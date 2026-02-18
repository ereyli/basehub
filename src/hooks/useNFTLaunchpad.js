import { useState } from 'react'
import { useAccount, useWalletClient, useChainId } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config } from '../config/wagmi'
import { parseEther, encodeAbiParameters, parseAbiParameters, toEventHash } from 'viem'
import { uploadToIPFS, uploadMetadataToIPFS, createNFTMetadata } from '../utils/pinata'
import { encodeDeployerCall, DEPLOYER_FEE_NFT_COLLECTION_ETH } from '../config/deployer'
import { getContractAddressByNetwork } from '../config/networks'
import { NFT_COLLECTION_BYTECODE } from '../config/nftCollection'
import { addXP, recordTransaction } from '../utils/xpUtils'
import { useQuestSystem } from './useQuestSystem'
import { useNetworkCheck } from './useNetworkCheck'
import { supabase } from '../config/supabase'

/**
 * Generate a URL-friendly slug from a collection name.
 * Appends a short random suffix to avoid collisions.
 */
function generateSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base}-${rand}`
}

export function useNFTLaunchpad() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const { isCorrectNetwork, networkName } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()

  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [contractAddress, setContractAddress] = useState(null)
  const [deployTxHash, setDeployTxHash] = useState(null)
  const [slug, setSlug] = useState(null)

  const validateNetwork = async () => {
    if (!isCorrectNetwork) {
      throw new Error(
        `Please switch to Base network. You are currently on ${networkName}. Use the network selector.`
      )
    }
  }

  /**
   * Create a public-mint NFT collection.
   *
   * @param {Object} opts
   * @param {string} opts.name - Collection name
   * @param {string} opts.symbol - Collection symbol
   * @param {number} opts.supply - Max supply (e.g. 100, 1000, 10000)
   * @param {string} opts.mintPrice - Mint price in ETH (e.g. "0.005")
   * @param {'upload'|'url'} opts.imageSource
   * @param {File} [opts.imageFile]
   * @param {string} [opts.imageUrl]
   * @param {string} [opts.description]
   */
  const createCollection = async ({
    name,
    symbol,
    supply,
    mintPrice = '0',
    imageSource,
    imageFile = null,
    imageUrl = null,
    description = '',
  }) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setContractAddress(null)
    setDeployTxHash(null)
    setSlug(null)

    if (!address) {
      setIsLoading(false)
      throw new Error('Wallet not connected')
    }
    if (!NFT_COLLECTION_BYTECODE || NFT_COLLECTION_BYTECODE.length < 100) {
      setIsLoading(false)
      const msg =
        'NFT collection bytecode not configured. Compile NFTLaunchCollection.sol and update src/config/nftCollection.js.'
      setError(msg)
      throw new Error(msg)
    }

    await validateNetwork()

    try {
      // --- Step 1: Upload image ---
      let finalImageUrl = imageUrl
      if (imageSource === 'upload' && imageFile) {
        setLoadingStep('uploading_image')
        finalImageUrl = await uploadToIPFS(imageFile)
      }
      if (!finalImageUrl) throw new Error('No image URL. Upload an image or provide imageUrl.')

      // --- Step 2: Upload collection-level metadata (contractURI for OpenSea) ---
      setLoadingStep('uploading_metadata')
      const metadata = createNFTMetadata(
        name,
        description || `${name} NFT Collection`,
        finalImageUrl,
        [{ trait_type: 'Collection', value: name }]
      )
      const contractURI = await uploadMetadataToIPFS(metadata)

      // baseTokenURI = same metadata for all tokens in the collection
      const baseTokenURI = contractURI

      // --- Step 3: Deploy collection via NFTCollectionDeployer ---
      setLoadingStep('deploying')

      // Constructor: (name, symbol, maxSupply, mintPrice, fundsRecipient, baseTokenURI, contractURI)
      const mintPriceWei = parseEther(mintPrice || '0')
      const constructorData = encodeAbiParameters(
        parseAbiParameters(
          'string name, string symbol, uint256 maxSupply, uint256 mintPrice, address fundsRecipient, string baseTokenURI, string contractURI'
        ),
        [name, symbol, BigInt(supply), mintPriceWei, address, baseTokenURI, contractURI]
      )
      const initCodeHex =
        (NFT_COLLECTION_BYTECODE.startsWith('0x') ? NFT_COLLECTION_BYTECODE : '0x' + NFT_COLLECTION_BYTECODE) +
        constructorData.slice(2)

      const deployerAddress = getContractAddressByNetwork('BASEHUB_NFT_COLLECTION_DEPLOYER', chainId)
      if (!deployerAddress) throw new Error('NFT Launchpad deployer not configured for this network.')
      if (!walletClient) throw new Error('Wallet not available.')

      const deployData = encodeDeployerCall('deployNFTCollection', initCodeHex)
      const txHash = await walletClient.sendTransaction({
        to: deployerAddress,
        data: deployData,
        value: parseEther(DEPLOYER_FEE_NFT_COLLECTION_ETH),
        chainId,
        gas: 5000000n,
      })
      setDeployTxHash(txHash)

      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        chainId,
        confirmations: 1,
      })

      // Parse Deployed(address indexed, uint8) event
      const DEPLOYED_TOPIC0 = toEventHash('Deployed(address,uint8)')
      let deployedAddress = null
      if (receipt?.logs?.length) {
        const deployerLog = receipt.logs.find(
          (l) =>
            l.address?.toLowerCase() === deployerAddress.toLowerCase() &&
            l.topics?.[0] === DEPLOYED_TOPIC0 &&
            l.topics?.length >= 2
        )
        if (deployerLog?.topics?.[1]) {
          deployedAddress = '0x' + deployerLog.topics[1].slice(-40).toLowerCase()
        }
      }
      if (!deployedAddress) throw new Error('Deploy succeeded but contract address could not be read from logs.')

      setContractAddress(deployedAddress)

      // --- Step 4: Save to Supabase ---
      const collectionSlug = generateSlug(name)
      setSlug(collectionSlug)

      if (supabase?.from) {
        try {
          await supabase.from('nft_launchpad_collections').insert({
            contract_address: deployedAddress.toLowerCase(),
            deployer_address: address.toLowerCase(),
            name,
            symbol,
            supply,
            description: description || null,
            deploy_tx_hash: txHash,
            mint_price: mintPrice || '0',
            image_url: finalImageUrl,
            slug: collectionSlug,
            base_token_uri: baseTokenURI,
            is_active: true,
            total_minted: 0,
          })
        } catch (e) {
          console.error('Supabase nft_launchpad_collections insert failed:', e)
        }
      }

      setSuccess({ contractAddress: deployedAddress, deployTxHash: txHash, slug: collectionSlug })

      // XP & quest (2000 XP for launching a collection)
      try {
        await addXP(address, 2000, 'NFT_LAUNCHPAD_COLLECTION', chainId)
        await recordTransaction({
          wallet_address: address,
          game_type: 'NFT_LAUNCHPAD_COLLECTION',
          transaction_hash: txHash,
          contract_address: deployedAddress,
          amount: DEPLOYER_FEE_NFT_COLLECTION_ETH,
          currency: 'ETH',
          status: 'success',
          metadata: { name, symbol, supply, mintPrice },
        })
      } catch (e) {
        console.error('XP/record failed:', e)
      }
      try {
        await updateQuestProgress('nftLaunchpadDeployed', 1)
      } catch (e) {
        console.error('Quest update failed:', e)
      }

      return { contractAddress: deployedAddress, deployTxHash: txHash, slug: collectionSlug }
    } catch (err) {
      const msg = err.message || 'Failed to create collection'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
      setLoadingStep(null)
    }
  }

  return {
    createCollection,
    isLoading,
    loadingStep,
    error,
    success,
    contractAddress,
    deployTxHash,
    slug,
  }
}
