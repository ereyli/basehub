// Featured Profile Registration Endpoint for BaseHub
// Users pay to register their profile and appear at the top of the list
// Payment: Variable USDC on Base via x402 (0.2 daily, 1.0 weekly, 6.0 monthly)

import { Hono } from 'hono'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

console.log('🚀 Featured Profile API loaded')

// ==========================================
// Configuration
// ==========================================
const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

// Subscription pricing
const PRICING = {
  daily: { price: '$0.20', amount: '0.2', days: 1 },
  weekly: { price: '$1.00', amount: '1.0', days: 7 },
  monthly: { price: '$6.00', amount: '6.0', days: 30 }
}

// Supabase client
// Support both VITE_ prefix (for frontend compatibility) and direct env vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not found! Featured profiles will not work.')
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = facilitator
  console.log('✅ Using CDP facilitator for Base mainnet')
} else {
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
  console.log('⚠️  WARNING: No CDP API keys found!')
}

// ==========================================
// CORS middleware
// ==========================================
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['X-PAYMENT-RESPONSE'],
  maxAge: 86400,
}))

// ==========================================
// Health check endpoint
// ==========================================
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Featured Profile Registration',
    pricing: PRICING,
    paymentNetwork: NETWORK,
  })
})

// ==========================================
// Payment middleware for each subscription type
// ==========================================

// Daily subscription (0.2 USDC)
app.post('/daily', 
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /daily': {
        price: PRICING.daily.price,
        network: NETWORK,
        config: {
          description: `BaseHub Featured Profile - Daily subscription (${PRICING.daily.price} USDC)`,
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  ),
  async (c) => await handleProfileRegistration(c, 'daily', PRICING.daily)
)

// Weekly subscription (1.0 USDC)
app.post('/weekly',
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /weekly': {
        price: PRICING.weekly.price,
        network: NETWORK,
        config: {
          description: `BaseHub Featured Profile - Weekly subscription (${PRICING.weekly.price} USDC)`,
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  ),
  async (c) => await handleProfileRegistration(c, 'weekly', PRICING.weekly)
)

// Monthly subscription (6.0 USDC)
app.post('/monthly',
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /monthly': {
        price: PRICING.monthly.price,
        network: NETWORK,
        config: {
          description: `BaseHub Featured Profile - Monthly subscription (${PRICING.monthly.price} USDC)`,
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  ),
  async (c) => await handleProfileRegistration(c, 'monthly', PRICING.monthly)
)

// ==========================================
// Profile Registration Handler
// ==========================================
async function handleProfileRegistration(c, subscriptionType, pricing) {
  if (!supabase) {
    return c.json({ 
      success: false, 
      error: 'Database not configured' 
    }, 500)
  }

  try {
    const { 
      farcaster_fid, 
      username, 
      display_name, 
      avatar_url, 
      bio, 
      description,
      wallet_address 
    } = await c.req.json()
    
    if (!farcaster_fid) {
      return c.json({ 
        success: false, 
        error: 'Farcaster FID required' 
      }, 400)
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pricing.days)

    // Check for existing profile
    const { data: existing } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('farcaster_fid', farcaster_fid)
      .single()

    // Get next position (new profiles go to top)
    const { data: maxPos } = await supabase
      .from('featured_profiles')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPos?.position || 0) + 1

    // Get payment transaction hash from x402 header if available
    const paymentTxHash = c.req.header('X-PAYMENT-TX-HASH') || null

    const profileData = {
      farcaster_fid,
      username,
      display_name,
      avatar_url,
      bio,
      description: description || null, // Kullanıcının yazdığı açıklama
      wallet_address,
      payment_tx_hash: paymentTxHash,
      payment_amount: pricing.amount,
      subscription_type: subscriptionType,
      subscription_days: pricing.days,
      position: existing ? existing.position : newPosition, // Keep position if renewing
      is_active: true,
      expires_at: expiresAt.toISOString(),
    }

    // Insert or update profile
    const { data, error } = existing
      ? await supabase
          .from('featured_profiles')
          .update(profileData)
          .eq('farcaster_fid', farcaster_fid)
          .select()
          .single()
      : await supabase
          .from('featured_profiles')
          .insert(profileData)
          .select()
          .single()

    if (error) {
      console.error('❌ Supabase error:', error)
      throw error
    }

    console.log(`✅ Profile registered: FID ${farcaster_fid}, Type: ${subscriptionType}, Expires: ${expiresAt.toISOString()}`)

    return c.json({ 
      success: true, 
      profile: data,
      message: `Profile registered successfully! Active for ${pricing.days} day(s).` 
    })
  } catch (err) {
    console.error('❌ Registration error:', err)
    return c.json({ 
      success: false, 
      error: err.message || 'Registration failed' 
    }, 500)
  }
}

// Vercel handler
export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host']
    const url = req.url || '/'
    
    // Parse query string if present
    const urlParts = url.split('?')
    const path = urlParts[0] || '/'
    const queryString = urlParts[1] || ''
    
    // For Vercel API routes, the path should be relative to the function
    // If the request is to /api/x402-featured-profile, the path in the function is '/'
    // If the request is to /api/x402-featured-profile/daily, the path in the function is '/daily'
    const normalizedPath = path.replace(/^\/api\/x402-featured-profile/, '') || '/'
    
    const fullUrl = `${protocol}://${host}${normalizedPath}${queryString ? `?${queryString}` : ''}`
    
    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
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
    console.error('❌ Featured Profile handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', message: error.message })
    }
  }
}

