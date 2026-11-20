import { ADDRESS, ZERO } from './_airdropRegistry.js'
import { createRpc, createScanRpc, parseCutoff, scanWallet } from './_airdropScanner.js'

const cache = new Map()
const pending = new Map()
const CACHE_TTL = 5 * 60_000
const CACHE_MAX = 100
const MAX_CONCURRENT = 6

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
  if (cached?.expires > Date.now()) return res.status(200).json(cached.result)
  if (cached) cache.delete(cacheKey)
  let scan = pending.get(cacheKey)
  if (!scan && pending.size >= MAX_CONCURRENT) {
    res.setHeader('Retry-After', '10')
    return res.status(429).json({ error: 'The scanner is busy. Try again in a few seconds.' })
  }
  if (!scan) {
    const deadline = AbortSignal.timeout(46_000)
    const index = createRpc(process.env.ALCHEMY_BASE_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${encodeURIComponent(key)}`, fetch, deadline)
    const chain = createRpc(process.env.BASE_AIRDROP_RPC_URL || 'https://base-rpc.publicnode.com', fetch, deadline)
    const backup = createRpc(process.env.BASE_RPC_URL || 'https://mainnet.base.org', fetch, deadline)
    const rpc = createScanRpc(index, chain, backup)
    scan = scanWallet(rpc, address, cutoff).then((result) => {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
      const ttl = result.coverage.historyUnavailable ? 0 : result.coverage.activityComplete ? CACHE_TTL : 45_000
      if (ttl) cache.set(cacheKey, { result, expires: Date.now() + ttl })
      return result
    }).finally(() => pending.delete(cacheKey))
    pending.set(cacheKey, scan)
  }
  try {
    return res.status(200).json(await scan)
  } catch {
    return res.status(503).json({ error: 'Base history could not be verified right now. Please retry in a moment.' })
  }
}
