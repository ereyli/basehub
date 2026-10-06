import { createHash, createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

export const NFT_BUCKET = 'nft-assets'
const MAX_FILE_BYTES = 3 * 1024 * 1024
const MAX_METADATA_BYTES = 64 * 1024
const recentRequests = new Map()

export async function storeAsset(client, bytes, contentType, extension) {
  const hash = createHash('sha256').update(bytes).digest('hex')
  const path = `${contentType === 'application/json' ? 'metadata' : 'images'}/${hash}.${extension}`
  const bucket = client.storage.from(NFT_BUCKET)
  const { error } = await bucket.upload(path, bytes, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error && String(error.statusCode) !== '409' && error.error !== 'Duplicate') throw error
  return { url: bucket.getPublicUrl(path).data.publicUrl, path }
}

export default async function handler(req, res) {
  const origin = req.headers?.origin
  const allowedOrigins = new Set(['https://basehub.fun', 'https://www.basehub.fun', 'http://localhost:5173', 'http://127.0.0.1:5173'])
  if (process.env.VERCEL_URL) allowedOrigins.add(`https://${process.env.VERCEL_URL}`)
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Origin not allowed' })
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // A local burst limit supplements platform-level request protection.
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]
  const now = Date.now()
  for (const [key, value] of recentRequests) if (now - value.start > 60000) recentRequests.delete(key)
  const requests = recentRequests.get(ip) || { start: now, count: 0 }
  if (++requests.count > 20) return res.status(429).json({ error: 'Too many uploads. Try again shortly.' })
  recentRequests.set(ip, requests)

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'NFT storage is not configured' })
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  try {
    let bytes, contentType, extension
    if (body?.type === 'file') {
      if (typeof body.imageBase64 !== 'string') return res.status(400).json({ error: 'Missing image' })
      const base64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '')
      if (base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) return res.status(413).json({ error: 'Image exceeds 3 MB' })
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return res.status(400).json({ error: 'Invalid image encoding' })
      bytes = Buffer.from(base64, 'base64')
      if (bytes.length > MAX_FILE_BYTES) return res.status(413).json({ error: 'Image exceeds 3 MB' })
      let image
      try {
        const decoder = sharp(bytes, { limitInputPixels: 4096 * 4096 })
        image = await decoder.metadata()
        await decoder.stats()
      } catch { return res.status(400).json({ error: 'Invalid image' }) }
      const formats = { jpeg: ['image/jpeg', 'jpg'], png: ['image/png', 'png'], webp: ['image/webp', 'webp'], gif: ['image/gif', 'gif'] }
      if (!formats[image.format]) return res.status(400).json({ error: 'Unsupported image format' })
      ;[contentType, extension] = formats[image.format]
    } else if (body?.type === 'metadata') {
      const metadata = body.metadata
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || typeof metadata.name !== 'string' || typeof metadata.image !== 'string' || !/^(https:\/\/|ipfs:\/\/)/.test(metadata.image)) {
        return res.status(400).json({ error: 'Invalid NFT metadata' })
      }
      bytes = Buffer.from(JSON.stringify(metadata))
      if (bytes.length > MAX_METADATA_BYTES) return res.status(413).json({ error: 'Metadata exceeds 64 KB' })
      contentType = 'application/json'
      extension = 'json'
    } else return res.status(400).json({ error: 'Invalid upload type' })
    const ipHash = createHmac('sha256', key).update(ip).digest('hex')
    const { data: allowed, error: limitError } = await client.rpc('consume_nft_upload_quota', { p_subject: ipHash })
    if (limitError) throw limitError
    if (!allowed) {
      res.setHeader('Retry-After', '60')
      return res.status(429).json({ error: 'Upload limit reached. Please try again later.' })
    }
    return res.status(200).json(await storeAsset(client, bytes, contentType, extension))
  } catch (error) {
    console.error('NFT storage upload failed:', error?.message)
    return res.status(502).json({ error: 'NFT upload failed. Please try again.' })
  }
}
