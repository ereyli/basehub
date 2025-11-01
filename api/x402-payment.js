// x402 Payment Endpoint for BaseHub using Hono
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
// Facilitator import - conditional for mainnet
// import { facilitator } from '@coinbase/x402' // Uncomment when using mainnet with CDP keys

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

// For now, use testnet facilitator
// When ready for mainnet, uncomment the import above and use:
// facilitatorConfig = facilitator
facilitatorConfig = { url: 'https://x402.org/facilitator' }
console.log('✅ Using testnet facilitator')

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
  console.log('✅ Health check endpoint called')
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
  console.log('✅ Test endpoint called')
  return c.json({ message: 'Test endpoint works', timestamp: new Date().toISOString() })
})

// Apply x402 payment middleware (following Coinbase documentation exactly)
// Note: In Vercel, this file at /api/x402-payment.js automatically creates /api/x402-payment endpoint
// The route path in middleware config should match the route handler path
try {
  console.log('🔧 Applying x402 payment middleware...')
  console.log('Middleware config:', {
    receivingAddress: RECEIVING_ADDRESS,
    price: PRICE,
    network: NETWORK,
    facilitator: facilitatorConfig,
  })
  
  app.use(
    paymentMiddleware(
      RECEIVING_ADDRESS, // your receiving wallet address
      {
        // Route configurations for protected endpoints
        // Path must match the route handler path exactly
        '/': {
          price: PRICE,
          network: NETWORK, // 'base' for mainnet, 'base-sepolia' for testnet
          config: {
            description: 'BaseHub x402 Payment - Pay 0.1 USDC',
            mimeType: 'application/json',
          },
        },
      },
      facilitatorConfig // facilitator configuration
    )
  )
  console.log('✅ x402 payment middleware applied successfully')
} catch (error) {
  console.error('❌ Error applying x402 middleware:', error)
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
  })
  throw error
}

// x402 Payment endpoint
// This will be protected by the payment middleware above
app.post('/', async (c) => {
  console.log('✅ POST / endpoint called (payment verified)')
  try {
    // If we reach here, payment has been verified by middleware
    return c.json({
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
    })
  } catch (error) {
    console.error('Error in payment endpoint:', error)
    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Payment processing failed',
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
      path: req.url,
      query: req.query,
    })

    // In Vercel, req.url is the path relative to the function endpoint
    // For /api/x402-payment.js, req.url will be '/' for root requests
    // Hono routes are defined with '/' so we need to match that
    
    // Build full URL for Hono Request
    // Use the original request URL to preserve path
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
    
    // Get the path from req.url (will be '/' for root, or path with query)
    const path = req.url || '/'
    const fullUrl = new URL(path, `${protocol}://${host}`).toString()
    
    console.log('📤 Creating Hono Request:', {
      path: path,
      fullUrl,
      method: req.method,
    })
    
    // Get body if available
    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    // Create Web Standard Request for Hono
    // Use '/' as path since Hono routes are defined relative to function endpoint
    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
    })

    console.log('📞 Calling Hono app.fetch...')
    // Call Hono app
    const response = await app.fetch(request)
    
    console.log('📥 Hono app response:', {
      status: response.status,
      statusText: response.statusText,
    })

    // Convert Hono Response to Vercel response
    // Copy headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    // Get body and send
    const responseBody = await response.text()
    res.status(response.status)
    
    if (responseBody) {
      // Check if it's JSON
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
    console.error('❌ Vercel handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Server error',
      })
    }
  }
}
