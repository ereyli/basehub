import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { useNetworkCheck } from './useNetworkCheck'
import { EARLY_ACCESS_CONFIG, EARLY_ACCESS_ABI } from '../config/earlyAccessNFT'
import { DATA_SUFFIX } from '../config/wagmi'
import { addXP } from '../utils/xpUtils'

export const useEarlyAccessMint = () => {
  const { address, isConnected } = useAccount()
  const { isCorrectNetwork, switchToBaseNetwork } = useNetworkCheck()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Use ref to prevent double popup - more reliable than state
  const isTransactionPendingRef = useRef(false)
  const lastErrorRef = useRef(null)

  const contractAddress = EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS

  // Read contract data
  const { data: totalMinted, refetch: refetchTotalMinted } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'totalMinted',
    query: {
      enabled: !!contractAddress && contractAddress !== '',
      refetchInterval: 5000 // Refresh every 5 seconds
    }
  })

  const { data: uniqueMinters, refetch: refetchUniqueMinters } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'uniqueMinters',
    query: {
      enabled: !!contractAddress && contractAddress !== '',
      refetchInterval: 5000
    }
  })

  const { data: maxSupply } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'MAX_SUPPLY',
    query: {
      enabled: !!contractAddress && contractAddress !== ''
    }
  })

  const { data: mintPrice } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'MINT_PRICE',
    query: {
      enabled: !!contractAddress && contractAddress !== ''
    }
  })

  const { data: mintingEnabled } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'mintingEnabled',
    query: {
      enabled: !!contractAddress && contractAddress !== '',
      refetchInterval: 5000
    }
  })

  const { data: userHasMinted } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'hasMinted',
    args: [address],
    query: {
      enabled: !!contractAddress && contractAddress !== '' && !!address
    }
  })

  const { data: userMintCount } = useReadContract({
    address: contractAddress || undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'mintCount',
    args: [address],
    query: {
      enabled: !!contractAddress && contractAddress !== '' && !!address
    }
  })

  const { writeContractAsync, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // NOTE: We intentionally don't use useEffect for writeError anymore
  // Error handling is done in catch block of mint function
  // This prevents the double popup issue caused by useEffect re-triggers

  const mint = async () => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected')
    }

    if (!contractAddress || contractAddress === '') {
      throw new Error('Contract not deployed yet. Please check configuration.')
    }

    if (!isCorrectNetwork) {
      await switchToBaseNetwork()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    setIsLoading(true)
    lastErrorRef.current = null
    isTransactionPendingRef.current = true
    setError(null)

    try {
      if (mintingEnabled === false) {
        throw new Error('Minting is currently disabled')
      }

      if (totalMinted && maxSupply && totalMinted >= maxSupply) {
        throw new Error('Max supply reached')
      }

      const price = mintPrice || parseEther(EARLY_ACCESS_CONFIG.MINT_PRICE)

      await writeContractAsync({
        address: contractAddress,
        abi: EARLY_ACCESS_ABI,
        functionName: 'mint',
        value: price,
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
    } catch (err) {
      console.error('Mint error:', err)
      isTransactionPendingRef.current = false
      // Don't show error for user cancellation
      if (err.message?.includes('User rejected') || err.message?.includes('user rejected')) {
        console.log('ℹ️ User cancelled the transaction')
        setError(null)
      } else {
        setError(err.message || 'Mint failed')
      }
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isSuccess && hash && address) {
      setIsLoading(false)
      isTransactionPendingRef.current = false
      refetchTotalMinted()
      refetchUniqueMinters()
      
      // Award 3000 XP for successful Early Access NFT mint
      const awardXP = async () => {
        try {
          console.log('🎉 Awarding 3000 XP for Early Access NFT minting!')
          await addXP(address, 3000, 'Early Access NFT Mint', null, false, hash)
          
          console.log('✅ XP awarded and transaction recorded!')
        } catch (error) {
          console.error('❌ Failed to award XP or record transaction:', error)
        }
      }
      
      awardXP()
    }
  }, [isSuccess, hash, address, refetchTotalMinted, refetchUniqueMinters])

  useEffect(() => {
    if (isPending || isConfirming) {
      setIsLoading(true)
    }
  }, [isPending, isConfirming])

  // Format mint price correctly
  const formattedMintPrice = mintPrice 
    ? (typeof mintPrice === 'bigint' ? mintPrice : BigInt(mintPrice))
    : parseEther(EARLY_ACCESS_CONFIG.MINT_PRICE)

  return {
    mint,
    isLoading: isLoading || isPending || isConfirming,
    error,
    totalMinted: totalMinted ? Number(totalMinted) : 0,
    uniqueMinters: uniqueMinters ? Number(uniqueMinters) : 0,
    maxSupply: maxSupply ? Number(maxSupply) : EARLY_ACCESS_CONFIG.MAX_SUPPLY,
    mintPrice: formattedMintPrice,
    mintingEnabled: mintingEnabled ?? true,
    userHasMinted: userHasMinted ?? false,
    userMintCount: userMintCount ? Number(userMintCount) : 0,
    isSuccess,
    hash
  }
}
