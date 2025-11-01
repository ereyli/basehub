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
      // x402-fetch automatically:
      // 1. Makes initial request
      // 2. Receives 402 Payment Required
      // 3. Shows wallet UI to user (automatically handled)
      // 4. Creates payment transaction
      // 5. Retries request with X-PAYMENT header
      
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        BigInt(100000), // 0.1 USDC in base units (6 decimals: 0.1 * 10^6)
      )

      const response = await fetchWithPayment('/api/x402-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || 'Payment failed')
      }

      const result = await response.json()
      return result

    } catch (err) {
      console.error('x402 Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
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
