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
// Vercel automatically detects Hono app and uses app.fetch
// Reference: https://vercel.com/docs/functions/serverless-functions/runtimes/node-js#using-web-standards
export default app
