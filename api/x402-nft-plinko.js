// x402 Payment for NFT Plinko (0.05 USDC) — payment only, outcome on client.
// Reference: api/x402-nft-wheel.js

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createX402PaymentMiddleware, createX402Route, getFacilitatorConfig } from './_x402BuilderCode.js'

const app = new Hono()

const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.05'
const NETWORK = process.env.X402_NETWORK || 'base'

let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = getFacilitatorConfig()
  console.log('✅ Plinko: CDP facilitator')
} else {
  facilitatorConfig = getFacilitatorConfig()
  console.log('⚠️ Plinko: fallback facilitator')
}

app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT', 'PAYMENT-SIGNATURE'],
    exposeHeaders: ['X-PAYMENT-RESPONSE', 'PAYMENT-RESPONSE', 'PAYMENT-REQUIRED'],
    maxAge: 86400,
  })
)

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    network: NETWORK,
    price: PRICE,
    recipient: RECEIVING_ADDRESS,
    service: 'NFT Plinko',
    facilitator: process.env.CDP_API_KEY_ID ? 'CDP' : 'Testnet',
    message: 'x402 payment endpoint for NFT Plinko is working',
  })
})

app.use(
  createX402PaymentMiddleware(
    {
      'POST /': createX402Route({
        price: PRICE,
        network: NETWORK,
        payTo: RECEIVING_ADDRESS,
        description: 'BaseHub NFT Plinko - Pay 0.05 USDC',
        maxTimeoutSeconds: 600,
      }),
    },
    facilitatorConfig
  )
)

app.post('/', (c) => {
  console.log('✅ POST / — NFT Plinko payment verified by middleware')
  return c.json({
    success: true,
    message: 'Payment verified successfully!',
    payment: {
      amount: PRICE,
      currency: 'USDC',
      network: NETWORK,
      recipient: RECEIVING_ADDRESS,
      service: 'NFT Plinko',
    },
  })
})

export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host']
    const fullUrl = `${protocol}://${host}/`

    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body,
    })

    const response = await app.fetch(request)

    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const responseBody = await response.text()
    res.status(response.status)

    if (responseBody) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        res.json(JSON.parse(responseBody))
      } else {
        res.send(responseBody)
      }
    } else {
      res.end()
    }
  } catch (error) {
    console.error('❌ x402-nft-plinko handler:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', message: error.message })
    }
  }
}
