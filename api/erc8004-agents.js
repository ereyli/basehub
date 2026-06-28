import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbiItem, parseEventLogs } from 'viem'
import { base } from 'viem/chains'

const REGISTRAR_ADDRESS = (process.env.ERC8004_REGISTRAR_ADDRESS || '0x125467368441F5a8c5C1184b09E5BE95f8b7aE3C').toLowerCase()
const REGISTRAR_DEPLOY_BLOCK = BigInt(process.env.ERC8004_REGISTRAR_DEPLOY_BLOCK || '47670327')
const LOG_BLOCK_CHUNK_SIZE = 9000n
const DEFAULT_LIMIT = 96
const MAX_LIMIT = 240
const METADATA_TIMEOUT_MS = 12000

const agentRegisteredEvent = parseAbiItem(
  'event AgentRegistered(address indexed user, uint256 indexed agentId, string agentURI, uint256 feePaid)'
)

function clean(value) {
  return value == null ? '' : String(value).trim()
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      enabled: false,
    },
  })
}

function getRpcUrls() {
  return [
    process.env.BASE_RPC_URL,
    process.env.VITE_BASE_RPC_URL,
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
    'https://base.drpc.org',
    'https://1rpc.io/base',
  ].map(clean).filter(Boolean)
}

function getBaseClient(rpcUrl) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, {
      timeout: 12000,
      retryCount: 1,
      retryDelay: 650,
    }),
  })
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
  return services
    .map((service) => `${service?.name || ''} ${service?.endpoint || ''}`)
    .join(' ')
    .toLowerCase()
}

function inferCategory(metadata) {
  const text = [
    metadata?.name,
    metadata?.description,
    getServiceText(metadata?.services),
  ].filter(Boolean).join(' ').toLowerCase()

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
      return {
        metadata,
        metadataOk: isValidMetadata(metadata),
        metadataError: null,
      }
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

async function withRpcFallback(action) {
  const errors = []
  for (const rpcUrl of getRpcUrls()) {
    try {
      return await action(getBaseClient(rpcUrl), rpcUrl)
    } catch (error) {
      errors.push(`${rpcUrl}: ${error?.shortMessage || error?.message || 'failed'}`)
    }
  }
  throw new Error(errors.join(' | ') || 'No Base RPC available')
}

async function getLatestCachedBlock(supabase) {
  const { data, error } = await supabase
    .from('erc8004_agents')
    .select('block_number')
    .order('block_number', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0]?.block_number ? BigInt(data[0].block_number) : null
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return null
    }
  }
  return {}
}

function normalizeTxHash(value) {
  const txHash = clean(value).toLowerCase()
  return /^0x[a-f0-9]{64}$/.test(txHash) ? txHash : ''
}

function normalizeMetadataUri(value) {
  const uri = normalizeUri(value)
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return uri.slice(0, 900)
  try {
    const parsed = new URL(uri)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    return parsed.toString().slice(0, 900)
  } catch {
    return ''
  }
}

async function buildRowFromLog(log, { metadataUriOverride = '' } = {}) {
    const agentId = log.args.agentId?.toString()
    const agentURI = normalizeMetadataUri(metadataUriOverride) || normalizeUri(log.args.agentURI)
    const { metadata, metadataOk, metadataError } = await fetchMetadata(agentURI)
    const services = Array.isArray(metadata?.services) ? metadata.services : []
    const imageCandidates = buildImageCandidates(metadata?.image)
    const category = inferCategory(metadata)
    const x402Enabled = Boolean(metadata?.x402Support) || /x402/i.test(getServiceText(services))

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
      x402_enabled: x402Enabled,
      category,
      metadata_ok: metadataOk,
      metadata_error: metadataError,
      synced_at: new Date().toISOString(),
    }
}

async function upsertLogs(supabase, logs) {
  const rows = await Promise.all(logs.map((log) => buildRowFromLog(log)))

  if (!rows.length) return 0

  const { error } = await supabase
    .from('erc8004_agents')
    .upsert(rows, { onConflict: 'agent_id' })

  if (error) throw error
  return rows.length
}

async function getRegistrationLogFromTxHash(txHash) {
  return withRpcFallback(async (client) => {
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    if (!receipt) throw new Error('Transaction receipt not found')
    if (receipt.status !== 'success') throw new Error('Registration transaction failed')

    const events = parseEventLogs({
      abi: [agentRegisteredEvent],
      logs: receipt.logs.filter((log) => clean(log.address).toLowerCase() === REGISTRAR_ADDRESS),
      eventName: 'AgentRegistered',
    })
    const event = events[0]
    if (!event?.args?.agentId) throw new Error('AgentRegistered event not found in transaction')

    return {
      ...event,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      logIndex: event.logIndex ?? 0,
    }
  })
}

async function syncFromChain(supabase, { maxLogs = 1200 } = {}) {
  const latestCached = await getLatestCachedBlock(supabase)
  const startBlock = latestCached == null ? REGISTRAR_DEPLOY_BLOCK : latestCached + 1n

  return withRpcFallback(async (client) => {
    const latestBlock = await client.getBlockNumber()
    if (startBlock > latestBlock) return { synced: 0, latestBlock: latestBlock.toString(), fromBlock: startBlock.toString() }

    let fromBlock = startBlock
    let synced = 0

    while (fromBlock <= latestBlock && synced < maxLogs) {
      const toBlock = fromBlock + LOG_BLOCK_CHUNK_SIZE > latestBlock
        ? latestBlock
        : fromBlock + LOG_BLOCK_CHUNK_SIZE
      const logs = await client.getLogs({
        address: REGISTRAR_ADDRESS,
        event: agentRegisteredEvent,
        fromBlock,
        toBlock,
      })

      if (logs.length) {
        const remaining = maxLogs - synced
        synced += await upsertLogs(supabase, logs.slice(0, remaining))
      }
      fromBlock = toBlock + 1n
    }

    return { synced, latestBlock: latestBlock.toString(), fromBlock: startBlock.toString() }
  })
}

async function loadAgents(supabase, { limit, page, sort, category, query }) {
  const offset = (page - 1) * limit
  let request = supabase
    .from('erc8004_agents')
    .select('*', { count: 'exact' })

  if (category && category !== 'All') request = request.eq('category', category)
  if (query) {
    const needle = `%${query.replace(/[%_]/g, '')}%`
    request = request.or(`name.ilike.${needle},description.ilike.${needle},owner_address.ilike.${needle},agent_id.ilike.${needle},category.ilike.${needle}`)
  }

  request = request
    .order('block_number', { ascending: false })
    .order('log_index', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await request
  if (error) throw error

  const ids = (data || []).map((row) => row.agent_id)
  let views = {}
  if (ids.length) {
    const { data: viewRows, error: viewError } = await supabase
      .from('erc8004_agent_view_totals')
      .select('agent_id, view_count, unique_view_count, last_viewed_at')
      .in('agent_id', ids)
    if (!viewError) {
      for (const row of viewRows || []) {
        views[row.agent_id] = row
      }
    }
  }

  let agents = (data || []).map((row) => {
    const view = views[row.agent_id] || {}
    return {
      agentId: row.agent_id,
      owner: row.owner_address,
      agentURI: row.agent_uri,
      feePaid: row.fee_paid_wei,
      txHash: row.tx_hash,
      blockNumber: String(row.block_number),
      logIndex: Number(row.log_index || 0),
      name: row.name || `Agent #${row.agent_id}`,
      description: row.description || 'Metadata could not be loaded yet.',
      image: row.image_url || '',
      imageCandidates: Array.isArray(row.image_candidates) ? row.image_candidates : [],
      services: Array.isArray(row.services) ? row.services : [],
      x402Enabled: Boolean(row.x402_enabled),
      category: row.category || 'General',
      metadataOk: Boolean(row.metadata_ok),
      metadataError: row.metadata_error || null,
      views: Number(view.view_count || 0),
      uniqueViews: Number(view.unique_view_count || view.view_count || 0),
      lastViewedAt: view.last_viewed_at || null,
    }
  })

  if (sort === 'views') {
    agents = agents.sort((a, b) => Number(b.views || 0) - Number(a.views || 0) || Number(b.agentId || 0) - Number(a.agentId || 0))
  } else if (sort === 'x402') {
    agents = agents.sort((a, b) => Number(Boolean(b.x402Enabled)) - Number(Boolean(a.x402Enabled)) || Number(b.agentId || 0) - Number(a.agentId || 0))
  } else if (sort === 'verified') {
    agents = agents.sort((a, b) => Number(Boolean(b.metadataOk)) - Number(Boolean(a.metadataOk)) || Number(b.agentId || 0) - Number(a.agentId || 0))
  }

  const { count: totalRegistered, error: totalError } = await supabase
    .from('erc8004_agents')
    .select('agent_id', { count: 'exact', head: true })
  if (totalError) throw totalError

  const { count: totalX402, error: x402Error } = await supabase
    .from('erc8004_agents')
    .select('agent_id', { count: 'exact', head: true })
    .eq('x402_enabled', true)
  if (x402Error) throw x402Error

  const { count: totalVerified, error: verifiedError } = await supabase
    .from('erc8004_agents')
    .select('agent_id', { count: 'exact', head: true })
    .eq('metadata_ok', true)
  if (verifiedError) throw verifiedError

  const { data: categoryRows, error: categoryError } = await supabase
    .from('erc8004_agents')
    .select('category')
    .limit(5000)
  if (categoryError) throw categoryError

  const filteredCount = count || 0

  return {
    agents,
    filteredCount,
    totalRegistered: totalRegistered || 0,
    totalX402: totalX402 || 0,
    totalVerified: totalVerified || 0,
    page,
    pageSize: limit,
    pageCount: Math.max(1, Math.ceil(filteredCount / limit)),
    categories: ['All', ...Array.from(new Set((categoryRows || []).map((row) => row.category).filter(Boolean))).sort()],
  }
}

async function handlePost(req, res, supabase) {
  const body = parseJsonBody(req)
  if (!body) return res.status(400).json({ error: 'Invalid JSON' })

  const txHash = normalizeTxHash(body.txHash || body.registerTxHash)
  if (!txHash) return res.status(400).json({ error: 'Invalid txHash' })

  const registrationLog = await getRegistrationLogFromTxHash(txHash)
  const row = await buildRowFromLog(registrationLog, {
    metadataUriOverride: body.metadataUri || body.agentURI,
  })

  const { error } = await supabase
    .from('erc8004_agents')
    .upsert(row, { onConflict: 'agent_id' })

  if (error) throw error

  return res.status(200).json({
    ok: true,
    agent: {
      agentId: row.agent_id,
      owner: row.owner_address,
      agentURI: row.agent_uri,
      txHash: row.tx_hash,
      blockNumber: String(row.block_number),
      name: row.name,
      image: row.image_url,
      imageCandidates: row.image_candidates,
      metadataOk: row.metadata_ok,
    },
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getServerSupabase()
  if (!supabase) return res.status(503).json({ error: 'Supabase service key missing' })

  try {
    if (req.method === 'POST') return handlePost(req, res, supabase)

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || DEFAULT_LIMIT), 1), MAX_LIMIT)
    const page = Math.max(Number(url.searchParams.get('page') || 1), 1)
    const sort = clean(url.searchParams.get('sort')) || 'newest'
    const category = clean(url.searchParams.get('category')) || 'All'
    const query = clean(url.searchParams.get('q')).slice(0, 120)
    const shouldSync = url.searchParams.get('sync') === '1'

    let sync = null
    if (shouldSync) sync = await syncFromChain(supabase)

    let payload = await loadAgents(supabase, { limit, page, sort, category, query })
    if (!payload.totalRegistered) {
      sync = await syncFromChain(supabase)
      payload = await loadAgents(supabase, { limit, page, sort, category, query })
    }

    return res.status(200).json({
      ok: true,
      ...payload,
      lastUpdated: Date.now(),
      sync,
    })
  } catch (error) {
    const message = error?.message || 'Failed to load ERC-8004 agents'
    if (/erc8004_agents|does not exist|schema cache/i.test(message)) {
      return res.status(503).json({
        error: 'ERC-8004 agent cache table is missing',
        detail: 'Apply supabase/migrations/20260628124500_erc8004_agents_cache.sql.',
        migrationRequired: true,
      })
    }
    console.error('erc8004-agents:', error)
    return res.status(502).json({ error: message })
  }
}
