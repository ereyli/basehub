import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { useFarcaster } from '../contexts/FarcasterContext'
import { addXP, addBonusXP, recordTransaction } from '../utils/xpUtils'
import { getCurrentConfig, getContractAddress, GAS_CONFIG, GAME_CONFIG } from '../config/base'
import { parseEther } from 'viem'
import { config } from '../config/wagmi'

export const useTransactions = () => {
  const { isInFarcaster } = useFarcaster()
  const { address, chainId } = useAccount()
  const { writeContractAsync, data: txData } = useWriteContract()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Farcaster-only app - no need for provider checks

  const sendGMTransaction = async (message = 'GM!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const contractAddress = getContractAddress('GM_GAME')
      
      console.log('📡 Sending GM transaction to blockchain...')
      
      // Send transaction to blockchain
      const txHash = await writeContractAsyncAsync({
        address: contractAddress,
        abi: [{
          name: 'sendGM',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'message', type: 'string' }]
        }],
        functionName: 'sendGM',
        args: [message],
        value: parseEther('0.000005'), // 0.000005 ETH fee
      })
      
      console.log('✅ GM transaction sent! Hash:', txHash)
      
      // Even in Farcaster, wait for at least some confirmation
      console.log('⏳ Waiting for transaction confirmation...')
      console.log('📋 Transaction hash:', txHash)
      console.log('⏰ Will wait up to 30 seconds for confirmation...')
      
      try {
        // Wait for confirmation with timeout for better UX
        const receipt = await Promise.race([
          waitForTransactionReceipt(config, {
            hash: txHash,
            confirmations: 1,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000) // 30 seconds
          )
        ])
        
        console.log('✅ GM transaction confirmed!')
        console.log('📦 Receipt:', receipt)
        console.log('🔢 Block number:', receipt.blockNumber)
        console.log('⛽ Gas used:', receipt.gasUsed?.toString())
        
        try {
          await addXP(address, 10) // GM gives 10 XP
          await recordTransaction(address, 'GM_GAME', 10, txHash) // Record transaction
          console.log('✅ XP added and transaction recorded after confirmation')
        } catch (xpError) {
          console.error('Error adding XP or recording transaction:', xpError)
        }
        
        return { 
          txHash,
          xpEarned: 10 
        }
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        // Don't award XP if confirmation fails
        throw new Error('Transaction confirmation failed - please try again')
      }
    } catch (err) {
      console.error('❌ Transaction failed:', err)
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendGNTransaction = async (message = 'GN!') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const contractAddress = getContractAddress('GN_GAME')
      
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
        value: parseEther('0.000005'), // 0.000005 ETH fee
      })
      
      console.log('✅ GN transaction sent! Hash:', txHash)
      
      // Wait for transaction confirmation
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with shorter timeout for better UX
        const receipt = await Promise.race([
          waitForTransactionReceipt(config, {
            hash: txHash,
            confirmations: 1,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000) // 30 seconds
          )
        ])
        
        console.log('✅ GN transaction confirmed!', receipt)
        
        try {
          await addXP(address, 10) // GN gives 10 XP
          await recordTransaction(address, 'GN_GAME', 10, txHash) // Record transaction
          console.log('✅ XP added and transaction recorded after confirmation')
        } catch (xpError) {
          console.error('Error adding XP or recording transaction:', xpError)
        }
        
        return { 
          txHash,
          xpEarned: 10 
        }
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        // Don't award XP if confirmation fails
        throw new Error('Transaction confirmation failed - please try again')
      }
    } catch (err) {
      console.error('❌ Transaction failed:', err)
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendFlipTransaction = async (selectedSide) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {

      const contractAddress = getContractAddress('FLIP_GAME')
      
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
        value: parseEther('0.000005'), // 0.000005 ETH fee
      })
      
      console.log('✅ Flip transaction sent! Hash:', txHash)
      
      // Wait for transaction confirmation before generating results
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          waitForTransactionReceipt(config, {
            hash: txHash,
            confirmations: 1,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000) // 30 seconds
          )
        ])
        
        console.log('✅ Flip transaction confirmed!', receipt)
        
        // ONLY NOW generate game result after confirmation
        const actualResult = Math.random() < 0.5 ? 'heads' : 'tails'
        const playerWon = (selectedSide === 'heads' && actualResult === 'heads') || 
                         (selectedSide === 'tails' && actualResult === 'tails')
        
        console.log('🎲 Flip result AFTER confirmation:', { selectedSide, actualResult, playerWon })
        
               try {
                 await addBonusXP(address, 'flip', playerWon)
                 const xpEarned = playerWon ? 10 + 500 : 10
                 await recordTransaction(address, 'FLIP_GAME', xpEarned, txHash) // Record transaction
                 console.log(`✅ XP added and transaction recorded: ${xpEarned} (${playerWon ? 'WIN' : 'LOSS'})`)
               } catch (xpError) {
                 console.error('Error adding XP or recording transaction:', xpError)
               }
        
        return { 
          txHash, 
          playerChoice: selectedSide, 
          result: actualResult, 
          isWin: playerWon,
          xpEarned: playerWon ? 510 : 10
        }
        
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        // Don't generate results if confirmation fails
        throw new Error('Transaction confirmation failed - please try again')
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }


  const sendLuckyNumberTransaction = async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {

      const contractAddress = getContractAddress('LUCKY_NUMBER')
      
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
        value: parseEther('0.000005'), // 0.000005 ETH fee
      })
      
      console.log('✅ Lucky Number transaction sent! Hash:', txHash)
      
      // Wait for transaction confirmation before generating results
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          waitForTransactionReceipt(config, {
            hash: txHash,
            confirmations: 1,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000) // 30 seconds
          )
        ])
        
        console.log('✅ Lucky Number transaction confirmed!', receipt)
        
        // ONLY NOW generate game result after confirmation
        const winningNumber = Math.floor(Math.random() * 10) + 1
        const playerWon = guess === winningNumber
        
        console.log('🎲 Lucky Number result AFTER confirmation:', { guess, winningNumber, playerWon })
        
               try {
                 await addBonusXP(address, 'luckynumber', playerWon)
                 const xpEarned = playerWon ? 10 + 1000 : 10
                 await recordTransaction(address, 'LUCKY_NUMBER', xpEarned, txHash) // Record transaction
                 console.log(`✅ XP added and transaction recorded: ${xpEarned} (${playerWon ? 'WIN' : 'LOSS'})`)
               } catch (xpError) {
                 console.error('Error adding XP or recording transaction:', xpError)
               }
        
        return { 
          txHash, 
          playerGuess: guess, 
          winningNumber, 
          isWin: playerWon,
          xpEarned: playerWon ? 1010 : 10
        }
        
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        // Don't generate results if confirmation fails
        throw new Error('Transaction confirmation failed - please try again')
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendDiceRollTransaction = async (guess) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {

      const contractAddress = getContractAddress('DICE_ROLL')
      
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
        value: parseEther('0.000005'), // 0.000005 ETH fee
      })
      
      console.log('✅ Dice Roll transaction sent! Hash:', txHash)
      
      // Wait for transaction confirmation before generating results
      console.log('⏳ Waiting for transaction confirmation...')
      try {
        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          waitForTransactionReceipt(config, {
            hash: txHash,
            confirmations: 1,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000) // 30 seconds
          )
        ])
        
        console.log('✅ Dice Roll transaction confirmed!', receipt)
        
        // ONLY NOW generate game result after confirmation
        const dice1 = Math.floor(Math.random() * 6) + 1
        const dice2 = Math.floor(Math.random() * 6) + 1
        const diceTotal = dice1 + dice2
        const playerWon = guess === diceTotal
        
        console.log('🎲 Dice Roll result AFTER confirmation:', { guess, dice1, dice2, diceTotal, playerWon })
        
               try {
                 await addBonusXP(address, 'diceroll', playerWon)
                 const xpEarned = playerWon ? 10 + 1500 : 10
                 await recordTransaction(address, 'DICE_ROLL', xpEarned, txHash) // Record transaction
                 console.log(`✅ XP added and transaction recorded: ${xpEarned} (${playerWon ? 'WIN' : 'LOSS'})`)
               } catch (xpError) {
                 console.error('Error adding XP or recording transaction:', xpError)
               }
        
        return { 
          txHash, 
          playerGuess: guess, 
          dice1,
          dice2,
          diceTotal, 
          isWin: playerWon,
          xpEarned: playerWon ? 1510 : 10
        }
        
      } catch (confirmError) {
        console.warn('⚠️ Confirmation timeout:', confirmError.message)
        // Don't generate results if confirmation fails
        throw new Error('Transaction confirmation failed - please try again')
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sendCustomTransaction = async (contractAddress, functionData, value = '0') => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

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
    sendCustomTransaction,
  }
}
