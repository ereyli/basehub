import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'

const REGISTRAR_ADDRESS = (process.env.ERC8004_REGISTRAR_ADDRESS || '0x125467368441F5a8c5C1184b09E5BE95f8b7aE3C').toLowerCase()
const REGISTRAR_DEPLOY_BLOCK = BigInt(process.env.ERC8004_REGISTRAR_DEPLOY_BLOCK || '47670327')
const LOG_BLOCK_CHUNK_SIZE = 9000n
const METADATA_TIMEOUT_MS = 12000

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org', {
    timeout: 12000,
    retryCount: 2,
    retryDelay: 800,
  }),
})

const agentRegisteredEvent = parseAbiItem(
  'event AgentRegistered(address indexed user, uint256 indexed agentId, string agentURI, uint256 feePaid)'
)

function clean(value) {
  return value == null ? '' : String(value).trim()
}

function cidFromValue(value) {
  const uri = clean(value)
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return uri.replace('ipfs://', '').replace(/^ipfs\//, '').split(/[?#]/)[0]
  const match = uri.match(/\/ipfs\/([^/?#]+)/i)
  if (match?.[1]) return match[1]
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{40,})/i.test(uri)) return uri.split(/[/?#]/)[0]
  return ''
}

function normalizeUri(uri) {
  const value = clean(uri)
  if (!value) return ''
  const cid = cidFromValue(value)
  if (value.startsWith('ipfs://') && cid) return `https://ipfs.io/ipfs/${cid}`
  return value
}

function buildIpfsCandidates(value) {
  const cid = cidFromValue(value)
  if (!cid) return []
  const suffix = clean(value).includes(`/ipfs/${cid}/`)
    ? clean(value).split(`/ipfs/${cid}/`)[1]
    : clean(value).startsWith(`ipfs://${cid}/`)
      ? clean(value).slice(`ipfs://${cid}/`.length)
      : ''
  const path = suffix ? `${cid}/${suffix.replace(/^\/+/, '')}` : cid
  return [
    `https://ipfs.io/ipfs/${path}`,
    `https://gateway.pinata.cloud/ipfs/${path}`,
    `https://cloudflare-ipfs.com/ipfs/${path}`,
    `https://dweb.link/ipfs/${path}`,
  ]
}

function buildImageCandidates(value) {
  const raw = clean(value)
  const candidates = []
  if (raw && /^https?:\/\//i.test(raw)) candidates.push(raw)
  candidates.push(...buildIpfsCandidates(raw))
  return Array.from(new Set(candidates)).slice(0, 6)
}

function buildMetadataCandidates(value) {
  const raw = normalizeUri(value)
  const candidates = []
  candidates.push(...buildIpfsCandidates(raw))
  if (raw && /^https?:\/\//i.test(raw)) candidates.push(raw)
  return Array.from(new Set(candidates)).slice(0, 6)
}

function getServiceText(services) {
  if (!Array.isArray(services)) return ''
  return services.map((service) => `${service?.name || ''} ${service?.endpoint || ''}`).join(' ').toLowerCase()
}

function inferCategory(metadata) {
  const text = [metadata?.name, metadata?.description, getServiceText(metadata?.services)].filter(Boolean).join(' ').toLowerCase()
  if (/trade|trading|swap|market|defi|token|portfolio|price/.test(text)) return 'Trading'
  if (/game|gaming|quest|xp|nft|collectible/.test(text)) return 'Gaming'
  if (/research|data|analysis|analytics|search|knowledge/.test(text)) return 'Research'
  if (/dev|code|github|api|mcp|tool|automation/.test(text)) return 'Devtools'
  if (/social|farcaster|cast|community|content/.test(text)) return 'Social'
  if (/pay|payment|x402|commerce|checkout/.test(text)) return 'Payments'
  return 'General'
}

function isValidMetadata(metadata) {
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    typeof metadata.name === 'string' &&
    metadata.name.trim() &&
    typeof metadata.description === 'string' &&
    metadata.description.trim()
  )
}

async function fetchMetadata(agentURI) {
  const urls = buildMetadataCandidates(agentURI)
  if (!urls.length) return { metadata: null, metadataOk: false, metadataError: 'Missing metadata URI' }

  const errors = []
  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`)
      const metadata = await response.json()
      return { metadata, metadataOk: isValidMetadata(metadata), metadataError: null }
    } catch (error) {
      clearTimeout(timeoutId)
      errors.push(`${url}: ${error?.message || 'Metadata unavailable'}`)
    }
  }

  return {
    metadata: null,
    metadataOk: false,
    metadataError: errors.at(-1) || 'Metadata unavailable',
  }
}

async function buildRow(log) {
  const agentId = log.args.agentId?.toString()
  const agentURI = normalizeUri(log.args.agentURI)
  const { metadata, metadataOk, metadataError } = await fetchMetadata(agentURI)
  const services = Array.isArray(metadata?.services) ? metadata.services : []
  const imageCandidates = buildImageCandidates(metadata?.image)
  return {
    agent_id: agentId,
    owner_address: clean(log.args.user).toLowerCase(),
    agent_uri: agentURI,
    registrar_address: REGISTRAR_ADDRESS,
    tx_hash: clean(log.transactionHash).toLowerCase(),
    block_number: Number(log.blockNumber || 0n),
    log_index: Number(log.logIndex || 0),
    fee_paid_wei: log.args.feePaid?.toString() || null,
    name: metadata?.name || `Agent #${agentId}`,
    description: metadata?.description || 'Metadata could not be loaded yet.',
    image_url: imageCandidates[0] || null,
    image_candidates: imageCandidates,
    services,
    x402_enabled: Boolean(metadata?.x402Support) || /x402/i.test(getServiceText(services)),
    category: inferCategory(metadata),
    metadata_ok: metadataOk,
    metadata_error: metadataError,
    synced_at: new Date().toISOString(),
  }
}

async function getRegistrarEvents() {
  const latestBlock = await publicClient.getBlockNumber()
  const logs = []
  let fromBlock = REGISTRAR_DEPLOY_BLOCK

  while (fromBlock <= latestBlock) {
    const toBlock = fromBlock + LOG_BLOCK_CHUNK_SIZE > latestBlock
      ? latestBlock
      : fromBlock + LOG_BLOCK_CHUNK_SIZE
    const batch = await publicClient.getLogs({
      address: REGISTRAR_ADDRESS,
      event: agentRegisteredEvent,
      fromBlock,
      toBlock,
    })
    logs.push(...batch)
    console.log(`Scanned ${fromBlock}-${toBlock}: +${batch.length} logs`)
    fromBlock = toBlock + 1n
  }

  return logs
}

async function upsertRows(rows) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/erc8004_agents?on_conflict=agent_id`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Supabase upsert failed: HTTP ${response.status} ${detail}`)
  }
}

const logs = await getRegistrarEvents()
console.log(`ERC-8004 registrar events found: ${logs.length}`)

if (!apply) {
  console.log('Dry run only. Re-run with --apply to write rows into erc8004_agents.')
  for (const log of logs.slice(-10).reverse()) {
    console.log(`agentId=${log.args.agentId?.toString()} owner=${log.args.user} tx=${log.transactionHash}`)
  }
  process.exit(0)
}

let written = 0
const batchSize = 15
for (let i = 0; i < logs.length; i += batchSize) {
  const rows = await Promise.all(logs.slice(i, i + batchSize).map(buildRow))
  await upsertRows(rows)
  written += rows.length
  console.log(`Written ${written}/${logs.length}`)
}

console.log(`Backfill complete. ERC-8004 agents written: ${written}/${logs.length}`)
