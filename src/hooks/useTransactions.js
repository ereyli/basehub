import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
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
  const { address, chainId } = useAccount()
  const { writeContractAsync, data: txData } = useWriteContract()
  const { isCorrectNetwork, networkName, currentNetworkConfig, switchToNetwork, supportedNetworks } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)

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
    if (!isCorrectNetwork) {
      // Try to switch to a supported network (prefer Base, fallback to InkChain)
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
        throw new Error(`❌ SUPPORTED NETWORK REQUIRED!\n\nYou are currently on ${networkName}.\nBaseHub works on Base or InkChain networks.\n\nPlease switch to a supported network manually and try again.`)
      }
    }
  }
  
  // Get contract address for current network
  const getContractAddressForCurrentNetwork = (contractName) => {
    return getContractAddressByNetwork(contractName, chainId) || getContractAddress(contractName) // Fallback to Base
  }

  // Get game fee based on network
  // Base: 0.000005 ETH, InkChain: 0.00002 ETH
  const getGameFee = () => {
    const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
    return isOnInkChain ? parseEther('0.00002') : parseEther('0.000005')
  }

  // Get slot credit price based on network
  // Base: 0.000005 ETH, InkChain: 0.00002 ETH
  const getSlotCreditPrice = () => {
    const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
    return isOnInkChain ? parseEther('0.00002') : parseEther('0.000005')
  }

  const sendGMTransaction = async (message = 'GM!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

    try {
      const contractAddress = getContractAddressForCurrentNetwork('GM_GAME')
      
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
      try {
        await addXP(address, 30) // GM gives 30 XP
        await recordTransaction(address, 'GM_GAME', 30, txHash) // Record transaction
        await updateQuestProgress('gmUsed', 1) // Update quest progress
        await updateQuestProgress('transactions', 1) // Update transaction count
        console.log('✅ XP added, transaction recorded, and quest progress updated')
      } catch (xpError) {
        console.error('Error adding XP, recording transaction, or updating quest progress:', xpError)
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
      console.error('❌ Transaction failed:', err)
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!err.message?.includes('confirmation timeout') && !err.message?.includes('Confirmation timeout')) {
        setError(err.message)
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendGNTransaction = async (message = 'GN!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

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
      try {
        await addXP(address, 30) // GN gives 30 XP
        await recordTransaction(address, 'GN_GAME', 30, txHash) // Record transaction
        await updateQuestProgress('gnUsed', 1) // Update quest progress
        await updateQuestProgress('transactions', 1) // Update transaction count
        console.log('✅ XP added, transaction recorded, and quest progress updated')
      } catch (xpError) {
        console.error('Error adding XP, recording transaction, or updating quest progress:', xpError)
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
      console.error('❌ Transaction failed:', err)
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!err.message?.includes('confirmation timeout') && !err.message?.includes('Confirmation timeout')) {
        setError(err.message)
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendFlipTransaction = async (selectedSide) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

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
      try {
        await addBonusXP(address, 'flip', playerWon)
        const xpEarned = playerWon ? 60 + 500 : 60
        await recordTransaction(address, 'FLIP_GAME', xpEarned, txHash) // Record transaction
        await updateQuestProgress('coinFlipUsed', 1) // Update quest progress
        await updateQuestProgress('transactions', 1) // Update transaction count
        console.log(`✅ XP added, transaction recorded, and quest progress updated: ${xpEarned} (${playerWon ? 'WIN' : 'LOSS'})`)
      } catch (xpError) {
        console.error('Error adding XP, recording transaction, or updating quest progress:', xpError)
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
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!err.message?.includes('confirmation timeout') && !err.message?.includes('Confirmation timeout')) {
        setError(err.message)
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }


  const sendLuckyNumberTransaction = async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

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
      try {
        await addBonusXP(address, 'luckynumber', playerWon)
        const xpEarned = playerWon ? 60 + 1000 : 60
        await recordTransaction(address, 'LUCKY_NUMBER', xpEarned, txHash) // Record transaction
        await updateQuestProgress('luckyNumberUsed', 1) // Update quest progress
        await updateQuestProgress('transactions', 1) // Update transaction count
        console.log(`✅ XP added, transaction recorded, and quest progress updated: ${xpEarned} (${playerWon ? 'WIN' : 'LOSS'})`)
      } catch (xpError) {
        console.error('Error adding XP, recording transaction, or updating quest progress:', xpError)
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
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!err.message?.includes('confirmation timeout') && !err.message?.includes('Confirmation timeout')) {
        setError(err.message)
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendDiceRollTransaction = async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

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
      try {
        await addBonusXP(address, 'diceroll', playerWon)
        const xpEarned = playerWon ? 60 + 1500 : 60
        await recordTransaction(address, 'DICE_ROLL', xpEarned, txHash) // Record transaction
        await updateQuestProgress('diceRollUsed', 1) // Update quest progress
        await updateQuestProgress('transactions', 1) // Update transaction count
        console.log(`✅ XP added, transaction recorded, and quest progress updated: ${xpEarned} (${playerWon ? 'WIN' : 'LOSS'})`)
      } catch (xpError) {
        console.error('Error adding XP, recording transaction, or updating quest progress:', xpError)
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
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!err.message?.includes('confirmation timeout') && !err.message?.includes('Confirmation timeout')) {
        setError(err.message)
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendSlotTransaction = async (action, params = {}) => {
    if (!address) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

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
          
          try {
            await addXP(address, xpEarned)
            await recordTransaction(address, 'SLOT_GAME', xpEarned, txHash)
            await updateQuestProgress('slotUsed', 1)
            await updateQuestProgress('transactions', 1)
            console.log(`✅ XP added, transaction recorded, and quest progress updated: ${xpEarned} (${won ? 'WIN' : 'LOSS'})`)
        } catch (xpError) {
          console.error('Error adding XP, recording transaction, or updating quest progress:', xpError)
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
        try {
          await addXP(address, 10) // Small XP for purchasing credits
          await recordTransaction(address, 'SLOT_GAME_CREDITS', 10, txHash)
          await updateQuestProgress('transactions', 1)
          console.log('✅ XP added for credit purchase')
        } catch (xpError) {
          console.error('Error adding XP for credit purchase:', xpError)
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
      // Only set error for actual transaction failures, not confirmation timeouts
      if (!err.message?.includes('confirmation timeout') && !err.message?.includes('Confirmation timeout')) {
        setError(err.message)
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendCustomTransaction = async (contractAddress, functionData, value = '0') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

    try {
      
      // For custom transactions, we need to use sendTransaction from Wagmi
      // since we don't have ABI information
      const { sendTransaction } = await import('wagmi/actions')
      const { config } = await import('../config/wagmi')
      
      const result = await sendTransaction(config, {
        to: contractAddress,
        data: functionData,
        value: BigInt(value),
      })
      
      // Notification disabled due to Farcaster SDK issues
      console.log('✅ Custom transaction completed successfully!')

      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

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
