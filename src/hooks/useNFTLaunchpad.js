import { useState } from 'react'
import { useAccount, useWalletClient, useChainId } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config } from '../config/wagmi'
import { parseEther, encodeAbiParameters, parseAbiParameters, encodeFunctionData, toEventHash } from 'viem'
import { uploadToIPFS, uploadMetadataToIPFS, createNFTMetadata } from '../utils/pinata'
import { encodeDeployerCall, DEPLOYER_FEE_NFT_COLLECTION_ETH } from '../config/deployer'
import { getContractAddressByNetwork } from '../config/networks'
import { NETWORKS } from '../config/networks'
import { NFT_COLLECTION_BYTECODE } from '../config/nftCollection'
import { addXP, recordTransaction } from '../utils/xpUtils'
import { useQuestSystem } from './useQuestSystem'
import { useNetworkCheck } from './useNetworkCheck'
import { supabase } from '../config/supabase'

const NFT_COLLECTION_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenURI_', type: 'string' },
      { name: 'quantity', type: 'uint256' },
    ],
    name: 'mintBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export function useNFTLaunchpad() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const { isCorrectNetwork, networkName, switchToBaseNetwork } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()

  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(null) // 'uploading_image' | 'uploading_metadata' | 'deploying' | 'minting'
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [contractAddress, setContractAddress] = useState(null)
  const [deployTxHash, setDeployTxHash] = useState(null)
  const [mintTxHash, setMintTxHash] = useState(null)

  const validateNetwork = async () => {
    if (!isCorrectNetwork) {
      throw new Error(
        `Please switch to Base network. You are currently on ${networkName}. Use the network selector.`
      )
    }
  }

  /**
   * Create collection: upload or use imageUrl -> metadata -> deploy -> mintBatch.
   * @param {Object} opts
   * @param {string} opts.name - Collection name
   * @param {string} opts.symbol - Collection symbol
   * @param {number} opts.supply - Number of NFTs (e.g. 1-100)
   * @param {'upload'|'url'} opts.imageSource - 'upload' = file to Pinata, 'url' = already have image URL (e.g. after AI)
   * @param {File} [opts.imageFile] - Required if imageSource === 'upload'
   * @param {string} [opts.imageUrl] - Required if imageSource === 'url' (already on Pinata or elsewhere)
   * @param {string} [opts.description] - Optional metadata description
   */
  const createCollection = async ({
    name,
    symbol,
    supply,
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
    setMintTxHash(null)

    if (!address) {
      setIsLoading(false)
      throw new Error('Wallet not connected')
    }
    if (!NFT_COLLECTION_BYTECODE || NFT_COLLECTION_BYTECODE.length < 100) {
      setIsLoading(false)
      const msg =
        'NFT collection bytecode not configured. Ask the team to add compiled bytecode to src/config/nftCollection.js (from Hardhat compile).'
      setError(msg)
      throw new Error(msg)
    }

    await validateNetwork()

    try {
      let finalImageUrl = imageUrl
      if (imageSource === 'upload' && imageFile) {
        setLoadingStep('uploading_image')
        const url = await uploadToIPFS(imageFile)
        finalImageUrl = url
      }
      if (!finalImageUrl) throw new Error('No image URL. Upload an image or provide imageUrl.')

      setLoadingStep('uploading_metadata')
      const metadata = createNFTMetadata(
        name,
        description || `${name} NFT Collection`,
        finalImageUrl,
        [{ trait_type: 'Collection', value: name }]
      )
      const metadataURI = await uploadMetadataToIPFS(metadata)

      setLoadingStep('deploying')
      const constructorData = encodeAbiParameters(
        parseAbiParameters('string name, string symbol, uint256 maxSupply, address initialOwner, string contractURI'),
        [name, symbol, BigInt(supply), address, metadataURI]
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
        gas: 3000000n,
      })
      setDeployTxHash(txHash)

      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        chainId,
        confirmations: 1,
      })
      // Deployed(address indexed deployedAddress, uint8 tokenType) from NFTCollectionDeployer
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

      setLoadingStep('minting')
      const mintTx = await walletClient.sendTransaction({
        to: deployedAddress,
        data: encodeFunctionData({
          abi: NFT_COLLECTION_ABI,
          functionName: 'mintBatch',
          args: [address, metadataURI, BigInt(supply)],
        }),
        chainId,
        gas: 500000n,
      })
      setMintTxHash(mintTx)
      await waitForTransactionReceipt(config, { hash: mintTx, chainId, confirmations: 1 })

      setSuccess({ contractAddress: deployedAddress, deployTxHash: txHash, mintTxHash: mintTx })

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
            mint_tx_hash: mintTx,
          })
        } catch (e) {
          console.error('Supabase nft_launchpad_collections insert failed:', e)
        }
      }

      try {
        await addXP(address, 500, 'NFT_LAUNCHPAD_COLLECTION', chainId)
        await recordTransaction({
          wallet_address: address,
          game_type: 'NFT_LAUNCHPAD_COLLECTION',
          transaction_hash: txHash,
          contract_address: deployedAddress,
          amount: DEPLOYER_FEE_NFT_COLLECTION_ETH,
          currency: 'ETH',
          status: 'success',
          metadata: { name, symbol, supply },
        })
      } catch (e) {
        console.error('XP/record failed:', e)
      }
      try {
        await updateQuestProgress('nftLaunchpadDeployed', 1)
      } catch (e) {
        console.error('Quest update failed:', e)
      }

      return { contractAddress: deployedAddress, deployTxHash: txHash, mintTxHash: mintTx }
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
    mintTxHash,
  }
}

