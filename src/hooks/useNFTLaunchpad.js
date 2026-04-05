import { useState } from 'react'
import { useAccount, useWalletClient, useChainId, useReadContract, usePublicClient, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config, DATA_SUFFIX, tempo } from '../config/wagmi'
// Tempo pathUSD: match useDeployToken.js — writeContractAsync + dataSuffix: DATA_SUFFIX (proven working on TempoBaseHubDeployer).
import { parseEther, encodeAbiParameters, parseAbiParameters, toEventHash, maxUint256, getAddress } from 'viem'
import { uploadToIPFS, uploadMetadataToIPFS, createNFTMetadata } from '../utils/pinata'
import {
  encodeDeployerCall,
  DEPLOYER_FEE_NFT_COLLECTION_ETH,
  DEPLOYER_FEE_NFT_COLLECTION_ETH_HOLDER,
} from '../config/deployer'
import { getContractAddressByNetwork, NETWORKS } from '../config/networks'
import { NFT_COLLECTION_BYTECODE } from '../config/nftCollection'
import { EARLY_ACCESS_CONFIG, EARLY_ACCESS_ABI } from '../config/earlyAccessNFT'
import { addXP } from '../utils/xpUtils'
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

const TIP20_APPROVE_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]

/** Tempo: deployment gas is much higher than Ethereum (see https://docs.tempo.xyz/quickstart/evm-compatibility); block cap 30M. */
const TEMPO_NFT_DEPLOY_GAS_DEFAULT = 28_000_000n

export function useNFTLaunchpad() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId })
  const { isCorrectNetwork, networkName } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()

  const shouldFetchEarlyAccess = !!address && !!EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS && chainId === NETWORKS.BASE.chainId
  const { data: earlyAccessBalance } = useReadContract({
    address: shouldFetchEarlyAccess ? EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS : undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: shouldFetchEarlyAccess },
  })
  const isEarlyAccessHolder = (earlyAccessBalance ?? 0n) > 0n
  const deployFeeEth = isEarlyAccessHolder ? DEPLOYER_FEE_NFT_COLLECTION_ETH_HOLDER : DEPLOYER_FEE_NFT_COLLECTION_ETH

  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [contractAddress, setContractAddress] = useState(null)
  const [deployTxHash, setDeployTxHash] = useState(null)
  const [slug, setSlug] = useState(null)
  const isTempoChain = chainId === NETWORKS.TEMPO.chainId

  const validateNetwork = async () => {
    if (!isCorrectNetwork) {
      throw new Error(
        `Please switch to Base, InkChain, Soneium, MegaETH or Tempo. You are currently on ${networkName}. Use the network selector.`
      )
    }
  }

  /** Same as useDeployToken.ensureTempoDeployerAllowance — wagmi writeContract + DATA_SUFFIX on Tempo. */
  const tip20ApproveLikeTokenDeploy = async (feeTokenAddr, spender, amount) =>
    writeContractAsync({
      address: getAddress(feeTokenAddr),
      abi: TIP20_APPROVE_ABI,
      functionName: 'approve',
      args: [getAddress(spender), amount],
      chainId,
      dataSuffix: DATA_SUFFIX,
    })

  /** TIP20 allowance can lag behind receipt on some RPCs — retry reads before failing. */
  const readAllowanceWithRetry = async (feeTokenAddr, ownerAddr, spenderAddr, required, attempts = 12, delayMs = 350) => {
    const erc20Abi = [
      { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
    ]
    const token = getAddress(feeTokenAddr)
    const owner = getAddress(ownerAddr)
    const spender = getAddress(spenderAddr)
    const need = BigInt(required)
    for (let i = 0; i < attempts; i++) {
      const a = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender],
      })
      if (BigInt(a ?? 0n) >= need) return BigInt(a ?? 0n)
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs))
    }
    return publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    }).then((x) => BigInt(x ?? 0n))
  }

  const ensureTempoLaunchpadAllowance = async (deployerAddress) => {
    if (!isTempoChain) return
    if (!publicClient || !address) throw new Error('Wallet/public client not ready')

    const deployer = getAddress(deployerAddress)

    const deployerAbi = [
      { name: 'feeToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { name: 'FEE_NFT_COLLECTION_USD6', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    ]
    const erc20Abi = [
      { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
      ...TIP20_APPROVE_ABI,
    ]

    const feeTokenRaw = await publicClient.readContract({
      address: deployer,
      abi: deployerAbi,
      functionName: 'feeToken',
    })

    if (String(feeTokenRaw || '').toLowerCase() === '0x0000000000000000000000000000000000000000') {
      throw new Error('Tempo NFT deployer fee token is not set. Call setFeeToken(pathUSD TIP20 address).')
    }

    const feeToken = getAddress(feeTokenRaw)

    const feeAmount = await publicClient.readContract({
      address: deployer,
      abi: deployerAbi,
      functionName: 'FEE_NFT_COLLECTION_USD6',
    }).catch(() => 4_400_000n)

    const allowance = await publicClient.readContract({
      address: feeToken,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [getAddress(address), deployer],
    })

    const required = BigInt(feeAmount || 4_400_000n)

    const balance = await publicClient.readContract({
      address: feeToken,
      abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [getAddress(address)],
    }).catch(() => 0n)

    if (BigInt(balance || 0n) < required) {
      throw new Error(
        `Insufficient pathUSD balance for deploy fee (~${Number(required) / 1e6} USD). Top up PUSD/pathUSD on Tempo, then try again.`
      )
    }

    let current = BigInt(allowance || 0n)
    // NFT Launchpad: always aim for unlimited pathUSD approval (maxUint256) for this deployer — not only "enough for one fee".
    if (current === maxUint256) return

    // Some TIP20 / bridged tokens need approve(0) before any new approve when allowance is still positive but not max (e.g. after max − fee).
    if (current > 0n) {
      const resetHash = await tip20ApproveLikeTokenDeploy(feeToken, deployer, 0n)
      await waitForTransactionReceipt(config, {
        hash: resetHash,
        chainId,
        confirmations: 1,
        pollingInterval: 2000,
      })
    }

    const approveHash = await tip20ApproveLikeTokenDeploy(feeToken, deployer, maxUint256)

    await waitForTransactionReceipt(config, {
      hash: approveHash,
      chainId,
      confirmations: 1,
      pollingInterval: 2000,
    })

    const allowanceAfter = await readAllowanceWithRetry(feeToken, address, deployer, required)
    if (allowanceAfter < required) {
      throw new Error(
        'pathUSD approval did not apply. If your wallet added extra data to the approve tx, try a different wallet, or clear site token permissions and retry.'
      )
    }
  }

  /** Same calldata + `from` as the wallet will use — catches InsufficientAllowance before MetaMask. */
  const verifyTempoDeployViaEthCall = async (dataToSend, deployerAddress) => {
    if (!isTempoChain || !publicClient || !address) return
    const deployer = getAddress(deployerAddress)
    const from = getAddress(address)
    const tryCall = () =>
      publicClient.call({
        account: from,
        to: deployer,
        data: dataToSend,
        gas: 50_000_000n,
      })
    const errStr = (e) =>
      `${e?.shortMessage || ''} ${e?.message || ''} ${e?.cause?.message || ''} ${e?.details || ''} ${String(e)}`
    const isInsufficientAllowance = (e) => /InsufficientAllowance|insufficient allowance/i.test(errStr(e))
    try {
      await tryCall()
      return
    } catch (e) {
      if (!isInsufficientAllowance(e)) throw e
      setLoadingStep('approving_token')
      await ensureTempoLaunchpadAllowance(deployerAddress)
      setLoadingStep('deploying')
      try {
        await tryCall()
      } catch (e2) {
        if (isInsufficientAllowance(e2)) {
          throw new Error(
            'pathUSD allowance is still insufficient for this deploy. In MetaMask, use the same account shown as connected on the site, then run the approve step again for the NFT deploy contract (0x0854…e9e9b).'
          )
        }
        throw e2
      }
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
      if (isTempoChain) {
        setLoadingStep('approving_token')
        await ensureTempoLaunchpadAllowance(deployerAddress)
        setLoadingStep('deploying')
      }

      // Fee at tx time: read Early Access balance on Base only (Early Access Pass is Base-only)
      let feeEthForTx = DEPLOYER_FEE_NFT_COLLECTION_ETH
      if (chainId === NETWORKS.BASE.chainId && publicClient && address && EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS) {
        try {
          const balance = await publicClient.readContract({
            address: EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS,
            abi: EARLY_ACCESS_ABI,
            functionName: 'balanceOf',
            args: [address],
          })
          if (balance != null && balance > 0n) feeEthForTx = DEPLOYER_FEE_NFT_COLLECTION_ETH_HOLDER
        } catch (e) {
          console.warn('Early Access balance check failed, using standard fee:', e)
        }
      }

      const deployData = encodeDeployerCall('deployNFTCollection', initCodeHex)
      // ERC-8021 Builder Code: Base + Tempo (same as useDeployToken writeContractAsync + dataSuffix on Tempo deployERC20).
      const suffixHex = DATA_SUFFIX.startsWith('0x') ? DATA_SUFFIX.slice(2) : DATA_SUFFIX
      const dataToSend =
        chainId === NETWORKS.BASE.chainId || chainId === NETWORKS.TEMPO.chainId
          ? `${deployData}${suffixHex}`
          : deployData
      if (isTempoChain) {
        await verifyTempoDeployViaEthCall(dataToSend, deployerAddress)
      }

      let deployGas = 5_000_000n
      if (isTempoChain) {
        deployGas = TEMPO_NFT_DEPLOY_GAS_DEFAULT
        if (publicClient && address) {
          try {
            const est = await publicClient.estimateGas({
              account: getAddress(address),
              to: getAddress(deployerAddress),
              data: dataToSend,
            })
            const buffered = (est * 130n) / 100n
            deployGas = buffered > 30_000_000n ? 30_000_000n : buffered < 12_000_000n ? 12_000_000n : buffered
          } catch (e) {
            console.warn('Tempo NFT deploy estimateGas failed, using default gas', e)
          }
        }
      }

      const txHash = await walletClient.sendTransaction({
        ...(isTempoChain
          ? {}
          : {
              account: address,
              value: parseEther(feeEthForTx),
            }),
        to: getAddress(deployerAddress),
        data: dataToSend,
        ...(isTempoChain ? { chain: tempo } : {}),
        chainId,
        gas: deployGas,
      })
      setDeployTxHash(txHash)

      const isFastChain = chainId === NETWORKS.INKCHAIN.chainId || chainId === NETWORKS.SONEIUM.chainId || chainId === NETWORKS.MEGAETH.chainId
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        chainId,
        confirmations: isFastChain ? 0 : 1,
        pollingInterval: isFastChain ? 1000 : 4000,
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
          const insertRow = {
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
          }
          if (typeof chainId === 'number') insertRow.chain_id = chainId
          await supabase.from('nft_launchpad_collections').insert(insertRow)
        } catch (e) {
          console.error('Supabase nft_launchpad_collections insert failed:', e)
        }
      }

      setSuccess({ contractAddress: deployedAddress, deployTxHash: txHash, slug: collectionSlug })

      // XP & quest (2000 XP for launching a collection)
      try {
        await addXP(address, 2000, 'NFT_LAUNCHPAD_COLLECTION', chainId, false, txHash)
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

  /** UI: Tempo uses pathUSD (TIP20 / PUSD-style), not ETH for deploy fee */
  const deployFeeLabel = isTempoChain
    ? '4.40 PUSD (pathUSD)'
    : `${deployFeeEth} ETH`

  return {
    createCollection,
    isLoading,
    loadingStep,
    error,
    success,
    contractAddress,
    deployTxHash,
    slug,
    deployFeeEth,
    deployFeeLabel,
    isTempoChain,
    isEarlyAccessHolder,
  }
}
