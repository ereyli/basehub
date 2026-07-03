// Hook for contract security analysis using x402 payment
import { useEffect, useState } from 'react'
import { useWalletClient, useAccount, useChainId, useSwitchChain } from 'wagmi'
import { createX402FetchWithBuilderCode } from '../utils/x402BuilderCode'
import { addXP, getNFTCount } from '../utils/xpUtils'
import { useQuestSystem } from './useQuestSystem'
import { NETWORKS } from '../config/networks'

export const useContractSecurity = () => {
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [isPassHolder, setIsPassHolder] = useState(false)
  const [paymentPrice, setPaymentPrice] = useState('0.50')

  useEffect(() => {
    let active = true
    async function checkPass() {
      if (!address) {
        setIsPassHolder(false)
        setPaymentPrice('0.50')
        return
      }
      const passHolder = (await getNFTCount(address)) > 0
      if (!active) return
      setIsPassHolder(passHolder)
      setPaymentPrice(passHolder ? '0.25' : '0.50')
    }
    checkPass()
    return () => {
      active = false
    }
  }, [address])

  const analyzeContract = async (contractAddress, selectedNetwork = 'ethereum') => {
    if (!contractAddress) {
      throw new Error('Contract address is required')
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      throw new Error('Invalid contract address format')
    }

    if (!walletClient) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    // x402 payments only work on Base network - switch if needed
    if (chainId !== NETWORKS.BASE.chainId) {
      try {
        await switchChain({ chainId: NETWORKS.BASE.chainId })
        // Wait a bit for network switch
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err) {
        throw new Error('Please switch to Base network to use x402 payments')
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🚀 Starting contract security analysis payment flow...')
      console.log('Target contract:', contractAddress)
      console.log('Selected network:', selectedNetwork)
      const passHolder = address ? (await getNFTCount(address)) > 0 : false
      setIsPassHolder(passHolder)
      setPaymentPrice(passHolder ? '0.25' : '0.50')

      // x402 payment: 0.50 USDC = 500000 base units (6 decimals)
      const MAX_PAYMENT_AMOUNT = passHolder ? BigInt(250000) : BigInt(500000)
      const endpoint = passHolder ? '/api/x402-contract-security?pass=1' : '/api/x402-contract-security'

      const fetchWithPayment = createX402FetchWithBuilderCode(
        fetch,
        walletClient,
        MAX_PAYMENT_AMOUNT
      )

      console.log('💳 Making payment request to contract security endpoint...', { passHolder })

      const response = await fetchWithPayment(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          contractAddress: contractAddress,
          payerWalletAddress: address,
          network: selectedNetwork,
        }),
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
            errorMessage = `Insufficient USDC balance. Please ensure you have at least ${passHolder ? '0.25' : '0.50'} USDC in your wallet on Base network.`
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
      console.log('✅ Contract security analysis successful:', result)

      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
        
        // Award 500 XP for successful contract analysis
        if (address) {
          try {
            console.log('🎁 Awarding 500 XP for successful contract security analysis...')
            
            // Add XP (500 XP for contract analysis)
            const transactionHash = result.transactionHash || null
            await addXP(address, 500, 'CONTRACT_SECURITY', chainId ?? 8453, false, transactionHash)
            console.log('✅ 500 XP added successfully')
            console.log('✅ Transaction recorded successfully')
            
            // Update quest progress (if there's a contract analysis quest)
            try {
              await updateQuestProgress('contractSecurity', 1)
              console.log('✅ Quest progress updated: contractSecurity +1')
            } catch (questError) {
              // Quest might not exist, that's okay
              console.log('ℹ️ Quest progress update skipped (quest may not exist)')
            }
            
          } catch (xpError) {
            console.error('⚠️ Error awarding XP or updating quest progress:', xpError)
            // Don't throw error - XP is not critical for analysis flow
          }
        } else {
          console.warn('⚠️ No wallet address available, skipping XP reward')
        }
        
        return result.analysis
      } else {
        throw new Error('Invalid response from server')
      }

    } catch (err) {
      console.error('❌ Contract security analysis error:', err)
      const errorMessage = err.message || 'Analysis failed. Please try again.'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    analyzeContract,
    isLoading,
    error,
    analysis,
    isPassHolder,
    paymentPrice,
    isConnected: !!walletClient,
  }
}
