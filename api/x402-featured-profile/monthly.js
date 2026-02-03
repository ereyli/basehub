// Featured Profile Registration - Daily Subscription (0.2 USDC)
// This is a separate endpoint file for Vercel nested routes

import { Hono } from 'hono'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

const NETWORK = 'base'
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$6.00'
const SUBSCRIPTION_TYPE = 'monthly'
const PRICING = { price: '$6.00', amount: '6.0', days: 30 }

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseKey = supabaseServiceKey || supabaseAnonKey
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = facilitator
} else {
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
}

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['X-PAYMENT-RESPONSE'],
  maxAge: 86400,
}))

app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: PRICE,
        network: NETWORK,
        config: {
          description: 'BaseHub Featured Profile - Monthly',
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  )
)

app.post('/', async (c) => {
  if (!supabase) {
    return c.json({ success: false, error: 'Database not configured' }, 500)
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
      return c.json({ success: false, error: 'Farcaster FID required' }, 400)
    }

    const { data: existingActive } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('farcaster_fid', farcaster_fid)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingActive) {
      const expiresDate = new Date(existingActive.expires_at)
      const now = new Date()
      const daysRemaining = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24))
      
      return c.json({ 
        success: false, 
        error: `You already have an active featured profile! It expires in ${daysRemaining} day(s). Please wait until it expires before registering again.`,
        existing_profile: {
          expires_at: existingActive.expires_at,
          days_remaining: daysRemaining,
          subscription_type: existingActive.subscription_type
        }
      }, 400)
    }

    const { data: existing } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('farcaster_fid', farcaster_fid)
      .single()

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PRICING.days)

    const { data: maxPos } = await supabase
      .from('featured_profiles')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPos?.position || 0) + 1
    const paymentTxHash = c.req.header('X-PAYMENT-TX-HASH') || null

    const profileData = {
      farcaster_fid,
      username,
      display_name,
      avatar_url,
      bio,
      description: description || null,
      wallet_address,
      payment_tx_hash: paymentTxHash,
      payment_amount: PRICING.amount,
      subscription_type: SUBSCRIPTION_TYPE,
      subscription_days: PRICING.days,
      position: existing ? existing.position : newPosition,
      is_active: true,
      expires_at: expiresAt.toISOString(),
    }

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

    console.log(`✅ Profile registered: FID ${farcaster_fid}, Type: ${SUBSCRIPTION_TYPE}, Expires: ${expiresAt.toISOString()}`)

    return c.json({ 
      success: true, 
      profile: data,
      message: `Profile registered successfully! Active for ${PRICING.days} day(s).` 
    })
  } catch (err) {
    console.error('❌ Registration error:', err)
    return c.json({ 
      success: false, 
      error: err.message || 'Registration failed' 
    }, 500)
  }
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
    console.error('❌ Handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', message: error.message })
    }
  }
}
