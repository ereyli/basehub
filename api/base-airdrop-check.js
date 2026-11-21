import { ADDRESS, ZERO } from './_airdropRegistry.js'
import { createRpc, createScanRpc, parseCutoff, scanWallet } from './_airdropScanner.js'

const cache = new Map()
const pending = new Map()
const recordCache = new Map()
const CACHE_TTL = 5 * 60_000
const FALLBACK_TTL = 60 * 60_000
const CACHE_MAX = 100
const MAX_CONCURRENT = 6
const MAX_WAITING = 12
const QUEUE_TIMEOUT = 8_000
const waiting = []
let active = 0

function sendVerified(res, { result, expires }) {
  const seconds = Math.floor((expires - Date.now()) / 1000)
  if (seconds > 0) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    res.setHeader('Vercel-CDN-Cache-Control', `public, max-age=${seconds}`)
  }
  return res.status(200).json(result)
}

function sendPrevious(res, { result }) {
  return res.status(200).json({ ...result, refreshDeferred: true })
}

function acquireScanSlot() {
  if (active < MAX_CONCURRENT) {
    active += 1
    return Promise.resolve(true)
  }
  if (waiting.length >= MAX_WAITING) return Promise.resolve(false)

  return new Promise((resolve) => {
    const admit = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    const timeout = setTimeout(() => {
      waiting.splice(waiting.indexOf(admit), 1)
      resolve(false)
    }, QUEUE_TIMEOUT)
    waiting.push(admit)
  })
}

function releaseScanSlot() {
  const next = waiting.shift()
  if (next) next()
  else active -= 1
}

async function runScan(key, address, cutoff) {
  if (!await acquireScanSlot()) return null
  try {
    const deadline = AbortSignal.timeout(45_000)
    const index = createRpc(process.env.ALCHEMY_BASE_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${encodeURIComponent(key)}`, fetch, deadline)
    const chain = createRpc(process.env.BASE_AIRDROP_RPC_URL || 'https://base-rpc.publicnode.com', fetch, deadline, 3000)
    const backup = createRpc(process.env.BASE_RPC_URL || 'https://mainnet.base.org', fetch, deadline, 3000)
    return await scanWallet(createScanRpc(index, chain, backup), address, cutoff, fetch, recordCache)
  } finally {
    releaseScanSlot()
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Use GET to analyze a Base address.' })
  }
  const query = new URL(req.url || '/', 'http://localhost').searchParams
  const address = (query.get('address') ?? '').trim().toLowerCase()
  const date = query.get('date')
  const cutoff = parseCutoff(date)
  if (!ADDRESS.test(address) || address === ZERO) return res.status(400).json({ error: 'Enter a valid, non-zero Base address.' })
  if (cutoff === undefined) return res.status(400).json({ error: 'Choose a date between August 9, 2023 and today (UTC).' })
  const key = process.env.ALCHEMY_API_KEY?.trim()
  if (!key) return res.status(503).json({ error: 'Base history provider is not configured. Please try again later.' })

  const cacheKey = `${address}:${date || 'current'}`
  const cached = cache.get(cacheKey)
  if (cached?.expires > Date.now()) return sendVerified(res, cached)
  const previous = cached?.retainUntil > Date.now() ? cached : null
  if (cached && !previous) cache.delete(cacheKey)
  let scan = pending.get(cacheKey)
  if (!scan) {
    scan = runScan(key, address, cutoff).then((result) => {
      if (!result) return null
      if (result.coverage.estimateReady) {
        cache.delete(cacheKey)
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
        const now = Date.now()
        cache.set(cacheKey, { result, expires: now + CACHE_TTL, retainUntil: now + FALLBACK_TTL })
      }
      return result
    }).finally(() => pending.delete(cacheKey))
    pending.set(cacheKey, scan)
  }
  try {
    const result = await scan
    const verified = cache.get(cacheKey)
    if (result && verified?.result === result) return sendVerified(res, verified)
    if (previous) return sendPrevious(res, previous)
    if (result) return res.status(200).json(result)
    res.setHeader('Retry-After', '3')
    return res.status(429).json({ error: 'The scanner is at capacity. Please try again shortly.' })
  } catch {
    if (previous) return sendPrevious(res, previous)
    return res.status(503).json({ error: 'Base history could not be verified right now. Please retry in a moment.' })
  }
}
