// x402 Payment Endpoint for BaseHub using Hono
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'

const app = new Hono()

// Your receiving wallet address
const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

// Payment configuration
const PRICE = '$0.10' // 0.1 USDC
const NETWORK = process.env.X402_NETWORK || 'base' // 'base' for mainnet, 'base-sepolia' for testnet

// Configure facilitator
let facilitatorConfig
try {
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
    // Use CDP facilitator for mainnet
    facilitatorConfig = facilitator({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
    })
    console.log('✅ Using CDP facilitator for mainnet')
  } else {
    // Use testnet facilitator
    facilitatorConfig = { url: 'https://x402.org/facilitator' }
    console.log('✅ Using testnet facilitator')
  }
} catch (error) {
  console.error('❌ Error configuring facilitator:', error)
  // Fallback to testnet facilitator
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
  console.log('⚠️ Fallback to testnet facilitator')
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
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    network: NETWORK,
    price: PRICE,
    recipient: RECEIVING_ADDRESS,
    facilitator: process.env.CDP_API_KEY_ID ? 'CDP' : 'Testnet',
  })
})

// Apply x402 payment middleware (following Coinbase documentation exactly)
// Note: In Vercel, this file at /api/x402-payment.js automatically creates /api/x402-payment endpoint
// So the route path should be '/' relative to the file
try {
  console.log('🔧 Applying x402 payment middleware...')
  app.use(
    paymentMiddleware(
      RECEIVING_ADDRESS, // your receiving wallet address
      {
        // Route configurations for protected endpoints (path only, method specified in route handler)
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
  throw error
}

// x402 Payment endpoint
app.post('/', (c) => {
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
// Vercel handler format - convert Node.js req/res to Web Standard Request/Response for Hono
export default async function handler(req, res) {
  try {
    // In Vercel, req.url is relative to the function endpoint
    // For /api/x402-payment.js, req.url will be '/'
    const path = req.url || '/'
    
    // Build full URL for Hono
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
    const url = `${protocol}://${host}${path}`

    console.log('🔍 Vercel handler:', {
      method: req.method,
      url: req.url,
      path: path,
      fullUrl: url,
      headers: Object.keys(req.headers || {}),
    })

    // Get request body
    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') {
        body = req.body
      } else if (req.body) {
        body = JSON.stringify(req.body)
      }
    }

    // Create Web Standard Request
    const request = new Request(url, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
    })

    console.log('📤 Calling Hono app with request:', {
      method: request.method,
      url: request.url,
    })

    // Call Hono app
    const response = await app.fetch(request)

    console.log('📥 Hono response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    // Get response body
    const responseBody = await response.text()

    // Send response
    res.status(response.status)
    if (responseBody) {
      res.send(responseBody)
    } else {
      res.end()
    }
  } catch (error) {
    console.error('❌ Vercel handler error:', error)
    console.error('Error stack:', error.stack)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Server error',
      })
    }
  }
}
