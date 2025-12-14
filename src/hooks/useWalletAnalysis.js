// Hook for wallet analysis using x402 payment
import { useState } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { wrapFetchWithPayment } from 'x402-fetch'

export const useWalletAnalysis = () => {
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [analysis, setAnalysis] = useState(null)

  const analyzeWallet = async (targetAddress) => {
    if (!targetAddress) {
      throw new Error('Wallet address is required')
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      throw new Error('Invalid wallet address format')
    }

    if (!walletClient) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🚀 Starting wallet analysis payment flow...')
      console.log('Target wallet:', targetAddress)

      // x402 payment: 0.3 USDC = 300000 base units (6 decimals)
      const MAX_PAYMENT_AMOUNT = BigInt(300000) // 0.3 USDC max

      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        MAX_PAYMENT_AMOUNT
      )

      console.log('💳 Making payment request to /api/x402-wallet-analysis...')

      const response = await fetchWithPayment('/api/x402-wallet-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: targetAddress }),
      })

      console.log('📥 Response received:', {
        status: response.status,
        ok: response.ok,
      })

      if (!response.ok) {
        let errorData = {}
        try {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            errorData = await response.json()
          } else {
            const errorText = await response.text()
            errorData = { message: errorText }
          }
        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError)
        }

        let errorMessage = 'Analysis failed'
        
        if (response.status === 402) {
          let errorText = errorData.error
          if (errorText && typeof errorText === 'object') {
            errorText = errorText.message || 
                       errorText.error || 
                       errorText.reason ||
                       'Payment settlement failed'
          } else if (typeof errorText !== 'string') {
            errorText = String(errorText || '')
          }

          if (errorText === 'insufficient_funds' || errorText.includes('insufficient_funds')) {
            errorMessage = 'Insufficient USDC balance. Please ensure you have at least 0.3 USDC in your wallet on Base network.'
          } else if (errorText === 'X-PAYMENT header is required' || errorText.includes('X-PAYMENT')) {
            errorMessage = 'Payment required. Please complete the payment in your wallet.'
          } else if (errorText.trim()) {
            errorMessage = `Payment error: ${errorText}. Please check your wallet and try again.`
          } else {
            errorMessage = 'Payment settlement failed. The transaction may still be processing. Please wait a moment and check your wallet.'
          }
        } else if (response.status === 400) {
          errorMessage = errorData.error || errorData.message || 'Invalid request'
        } else if (response.status === 500) {
          errorMessage = errorData.message || 'Server error. Please try again later.'
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('✅ Wallet analysis successful:', result)

      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
        return result.analysis
      } else {
        throw new Error('Invalid response from server')
      }

    } catch (err) {
      console.error('❌ Wallet analysis error:', err)
      const errorMessage = err.message || 'Analysis failed. Please try again.'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    analyzeWallet,
    isLoading,
    error,
    analysis,
    isConnected: !!walletClient,
  }
}

