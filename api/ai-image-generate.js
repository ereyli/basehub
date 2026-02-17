// Server-side proxy for MiniMax image generation (avoids CORS from browser)
// Set MINIMAX_API_KEY in Vercel (or env) – do not use VITE_ prefix here (server-only)

export default async function handler(req, res) {
  // CORS: allow same-origin and basehub.fun
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey || apiKey === 'YOUR_MINIMAX_API_KEY') {
    console.error('MINIMAX_API_KEY not set on server')
    return res.status(500).json({ error: 'AI image service not configured' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  const prompt = body.prompt
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  try {
    const response = await fetch('https://api.minimax.io/v1/image_generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt: prompt.trim(),
        aspect_ratio: '1:1',
        response_format: 'base64',
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('MiniMax API error:', response.status, text)
      return res.status(response.status).json({
        error: 'Image generation failed',
        details: response.status === 401 ? 'Invalid API key' : text.slice(0, 200),
      })
    }

    const result = await response.json()
    const base64Image =
      result?.data?.image_base64?.[0]
    if (!base64Image) {
      return res.status(502).json({ error: 'No image in MiniMax response' })
    }

    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`
    return res.status(200).json({ imageDataUrl })
  } catch (err) {
    console.error('ai-image-generate proxy error:', err)
    return res.status(500).json({
      error: 'Image generation failed',
      message: err.message || 'Network or server error',
    })
  }
}
