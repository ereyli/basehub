import { useState, useRef, useCallback } from 'react'
import { useAccount, useWriteContract, useChainId, usePublicClient } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useNetworkCheck } from './useNetworkCheck'
import { addXP, addBonusXP, shouldAwardXPOnHashOnly } from '../utils/xpUtils'
import { getCurrentConfig, getContractAddress, GAS_CONFIG, GAME_CONFIG } from '../config/base'
import { getContractAddressByNetwork, NETWORKS, isNetworkSupported } from '../config/networks'
import { parseEther, formatEther } from 'viem'
import { config, DATA_SUFFIX } from '../config/wagmi'
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
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId })
  const { writeContractAsync } = useWriteContract()
  const { isCorrectNetwork, networkName, currentNetworkConfig, switchToNetwork, supportedNetworks } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)
  
  const isTransactionPendingRef = useRef(false)

  // Web: receipt için max bekleme. Base/Farcaster: XP zaten hash ile verildi, receipt opsiyonel
  const UI_MAX_WAIT_MS = 7000

  // Helper function to wait for transaction receipt with optimized polling for InkChain
  const waitForTxReceipt = async (txHash, timeoutDuration = 60000) => {
    const receiptPromise = (async () => {
      try {
        return await Promise.race([
          waitForTransactionReceipt(config, {
            hash: txHash,
            chainId: chainId || NETWORKS.BASE.chainId,
            confirmations: chainId === NETWORKS.INKCHAIN.chainId ? 0 : 1,
            pollingInterval: chainId === NETWORKS.INKCHAIN.chainId ? 500 : 4000,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeoutDuration)
          )
        ])
      } catch (error) {
        if (error?.message?.includes('405') || error?.message?.includes('Method Not Allowed') || error?.stack?.includes('basehub.fun/h')) {
          console.warn('⚠️ Transaction confirmation error suppressed:', error.message)
          throw new Error('Transaction confirmation timeout')
        }
        throw error
      }
    })()

    // Never block UI longer than UI_MAX_WAIT_MS (Base app often hangs on RPC)
    return await Promise.race([
      receiptPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), UI_MAX_WAIT_MS)
      )
    ])
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
  // Base + all networks: 0.00002 ETH
  const getGameFee = () => {
    return parseEther('0.00002')
  }

  // SlotGame ABI for reading CREDIT_PRICE and simulating purchaseCredits
  const SLOT_GAME_ABI = [
    { name: 'CREDIT_PRICE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'purchaseCredits', type: 'function', stateMutability: 'payable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }
  ]
  // Get slot credit price from chain when possible, else fallback to match SlotGame.sol (0.00002 ether)
  const getSlotCreditPrice = useCallback(async (contractAddress) => {
    if (publicClient && contractAddress) {
      try {
        const price = await publicClient.readContract({
          address: contractAddress,
          abi: SLOT_GAME_ABI,
          functionName: 'CREDIT_PRICE'
        })
        return BigInt(price)
      } catch (e) {
        console.warn('Could not read CREDIT_PRICE from contract, using 0.00002:', e?.message)
      }
    }
    return parseEther('0.00002')
  }, [publicClient])

  const sendGMTransaction = useCallback(async (message = 'GM!') => {
    if (!address) {
      throw new Error('Wallet not connected')
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
        value: getGameFee(), // 0.00002 ETH fee
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      console.log('✅ GM transaction sent! Hash:', txHash)
      
      // Base app / Farcaster (fcbe2b0 yapısı): hash alır almaz XP + quest, receipt arka planda
      if (shouldAwardXPOnHashOnly()) {
        try { await addXP(address, 150, 'GM_GAME', chainId, false, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('gmUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
          console.log('✅ GM transaction confirmed!')
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        setError(null)
        return { txHash, xpEarned: 30 }
      }
      
      // Web: önce receipt bekle, sonra XP
      console.log('⏳ Waiting for confirmation before awarding XP...')
      try {
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000
        await waitForTxReceipt(txHash, timeoutDuration)
        console.log('✅ GM transaction confirmed!')
        try { await addXP(address, 150, 'GM_GAME', chainId, false, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('gmUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        try { await addXP(address, 150, 'GM_GAME', chainId, false, txHash) } catch (_) {}
        try { await updateQuestProgress('gmUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      }
      setError(null)
      return { txHash, xpEarned: 30 }
    } catch (err) {
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
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId, currentNetworkConfig, isCorrectNetwork, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendGNTransaction = useCallback(async (message = 'GN!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {
      const contractAddress = getContractAddressForCurrentNetwork('GN_GAME')
      
      console.log('📡 Sending GN transaction to blockchain...')
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
        value: getGameFee(), // 0.00002 ETH fee
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      console.log('✅ GN transaction sent! Hash:', txHash)
      if (shouldAwardXPOnHashOnly()) {
        try { await addXP(address, 150, 'GN_GAME', chainId, false, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('gnUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
          console.log('✅ GN transaction confirmed!')
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        setError(null)
        return { txHash, xpEarned: 30 }
      }
      console.log('⏳ Waiting for confirmation before awarding XP...')
      try {
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000
        await waitForTxReceipt(txHash, timeoutDuration)
        console.log('✅ GN transaction confirmed!')
        try { await addXP(address, 150, 'GN_GAME', chainId, false, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('gnUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        try { await addXP(address, 150, 'GN_GAME', chainId, false, txHash) } catch (_) {}
        try { await updateQuestProgress('gnUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      }
      setError(null)
      return { txHash, xpEarned: 30 }
    } catch (err) {
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
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendFlipTransaction = useCallback(async (selectedSide) => {
    if (!address) {
      throw new Error('Wallet not connected')
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
        value: getGameFee(), // 0.00002 ETH fee
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      console.log('✅ Flip transaction sent! Hash:', txHash)
      const actualResult = Math.random() < 0.5 ? 'heads' : 'tails'
      const playerWon = (selectedSide === 'heads' && actualResult === 'heads') || 
                       (selectedSide === 'tails' && actualResult === 'tails')
      console.log('🎲 Flip result:', { selectedSide, actualResult, playerWon })
      if (shouldAwardXPOnHashOnly()) {
        try { await addBonusXP(address, 'flip', playerWon, chainId, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('coinFlipUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
          console.log('✅ Flip transaction confirmed!')
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        setError(null)
        return { txHash, playerChoice: selectedSide, result: actualResult, isWin: playerWon, xpEarned: playerWon ? 560 : 60 }
      }
      console.log('⏳ Waiting for confirmation before awarding XP...')
      try {
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000
        await waitForTxReceipt(txHash, timeoutDuration)
        console.log('✅ Flip transaction confirmed!')
        try { await addBonusXP(address, 'flip', playerWon, chainId, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('coinFlipUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        try { await addBonusXP(address, 'flip', playerWon, chainId, txHash) } catch (_) {}
        try { await updateQuestProgress('coinFlipUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      }
      setError(null)
      return { txHash, playerChoice: selectedSide, result: actualResult, isWin: playerWon, xpEarned: playerWon ? 560 : 60 }
    } catch (err) {
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
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])


  const sendLuckyNumberTransaction = useCallback(async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {

      const contractAddress = getContractAddressForCurrentNetwork('LUCKY_NUMBER')
      
      console.log('📡 Sending Lucky Number transaction to blockchain...')
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
        value: getGameFee(), // 0.00002 ETH fee
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      console.log('✅ Lucky Number transaction sent! Hash:', txHash)
      const winningNumber = Math.floor(Math.random() * 10) + 1
      const playerWon = guess === winningNumber
      console.log('🎲 Lucky Number result:', { guess, winningNumber, playerWon })
      if (shouldAwardXPOnHashOnly()) {
        try { await addBonusXP(address, 'luckynumber', playerWon, chainId, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('luckyNumberUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
          console.log('✅ Lucky Number transaction confirmed!')
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        setError(null)
        return { txHash, playerGuess: guess, winningNumber, isWin: playerWon, xpEarned: playerWon ? 1060 : 60 }
      }
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000
        await waitForTxReceipt(txHash, timeoutDuration)
        console.log('✅ Lucky Number transaction confirmed!')
        try { await addBonusXP(address, 'luckynumber', playerWon, chainId, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('luckyNumberUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        try { await addBonusXP(address, 'luckynumber', playerWon, chainId, txHash) } catch (_) {}
        try { await updateQuestProgress('luckyNumberUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
      }
      setError(null)
      return { txHash, playerGuess: guess, winningNumber, isWin: playerWon, xpEarned: playerWon ? 1060 : 60 }
    } catch (err) {
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
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendDiceRollTransaction = useCallback(async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)
    isTransactionPendingRef.current = true

    try {

      const contractAddress = getContractAddressForCurrentNetwork('DICE_ROLL')
      
      console.log('📡 Sending Dice Roll transaction to blockchain...')
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
        value: getGameFee(), // 0.00002 ETH fee
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      console.log('✅ Dice Roll transaction sent! Hash:', txHash)
      const dice1 = Math.floor(Math.random() * 6) + 1
      const dice2 = Math.floor(Math.random() * 6) + 1
      const diceTotal = dice1 + dice2
      const playerWon = guess === diceTotal
      console.log('🎲 Dice Roll result:', { guess, dice1, dice2, diceTotal, playerWon })
      if (shouldAwardXPOnHashOnly()) {
        try { await addBonusXP(address, 'diceroll', playerWon, chainId, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
        try { await updateQuestProgress('diceRollUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
          console.log('✅ Dice Roll transaction confirmed!')
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
        }
        setError(null)
        return { txHash, playerGuess: guess, dice1, dice2, diceTotal, isWin: playerWon, xpEarned: playerWon ? 1560 : 60 }
      }
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000
        await waitForTxReceipt(txHash, timeoutDuration)
        console.log('✅ Dice Roll transaction confirmed!')
        try {
          await addBonusXP(address, 'diceroll', playerWon, chainId, txHash)
          console.log('✅ XP added successfully')
        } catch (xpError) {
          console.error('❌ Error adding XP:', xpError)
        }
        try {
          await updateQuestProgress('diceRollUsed', 1)
          await updateQuestProgress('transactions', 1)
        } catch (questError) {
          console.error('⚠️ Quest progress error (non-critical):', questError)
        }
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout (e.g. Base app):', confirmError.message)
        try {
          await addBonusXP(address, 'diceroll', playerWon, chainId, txHash)
          await updateQuestProgress('diceRollUsed', 1)
          await updateQuestProgress('transactions', 1)
        } catch (_) {}
      }
      setError(null)
      return { txHash, playerGuess: guess, dice1, dice2, diceTotal, isWin: playerWon, xpEarned: playerWon ? 1560 : 60 }
    } catch (err) {
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
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getGameFee])

  const sendSlotTransaction = useCallback(async (action, params = {}) => {
    if (!address) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
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
      let xpEarned = 150 // Base XP for slot
      
      if (action === 'purchaseCredits') {
        // 1) Read CREDIT_PRICE from contract so UI always matches deployed contract
        const amount = Number(params.amount) || 10
        const amountBn = BigInt(amount)
        const creditPrice = await getSlotCreditPrice(contractAddress)
        const totalCost = amountBn * creditPrice

        // 2) Simulate to avoid sending a tx that will revert (e.g. "Payment transfer failed" if owner rejects ETH)
        if (publicClient) {
          try {
            await publicClient.simulateContract({
              account: address,
              address: contractAddress,
              abi: SLOT_GAME_ABI,
              functionName: 'purchaseCredits',
              args: [amountBn],
              value: totalCost
            })
          } catch (simErr) {
            const msg = (simErr?.message || simErr?.shortMessage || String(simErr)).toLowerCase()
            if (msg.includes('payment transfer failed') || msg.includes('payment transfer')) {
              throw new Error('Credit purchase would fail: the slot contract cannot send ETH to its owner on this network. Please try another network or contact support.')
            }
            if (msg.includes('insufficient eth') || msg.includes('insufficient eth for credits')) {
              throw new Error(`Insufficient ETH. For ${amount} credits you need ${formatEther(totalCost)} ETH (contract price: ${formatEther(creditPrice)} per credit).`)
            }
            throw simErr
          }
        }

        const gasLimit = 500000n
        txHash = await writeContractAsync({
          address: contractAddress,
          abi: SLOT_GAME_ABI,
          functionName: 'purchaseCredits',
          args: [amountBn],
          value: totalCost,
          gas: gasLimit,
          dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
        })
        console.log('✅ Credits purchase transaction sent! Hash:', txHash)
      } else if (action === 'spinSlot') {
        const spinGasLimit = 250000n
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
          value: 0n, // No ETH needed for spin
          gas: spinGasLimit,
          dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
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
          
          xpEarned = 150 + bonusXp // Base XP + bonus
          if (shouldAwardXPOnHashOnly()) {
            try { await addXP(address, xpEarned, 'SLOT_GAME', chainId, false, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
            try { await updateQuestProgress('slotUsed', 1); await updateQuestProgress('transactions', 1) } catch (_) {}
            try {
              const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
              await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
              console.log('✅ Slot transaction confirmed!')
            } catch (confirmError) {
              console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
            }
            setError(null)
            return { txHash, symbols, won, xpEarned }
          }
          console.log('⏳ Waiting for transaction confirmation...')
          try {
            const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
            const timeoutDuration = isOnInkChain ? 120000 : 60000
            const receipt = await waitForTxReceipt(txHash, timeoutDuration)
            console.log('✅ Slot transaction confirmed!', receipt)
            try {
              await addXP(address, xpEarned, 'SLOT_GAME', chainId, false, txHash)
              console.log('✅ XP added successfully')
            } catch (xpError) {
              console.error('❌ Error adding XP:', xpError)
            }
            try {
              await updateQuestProgress('slotUsed', 1)
              await updateQuestProgress('transactions', 1)
            } catch (questError) {
              console.error('⚠️ Quest progress error (non-critical):', questError)
            }
          } catch (confirmError) {
            console.warn('⚠️ Confirmation timeout (e.g. Base app):', confirmError.message)
            try {
              await addXP(address, xpEarned, 'SLOT_GAME', chainId, false, txHash)
              await updateQuestProgress('slotUsed', 1)
              await updateQuestProgress('transactions', 1)
            } catch (_) {}
          }
          setError(null)
          return { txHash, symbols, won, xpEarned }
      } else {
        // Credits purchase
        if (shouldAwardXPOnHashOnly()) {
          try { await addXP(address, 10, 'SLOT_GAME_CREDITS', chainId, false, txHash) } catch (xpError) { console.error('❌ Error adding XP:', xpError) }
          try { await updateQuestProgress('transactions', 1) } catch (_) {}
          try {
            const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
            await waitForTxReceipt(txHash, isOnInkChain ? 120000 : 60000)
            console.log('✅ Slot credits purchase confirmed!')
          } catch (confirmError) {
            console.warn('⚠️ Confirmation timeout (but XP already awarded):', confirmError.message)
          }
          setError(null)
          return { txHash, creditsPurchased: params.amount, xpEarned: 10 }
        }
        console.log('⏳ Waiting for transaction confirmation...')
        let receipt
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          const timeoutDuration = isOnInkChain ? 120000 : 60000
          receipt = await waitForTxReceipt(txHash, timeoutDuration)
        } catch (confirmError) {
          console.warn('⚠️ Confirmation timeout (e.g. Base app):', confirmError.message)
          try {
            await addXP(address, 10, 'SLOT_GAME_CREDITS', chainId, false, txHash)
            await updateQuestProgress('transactions', 1)
          } catch (_) {}
          setError(null)
          return { txHash, creditsPurchased: params.amount, xpEarned: 10 }
        }
        if (receipt?.status !== 'success') {
          console.error('❌ Slot credits purchase reverted', receipt)
          throw new Error('Transaction reverted. Credits were not added.')
        }
        console.log('✅ Slot credits purchase confirmed!', receipt)
        
        // Award XP after confirmation (verified via tx receipt)
        try {
          console.log('🎯 Awarding XP for Slot credits purchase:', { address, chainId, chainName: currentNetworkConfig?.chainName })
          await addXP(address, 10, 'SLOT_GAME_CREDITS', chainId, false, txHash)
          console.log('✅ XP added successfully')
        } catch (xpError) {
          console.error('❌ Error adding XP:', xpError)
        }
        
        try {
          await updateQuestProgress('transactions', 1)
          console.log('✅ Quest progress updated')
        } catch (questError) {
          console.error('⚠️ Quest progress error (non-critical):', questError)
        }

        setError(null)
        return {
          txHash,
          creditsPurchased: params.amount,
          xpEarned: 10
        }
      }
    } catch (err) {
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

      // Surface contract revert reasons for credit purchase
      let throwMsg = err.message
      if (action === 'purchaseCredits') {
        if (errorMsg.includes('insufficient eth') || errorMsg.includes('insufficient eth for credits')) {
          throwMsg = 'Insufficient ETH sent. Each credit costs 0.00002 ETH. Send at least (amount × 0.00002) ETH.'
        } else if (errorMsg.includes('payment transfer failed')) {
          throwMsg = 'Credit purchase failed: payment to contract owner failed. Try again or contact support.'
        } else if (errorMsg.includes('revert') || errorMsg.includes('execution reverted')) {
          throwMsg = throwMsg || 'Transaction reverted on-chain. Ensure you have enough ETH (0.00002 per credit) and are on the correct network.'
        }
      }

      console.error('❌ Slot Transaction failed:', err)
      if (!errorMsg.includes('confirmation timeout')) {
        setError(throwMsg)
      }
      throw new Error(throwMsg)
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId, currentNetworkConfig, writeContractAsync, updateQuestProgress, validateAndSwitchNetwork, getContractAddressForCurrentNetwork, getSlotCreditPrice, publicClient])

  const sendCustomTransaction = useCallback(async (contractAddressParam, functionData, value = '0') => {
    if (!address) {
      throw new Error('Wallet not connected')
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
    } finally {
      isTransactionPendingRef.current = false
      setIsLoading(false)
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
