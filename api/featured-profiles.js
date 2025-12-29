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
      console.error('❌ Supabase not configured')
      return c.json({ 
        success: false, 
        error: 'Database not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.' 
      }, 500)
    }

    // Try to deactivate expired profiles first (ignore errors if RPC doesn't exist yet)
    try {
      const { error: rpcError } = await supabase.rpc('deactivate_expired_profiles')
      if (rpcError) {
        console.warn('⚠️ RPC deactivate_expired_profiles failed (may not exist yet):', rpcError.message)
        // Continue anyway - we'll filter expired profiles in the query
      }
    } catch (rpcErr) {
      console.warn('⚠️ RPC deactivate_expired_profiles error (may not exist yet):', rpcErr.message)
      // Continue anyway
    }

    // Get active profiles, sorted by position (lowest = top) then by creation date
    // Filter by is_active and expires_at in the query
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('featured_profiles')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', now)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Supabase query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return c.json({ 
          success: false, 
          error: 'Database table not found. Please run the SQL schema in Supabase SQL Editor.',
          hint: 'Run featured-profiles-schema.sql in Supabase'
        }, 500)
      }
      
      throw error
    }

    return c.json({ 
      success: true, 
      profiles: data || [],
      count: data?.length || 0
    })
  } catch (err) {
    console.error('❌ List error:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    })
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to fetch profiles',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
    console.log('📥 Featured Profiles API request:', {
      method: req.method,
      url: req.url,
      path: req.url?.split('?')[0]
    })

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
    
    console.log('🔄 Normalized path:', { original: path, normalized: normalizedPath, fullUrl })
    
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

    console.log('📤 Featured Profiles API response:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      bodyLength: responseBody?.length || 0
    })

    if (responseBody) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          res.json(JSON.parse(responseBody))
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError)
          console.error('Response body:', responseBody.substring(0, 200))
          res.status(500).json({ 
            error: 'Invalid JSON response', 
            message: parseError.message 
          })
        }
      } else {
        res.send(responseBody)
      }
    } else {
      res.end()
    }
  } catch (error) {
    console.error('❌ Featured Profiles handler error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }
}

