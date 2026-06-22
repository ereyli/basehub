import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createX402PaymentMiddleware, createX402Route } from './_x402BuilderCode.js'
import {
  AGENT_ACCESS_PASS_PRICE_USDC,
  AGENT_ACCESS_PRICE_USDC,
  getAgentAccess,
  grantAgentAccess,
  isEarlyAccessPassHolder,
  normalizeAddress,
} from './_agentAccess.js'

const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x0000000000000000000000000000000000000000'
const NETWORK = process.env.X402_NETWORK || 'base'

function getPaymentHash(c) {
  return (
    c.req.header('X-PAYMENT-TX-HASH') ||
    c.req.header('x-payment-tx-hash') ||
    c.req.header('X-TRANSACTION-HASH') ||
    c.req.header('x-transaction-hash') ||
    null
  )
}

async function readBody(c) {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

export function createAgentAccessPaymentApp({ discounted = false } = {}) {
  const app = new Hono()
  const price = discounted ? AGENT_ACCESS_PASS_PRICE_USDC : AGENT_ACCESS_PRICE_USDC
  const priceLabel = `${price} USDC`

  app.use(
    '/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT', 'PAYMENT-SIGNATURE'],
      exposeHeaders: ['X-PAYMENT-RESPONSE', 'PAYMENT-RESPONSE', 'PAYMENT-REQUIRED', 'X-PAYMENT-TX-HASH', 'X-TRANSACTION-HASH'],
      maxAge: 86400,
    })
  )

  app.get('/', (c) =>
    c.json({
      status: 'ok',
      product: 'agent_mode_access',
      discounted,
      price: `$${price}`,
      network: NETWORK,
      recipient: RECEIVING_ADDRESS,
    })
  )

  app.use(
    createX402PaymentMiddleware({
      'POST /': createX402Route({
        price: `$${price}`,
        network: NETWORK,
        payTo: RECEIVING_ADDRESS,
        description: discounted
          ? `BaseHub Agent Mode access with Early Access Pass discount - ${priceLabel}`
          : `BaseHub Agent Mode access - ${priceLabel}`,
        maxTimeoutSeconds: 600,
      }),
    })
  )

  app.post('/', async (c) => {
    const body = await readBody(c)
    const walletAddress = normalizeAddress(body.walletAddress || c.req.query('walletAddress'))
    const agentWalletAddress = normalizeAddress(body.agentWalletAddress || c.req.query('agentWalletAddress')) || null

    if (!walletAddress) {
      return c.json({ success: false, error: 'Valid walletAddress is required.' }, 400)
    }

    const existing = await getAgentAccess(walletAddress)
    if (existing.hasAccess) {
      return c.json({
        success: true,
        alreadyUnlocked: true,
        hasAccess: true,
        subscription: existing.subscription,
        price: priceLabel,
      })
    }

    if (discounted) {
      const passHolder = await isEarlyAccessPassHolder(walletAddress)
      if (!passHolder) {
        return c.json({
          success: false,
          error: 'Early Access Pass was not found in this wallet. Use the standard Agent Mode access payment.',
        }, 403)
      }
    }

    const subscription = await grantAgentAccess({
      walletAddress,
      agentWalletAddress,
      priceLabel,
      network: NETWORK,
      paymentTxHash: getPaymentHash(c),
      discountReason: discounted ? 'early_access_pass_30_percent' : null,
    })

    return c.json({
      success: true,
      hasAccess: true,
      discountApplied: discounted,
      price: priceLabel,
      subscription,
    })
  })

  return app
}

export async function runHonoApp(app, req, res) {
  const urlParts = (req.url || '/').split('?')
  const queryString = urlParts[1] || ''
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
  const fullUrl = `${protocol}://${host}/${queryString ? `?${queryString}` : ''}`

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
  response.headers.forEach((value, key) => res.setHeader(key, value))

  const responseBody = await response.text()
  res.status(response.status)
  if (!responseBody) {
    res.end()
    return
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      res.json(JSON.parse(responseBody))
      return
    } catch {
      // Fall through to raw response.
    }
  }
  res.send(responseBody)
}
