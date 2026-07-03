// Hook for wallet analysis using x402 payment
import { useEffect, useState } from 'react'
import { useWalletClient, useAccount, useChainId, useSwitchChain } from 'wagmi'
import { createX402FetchWithBuilderCode } from '../utils/x402BuilderCode'
import { addXP, getNFTCount } from '../utils/xpUtils'
import { useQuestSystem } from './useQuestSystem'
import { NETWORKS } from '../config/networks'

export const useWalletAnalysis = () => {
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [isPassHolder, setIsPassHolder] = useState(false)
  const [paymentPrice, setPaymentPrice] = useState('0.40')

  useEffect(() => {
    let active = true
    async function checkPass() {
      if (!address) {
        setIsPassHolder(false)
        setPaymentPrice('0.40')
        return
      }
      const passHolder = (await getNFTCount(address)) > 0
      if (!active) return
      setIsPassHolder(passHolder)
      setPaymentPrice(passHolder ? '0.20' : '0.40')
    }
    checkPass()
    return () => {
      active = false
    }
  }, [address])
  const [analysisProgress, setAnalysisProgress] = useState({
    stage: 'idle',
    percent: 0,
    label: '',
    detail: '',
    stageStartedAt: null,
  })

  const updateProgress = (stage, percent, label, detail = '') => {
    setAnalysisProgress({
      stage,
      percent,
      label,
      detail,
      stageStartedAt: Date.now(),
    })
  }

  const hasX402PaymentHeader = (headers) => {
    if (!headers) return false
    if (headers instanceof Headers) return Boolean(headers.get('X-PAYMENT') || headers.get('x-payment'))
    if (Array.isArray(headers)) {
      return headers.some(([key]) => String(key).toLowerCase() === 'x-payment')
    }
    return Object.keys(headers).some((key) => key.toLowerCase() === 'x-payment')
  }

  const analyzeWallet = async (targetAddress, selectedNetwork = 'ethereum') => {
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
    updateProgress('initializing', 0, 'Preparing x402 payment', 'Checking wallet and Base network.')

    // x402 payments only work on Base network - switch if needed
    if (chainId !== NETWORKS.BASE.chainId) {
      try {
        updateProgress('switching-network', 0, 'Switching to Base', 'x402 payments are settled on Base mainnet.')
        await switchChain({ chainId: NETWORKS.BASE.chainId })
        // Wait a bit for network switch
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err) {
        setIsLoading(false)
        updateProgress('idle', 0, '', '')
        throw new Error('Please switch to Base network to use x402 payments')
      }
    }

    try {
      console.log('🚀 Starting wallet analysis payment flow...')
      console.log('Target wallet:', targetAddress)
      console.log('Selected network:', selectedNetwork)
      const passHolder = address ? (await getNFTCount(address)) > 0 : false
      setIsPassHolder(passHolder)
      setPaymentPrice(passHolder ? '0.20' : '0.40')
      updateProgress(
        'waiting-payment',
        0,
        'Complete x402 payment',
        `Approve the ${passHolder ? '0.20' : '0.40'} USDC x402 payment in your wallet${passHolder ? ' with BaseHub Pass discount' : ''}. Report progress starts after approval.`
      )

      // x402 payment: 0.40 USDC = 400000 base units (6 decimals)
      const MAX_PAYMENT_AMOUNT = passHolder ? BigInt(200000) : BigInt(400000)
      const endpoint = passHolder ? '/api/x402-wallet-analysis?pass=1' : '/api/x402-wallet-analysis'

      const trackedFetch = async (input, init = {}) => {
        const isPaidRequest = hasX402PaymentHeader(init.headers) || hasX402PaymentHeader(input?.headers)
        if (isPaidRequest) {
          updateProgress('preparing-report', 38, 'x402 payment confirmed', 'Preparing the wallet report from live network data.')
        }

        const response = await fetch(input, init)

        if (!isPaidRequest && response.status === 402) {
          updateProgress('waiting-payment', 0, 'Waiting for x402 approval', 'Approve the payment in your wallet to start report generation.')
        } else if (isPaidRequest) {
          updateProgress('response-received', 82, 'Network data received', 'Final report data returned from the analysis API.')
        }

        return response
      }

      const fetchWithPayment = createX402FetchWithBuilderCode(
        trackedFetch,
        walletClient,
        MAX_PAYMENT_AMOUNT
      )

      console.log('💳 Making payment request to wallet analysis endpoint...', { passHolder })

      const response = await fetchWithPayment(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          walletAddress: targetAddress,
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
            errorMessage = `Insufficient USDC balance. Please ensure you have at least ${passHolder ? '0.20' : '0.40'} USDC in your wallet on Base network.`
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

      updateProgress('building-report', 92, 'Building report card', 'Formatting wallet signals into the final report.')
      const result = await response.json()
      console.log('✅ Wallet analysis successful:', result)

      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
        updateProgress('ready', 100, 'Report ready', 'Your wallet report is ready.')

        // Award 400 XP for successful wallet analysis
        if (address) {
          void (async () => {
            try {
              console.log('🎁 Awarding 400 XP for successful wallet analysis...')

              // Add XP (400 XP for wallet analysis)
              const transactionHash = result.transactionHash || null
              await addXP(address, 400, 'WALLET_ANALYSIS', chainId ?? 8453, false, transactionHash)
              console.log('✅ 400 XP added successfully')
              console.log('✅ Transaction recorded successfully')

              // Update quest progress (if there's a wallet analysis quest)
              try {
                await updateQuestProgress('walletAnalysis', 1)
                console.log('✅ Quest progress updated: walletAnalysis +1')
              } catch (questError) {
                // Quest might not exist, that's okay
                console.log('ℹ️ Quest progress update skipped (quest may not exist)')
              }

            } catch (xpError) {
              console.error('⚠️ Error awarding XP or updating quest progress:', xpError)
              // Don't throw error - XP is not critical for analysis flow
            }
          })()
        } else {
          console.warn('⚠️ No wallet address available, skipping XP reward')
        }
        
        return result.analysis
      } else {
        throw new Error('Invalid response from server')
      }

    } catch (err) {
      console.error('❌ Wallet analysis error:', err)
      const errorMessage = err.message || 'Analysis failed. Please try again.'
      setError(errorMessage)
      updateProgress('error', 0, 'Analysis failed', errorMessage)
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
    analysisProgress,
    isPassHolder,
    paymentPrice,
    isConnected: !!walletClient,
  }
}
