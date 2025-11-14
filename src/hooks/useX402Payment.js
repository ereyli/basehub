// Hook for x402 payment using x402-fetch
// x402-fetch automatically handles wallet UI and payment flow
import { useState, useEffect } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { wrapFetchWithPayment } from 'x402-fetch'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config } from '../config/wagmi'
import { isInFarcaster } from '../config/wagmi'
import { addXP, recordTransaction } from '../utils/xpUtils'
import { useQuestSystem } from './useQuestSystem'

export const useX402Payment = () => {
  const { data: walletClient } = useWalletClient() // Get wallet client from wagmi
  const { isConnected, address } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isFarcaster, setIsFarcaster] = useState(false)
  const { updateQuestProgress } = useQuestSystem()

  // Check if we're in Farcaster environment
  useEffect(() => {
    setIsFarcaster(isInFarcaster())
  }, [])

  // Make x402 payment - x402-fetch handles wallet UI automatically
  const makePayment = async () => {
    // In Farcaster, check if wallet is connected via wagmi
    if (isFarcaster) {
      if (!isConnected || !address) {
        const err = new Error('Please connect your wallet in Farcaster first.')
        setError(err.message)
        throw err
      }
      if (!walletClient) {
        const err = new Error('Wallet client not available. Please ensure your wallet is properly connected in Farcaster.')
        setError(err.message)
        throw err
      }
    } else {
      // Web environment
      if (!walletClient) {
        const err = new Error('Wallet not connected. Please connect your wallet first.')
        setError(err.message)
        throw err
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🚀 Starting x402 payment flow...')
      console.log('Environment:', isFarcaster ? 'Farcaster' : 'Web')
      console.log('Wallet connected:', isConnected)
      console.log('Wallet address:', address)
      console.log('Wallet client available:', !!walletClient)
      console.log('Wallet client type:', walletClient?.constructor?.name || 'Unknown')
      
      // x402-fetch automatically:
      // 1. Makes initial request
      // 2. Receives 402 Payment Required
      // 3. Shows wallet UI to user (automatically handled)
      // 4. Creates payment transaction
      // 5. Retries request with X-PAYMENT header
      
      // x402-fetch automatically reads payment requirements from 402 response
      // We only need to specify maxValue (optional, defaults to 0.1 USDC)
      // 0.1 USDC = 100000 base units (6 decimals)
      const MAX_PAYMENT_AMOUNT = BigInt(100000) // 0.1 USDC max
      
      console.log('💰 Payment config:', {
        maxAmount: MAX_PAYMENT_AMOUNT.toString(),
        note: 'Token address and network are read from 402 response',
      })
      
      // wrapFetchWithPayment signature: (fetch, walletClient, maxValue?)
      // x402-fetch will automatically:
      // 1. Read payment requirements from 402 response
      // 2. Extract token address and network from response
      // 3. Create payment transaction using wallet client
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        MAX_PAYMENT_AMOUNT // Max allowed payment amount (safety check)
      )

      console.log('📡 Making payment request to /api/x402-payment...')
      
      let response
      let transactionHash = null
      
      try {
        // x402-fetch sends the transaction and retries the request
        // If it's in Farcaster, we may need to wait longer for transaction confirmation
        response = await fetchWithPayment('/api/x402-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        // Try to extract transaction hash from response headers (if available)
        // x402-fetch may include transaction info in headers
        const txHashHeader = response.headers.get('X-TRANSACTION-HASH') || 
                            response.headers.get('x-transaction-hash')
        if (txHashHeader) {
          transactionHash = txHashHeader
          console.log('📋 Transaction hash from response:', transactionHash)
        }
      } catch (fetchError) {
        console.error('❌ Fetch error:', fetchError)
        throw new Error(`Network error: ${fetchError.message || 'Failed to reach server'}`)
      }

      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      })

      if (!response.ok) {
        // Try to get error details
        let errorData = {}
        let errorText = ''
        
        try {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            errorData = await response.json()
          } else {
            errorText = await response.text()
            errorData = { message: errorText }
          }
        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError)
          errorText = `Status ${response.status}: ${response.statusText}`
        }
        
        console.error('❌ Payment failed - Full details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorText,
          isFarcaster,
          transactionHash,
        })
        
        let errorMessage = 'Payment failed'
        
        // Handle 402 Payment Required with specific error types
        if (response.status === 402) {
          // Extract error message from errorData.error
          // errorData.error can be a string, object, or undefined
          let errorText = errorData.error
          
          // Convert error to string if it's an object
          if (errorText && typeof errorText === 'object') {
            // Try multiple ways to extract a meaningful message
            errorText = errorText.message || 
                       errorText.error || 
                       errorText.reason ||
                       JSON.stringify(errorText, null, 2) ||
                       'Payment settlement failed'
          } else if (typeof errorText !== 'string') {
            // If errorText is not a string and not an object, convert it
            errorText = String(errorText || '')
          }
          
          // Normalize to empty string if falsy
          if (!errorText) {
            errorText = ''
          }
          
          // Handle specific error types
          if (errorText === 'insufficient_funds' || errorText.includes('insufficient_funds')) {
            errorMessage = 'Insufficient USDC balance. Please ensure you have at least 0.1 USDC in your wallet on Base network.'
          } else if (errorText === 'X-PAYMENT header is required' || errorText.includes('X-PAYMENT')) {
            errorMessage = 'Payment required. Please complete the payment in your wallet.'
          } else if (errorText.trim()) {
            // Only show errorText if it's not empty
            errorMessage = `Payment error: ${errorText}. Please check your wallet and try again.`
          } else {
            // Settlement failed with empty error object - likely transaction not confirmed yet
            // In Farcaster, transactions may take longer to confirm
            if (isFarcaster) {
              errorMessage = 'Payment transaction is being processed. In Farcaster, transactions may take a bit longer to confirm. Please wait a moment and check your wallet. Your payment will be processed once the transaction is confirmed on-chain.'
            } else {
              errorMessage = 'Payment settlement failed. The transaction may still be processing. Please wait a moment and check your wallet. If the payment was successful, your funds have been sent.'
            }
          }
        } else if (response.status === 404) {
          errorMessage = 'Payment endpoint not found (404). Please check server configuration.'
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.'
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorText) {
          errorMessage = errorText
        } else {
          errorMessage = `Payment failed with status ${response.status}`
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('✅ Payment successful:', result)
      console.log('✅ Transaction hash (if available):', transactionHash)
      
      // If in Farcaster and we have a transaction hash, log it for user reference
      if (isFarcaster && transactionHash) {
        console.log('📋 Farcaster payment transaction:', transactionHash)
      }
      
      // Award 500 XP for successful x402 payment
      if (address) {
        try {
          console.log('🎁 Awarding 500 XP for successful x402 payment...')
          
          // Add XP (500 XP for x402 payment)
          await addXP(address, 500, 'X402_PAYMENT')
          console.log('✅ 500 XP added successfully')
          
          // Record transaction
          await recordTransaction(address, 'X402_PAYMENT', 500, transactionHash || 'x402-payment')
          console.log('✅ Transaction recorded successfully')
          
          // Update quest progress
          await updateQuestProgress('x402Payment', 1)
          console.log('✅ Quest progress updated: x402Payment +1')
          
        } catch (xpError) {
          console.error('⚠️ Error awarding XP or updating quest progress:', xpError)
          // Don't throw error - XP is not critical for payment flow
        }
      } else {
        console.warn('⚠️ No wallet address available, skipping XP reward')
      }
      
      return result

    } catch (err) {
      console.error('❌ x402 Payment error:', err)
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      })
      
      const errorMessage = err.message || 'Payment failed. Please try again.'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    makePayment,
    isLoading,
    error,
    isConnected: isConnected && !!walletClient,
  }
}
