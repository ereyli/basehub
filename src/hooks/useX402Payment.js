// Hook for x402 payment using x402-fetch
// x402-fetch automatically handles wallet UI and payment flow
import { useState } from 'react'
import { useWalletClient } from 'wagmi'
import { wrapFetchWithPayment } from 'x402-fetch'

export const useX402Payment = () => {
  const { data: walletClient } = useWalletClient() // Get wallet client from wagmi
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Make x402 payment - x402-fetch handles wallet UI automatically
  const makePayment = async () => {
    if (!walletClient) {
      const err = new Error('Wallet not connected. Please connect your wallet first.')
      setError(err.message)
      throw err
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🚀 Starting x402 payment flow...')
      console.log('Wallet client:', walletClient ? 'Connected' : 'Not connected')
      
      // x402-fetch automatically:
      // 1. Makes initial request
      // 2. Receives 402 Payment Required
      // 3. Shows wallet UI to user (automatically handled)
      // 4. Creates payment transaction
      // 5. Retries request with X-PAYMENT header
      
      // x402-fetch can automatically detect amount from 402 response
      // Amount parameter is optional - if not provided, it will be read from the 402 response
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        // Amount parameter - x402-fetch will use this or read from 402 response
        // 0.1 USDC = 100000 (6 decimals)
        BigInt(100000),
      )
      
      console.log('💰 Payment amount: 0.1 USDC (100000 base units)')

      console.log('📡 Making payment request to /api/x402-payment...')
      const response = await fetchWithPayment('/api/x402-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📥 Response received:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => {
          // Try to get text if JSON fails
          return response.text().then(text => ({ message: text })).catch(() => ({}))
        })
        console.error('❌ Payment failed:', response.status, errorData)
        
        let errorMessage = 'Payment failed'
        if (response.status === 402) {
          errorMessage = 'Payment required. Please complete the payment in your wallet.'
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('✅ Payment successful:', result)
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
    isConnected: !!walletClient,
  }
}
