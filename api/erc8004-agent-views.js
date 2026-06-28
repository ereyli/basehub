import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const MAX_AGENT_IDS = 200
const BOT_UA_RE = /bot|crawler|spider|preview|facebookexternalhit|slurp|telegrambot|discordbot|whatsapp|curl|wget/i

function clean(value) {
  return value == null ? '' : String(value).trim()
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function hash(value) {
  const salt = process.env.ERC8004_VIEW_SALT || process.env.SUPABASE_SERVICE_KEY || 'basehub-erc8004-views'
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex')
}

function getIp(req) {
  const forwarded = clean(req.headers['x-forwarded-for'])
  if (forwarded) return forwarded.split(',')[0].trim()
  return clean(req.headers['x-real-ip']) || clean(req.socket?.remoteAddress) || 'unknown'
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

function normalizeAgentId(value) {
  const agentId = clean(value)
  if (!/^[0-9]{1,78}$/.test(agentId)) return ''
  return agentId
}

function normalizeAddress(value) {
  const address = clean(value).toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(address) ? address : ''
}

function normalizeTxHash(value) {
  const txHash = clean(value).toLowerCase()
  return /^0x[a-f0-9]{64}$/.test(txHash) ? txHash : ''
}

function normalizeUrl(value) {
  const url = clean(value)
  if (!url) return ''
  if (url.startsWith('ipfs://')) return url.slice(0, 800)
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    return parsed.toString().slice(0, 800)
  } catch {
    return ''
  }
}

function getAgentIdsFromRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const raw = [
    ...url.searchParams.getAll('agentId'),
    ...url.searchParams.getAll('agentIds').flatMap((value) => clean(value).split(',')),
  ]
  return Array.from(new Set(raw.map(normalizeAgentId).filter(Boolean))).slice(0, MAX_AGENT_IDS)
}

async function handleGet(req, res, supabase) {
  const agentIds = getAgentIdsFromRequest(req)
  if (!agentIds.length) {
    return res.status(200).json({ ok: true, views: {} })
  }

  const { data, error } = await supabase
    .from('erc8004_agent_view_totals')
    .select('agent_id, view_count, unique_view_count, last_viewed_at')
    .in('agent_id', agentIds)

  if (error) {
    if (/erc8004_agent_view_totals|does not exist|schema cache/i.test(error.message || '')) {
      return res.status(200).json({ ok: true, views: {}, migrationRequired: true })
    }
    return res.status(502).json({ error: 'Failed to load agent views', detail: error.message })
  }

  const views = {}
  for (const row of data || []) {
    views[row.agent_id] = {
      viewCount: Number(row.view_count || 0),
      uniqueViewCount: Number(row.unique_view_count || 0),
      lastViewedAt: row.last_viewed_at || null,
    }
  }

  return res.status(200).json({ ok: true, views })
}

async function handlePost(req, res, supabase) {
  const body = parseJsonBody(req)
  if (!body) return res.status(400).json({ error: 'Invalid JSON' })

  const agentId = normalizeAgentId(body.agentId)
  if (!agentId) return res.status(400).json({ error: 'Invalid agentId' })

  const userAgent = clean(req.headers['user-agent'])
  if (!userAgent || BOT_UA_RE.test(userAgent)) {
    return res.status(200).json({ ok: true, ignored: true, reason: 'non_human_client' })
  }

  const acceptLanguage = clean(req.headers['accept-language']).slice(0, 120)
  const viewerHash = hash(`${getIp(req)}|${userAgent}|${acceptLanguage}`)
  const userAgentHash = hash(userAgent)
  const referrer = clean(body.referrer) || clean(req.headers.referer)

  const { data, error } = await supabase.rpc('record_erc8004_agent_view', {
    p_agent_id: agentId,
    p_owner_address: normalizeAddress(body.owner),
    p_metadata_uri: normalizeUrl(body.metadataUri),
    p_tx_hash: normalizeTxHash(body.txHash),
    p_viewer_hash: viewerHash,
    p_referrer: normalizeUrl(referrer),
    p_user_agent_hash: userAgentHash,
  })

  if (error) {
    if (/record_erc8004_agent_view|erc8004_agent_view|does not exist|schema cache/i.test(error.message || '')) {
      return res.status(503).json({
        error: 'ERC-8004 agent view storage is missing',
        detail: 'Apply supabase/migrations/20260628123000_erc8004_agent_views.sql.',
        migrationRequired: true,
      })
    }
    return res.status(502).json({ error: 'Failed to record agent view', detail: error.message })
  }

  const row = Array.isArray(data) ? data[0] : data
  return res.status(200).json({
    ok: true,
    agentId,
    viewCount: Number(row?.view_count || 0),
    uniqueViewCount: Number(row?.unique_view_count || 0),
    counted: Boolean(row?.counted),
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const supabase = getServerSupabase()
  if (!supabase) return res.status(503).json({ error: 'Supabase service key missing' })

  try {
    if (req.method === 'GET') return handleGet(req, res, supabase)
    if (req.method === 'POST') return handlePost(req, res, supabase)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('erc8004-agent-views:', error)
    return res.status(500).json({ error: error.message || 'Unexpected error' })
  }
}
