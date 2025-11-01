// x402 Payment Endpoint for BaseHub using Hono
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
// Facilitator import for mainnet
import { facilitator } from '@coinbase/x402'

const app = new Hono()

// Your receiving wallet address
const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

// Payment configuration
const PRICE = '$0.10' // 0.1 USDC
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
// Following the exact pattern from x402.md Hono example
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS, // your receiving wallet address
    {
      // Route configurations for protected endpoints
      // Path matches the route handler path
      '/': {
        price: PRICE, // '$0.10'
        network: NETWORK, // 'base' for mainnet
        config: {
          description: 'BaseHub x402 Payment - Pay 0.1 USDC',
          mimeType: 'application/json',
        },
      },
    },
    facilitatorConfig // facilitator configuration (CDP facilitator for mainnet)
  )
)

// x402 Payment endpoint - protected by middleware above
// Following x402.md documentation: route handler after middleware
// When payment is verified, middleware calls this handler
app.post('/', async (c) => {
  console.log('✅ POST / endpoint called (payment verified)')
  
  // Safely get headers
  const headersObj = {}
  if (c.req.headers && typeof c.req.headers.entries === 'function') {
    try {
      headersObj = Object.fromEntries(c.req.headers.entries())
    } catch (e) {
      console.warn('⚠️  Could not parse headers:', e)
    }
  }
  
  console.log('📋 Request details:', {
    method: c.req.method,
    url: c.req.url,
    headers: headersObj,
  })
  
  try {
  // Check if payment header is present (middleware should have verified it)
  let paymentHeader = null
  try {
    paymentHeader = c.req.header('X-PAYMENT')
  } catch (e) {
    console.warn('⚠️  Could not read X-PAYMENT header:', e)
  }
  console.log('💰 Payment header present:', !!paymentHeader)
    
    if (!paymentHeader) {
      console.warn('⚠️  No X-PAYMENT header found - middleware may not have verified payment')
      // Don't reject, middleware should have handled this
    }
    
    // If we reach here, payment has been verified by middleware
    const response = {
      success: true,
      message: 'Payment verified successfully!',
      payment: {
        amount: PRICE,
        currency: 'USDC',
        network: NETWORK,
        recipient: RECEIVING_ADDRESS,
      },
      timestamp: new Date().toISOString(),
      data: {
        paymentCompleted: true,
      },
    }
    
    console.log('✅ Payment verified, returning success response:', response)
    
    // Set explicit status 200 to ensure middleware doesn't override
    return c.json(response, 200)
  } catch (error) {
    console.error('❌ Error in payment endpoint:', error)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    
    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Payment processing failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500)
  }
})

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

    // In Vercel, /api/x402-payment.js creates /api/x402-payment endpoint
    // req.url will be '/' for requests to the function root
    // We need to normalize the path to '/' for Hono routes
    
    // Parse query string if present
    const urlParts = (req.url || '/').split('?')
    const path = urlParts[0] || '/'
    const queryString = urlParts[1] || ''
    
    // Normalize path: For Vercel API routes, always use '/' as the base path
    // because Hono routes are defined relative to the function endpoint
    const normalizedPath = '/' // Always use root for this function
    
    // Build full URL for Hono Request
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
    const fullUrl = `${protocol}://${host}${normalizedPath}${queryString ? `?${queryString}` : ''}`
    
    console.log('📤 Creating Hono Request:', {
      originalPath: path,
      normalizedPath,
      queryString,
      fullUrl,
      method: req.method,
    })
    
    // Get body if available
    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    // Create Web Standard Request for Hono
    // IMPORTANT: Path is normalized to '/' because Hono routes are defined at root
    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
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
      } catch (e) {
        console.log('⚠️  Could not parse 402 response body')
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
