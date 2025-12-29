// Featured Profiles List Endpoint
// Returns list of active featured profiles sorted by position

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

console.log('🚀 Featured Profiles List API loaded')

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

app.use('/*', cors())

// Get all active featured profiles
app.get('/', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    // Deactivate expired profiles first
    await supabase.rpc('deactivate_expired_profiles').catch(() => {})

    // Get active profiles, sorted by position (lowest = top) then by creation date
    const { data, error } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Supabase error:', error)
      throw error
    }

    return c.json({ 
      success: true, 
      profiles: data || [],
      count: data?.length || 0
    })
  } catch (err) {
    console.error('❌ List error:', err)
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to fetch profiles' 
    }, 500)
  }
})

// Get single profile by FID
app.get('/:fid', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    const fid = parseInt(c.req.param('fid'))
    
    if (isNaN(fid)) {
      return c.json({ success: false, error: 'Invalid FID' }, 400)
    }

    const { data, error } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('farcaster_fid', fid)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ success: false, error: 'Profile not found' }, 404)
      }
      throw error
    }

    return c.json({ success: true, profile: data })
  } catch (err) {
    console.error('❌ Get profile error:', err)
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to fetch profile' 
    }, 500)
  }
})

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
    // If the request is to /api/featured-profiles, the path in the function is '/'
    // If the request is to /api/featured-profiles/123, the path in the function is '/123'
    const normalizedPath = path.replace(/^\/api\/featured-profiles/, '') || '/'
    
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
    console.error('❌ Featured Profiles handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', message: error.message })
    }
  }
}

