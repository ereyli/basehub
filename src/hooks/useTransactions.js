import { useState, useRef, useCallback } from 'react'
import { useAccount, useWriteContract, useChainId } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useNetworkCheck } from './useNetworkCheck'
import { addXP, addBonusXP, recordTransaction } from '../utils/xpUtils'
import { getCurrentConfig, getContractAddress, GAS_CONFIG, GAME_CONFIG } from '../config/base'
import { getContractAddressByNetwork, NETWORKS, isNetworkSupported } from '../config/networks'
import { parseEther } from 'viem'
import { config } from '../config/wagmi'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { useQuestSystem } from './useQuestSystem'

export const useTransactions = () => {
  // Check if we're in web environment
  const isWeb = shouldUseRainbowKit()
  
  // Safely get Farcaster context - only if not in web environment
  let isInFarcaster = false
  if (!isWeb) {
    try {
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      // If FarcasterProvider is not available, default to false
      isInFarcaster = false
    }
  }
  const { address } = useAccount()
  const chainId = useChainId() // Use useChainId hook to ensure we always get the current chainId
  const { writeContractAsync, data: txData } = useWriteContract()
  const { isCorrectNetwork, networkName, currentNetworkConfig, switchToNetwork, supportedNetworks } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)
  
  // Use ref to prevent double popup - more reliable than state
  const isTransactionPendingRef = useRef(false)

  // Helper function to wait for transaction receipt with optimized polling for InkChain
  const waitForTxReceipt = async (txHash, timeoutDuration = 60000) => {
    // Always use wagmi's waitForTransactionReceipt - it handles RPC correctly
    // The manual polling was causing issues with RPC URL resolution
    try {
      return await Promise.race([
        waitForTransactionReceipt(config, {
          hash: txHash,
          chainId: chainId || NETWORKS.BASE.chainId, // Fallback to Base if chainId is undefined
          confirmations: chainId === NETWORKS.INKCHAIN.chainId ? 0 : 1, // 0 for InkChain, 1 for Base
          pollingInterval: chainId === NETWORKS.INKCHAIN.chainId ? 500 : 4000, // Faster for InkChain
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeoutDuration)
        )
      ])
    } catch (error) {
      // Suppress 405 errors from basehub.fun/h endpoint
      if (error?.message?.includes('405') || 
          error?.message?.includes('Method Not Allowed') ||
          error?.stack?.includes('basehub.fun/h')) {
        console.warn('⚠️ Transaction confirmation error suppressed:', error.message)
        throw new Error('Transaction confirmation timeout')
      }
      throw error
    }
  }
  const [error, setError] = useState(null)

  // Network validation and auto-switch function
  const validateAndSwitchNetwork = async () => {
    console.log('🔍 Validating network:', { chainId, isCorrectNetwork, networkName, currentNetworkConfig: currentNetworkConfig?.chainName })
    if (!isCorrectNetwork) {
      // Try to switch to a supported network (prefer Base, fallback to first supported)
      const targetNetwork = supportedNetworks[0] || NETWORKS.BASE
      console.log(`🔄 Wrong network detected! Switching from ${networkName} to ${targetNetwork.chainName}...`)
      try {
        await switchToNetwork(targetNetwork.chainId)
        console.log(`✅ Successfully switched to ${targetNetwork.chainName} network`)
        // Wait a moment for the network switch to complete
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Double-check network after switch
        const currentChainId = chainId
        if (!isNetworkSupported(currentChainId)) {
          throw new Error(`Still on wrong network (Chain ID: ${currentChainId}). Please manually switch to a supported network and try again.`)
        }
      } catch (switchError) {
        console.error('❌ Failed to switch network:', switchError)
        const supportedNames = Object.values(NETWORKS).map(n => n.chainName).join(', ')
        throw new Error(`❌ SUPPORTED NETWORK REQUIRED!\n\nYou are currently on ${networkName}.\nBaseHub works on: ${supportedNames}\n\nPlease switch to a supported network manually and try again.`)
      }
    }
  }
  
  // Get contract address for current network
  const getContractAddressForCurrentNetwork = (contractName) => {
    return getContractAddressByNetwork(contractName, chainId) || getContractAddress(contractName) // Fallback to Base
  }

  // Get game fee based on network
  // Base: 0.000005 ETH, InkChain/Soneium/Katana: 0.00002 ETH
  const getGameFee = () => {
    const isOnBase = chainId === NETWORKS.BASE.chainId
    return isOnBase ? parseEther('0.000005') : parseEther('0.00002')
  }

  // Get slot credit price based on network
  // Base: 0.000005 ETH, InkChain/Soneium/Katana: 0.00002 ETH
  const getSlotCreditPrice = () => {
    const isOnBase = chainId === NETWORKS.BASE.chainId
    return isOnBase ? parseEther('0.000005') : parseEther('0.00002')
  }

  const sendGMTransaction = useCallback(async (message = 'GM!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {
      console.log('🔍 GM Transaction - Network Info:', { 
        chainId, 
        chainName: currentNetworkConfig?.chainName,
        isCorrectNetwork,
        address 
      })
      const contractAddress = getContractAddressForCurrentNetwork('GM_GAME')
      console.log('📡 Contract address for GM_GAME:', contractAddress)
      console.log('📡 Sending GM transaction to blockchain...')
      
      // Send transaction to blockchain
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: [{
          name: 'sendGM',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'message', type: 'string' }]
        }],
        functionName: 'sendGM',
        args: [message],
        value: getGameFee(), // Network-specific fee (Base: 0.000005 ETH, InkChain: 0.00002 ETH)
      })
      
      console.log('✅ GM transaction sent! Hash:', txHash)
      
      // Award XP immediately after transaction is sent (don't wait for confirmation)
      // This ensures XP is awarded even if confirmation takes time or fails
      // Separate try-catch blocks to ensure XP is awarded even if transaction recording fails
      try {
        console.log('🎯 Awarding XP for GM transaction:', { address, chainId, chainName: currentNetworkConfig?.chainName })
        await addXP(address, 30, 'GM_GAME', chainId) // GM gives 30 XP
        console.log('✅ XP added successfully')
      } catch (xpError) {
        console.error('❌ Error adding XP:', xpError)
        // Don't throw - XP failure shouldn't block the transaction
      }
      
      // Record transaction separately (non-blocking)
      try {
        await recordTransaction({
          wallet_address: address,
          game_type: 'GM_GAME',
          xp_earned: 30,
          transaction_hash: txHash
        })
        console.log('✅ Transaction recorded')
      } catch (txError) {
        console.error('⚠️ Error recording transaction (non-critical):', txError)
        // Don't throw - transaction recording failure shouldn't block XP
      }
      
      // Update quest progress separately (non-blocking)
      try {
        await updateQuestProgress('gmUsed', 1)
        await updateQuestProgress('transactions', 1)
        console.log('✅ Quest progress updated')
      } catch (questError) {
        console.error('⚠️ Error updating quest progress (non-critical):', questError)
        // Don't throw - quest progress failure shouldn't block XP
      }
      
      // Try to wait for confirmation (non-blocking, for better UX)
      console.log('⏳ Waiting for transaction confirmation...')
      console.log('📋 Transaction hash:', txHash)
      
      try {
        // Wait for confirmation with timeout - use publicClient for proper network
        // Wait for confirmation using helper function
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
        
        const receipt = await waitForTxReceipt(txHash, timeoutDuration)
        
        console.log('✅ GM transaction confirmed!')
        console.log('📦 Receipt:', receipt)
        console.log('🔢 Block number:', receipt.blockNumber)
        console.log('⛽ Gas used:', receipt.gasUsed?.toString())
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        // XP already awarded, so we don't throw error - just log warning
        // For InkChain, transaction might still be processing, so we don't show error
      }
      
      // Clear any previous errors on success
      setError(null)
      
      return { 
        txHash,
        xpEarned: 30 
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001 // MetaMask user rejection code
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the GM transaction')
        setError(null)
        return null // Don't throw, just return null
      }
      
      console.error('❌ GM Transaction failed:', err)
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!errorMsg.includes('confirmation timeout')) {
        setError(err.message)
      }
      throw err
    }
  }, [address, chainId, currentNetworkConfig, isCorrectNetwork, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendGNTransaction = useCallback(async (message = 'GN!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {
      const contractAddress = getContractAddressForCurrentNetwork('GN_GAME')
      
      console.log('📡 Sending GN transaction to blockchain...')
      
      // Send transaction to blockchain
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: [{
          name: 'sendGN',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'message', type: 'string' }]
        }],
        functionName: 'sendGN',
        args: [message],
        value: getGameFee(), // Network-specific fee (Base: 0.000005 ETH, InkChain: 0.00002 ETH)
      })
      
      console.log('✅ GN transaction sent! Hash:', txHash)
      
      // Award XP immediately after transaction is sent
      // Separate try-catch blocks to ensure XP is awarded even if transaction recording fails
      try {
        console.log('🎯 Awarding XP for GN transaction:', { address, chainId, chainName: currentNetworkConfig?.chainName })
        await addXP(address, 30, 'GN_GAME', chainId) // GN gives 30 XP
        console.log('✅ XP added successfully')
      } catch (xpError) {
        console.error('❌ Error adding XP:', xpError)
        // Don't throw - XP failure shouldn't block the transaction
      }
      
      // Record transaction separately (non-blocking)
      try {
        await recordTransaction({
          wallet_address: address,
          game_type: 'GN_GAME',
          xp_earned: 30,
          transaction_hash: txHash
        })
        console.log('✅ Transaction recorded')
      } catch (txError) {
        console.error('⚠️ Error recording transaction (non-critical):', txError)
        // Don't throw - transaction recording failure shouldn't block XP
      }
      
      // Update quest progress separately (non-blocking)
      try {
        await updateQuestProgress('gnUsed', 1)
        await updateQuestProgress('transactions', 1)
        console.log('✅ Quest progress updated')
      } catch (questError) {
        console.error('⚠️ Error updating quest progress (non-critical):', questError)
        // Don't throw - quest progress failure shouldn't block XP
      }
      
      // Try to wait for confirmation (non-blocking)
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with optimized polling
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
        
        const receipt = await waitForTxReceipt(txHash, timeoutDuration)
        
        console.log('✅ GN transaction confirmed!', receipt)
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
      }
      
      // Clear any previous errors on success
      setError(null)
      
      return { 
        txHash,
        xpEarned: 30 
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001 // MetaMask user rejection code
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the GN transaction')
        setError(null)
        return null // Don't throw, just return null
      }
      
      console.error('❌ GN Transaction failed:', err)
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!errorMsg.includes('confirmation timeout')) {
        setError(err.message)
      }
      throw err
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendFlipTransaction = useCallback(async (selectedSide) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {

      const contractAddress = getContractAddressForCurrentNetwork('FLIP_GAME')
      
      // Encode the function call: playFlip(uint8 choice) where 0=Heads, 1=Tails
      const choice = selectedSide === 'heads' ? 0 : 1
      
      console.log('📡 Sending Flip transaction to blockchain...')
      
      // Send transaction to blockchain
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: [{
          name: 'playFlip',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'choice', type: 'uint8' }]
        }],
        functionName: 'playFlip',
        args: [choice],
        value: getGameFee(), // Network-specific fee (Base: 0.000005 ETH, InkChain: 0.00002 ETH)
      })
      
      console.log('✅ Flip transaction sent! Hash:', txHash)
      
      // Generate game result immediately (don't wait for confirmation)
      const actualResult = Math.random() < 0.5 ? 'heads' : 'tails'
      const playerWon = (selectedSide === 'heads' && actualResult === 'heads') || 
                       (selectedSide === 'tails' && actualResult === 'tails')
      
      console.log('🎲 Flip result:', { selectedSide, actualResult, playerWon })
      
      // Award XP immediately after transaction is sent
      // Separate try-catch blocks to ensure XP is awarded even if transaction recording fails
      try {
        console.log('🎯 Awarding XP for Flip transaction:', { address, chainId, chainName: currentNetworkConfig?.chainName, playerWon })
        await addBonusXP(address, 'flip', playerWon, chainId)
        console.log('✅ XP added successfully')
      } catch (xpError) {
        console.error('❌ Error adding XP:', xpError)
        // Don't throw - XP failure shouldn't block the transaction
      }
      
      const xpEarned = playerWon ? 60 + 500 : 60
      
      // Record transaction separately (non-blocking)
      try {
        await recordTransaction({
          wallet_address: address,
          game_type: 'FLIP_GAME',
          xp_earned: xpEarned,
          transaction_hash: txHash
        })
        console.log('✅ Transaction recorded')
      } catch (txError) {
        console.error('⚠️ Error recording transaction (non-critical):', txError)
        // Don't throw - transaction recording failure shouldn't block XP
      }
      
      // Update quest progress separately (non-blocking)
      try {
        await updateQuestProgress('coinFlipUsed', 1)
        await updateQuestProgress('transactions', 1)
        console.log('✅ Quest progress updated')
      } catch (questError) {
        console.error('⚠️ Error updating quest progress (non-critical):', questError)
        // Don't throw - quest progress failure shouldn't block XP
      }
      
      // Try to wait for confirmation (non-blocking)
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with optimized polling
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
        
        const receipt = await waitForTxReceipt(txHash, timeoutDuration)
        
        console.log('✅ Flip transaction confirmed!', receipt)
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
      }
      
      // Clear any previous errors on success
      setError(null)
      
      return { 
        txHash, 
        playerChoice: selectedSide, 
        result: actualResult, 
        isWin: playerWon,
        xpEarned: playerWon ? 560 : 60
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the Flip transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Flip Transaction failed:', err)
      if (!errorMsg.includes('confirmation timeout')) {
        setError(err.message)
      }
      throw err
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])


  const sendLuckyNumberTransaction = useCallback(async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {

      const contractAddress = getContractAddressForCurrentNetwork('LUCKY_NUMBER')
      
      console.log('📡 Sending Lucky Number transaction to blockchain...')
      
      // Send transaction to blockchain
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: [{
          name: 'guessLuckyNumber',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'guess', type: 'uint256' }]
        }],
        functionName: 'guessLuckyNumber',
        args: [guess],
        value: getGameFee(), // Network-specific fee (Base: 0.000005 ETH, InkChain: 0.00002 ETH)
      })
      
      console.log('✅ Lucky Number transaction sent! Hash:', txHash)
      
      // Generate game result immediately
      const winningNumber = Math.floor(Math.random() * 10) + 1
      const playerWon = guess === winningNumber
      
      console.log('🎲 Lucky Number result:', { guess, winningNumber, playerWon })
      
      // Award XP immediately after transaction is sent
      // Separate try-catch blocks to ensure XP is awarded even if transaction recording fails
      try {
        console.log('🎯 Awarding XP for Lucky Number transaction:', { address, chainId, chainName: currentNetworkConfig?.chainName, playerWon })
        await addBonusXP(address, 'luckynumber', playerWon, chainId)
        console.log('✅ XP added successfully')
      } catch (xpError) {
        console.error('❌ Error adding XP:', xpError)
        // Don't throw - XP failure shouldn't block the transaction
      }
      
      const xpEarned = playerWon ? 60 + 1000 : 60
      
      // Record transaction separately (non-blocking)
      try {
        await recordTransaction({
          wallet_address: address,
          game_type: 'LUCKY_NUMBER',
          xp_earned: xpEarned,
          transaction_hash: txHash
        })
        console.log('✅ Transaction recorded')
      } catch (txError) {
        console.error('⚠️ Error recording transaction (non-critical):', txError)
        // Don't throw - transaction recording failure shouldn't block XP
      }
      
      // Update quest progress separately (non-blocking)
      try {
        await updateQuestProgress('luckyNumberUsed', 1)
        await updateQuestProgress('transactions', 1)
        console.log('✅ Quest progress updated')
      } catch (questError) {
        console.error('⚠️ Error updating quest progress (non-critical):', questError)
        // Don't throw - quest progress failure shouldn't block XP
      }
      
      // Try to wait for confirmation (non-blocking)
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with optimized polling
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
        
        const receipt = await waitForTxReceipt(txHash, timeoutDuration)
        
        console.log('✅ Lucky Number transaction confirmed!', receipt)
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
      }
      
      // Clear any previous errors on success
      setError(null)
      
      return { 
        txHash, 
        playerGuess: guess, 
        winningNumber, 
        isWin: playerWon,
        xpEarned: playerWon ? 1060 : 60
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the Lucky Number transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Lucky Number Transaction failed:', err)
      if (!errorMsg.includes('confirmation timeout')) {
        setError(err.message)
      }
      throw err
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendDiceRollTransaction = useCallback(async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {

      const contractAddress = getContractAddressForCurrentNetwork('DICE_ROLL')
      
      console.log('📡 Sending Dice Roll transaction to blockchain...')
      
      // Send transaction to blockchain
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: [{
          name: 'rollDice',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'guess', type: 'uint256' }]
        }],
        functionName: 'rollDice',
        args: [guess],
        value: getGameFee(), // Network-specific fee (Base: 0.000005 ETH, InkChain: 0.00002 ETH)
      })
      
      console.log('✅ Dice Roll transaction sent! Hash:', txHash)
      
      // Generate game result immediately
      const dice1 = Math.floor(Math.random() * 6) + 1
      const dice2 = Math.floor(Math.random() * 6) + 1
      const diceTotal = dice1 + dice2
      const playerWon = guess === diceTotal
      
      console.log('🎲 Dice Roll result:', { guess, dice1, dice2, diceTotal, playerWon })
      
      // Award XP immediately after transaction is sent
      // Separate try-catch blocks to ensure XP is awarded even if transaction recording fails
      try {
        console.log('🎯 Awarding XP for Dice Roll transaction:', { address, chainId, chainName: currentNetworkConfig?.chainName, playerWon })
        await addBonusXP(address, 'diceroll', playerWon, chainId)
        console.log('✅ XP added successfully')
      } catch (xpError) {
        console.error('❌ Error adding XP:', xpError)
        // Don't throw - XP failure shouldn't block the transaction
      }
      
      const xpEarned = playerWon ? 60 + 1500 : 60
      
      // Record transaction separately (non-blocking)
      try {
        await recordTransaction({
          wallet_address: address,
          game_type: 'DICE_ROLL',
          xp_earned: xpEarned,
          transaction_hash: txHash
        })
        console.log('✅ Transaction recorded')
      } catch (txError) {
        console.error('⚠️ Error recording transaction (non-critical):', txError)
        // Don't throw - transaction recording failure shouldn't block XP
      }
      
      // Update quest progress separately (non-blocking)
      try {
        await updateQuestProgress('diceRollUsed', 1)
        await updateQuestProgress('transactions', 1)
        console.log('✅ Quest progress updated')
      } catch (questError) {
        console.error('⚠️ Error updating quest progress (non-critical):', questError)
        // Don't throw - quest progress failure shouldn't block XP
      }
      
      // Try to wait for confirmation (non-blocking)
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with optimized polling
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
        
        const receipt = await waitForTxReceipt(txHash, timeoutDuration)
        
        console.log('✅ Dice Roll transaction confirmed!', receipt)
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
      }
      
      // Clear any previous errors on success
      setError(null)
      
      return { 
        txHash, 
        playerGuess: guess, 
        dice1,
        dice2,
        diceTotal, 
        isWin: playerWon,
        xpEarned: playerWon ? 1560 : 60
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the Dice Roll transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Dice Roll Transaction failed:', err)
      if (!errorMsg.includes('confirmation timeout')) {
        setError(err.message)
      }
      throw err
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendSlotTransaction = useCallback(async (action, params = {}) => {
    if (!address) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {
      const contractAddress = getContractAddressForCurrentNetwork('SLOT_GAME')
      
      console.log('📡 Sending Slot transaction to blockchain...')
      
      let txHash
      let xpEarned = 60 // Base XP for slot
      
      if (action === 'purchaseCredits') {
        // Purchase credits
        const amount = params.amount || 10
        const creditPrice = getSlotCreditPrice()
        // Calculate total cost: amount * creditPrice
        const totalCost = BigInt(amount) * creditPrice
        
        txHash = await writeContractAsync({
          address: contractAddress,
          abi: [{
            name: 'purchaseCredits',
            type: 'function',
            stateMutability: 'payable',
            inputs: [{ name: 'amount', type: 'uint256' }]
          }],
          functionName: 'purchaseCredits',
          args: [amount],
          value: totalCost, // Network-specific credit price (Base: 0.000005 ETH, InkChain: 0.00002 ETH per credit)
        })
        
        console.log('✅ Credits purchase transaction sent! Hash:', txHash)
        
      } else if (action === 'spinSlot') {
        // Spin the slot
        txHash = await writeContractAsync({
          address: contractAddress,
          abi: [{
            name: 'spinSlot',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: []
          }],
          functionName: 'spinSlot',
          args: [],
          value: 0 // No ETH needed for spin
        })
        
        console.log('✅ Slot spin transaction sent! Hash:', txHash)
      }
      
      // Generate slot result immediately (don't wait for confirmation)
      if (action === 'spinSlot') {
          // Generate symbols using same logic as contract (0-3 for 4 crypto symbols)
          const symbols = [
            Math.floor(Math.random() * 4),
            Math.floor(Math.random() * 4),
            Math.floor(Math.random() * 4),
            Math.floor(Math.random() * 4)
          ]
          
          // Count symbol occurrences (same as contract logic)
          const symbolCounts = [0, 0, 0, 0] // 4 symbols
          symbols.forEach(symbol => {
            symbolCounts[symbol]++
          })
          
          console.log('🎰 Slot symbols:', symbols)
          console.log('🎰 Symbol counts:', symbolCounts)
          
          // Check for wins (same as contract logic)
          let won = false
          let bonusXp = 0
          let maxCount = 0
          
          for (let i = 0; i < 4; i++) {
            if (symbolCounts[i] >= 2) {
              won = true
              maxCount = Math.max(maxCount, symbolCounts[i])
              if (symbolCounts[i] === 2) {
                bonusXp = 100 // WIN_XP_2_MATCH
              } else if (symbolCounts[i] === 3) {
                bonusXp = 500 // WIN_XP_3_MATCH
              } else if (symbolCounts[i] === 4) {
                bonusXp = 2000 // WIN_XP_4_MATCH
              }
            }
          }
          
          console.log('🎰 Max count:', maxCount, 'Bonus XP:', bonusXp)
          
          xpEarned = 60 + bonusXp // BASE_XP + bonus
          
          // Award XP separately (non-blocking)
          try {
            console.log('🎯 Awarding XP for Slot transaction:', { address, chainId, chainName: currentNetworkConfig?.chainName, xpEarned })
            await addXP(address, xpEarned, 'SLOT_GAME', chainId)
            console.log('✅ XP added successfully')
          } catch (xpError) {
            console.error('❌ Error adding XP:', xpError)
            // Don't throw - XP failure shouldn't block the transaction
          }
          
          // Record transaction separately (non-blocking)
          try {
            await recordTransaction({
              wallet_address: address,
              game_type: 'SLOT_GAME',
              xp_earned: xpEarned,
              transaction_hash: txHash
            })
            console.log('✅ Transaction recorded')
          } catch (txError) {
            console.error('⚠️ Error recording transaction (non-critical):', txError)
            // Don't throw - transaction recording failure shouldn't block XP
          }
          
          // Update quest progress separately (non-blocking)
          try {
            await updateQuestProgress('slotUsed', 1)
            await updateQuestProgress('transactions', 1)
            console.log('✅ Quest progress updated')
          } catch (questError) {
            console.error('⚠️ Error updating quest progress (non-critical):', questError)
            // Don't throw - quest progress failure shouldn't block XP
          }
        
        // Try to wait for confirmation (non-blocking)
        console.log('⏳ Waiting for transaction confirmation...')
        try {
          // Wait for confirmation with optimized polling
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
          
          const receipt = await waitForTxReceipt(txHash, timeoutDuration)
          
          console.log('✅ Slot transaction confirmed!', receipt)
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        
        // Clear any previous errors on success
        setError(null)
        
        return {
          txHash,
          symbols,
          won,
          xpEarned
        }
      } else {
        // Credits purchase - award XP immediately
        // Award XP separately (non-blocking)
        try {
          console.log('🎯 Awarding XP for Slot credits purchase:', { address, chainId, chainName: currentNetworkConfig?.chainName })
          await addXP(address, 10, 'SLOT_GAME_CREDITS', chainId) // Small XP for purchasing credits
          console.log('✅ XP added successfully')
        } catch (xpError) {
          console.error('❌ Error adding XP:', xpError)
          // Don't throw - XP failure shouldn't block the transaction
        }
        
        // Record transaction separately (non-blocking)
        try {
          await recordTransaction({
            wallet_address: address,
            game_type: 'SLOT_GAME_CREDITS',
            xp_earned: 10,
            transaction_hash: txHash
          })
          console.log('✅ Transaction recorded')
        } catch (txError) {
          console.error('⚠️ Error recording transaction (non-critical):', txError)
          // Don't throw - transaction recording failure shouldn't block XP
        }
        
        // Update quest progress separately (non-blocking)
        try {
          await updateQuestProgress('transactions', 1)
          console.log('✅ Quest progress updated')
        } catch (questError) {
          console.error('⚠️ Error updating quest progress (non-critical):', questError)
          // Don't throw - quest progress failure shouldn't block XP
        }
        
        // Try to wait for confirmation (non-blocking)
        console.log('⏳ Waiting for transaction confirmation...')
        try {
          // Wait for confirmation with optimized polling
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          const timeoutDuration = isOnInkChain ? 120000 : 60000 // 120 seconds for InkChain, 60 for Base
          
          const receipt = await waitForTxReceipt(txHash, timeoutDuration)
          
          console.log('✅ Slot credits purchase confirmed!', receipt)
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        
        // Clear any previous errors on success
        setError(null)
        
        return {
          txHash,
          creditsPurchased: params.amount,
          xpEarned: 10
        }
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the Slot transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Slot Transaction failed:', err)
      if (!errorMsg.includes('confirmation timeout')) {
        setError(err.message)
      }
      throw err
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getSlotCreditPrice])

  const sendCustomTransaction = useCallback(async (contractAddressParam, functionData, value = '0') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {
      
      // For custom transactions, we need to use sendTransaction from Wagmi
      // since we don't have ABI information
      const { sendTransaction } = await import('wagmi/actions')
      const { config } = await import('../config/wagmi')
      
      const result = await sendTransaction(config, {
        to: contractAddressParam,
        data: functionData,
        value: BigInt(value),
      })
      
      // Notification disabled due to Farcaster SDK issues
      console.log('✅ Custom transaction completed successfully!')

      return result
    } catch (err) {
      isTransactionPendingRef.current = false
      setIsLoading(false)
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsg = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsg.includes('user rejected') || 
                              errorMsg.includes('user denied') || 
                              errorMsg.includes('rejected the request') ||
                              errorMsg.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the Custom transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Custom Transaction failed:', err)
      setError(err.message)
      throw err
    }
  }, [address, validateAndSwitchNetwork])

  return {
    isLoading,
    error,
    sendGMTransaction,
    sendGNTransaction,
    sendFlipTransaction,
    sendLuckyNumberTransaction,
    sendDiceRollTransaction,
    sendSlotTransaction,
    sendCustomTransaction,
  }
}
