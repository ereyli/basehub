import { useCallback, useEffect, useState } from 'react'
import { useAccount, useChainId, usePublicClient, useWalletClient, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { createPublicClient, formatEther, http, parseAbiItem, parseEventLogs } from 'viem'
import { base } from 'wagmi/chains'
import { config, DATA_SUFFIX } from '../config/wagmi'
import { NETWORKS } from '../config/networks'
import { addXP } from '../utils/xpUtils'
import { uploadMetadataToIPFS, uploadToIPFS } from '../utils/pinata'
import {
  BASEHUB_ERC8004_REGISTRAR_ABI,
  ERC8004_AGENT_XP_REWARD,
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_REGISTRAR_DEPLOY_BLOCK,
  getERC8004IdentityRegistry,
  getERC8004RegistrarAddress,
} from '../config/erc8004'

function normalizeServiceList(servicesText) {
  return String(servicesText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((endpoint) => ({
      name: endpoint.includes('/.well-known/agent-card') ? 'A2A' : endpoint.includes('mcp') ? 'MCP' : 'web',
      endpoint,
    }))
}

function createAgentRegistration({ name, description, image, services, x402Support, active, chainId, identityRegistry, agentId }) {
  const registration = agentId
    ? [{ agentId: Number(agentId), agentRegistry: `eip155:${Number(chainId)}:${identityRegistry}` }]
    : [{ agentRegistry: `eip155:${Number(chainId)}:${identityRegistry}` }]

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description,
    image,
    services,
    x402Support: Boolean(x402Support),
    active: active !== false,
    registrations: registration,
    supportedTrust: ['reputation'],
  }
}

const baseStatsClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org', {
    timeout: 12000,
    retryCount: 2,
    retryDelay: 800,
  }),
})

const agentRegisteredEvent = parseAbiItem(
  'event AgentRegistered(address indexed user, uint256 indexed agentId, string agentURI, uint256 feePaid)'
)

const LOG_BLOCK_CHUNK_SIZE = 9500n
const ERC8004_XP_GAME_TYPE = 'ERC8004 Agent Registration'

export function useDeployERC8004() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [agentStats, setAgentStats] = useState({
    totalRegistered: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
  })

  const refreshERC8004Stats = useCallback(async () => {
    const baseChainId = NETWORKS.BASE.chainId
    const registrarAddress = getERC8004RegistrarAddress(baseChainId)
    if (!registrarAddress) {
      setAgentStats({
        totalRegistered: null,
        isLoading: false,
        error: 'Registrar not configured',
        lastUpdated: null,
      })
      return null
    }

    setAgentStats(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const latestBlock = await baseStatsClient.getBlockNumber()
      const firstBlock = ERC8004_REGISTRAR_DEPLOY_BLOCK[baseChainId] || 0n
      let fromBlock = firstBlock
      let totalRegistered = 0

      while (fromBlock <= latestBlock) {
        const toBlock = fromBlock + LOG_BLOCK_CHUNK_SIZE > latestBlock
          ? latestBlock
          : fromBlock + LOG_BLOCK_CHUNK_SIZE
        const logs = await baseStatsClient.getLogs({
          address: registrarAddress,
          event: agentRegisteredEvent,
          fromBlock,
          toBlock,
        })
        totalRegistered += logs.length
        fromBlock = toBlock + 1n
      }

      setAgentStats({
        totalRegistered,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      })
      return totalRegistered
    } catch (statsError) {
      console.warn('Could not load ERC-8004 agent stats:', statsError)
      setAgentStats(prev => ({
        ...prev,
        isLoading: false,
        error: 'Could not load agent count',
      }))
      return null
    }
  }, [])

  useEffect(() => {
    refreshERC8004Stats()
  }, [refreshERC8004Stats])

  const deployERC8004Agent = async ({ name, description, serviceEndpoints, imageFile, x402Support }) => {
    if (!address) throw new Error('Wallet not connected')

    setIsLoading(true)
    setError(null)

    try {
      const identityRegistry = getERC8004IdentityRegistry(chainId)
      const registrarAddress = getERC8004RegistrarAddress(chainId)

      if (!identityRegistry) {
        throw new Error('ERC-8004 is available on Base. Please switch your wallet to Base and try again.')
      }
      if (!registrarAddress) {
        throw new Error('BaseHub ERC-8004 Registrar is not configured yet. Deploy the registrar contract and set VITE_ERC8004_REGISTRAR_BASE.')
      }

      const services = normalizeServiceList(serviceEndpoints)
      const image = imageFile
        ? await uploadToIPFS(imageFile)
        : 'https://www.basehub.fun/BaseHubNFT.png'

      const metadata = createAgentRegistration({
        name,
        description,
        image,
        services,
        x402Support,
        chainId,
        identityRegistry,
      })
      const agentURI = await uploadMetadataToIPFS(metadata)

      let feeWei
      try {
        feeWei = await publicClient.readContract({
          address: registrarAddress,
          abi: BASEHUB_ERC8004_REGISTRAR_ABI,
          functionName: 'feeWei',
        })
      } catch (feeReadError) {
        console.warn('Could not read ERC-8004 registrar fee:', feeReadError)
        throw new Error('Could not read the ERC-8004 registration fee from the registrar contract.')
      }

      const registerTxHash = await writeContractAsync({
        address: registrarAddress,
        abi: BASEHUB_ERC8004_REGISTRAR_ABI,
        functionName: 'registerAgent',
        args: [agentURI],
        value: feeWei,
        chainId,
        dataSuffix: DATA_SUFFIX,
      })

      const registerReceipt = await waitForTransactionReceipt(config, {
        hash: registerTxHash,
        chainId,
        confirmations: 1,
        pollingInterval: 4000,
      })

      let agentId = null
      try {
        const events = parseEventLogs({
          abi: BASEHUB_ERC8004_REGISTRAR_ABI,
          logs: registerReceipt.logs,
          eventName: 'AgentRegistered',
        })
        agentId = events[0]?.args?.agentId ?? null
      } catch (parseError) {
        console.warn('Could not parse AgentRegistered event:', parseError)
      }
      if (agentId == null) throw new Error('Agent registered, but agentId could not be read from the transaction logs.')

      return {
        agentId: agentId.toString(),
        identityRegistry,
        registrarAddress,
        registerTxHash,
        agentURI,
        finalMetadata: createAgentRegistration({
          name,
          description,
          image,
          services,
          x402Support,
          chainId,
          identityRegistry,
          agentId,
        }),
        fee: `${formatEther(feeWei)} ETH`,
        xpEarned: 0,
        isComplete: false,
      }
    } catch (err) {
      console.error('ERC-8004 deploy failed:', err)
      const message = err.message === 'Failed to fetch'
        ? 'Could not upload agent metadata. Please check your connection and try again.'
        : (err.message || 'Failed to register ERC-8004 agent')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const awardERC8004XP = async ({ txHash }) => {
    if (!address) throw new Error('Wallet not connected')
    if (!txHash) throw new Error('Missing ERC-8004 XP transaction hash')

    setIsLoading(true)
    setError(null)

    try {
      const totalXP = await addXP(address, ERC8004_AGENT_XP_REWARD, ERC8004_XP_GAME_TYPE, chainId, true, txHash)
      return {
        xpAwarded: true,
        xpEarned: ERC8004_AGENT_XP_REWARD,
        totalXP,
      }
    } catch (err) {
      console.error('Failed to award ERC-8004 XP:', err)
      const message = err.message || 'Registration completed, but XP could not be saved. Please retry XP.'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const completeERC8004Registration = async ({ agentId, identityRegistry, finalMetadata }) => {
    if (!address) throw new Error('Wallet not connected')
    if (!agentId || !identityRegistry || !finalMetadata) throw new Error('Missing ERC-8004 registration details')

    setIsLoading(true)
    setError(null)

    try {
      const finalUri = await uploadMetadataToIPFS(finalMetadata)
      const metadataTxHash = await writeContractAsync({
        address: identityRegistry,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentURI',
        args: [BigInt(agentId), finalUri],
        chainId,
        dataSuffix: DATA_SUFFIX,
      })

      await waitForTransactionReceipt(config, {
        hash: metadataTxHash,
        chainId,
        confirmations: 1,
        pollingInterval: 4000,
      })

      let xpResult = {
        xpAwarded: false,
        xpEarned: 0,
        xpError: null,
      }
      try {
        const totalXP = await addXP(address, ERC8004_AGENT_XP_REWARD, ERC8004_XP_GAME_TYPE, chainId, true, metadataTxHash)
        xpResult = {
          xpAwarded: true,
          xpEarned: ERC8004_AGENT_XP_REWARD,
          xpError: null,
          totalXP,
        }
      } catch (xpError) {
        console.error('Failed to award ERC-8004 XP:', xpError)
        xpResult = {
          xpAwarded: false,
          xpEarned: 0,
          xpError: xpError.message || 'XP could not be saved. Please retry XP.',
        }
        setError(xpResult.xpError)
      }

      return {
        metadataTxHash,
        agentURI: finalUri,
        isComplete: true,
        ...xpResult,
      }
    } catch (err) {
      console.error('ERC-8004 registration completion failed:', err)
      const message = err.message === 'Failed to fetch'
        ? 'Could not upload final registration metadata. Please check your connection and try again.'
        : (err.message || 'Failed to complete ERC-8004 registration')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    deployERC8004Agent,
    completeERC8004Registration,
    awardERC8004XP,
    refreshERC8004Stats,
    agentStats,
    isLoading,
    error,
  }
}
