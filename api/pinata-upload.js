// Server-side Pinata upload proxy – follows https://docs.pinata.cloud/quickstart
// Env: PINATA_JWT (required), PINATA_GATEWAY (optional, e.g. gateway.pinata.cloud or your Dedicated Gateway)
import { PinataSDK } from 'pinata'

const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud'

function getPinata() {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    console.error('Pinata: PINATA_JWT not set on server')
    return null
  }
  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway,
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pinata = getPinata()
  if (!pinata) {
    return res.status(500).json({ error: 'Upload service not configured' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const type = body.type
  try {
    if (type === 'file') {
      const { imageBase64, fileName = 'image.png', mimeType = 'image/png' } = body
      if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })
      // Strip data URL prefix if present (SDK expects raw base64)
      const base64 = imageBase64.replace(/^data:[^;]+;base64,/, '')
      const upload = await pinata.upload.public.base64(base64).name(fileName)
      const cid = upload.cid
      const url = `https://${gateway}/ipfs/${cid}`
      return res.status(200).json({ url, ipfsHash: cid })
    }

    if (type === 'metadata') {
      const { metadata } = body
      if (!metadata) return res.status(400).json({ error: 'Missing metadata' })
      const upload = await pinata.upload.public
        .json(metadata)
        .name(`nft-metadata-${Date.now()}.json`)
      const cid = upload.cid
      const url = `https://${gateway}/ipfs/${cid}`
      return res.status(200).json({ url, ipfsHash: cid })
    }

    return res.status(400).json({ error: 'Invalid type; use type: "file" or "metadata"' })
  } catch (err) {
    console.error('pinata-upload proxy error:', err)
    return res.status(500).json({
      error: 'Upload failed',
      message: err?.message || err?.toString?.() || 'Server error',
    })
  }
}
