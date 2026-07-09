import { useCallback, useState } from 'react'
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { createPublicClient, fallback as viemFallback, http as viemHttp, keccak256, parseEther, parseEventLogs, stringToBytes, zeroAddress } from 'viem'
import { config, DATA_SUFFIX } from '../config/wagmi'
import { NETWORKS } from '../config/networks'
import { addXP } from '../utils/xpUtils'
import {
  B20_ACTIVATION_REGISTRY_ABI,
  B20_ACTIVATION_REGISTRY_ADDRESS,
  B20_DEPLOY_FEE_ETH,
  B20_FACTORY_ABI,
  B20_FEATURE_IDS,
  B20_FEE_WALLET,
  B20_VARIANTS,
  B20_XP_GAME_TYPE,
  B20_XP_REWARD,
  BASEHUB_B20_LAUNCHER_ABI,
  buildB20InitCalls,
  encodeB20CreateParams,
  getB20LauncherAddress,
  isB20SupportedChainId,
} from '../config/b20'

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

function normalizeName(value) {
  return String(value || '').trim().slice(0, 32)
}

function normalizeCurrency(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
}

const BASE_B20_READ_CLIENT = createPublicClient({
  transport: viemFallback([
    viemHttp('https://mainnet.base.org', { timeout: 15000, retryCount: 1, retryDelay: 500 }),
    viemHttp('https://base-rpc.publicnode.com', { timeout: 15000, retryCount: 1, retryDelay: 500 }),
    viemHttp('https://1rpc.io/base', { timeout: 15000, retryCount: 1, retryDelay: 500 }),
  ], { rank: false, retryCount: 1, retryDelay: 500 }),
})
const BASE_SEPOLIA_B20_READ_CLIENT = createPublicClient({
  transport: viemHttp('https://sepolia.base.org', { timeout: 15000, retryCount: 1, retryDelay: 500 }),
})

function getBackupReadClient(chainId) {
  if (Number(chainId) === NETWORKS.BASE.chainId) return BASE_B20_READ_CLIENT
  if (Number(chainId) === NETWORKS.BASE_SEPOLIA.chainId) return BASE_SEPOLIA_B20_READ_CLIENT
  return null
}

async function readContractWithFallback(publicClient, chainId, params) {
  try {
    return await publicClient.readContract(params)
  } catch (primaryError) {
    const backupClient = getBackupReadClient(chainId)
    if (!backupClient || backupClient === publicClient) throw primaryError
    try {
      return await backupClient.readContract(params)
    } catch {
      throw primaryError
    }
  }
}

async function simulateWithFallback(publicClient, chainId, params) {
  try {
    return await publicClient.simulateContract(params)
  } catch (primaryError) {
    const backupClient = getBackupReadClient(chainId)
    if (!backupClient || backupClient === publicClient) throw primaryError
    try {
      return await backupClient.simulateContract(params)
    } catch {
      throw primaryError
    }
  }
}

function getReceiptToken(receipt) {
  if (!receipt?.logs?.length) return null

  try {
    const launched = parseEventLogs({
      abi: BASEHUB_B20_LAUNCHER_ABI,
      logs: receipt.logs,
      eventName: 'B20Launched',
    })
    if (launched[0]?.args?.token) return launched[0].args.token
  } catch {
    /* ignore */
  }

  try {
    const created = parseEventLogs({
      abi: B20_FACTORY_ABI,
      logs: receipt.logs,
      eventName: 'B20Created',
    })
    if (created[0]?.args?.token) return created[0].args.token
  } catch {
    /* ignore */
  }

  return null
}

export function useDeployB20() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const readActivation = useCallback(async (variant, overrideChainId = chainId) => {
    if (!publicClient || !isB20SupportedChainId(overrideChainId)) return false
    return readContractWithFallback(publicClient, overrideChainId, {
      address: B20_ACTIVATION_REGISTRY_ADDRESS,
      abi: B20_ACTIVATION_REGISTRY_ABI,
      functionName: 'isActivated',
      args: [B20_FEATURE_IDS[variant]],
    })
  }, [chainId, publicClient])

  const deployB20 = async (input) => {
    if (!address) throw new Error('Wallet not connected')

    const activeChainId = Number(chainId)
    if (!isB20SupportedChainId(activeChainId)) {
      throw new Error('Switch to Base Sepolia for B20 testing, or Base after mainnet activation.')
    }

    const targetChainId = activeChainId
    const variant = input.variant === 'stablecoin' ? B20_VARIANTS.STABLECOIN : B20_VARIANTS.ASSET
    const decimals = variant === B20_VARIANTS.STABLECOIN ? 6 : Math.min(18, Math.max(6, Number(input.decimals || 18)))
    const name = normalizeName(input.name)
    const symbol = normalizeSymbol(input.symbol)
    const currency = normalizeCurrency(input.currency || 'USD')
    const admin = input.admin && input.admin !== zeroAddress ? input.admin : address

    if (!name) throw new Error('Token name is required')
    if (!symbol) throw new Error('Token symbol is required')
    if (variant === B20_VARIANTS.STABLECOIN && !currency) throw new Error('Currency code is required')

    setIsLoading(true)
    setError(null)

    try {
      const active = await readActivation(variant, targetChainId)
      if (!active) {
        throw new Error('B20 is not active on this network yet. Use Base Sepolia for testing until Base mainnet activation is enabled.')
      }

      const userSalt = keccak256(stringToBytes(`${address}:${Date.now()}:${name}:${symbol}:${variant}`))
      const params = encodeB20CreateParams({ variant, name, symbol, admin, decimals, currency })
      const initCalls = buildB20InitCalls({
        variant,
        admin,
        decimals,
        initialMint: input.initialMint,
        supplyCap: input.supplyCap,
      })
      const launcherAddress = getB20LauncherAddress(targetChainId)

      if (!launcherAddress) {
        throw new Error('B20 normal deploy launcher is not configured for this network. Deploy BaseHubB20Launcher and set the matching VITE_B20_LAUNCHER_* env value.')
      }

      let predictedAddress = null
      let deployTxHash = null

      predictedAddress = await readContractWithFallback(publicClient, targetChainId, {
        address: launcherAddress,
        abi: BASEHUB_B20_LAUNCHER_ABI,
        functionName: 'getB20Address',
        args: [variant, address, userSalt],
      })

      await simulateWithFallback(publicClient, targetChainId, {
        address: launcherAddress,
        abi: BASEHUB_B20_LAUNCHER_ABI,
        functionName: 'createB20',
        args: [variant, userSalt, params, initCalls],
        account: address,
        value: parseEther(B20_DEPLOY_FEE_ETH),
      })

      deployTxHash = await writeContractAsync({
        address: launcherAddress,
        abi: BASEHUB_B20_LAUNCHER_ABI,
        functionName: 'createB20',
        args: [variant, userSalt, params, initCalls],
        value: parseEther(B20_DEPLOY_FEE_ETH),
        chainId: targetChainId,
        dataSuffix: DATA_SUFFIX,
      })

      const receipt = await Promise.race([
        waitForTransactionReceipt(config, {
          hash: deployTxHash,
          chainId: targetChainId,
          confirmations: 1,
          pollingInterval: 2000,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Deploy confirmation timeout')), 90000)),
      ]).catch((receiptError) => {
        console.warn('B20 deploy receipt wait failed:', receiptError)
        return null
      })
      const tokenAddress = getReceiptToken(receipt) || predictedAddress

      let xpEarned = 0
      if (targetChainId === NETWORKS.BASE.chainId) {
        try {
          await addXP(address, B20_XP_REWARD, B20_XP_GAME_TYPE, targetChainId, false, deployTxHash)
          xpEarned = B20_XP_REWARD
        } catch (xpError) {
          console.error('B20 XP award failed:', xpError)
        }
      }

      return {
        txHash: deployTxHash,
        feeTxHash: null,
        tokenAddress,
        predictedAddress,
        variant,
        decimals,
        fee: `${B20_DEPLOY_FEE_ETH} ETH`,
        feeWallet: B20_FEE_WALLET,
        xpEarned,
        status: tokenAddress ? 'B20 token launched successfully.' : 'B20 launch sent. Check the transaction for token details.',
      }
    } catch (err) {
      console.error('B20 deployment failed:', err)
      setError(err.shortMessage || err.message || 'B20 deployment failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    deployB20,
    readActivation,
    isLoading,
    error,
  }
}
