import { createPublicClient, fallback, http } from 'viem'
import { NETWORKS } from '../config/networks'

const clients = new Map()

export function getNetworkByChainId(chainId) {
  const id = Number(chainId)
  return Object.values(NETWORKS).find((network) => Number(network.chainId) === id) || null
}

export function getReadClient(chainId) {
  const id = Number(chainId)
  if (!Number.isFinite(id)) return null
  if (clients.has(id)) return clients.get(id)

  const network = getNetworkByChainId(id)
  const urls = Array.from(new Set((network?.rpcUrls || []).filter(Boolean)))
  if (!network || urls.length === 0) return null

  const transports = urls.map((url) => http(url, {
    timeout: 8000,
    retryCount: 0,
  }))
  const transport = transports.length === 1
    ? transports[0]
    : fallback(transports, { rank: false, retryCount: 0 })

  const client = createPublicClient({ transport })
  clients.set(id, client)
  return client
}
