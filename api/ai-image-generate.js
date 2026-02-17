// Server-side proxy for AI image generation (MiniMax + Gemini). No VITE_ keys – set in Vercel:
// MINIMAX_API_KEY, GOOGLE_STUDIO_API_KEY (optional fallback)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const minimaxKey = process.env.MINIMAX_API_KEY
  const googleKey = process.env.GOOGLE_STUDIO_API_KEY
  if (!minimaxKey && !googleKey) {
    console.error('Neither MINIMAX_API_KEY nor GOOGLE_STUDIO_API_KEY set on server')
    return res.status(500).json({ error: 'AI image service not configured' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  const prompt = body.prompt && body.prompt.trim()
  if (!prompt) return res.status(400).json({ error: 'Missing or invalid prompt' })

  // 1) Try MiniMax first if key is set
  if (minimaxKey && minimaxKey !== 'YOUR_MINIMAX_API_KEY') {
    try {
      const response = await fetch('https://api.minimax.io/v1/image_generation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${minimaxKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'image-01',
          prompt,
          aspect_ratio: '1:1',
          response_format: 'base64',
        }),
      })
      if (response.ok) {
        const result = await response.json()
        const base64Image = result?.data?.image_base64?.[0]
        if (base64Image) {
          return res.status(200).json({ imageDataUrl: `data:image/jpeg;base64,${base64Image}` })
        }
      }
    } catch (e) {
      console.warn('MiniMax attempt failed:', e.message)
    }
  }

  // 2) Fallback: Gemini (GOOGLE_STUDIO_API_KEY on Vercel – important for production)
  if (googleKey && googleKey !== 'YOUR_GOOGLE_STUDIO_API_KEY') {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(googleKey)
      const imageModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' })
      const result = await imageModel.generateContent(prompt)
      const parts = result?.response?.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png'
          const b64 = typeof part.inlineData.data === 'string'
            ? part.inlineData.data
            : Buffer.from(part.inlineData.data).toString('base64')
          return res.status(200).json({ imageDataUrl: `data:${mime};base64,${b64}` })
        }
      }
    } catch (e) {
      console.warn('Gemini attempt failed:', e.message)
    }
  }

  return res.status(502).json({
    error: 'Image generation failed',
    details: 'MiniMax and Gemini both failed or are not configured',
  })
}
