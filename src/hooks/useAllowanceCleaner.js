// Hook for Allowance Cleaner using x402 payment
import { useEffect, useState } from 'react'
import { useWalletClient, useAccount, useWriteContract, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { createX402FetchWithBuilderCode } from '../utils/x402BuilderCode'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config, DATA_SUFFIX } from '../config/wagmi'
import { addXP, getNFTCount } from '../utils/xpUtils'
import { useQuestSystem } from './useQuestSystem'
import { NETWORKS } from '../config/networks'
import { parseUnits, formatUnits, maxUint256 } from 'viem'

// ERC20 ABI for allowance and approve
const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
]

// Base network popular tokens
const BASE_TOKENS = [
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  },
  {
    address: '0x4200000000000000000000000000000000000006', // WETH
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18
  },
  {
    address: '0x50c5725949A68F4B1E3295a3Fd0E88C1C4d3F3C9', // DAI
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18
  },
  {
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6
  }
]

export const useAllowanceCleaner = () => {
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [error, setError] = useState(null)
  const [allowances, setAllowances] = useState([])
  const [hasScanned, setHasScanned] = useState(false)
  const [scannedNetwork, setScannedNetwork] = useState(null) // Track which network was scanned
  const [isPassHolder, setIsPassHolder] = useState(false)
  const [paymentPrice, setPaymentPrice] = useState('0.10')

  useEffect(() => {
    let active = true
    async function checkPass() {
      if (!address) {
        setIsPassHolder(false)
        setPaymentPrice('0.10')
        return
      }
      const passHolder = (await getNFTCount(address)) > 0
      if (!active) return
      setIsPassHolder(passHolder)
      setPaymentPrice(passHolder ? '0.05' : '0.10')
    }
    checkPass()
    return () => {
      active = false
    }
  }, [address])

  // Scan allowances for connected wallet on selected network
  const scanAllowances = async (network = 'base') => {
    if (!address) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    if (!walletClient) {
      throw new Error('Wallet client not available')
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

    setIsScanning(true)
    setError(null)

    try {
      console.log('🔍 Starting allowance scan for:', address)
      const passHolder = address ? (await getNFTCount(address)) > 0 : false
      setIsPassHolder(passHolder)
      setPaymentPrice(passHolder ? '0.05' : '0.10')

      // x402 payment: 0.1 USDC = 100000 base units (6 decimals)
      const MAX_PAYMENT_AMOUNT = passHolder ? BigInt(50000) : BigInt(100000)
      const endpoint = passHolder ? '/api/x402-allowance-cleaner?pass=1' : '/api/x402-allowance-cleaner'

      const fetchWithPayment = createX402FetchWithBuilderCode(
        fetch,
        walletClient,
        MAX_PAYMENT_AMOUNT
      )

      console.log('💳 Making payment request to allowance cleaner endpoint...', { passHolder })

      const response = await fetchWithPayment(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          walletAddress: address,
          payerWalletAddress: address,
          network: network, // Selected network for scanning
        }),
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

        let errorMessage = 'Scan failed'
        
        if (response.status === 402) {
          let errorText = errorData.error
          if (errorText && typeof errorText === 'object') {
            errorText = errorText.message || errorText.error || 'Payment settlement failed'
          } else if (typeof errorText !== 'string') {
            errorText = String(errorText || '')
          }

          if (errorText === 'insufficient_funds' || errorText.includes('insufficient_funds')) {
            errorMessage = `Insufficient USDC balance. Please ensure you have at least ${passHolder ? '0.05' : '0.10'} USDC in your wallet on Base network.`
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
          // Try to get more detailed error message
          if (errorData.error) {
            errorMessage = errorData.error
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.details) {
            errorMessage = `Server error: ${errorData.details.substring(0, 200)}`
          } else {
            errorMessage = 'Server error. Please try again later. If the problem persists, try a different network.'
          }
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }

        console.error('❌ Error from API:', {
          status: response.status,
          errorData,
          errorMessage
        })

        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('✅ Allowance scan successful:', result)

      if (result.success && result.allowances) {
        setAllowances(result.allowances)
        setHasScanned(true)
        setScannedNetwork(network) // Remember which network was scanned
        
        // Award XP for successful scan
        if (address) {
          try {
            console.log('🎁 Awarding 300 XP for allowance scan...')
            const transactionHash = result.transactionHash || null
            await addXP(address, 300, 'ALLOWANCE_CLEANER', chainId, false, transactionHash)
            await updateQuestProgress('allowanceCleaner', 1)
          } catch (xpError) {
            console.error('⚠️ Error awarding XP:', xpError)
          }
        }
        
        return result.allowances
      } else {
        throw new Error('Invalid response from server')
      }

    } catch (err) {
      console.error('❌ Allowance scan error:', err)
      const errorMessage = err.message || 'Scan failed. Please try again.'
      setError(errorMessage)
      throw err
    } finally {
      setIsScanning(false)
    }
  }

  // Revoke a single allowance
  const revokeAllowance = async (tokenAddress, spenderAddress) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    const targetAllowance = allowances.find(
      allowance =>
        allowance.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase() &&
        allowance.spenderAddress?.toLowerCase() === spenderAddress.toLowerCase()
    )
    const targetNetwork = targetAllowance?.network || scannedNetwork || 'base'
    if (targetNetwork !== 'base') {
      const message = 'In-app revoke is currently supported on Base allowances only. Use the target chain explorer or wallet approval manager for this network.'
      setError(message)
      throw new Error(message)
    }

    if (chainId !== NETWORKS.BASE.chainId) {
      try {
        await switchChain({ chainId: NETWORKS.BASE.chainId })
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err) {
        throw new Error('Please switch to Base network to revoke this Base allowance')
      }
    }

    setIsRevoking(true)
    setError(null)

    try {
      console.log('🔄 Revoking allowance:', { 
        token: tokenAddress, 
        spender: spenderAddress,
        operation: 'ERC20 approve(spender, 0)',
        description: 'This will SET the allowance to 0, NOT transfer tokens'
      })

      // ERC20 approve(address spender, uint256 amount) - Set allowance to 0 to revoke
      // This is NOT a token transfer! It's setting approval amount to zero.
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, 0n], // 0n = BigInt zero = revoke approval
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })

      console.log('✅ Revoke transaction sent:', txHash)
      console.log('   ℹ️ This transaction calls approve(spender, 0) to revoke the allowance')

      // Wait for confirmation with timeout
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        confirmations: 1,
        timeout: 60_000, // 60 seconds timeout
      })

      console.log('✅ Revoke transaction confirmed:', receipt)

      // Force update allowances list - remove the revoked one immediately
      setAllowances(prev => {
        const updated = prev.filter(
          allowance => !(
            allowance.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && 
            allowance.spenderAddress.toLowerCase() === spenderAddress.toLowerCase()
          )
        )
        console.log('📝 Allowances updated:', {
          before: prev.length,
          after: updated.length,
          removed: prev.length - updated.length
        })
        return updated
      })

      // Show success message
      console.log('🎉 Allowance successfully revoked!')

      return { txHash, receipt }
    } catch (err) {
      console.error('❌ Revoke error:', err)
      
      // More detailed error message
      let errorMessage = 'Revoke failed. Please try again.'
      if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction rejected by user'
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      throw err
    } finally {
      setIsRevoking(false)
    }
  }

  // Revoke all risky allowances
  const revokeAllRisky = async () => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    const riskyAllowances = allowances.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium')
    const nonBaseRiskyCount = riskyAllowances.filter(a => (a.network || scannedNetwork || 'base') !== 'base').length
    
    if (riskyAllowances.length === 0) {
      throw new Error('No risky allowances to revoke')
    }

    if (nonBaseRiskyCount > 0) {
      const message = 'Batch revoke is currently supported for Base allowances only.'
      setError(message)
      throw new Error(message)
    }

    if (chainId !== NETWORKS.BASE.chainId) {
      try {
        await switchChain({ chainId: NETWORKS.BASE.chainId })
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err) {
        throw new Error('Please switch to Base network to revoke Base allowances')
      }
    }

    setIsRevoking(true)
    setError(null)

    try {
      console.log(`🔄 Revoking ${riskyAllowances.length} risky allowances...`)

      const revokePromises = riskyAllowances.map(allowance =>
        writeContractAsync({
          address: allowance.tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [allowance.spenderAddress, 0n],
          dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
        })
      )

      const txHashes = await Promise.all(revokePromises)
      console.log('✅ All revoke transactions sent:', txHashes)

      // Wait for all confirmations
      const receipts = await Promise.all(
        txHashes.map(txHash =>
          waitForTransactionReceipt(config, {
            hash: txHash,
            confirmations: 1,
          })
        )
      )

      console.log('✅ All revoke transactions confirmed')

      // Remove all revoked allowances
      setAllowances(prev => prev.filter(
        allowance => !riskyAllowances.some(
          risky => risky.tokenAddress.toLowerCase() === allowance.tokenAddress.toLowerCase() &&
                  risky.spenderAddress.toLowerCase() === allowance.spenderAddress.toLowerCase()
        )
      ))

      return { txHashes, receipts }
    } catch (err) {
      console.error('❌ Batch revoke error:', err)
      const errorMessage = err.message || 'Batch revoke failed. Please try again.'
      setError(errorMessage)
      throw err
    } finally {
      setIsRevoking(false)
    }
  }

  return {
    scanAllowances,
    revokeAllowance,
    revokeAllRisky,
    isLoading: isLoading || isScanning || isRevoking,
    isScanning,
    isRevoking,
    error,
    allowances,
    hasScanned,
    scannedNetwork, // Export scannedNetwork
    isPassHolder,
    paymentPrice,
    isConnected: !!walletClient,
  }
}
