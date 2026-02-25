import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWalletClient, useChainId, usePublicClient } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { encodeFunctionData } from 'viem'
import { config, DATA_SUFFIX } from '../config/wagmi'
import { NETWORKS } from '../config/networks'
import { NFT_LAUNCH_COLLECTION_ABI } from '../config/nftCollection'
import { useNetworkCheck } from './useNetworkCheck'
import { supabase } from '../config/supabase'
import { addXP } from '../utils/xpUtils'

/**
 * Hook for public minting from an NFT Launchpad collection.
 * Reads on-chain state (totalSupply, maxSupply, mintPrice, saleActive)
 * and provides a `mint(quantity)` function.
 *
 * @param {string} contractAddress - The deployed NFTLaunchCollection address
 */
export function useNFTMint(contractAddress) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { isCorrectNetwork, networkName } = useNetworkCheck()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [txHash, setTxHash] = useState(null)
  const [success, setSuccess] = useState(false)

  // On-chain state
  const [totalSupply, setTotalSupply] = useState(0n)
  const [maxSupply, setMaxSupply] = useState(0n)
  const [mintPrice, setMintPrice] = useState(0n)
  const [saleActive, setSaleActive] = useState(false)
  const [isReadingChain, setIsReadingChain] = useState(true)

  const readContractState = useCallback(async () => {
    if (!contractAddress || !publicClient) {
      setIsReadingChain(false)
      return
    }
    setIsReadingChain(true)
    try {
      const [supply, max, price, active] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: NFT_LAUNCH_COLLECTION_ABI,
          functionName: 'totalSupply',
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: NFT_LAUNCH_COLLECTION_ABI,
          functionName: 'maxSupply',
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: NFT_LAUNCH_COLLECTION_ABI,
          functionName: 'mintPrice',
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: NFT_LAUNCH_COLLECTION_ABI,
          functionName: 'saleActive',
        }),
      ])
      setTotalSupply(supply)
      setMaxSupply(max)
      setMintPrice(price)
      setSaleActive(active)
    } catch (err) {
      console.error('Failed to read collection state:', err)
    } finally {
      setIsReadingChain(false)
    }
  }, [contractAddress, publicClient])

  useEffect(() => {
    readContractState()
  }, [readContractState])

  /**
   * Mint NFTs from the collection.
   * @param {number} quantity - Number of NFTs to mint (1-20)
   */
  const mint = async (quantity = 1) => {
    setIsLoading(true)
    setError(null)
    setTxHash(null)
    setSuccess(false)

    try {
      if (!address) throw new Error('Wallet not connected')
      if (!walletClient) throw new Error('Wallet not available')
      if (!isCorrectNetwork) {
        throw new Error(`Please switch to Base, InkChain, Soneium or MegaETH. You are on ${networkName}.`)
      }
      if (!contractAddress) throw new Error('No contract address provided')
      if (!saleActive) throw new Error('Sale is not active for this collection')
      if (totalSupply + BigInt(quantity) > maxSupply) {
        throw new Error('Not enough supply remaining')
      }

      const totalCost = mintPrice * BigInt(quantity)
      // ERC-8021 Builder Code: Base only (Ink doesn't support it)
      const mintData = encodeMintCall(quantity)
      const dataToSend = chainId === NETWORKS.BASE.chainId
        ? `${mintData}${DATA_SUFFIX.startsWith('0x') ? DATA_SUFFIX.slice(2) : DATA_SUFFIX}`
        : mintData
      const hash = await walletClient.sendTransaction({
        to: contractAddress,
        data: dataToSend,
        value: totalCost,
        chainId,
        gas: 300000n * BigInt(quantity),
      })
      setTxHash(hash)

      const isFastChain = chainId === NETWORKS.INKCHAIN.chainId || chainId === NETWORKS.SONEIUM.chainId || chainId === NETWORKS.MEGAETH.chainId
      await waitForTransactionReceipt(config, {
        hash,
        chainId,
        confirmations: isFastChain ? 0 : 1,
        pollingInterval: isFastChain ? 1000 : 4000,
      })

      setSuccess(true)

      // XP: 200 XP per mint
      try {
        await addXP(address, 200, 'NFT_LAUNCHPAD_MINT', chainId, false, hash)
      } catch (e) {
        console.error('XP/record for mint failed:', e)
      }

      // Refresh on-chain state
      await readContractState()

      // Update Supabase total_minted (best effort)
      if (supabase?.from) {
        try {
          const { data } = await supabase
            .from('nft_launchpad_collections')
            .select('total_minted')
            .eq('contract_address', contractAddress.toLowerCase())
            .single()
          if (data) {
            await supabase
              .from('nft_launchpad_collections')
              .update({ total_minted: (data.total_minted || 0) + quantity })
              .eq('contract_address', contractAddress.toLowerCase())
          }
        } catch (e) {
          console.error('Supabase total_minted update failed:', e)
        }
      }

      return { txHash: hash }
    } catch (err) {
      const msg = err.message || 'Mint failed'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    mint,
    isLoading,
    error,
    txHash,
    success,
    totalSupply,
    maxSupply,
    mintPrice,
    saleActive,
    isReadingChain,
    refreshState: readContractState,
  }
}

/**
 * Encode the mint(uint256) function call.
 */
function encodeMintCall(quantity) {
  return encodeFunctionData({
    abi: NFT_LAUNCH_COLLECTION_ABI,
    functionName: 'mint',
    args: [BigInt(quantity)],
  })
}
