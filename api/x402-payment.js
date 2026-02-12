// x402 Payment Endpoint for BaseHub using Hono
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
// Facilitator import for mainnet
import { facilitator } from '@coinbase/x402'
import { getRequestUrl } from './x402-request-url.js'

const app = new Hono()

// Your receiving wallet address
const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

// Payment configuration
const PRICE = '$0.1' // 0.1 USDC (AI NFT generation cost)
const NETWORK = process.env.X402_NETWORK || 'base' // 'base' for mainnet, 'base-sepolia' for testnet

// Configure facilitator
// Following x402.md documentation exactly
// For testnet: { url: "https://x402.org/facilitator" }
// For mainnet: use facilitator from @coinbase/x402 (requires CDP API keys)
let facilitatorConfig

// Facilitator configuration for Base mainnet
// For mainnet: requires CDP API keys and facilitator from @coinbase/x402
// For testnet: use { url: "https://x402.org/facilitator" }
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  // Use CDP facilitator for mainnet
  facilitatorConfig = facilitator
  console.log('✅ Using CDP facilitator for Base mainnet')
  console.log('✅ CDP API keys found:', {
    keyId: process.env.CDP_API_KEY_ID ? 'Set' : 'Missing',
    keySecret: process.env.CDP_API_KEY_SECRET ? 'Set' : 'Missing',
  })
} else {
  // Use testnet facilitator when no CDP keys (will cause errors on mainnet)
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
  console.log('⚠️  WARNING: No CDP API keys found!')
  console.log('⚠️  NETWORK is "base" (mainnet) but using testnet facilitator')
  console.log('⚠️  Payments will FAIL on mainnet!')
  console.log('⚠️  To fix: Add CDP_API_KEY_ID and CDP_API_KEY_SECRET to Vercel environment variables')
}

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['X-PAYMENT-RESPONSE'],
  maxAge: 86400,
}))

// Health check endpoint (before payment middleware)
// Test endpoint to verify Hono is working
app.get('/', (c) => {
  console.log('✅ GET / health check endpoint called')
  return c.json({
    status: 'ok',
    network: NETWORK,
    price: PRICE,
    recipient: RECEIVING_ADDRESS,
    facilitator: process.env.CDP_API_KEY_ID ? 'CDP' : 'Testnet',
    message: 'x402 payment endpoint is working',
  })
})

// Test endpoint without payment middleware
app.get('/test', (c) => {
  console.log('✅ GET /test endpoint called')
  return c.json({ message: 'Test endpoint works', timestamp: new Date().toISOString() })
})

// Apply x402 payment middleware (following x402.md documentation exactly)
// Middleware MUST be applied BEFORE route handlers
// Following the exact pattern from x402.md Hono example (lines 204-218)
// NOTE: Middleware performs settlement AFTER route handler returns
// If settlement fails, middleware will override route handler's response with 402
// Route configuration format: "METHOD /path" or "/path" (matches any method)
const X402_PAYMENT_PATH = '/api/x402-payment'
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: PRICE,
        network: NETWORK,
        config: {
          description: 'BaseHub x402 Payment - Pay 0.1 USDC',
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
      [`POST ${X402_PAYMENT_PATH}`]: { price: PRICE, network: NETWORK, config: { description: 'BaseHub x402 Payment - Pay 0.1 USDC', mimeType: 'application/json', maxTimeoutSeconds: 600 } },
    },
    facilitatorConfig
  )
)

const paymentSuccess = (c) => {
  console.log('✅ Payment verified by middleware')
  return c.json({
    success: true,
    message: 'Payment verified successfully!',
    payment: { amount: PRICE, currency: 'USDC', network: NETWORK, recipient: RECEIVING_ADDRESS },
  })
}
app.post('/', paymentSuccess)
app.post(X402_PAYMENT_PATH, paymentSuccess)

// Export for Vercel (serverless function)
// Vercel serverless function handler format
export default async function handler(req, res) {
  try {
    console.log('🔍 Vercel handler called:', {
      method: req.method,
      url: req.url,
      originalUrl: req.url,
      query: req.query,
      headers: {
        host: req.headers.host,
        'x-forwarded-host': req.headers['x-forwarded-host'],
      },
    })

    // URL must match client request URL for x402 payment verification (web + Farcaster)
    const fullUrl = getRequestUrl(req, X402_PAYMENT_PATH)
    console.log('📤 Creating Hono Request:', {
      fullUrl,
      method: req.method,
    })
    
    // Get body if available
    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    // Create Web Standard Request for Hono
    // IMPORTANT: Path must be exactly '/' for middleware route matching
    // Middleware uses findMatchingRoute which checks c.req.path
    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
    })
    
    // Log request details for debugging route matching
    console.log('🔍 Request details for middleware:', {
      url: fullUrl,
      method: req.method,
      hasXPayment: !!req.headers['x-payment'],
    })

    console.log('📞 Calling Hono app.fetch with normalized path...')
    // Call Hono app
    const response = await app.fetch(request)
    
    console.log('📥 Hono app response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })
    
    // Log response body for 402 responses (payment required)
    if (response.status === 402) {
      const clonedResponse = response.clone()
      try {
        const bodyText = await clonedResponse.text()
        const bodyJson = JSON.parse(bodyText)
        console.log('💰 402 Payment Required response:', bodyJson)
        
        // Log detailed error information if error is an object
        if (bodyJson.error && typeof bodyJson.error === 'object') {
          console.error('❌ Settlement error (object):', {
            errorType: bodyJson.error.constructor?.name || 'Unknown',
            errorKeys: Object.keys(bodyJson.error),
            errorStringified: JSON.stringify(bodyJson.error, null, 2),
            errorMessage: bodyJson.error.message || bodyJson.error.error || 'No message property',
            fullError: bodyJson.error,
          })
        } else if (bodyJson.error) {
          console.error('❌ Settlement error:', bodyJson.error)
        }
      } catch (e) {
        console.log('⚠️  Could not parse 402 response body:', e.message)
      }
    }

    // Convert Hono Response to Vercel response
    // Copy headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    // Get body and send
    const responseBody = await response.text()
    
    console.log('📤 Sending response to client:', {
      status: response.status,
      statusText: response.statusText,
      bodyLength: responseBody.length,
      contentType: response.headers.get('content-type'),
    })
    
    res.status(response.status)
    
    if (responseBody) {
      // Check if it's JSON
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          const jsonData = JSON.parse(responseBody)
          console.log('📦 JSON response body:', jsonData)
          res.json(jsonData)
        } catch (parseError) {
          console.error('❌ Error parsing JSON response:', parseError)
          res.send(responseBody)
        }
      } else {
        res.send(responseBody)
      }
    } else {
      res.end()
    }
  } catch (error) {
    console.error('❌ Vercel handler error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  }
}
