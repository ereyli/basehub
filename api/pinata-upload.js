// Server-side Pinata upload proxy – API keys stay on server (no VITE_)
// Set PINATA_API_KEY and PINATA_SECRET_KEY in Vercel (or PINATA_JWT)
import FormData from 'form-data'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.PINATA_API_KEY
  const secretKey = process.env.PINATA_SECRET_KEY
  const jwt = process.env.PINATA_JWT
  const hasAuth = (apiKey && secretKey) || jwt
  if (!hasAuth) {
    console.error('Pinata credentials not set on server (PINATA_API_KEY+SECRET or PINATA_JWT)')
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
      const buf = Buffer.from(imageBase64.replace(/^data:[^;]+;base64,/, ''), 'base64')
      const form = new FormData()
      form.append('file', buf, { filename: fileName, contentType: mimeType })
      form.append('pinataMetadata', JSON.stringify({ name: fileName, keyvalues: { type: 'nft-image' } }))
      form.append('pinataOptions', JSON.stringify({ cidVersion: 0, wrapWithDirectory: false }))
      const headers = { ...form.getHeaders() }
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`
      else {
        headers['pinata_api_key'] = apiKey
        headers['pinata_secret_api_key'] = secretKey
      }
      const formBuffer = await new Promise((resolve, reject) => {
        const chunks = []
        form.on('data', (chunk) => chunks.push(chunk))
        form.on('end', () => resolve(Buffer.concat(chunks)))
        form.on('error', reject)
      })
      headers['Content-Length'] = String(formBuffer.length)
      const r = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers,
        body: formBuffer,
      })
      if (!r.ok) {
        const t = await r.text()
        console.error('Pinata pinFile error:', r.status, t)
        return res.status(502).json({ error: 'Pinata upload failed', details: t.slice(0, 200) })
      }
      const result = await r.json()
      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
      return res.status(200).json({ url, ipfsHash: result.IpfsHash })
    }

    if (type === 'metadata') {
      const { metadata } = body
      if (!metadata) return res.status(400).json({ error: 'Missing metadata' })
      const payload = {
        pinataContent: metadata,
        pinataMetadata: { name: `nft-metadata-${Date.now()}`, keyvalues: { type: 'nft-metadata' } },
        pinataOptions: { cidVersion: 0 },
      }
      const headers = { 'Content-Type': 'application/json' }
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`
      else { headers['pinata_api_key'] = apiKey; headers['pinata_secret_api_key'] = secretKey }
      const r = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const t = await r.text()
        console.error('Pinata pinJSON error:', r.status, t)
        return res.status(502).json({ error: 'Pinata metadata upload failed', details: t.slice(0, 200) })
      }
      const result = await r.json()
      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
      return res.status(200).json({ url, ipfsHash: result.IpfsHash })
    }

    return res.status(400).json({ error: 'Invalid type; use type: "file" or "metadata"' })
  } catch (err) {
    console.error('pinata-upload proxy error:', err)
    return res.status(500).json({ error: 'Upload failed', message: err.message || 'Server error' })
  }
}
