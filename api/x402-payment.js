// x402 Payment Endpoint for BaseHub using Hono
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-express'
import { facilitator } from '@coinbase/x402'

const app = new Hono()

// Your receiving wallet address
const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x0000000000000000000000000000000000000000'

// Payment configuration
const PRICE = '$0.1' // 0.1 USDC
const NETWORK = process.env.X402_NETWORK || 'base' // 'base' for mainnet, 'base-sepolia' for testnet

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  // Use CDP facilitator for mainnet
  facilitatorConfig = facilitator({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  })
} else {
  // Use testnet facilitator
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
}

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['X-PAYMENT-RESPONSE'],
  maxAge: 86400,
}))

// Create Express-like request/response wrappers for x402 middleware
const createExpressAdapter = async (c) => {
  // Get request body if available
  let body = {}
  try {
    if (c.req.method === 'POST') {
      body = await c.req.json().catch(() => {})
    }
  } catch (e) {
    // Body parsing failed, use empty object
  }

  // Collect headers from raw request
  const headers = {}
  if (c.req.raw && c.req.raw.headers) {
    const reqHeaders = c.req.raw.headers
    if (reqHeaders instanceof Headers) {
      for (const [key, value] of reqHeaders.entries()) {
        headers[key] = value
      }
    } else if (typeof reqHeaders === 'object') {
      // Node.js IncomingHttpHeaders
      Object.assign(headers, reqHeaders)
    }
  }

  const expressReq = {
    method: c.req.method,
    url: c.req.url,
    path: new URL(c.req.url).pathname,
    headers: headers,
    body: body,
    query: Object.fromEntries(new URL(c.req.url).searchParams),
  }

  let responseSent = false
  let responseStatus = 200
  let responseBody = null
  const responseHeaders = {}

  const expressRes = {
    status: (code) => {
      responseStatus = code
      return expressRes
    },
    json: (data) => {
      responseBody = data
      responseSent = true
      return expressRes
    },
    setHeader: (key, value) => {
      responseHeaders[key] = value
      return expressRes
    },
    getHeader: (key) => expressReq.headers[key.toLowerCase()],
    end: () => {
      responseSent = true
      return expressRes
    },
  }

  return { expressReq, expressRes, getResponse: () => ({ responseSent, responseStatus, responseBody, responseHeaders }) }
}

// Health check endpoint
app.get('/', async (c) => {
  return c.json({
    status: 'ok',
    network: NETWORK,
    price: PRICE,
    recipient: RECEIVING_ADDRESS,
    facilitator: process.env.CDP_API_KEY_ID ? 'CDP' : 'Testnet',
  })
})

// x402 Payment endpoint with middleware
app.post('/', async (c) => {
  try {
    // Create Express adapter
    const { expressReq, expressRes, getResponse } = await createExpressAdapter(c)

    // Apply x402 payment middleware
    await new Promise((resolve, reject) => {
      const middleware = paymentMiddleware(
        RECEIVING_ADDRESS,
        {
          'POST /': {
            price: PRICE,
            network: NETWORK,
            config: {
              description: 'BaseHub x402 Payment - Pay 0.1 USDC',
              mimeType: 'application/json',
            },
          },
        },
        facilitatorConfig
      )

      middleware(expressReq, expressRes, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // Get middleware response
    const { responseSent, responseStatus, responseBody, responseHeaders } = getResponse()

    // Set headers
    Object.entries(responseHeaders).forEach(([key, value]) => {
      c.header(key, value)
    })

    // If middleware sent 402 or handled response, return it
    if (responseSent) {
      return c.json(responseBody, responseStatus)
    }

    // If we reach here, payment was verified - return success
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
    console.error('x402 Payment error:', error)
    
    // Check if it's a 402 Payment Required error
    if (error.status === 402 || error.statusCode === 402) {
      return c.json({
        error: 'Payment Required',
        message: error.message || 'Payment required to access this endpoint',
      }, 402)
    }

    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Payment processing failed',
    }, 500)
  }
})

// Export for Vercel
export default app
