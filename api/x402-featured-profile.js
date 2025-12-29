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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseKey = supabaseServiceKey || supabaseAnonKey

console.log('🔑 Supabase Configuration:', {
  url: supabaseUrl ? '✅ Set' : '❌ Missing',
  serviceKey: supabaseServiceKey ? '✅ Set (bypasses RLS)' : '❌ Missing',
  anonKey: supabaseAnonKey ? '✅ Set (RLS enforced)' : '❌ Missing',
  usingKey: supabaseServiceKey ? 'SERVICE_KEY (recommended)' : (supabaseAnonKey ? 'ANON_KEY (RLS enforced)' : 'NONE')
})

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found! Featured profiles will not work.')
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel environment variables.')
}

if (!supabaseServiceKey && supabaseAnonKey) {
  console.warn('⚠️ WARNING: Using ANON_KEY instead of SERVICE_KEY!')
  console.warn('⚠️ This means RLS policies will be enforced and inserts may fail.')
  console.warn('⚠️ Please set SUPABASE_SERVICE_KEY in Vercel to bypass RLS.')
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
// Payment middleware - Single endpoint with dynamic pricing
// ==========================================

app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: '$0.20', // Minimum price (daily)
        network: NETWORK,
        config: {
          description: 'BaseHub Featured Profile Registration',
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  )
)

// Single POST endpoint that handles all subscription types
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { subscription_type } = body
    
    // Validate subscription type
    if (!subscription_type || !PRICING[subscription_type]) {
      return c.json({ 
        success: false, 
        error: 'Invalid subscription type. Must be: daily, weekly, or monthly' 
      }, 400)
    }
    
    const pricing = PRICING[subscription_type]
    console.log(`💰 Processing ${subscription_type} subscription: ${pricing.price}`)
    
    return await handleProfileRegistration(c, subscription_type, pricing)
  } catch (err) {
    console.error('❌ Request error:', err)
    return c.json({ 
      success: false, 
      error: 'Invalid request body' 
    }, 400)
  }
})

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

    // Check for existing active profile
    const { data: existingActive } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('farcaster_fid', farcaster_fid)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single()

    // If user has an active profile, prevent re-registration
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

    // Check for any existing profile (even expired) for position tracking
    const { data: existing } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('farcaster_fid', farcaster_fid)
      .single()

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pricing.days)

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
      
      // Check if it's an RLS policy error
      if (error.message && error.message.includes('row-level security policy')) {
        console.error('🔒 RLS Policy Error detected!')
        console.error('This means:')
        console.error('1. You are using ANON_KEY instead of SERVICE_KEY, OR')
        console.error('2. RLS policies need to be updated in Supabase')
        console.error('')
        console.error('Solution:')
        console.error('- Set SUPABASE_SERVICE_KEY in Vercel (recommended), OR')
        console.error('- Run the SQL in featured-profiles-rls-policies-fix.sql in Supabase SQL Editor')
      }
      
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
    // All requests to /api/x402-featured-profile should map to '/'
    const normalizedPath = '/'
    
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

    // Set status first
    res.status(response.status)

    // Copy headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    // Clone response to avoid body stream already read error
    const clonedResponse = response.clone()
    
    // Check if response has body
    if (response.body) {
      const contentType = response.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        const jsonData = await clonedResponse.json()
        res.json(jsonData)
      } else {
        const textData = await clonedResponse.text()
        res.send(textData)
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

