// Featured Profiles List Endpoint
// Returns list of active featured profiles sorted by position

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

console.log('🚀 Featured Profiles List API loaded')

// Supabase client
// RLS is enabled, so we need SERVICE_KEY to bypass RLS
// Priority: SERVICE_KEY > ANON_KEY (for RLS bypass)
// Support both VITE_ prefix (for frontend compatibility) and direct env vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseKey = supabaseServiceKey || supabaseAnonKey

// Log environment variable status (without exposing values)
console.log('📋 Supabase Configuration:', {
  url: supabaseUrl ? '✅ Set' : '❌ Missing',
  serviceKey: supabaseServiceKey ? '✅ Set' : '❌ Missing',
  anonKey: supabaseAnonKey ? '✅ Set' : '❌ Missing',
  usingKey: supabaseServiceKey ? 'SERVICE_KEY' : (supabaseAnonKey ? 'ANON_KEY' : 'NONE')
})

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

if (!supabase) {
  console.error('❌ Supabase client not initialized!')
  console.error('Missing:', {
    url: !supabaseUrl,
    key: !supabaseKey
  })
}

app.use('/*', cors())

// Get all active featured profiles
app.get('/', async (c) => {
  try {
    if (!supabase) {
      console.error('❌ Supabase not configured')
      console.error('Environment check:', {
        SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'
      })
      return c.json({ 
        success: false, 
        error: 'Database not configured. Please check SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) environment variables in Vercel.',
        hint: 'RLS is enabled, so SUPABASE_SERVICE_KEY is recommended to bypass RLS policies.'
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
    
    console.log('🔍 Querying featured_profiles table...', {
      filters: {
        is_active: true,
        expires_at_gt: now
      }
    })
    
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

    // Calculate actual follow counts from follows table
    const profilesWithCounts = await Promise.all((data || []).map(async (profile) => {
      try {
        // Get actual followers count
        const { count: followersCount, error: followersError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_fid', profile.farcaster_fid)
        
        if (followersError) {
          console.error(`❌ Error getting followers count for FID ${profile.farcaster_fid}:`, followersError)
        }
        
        // Get actual mutual follows count
        const { count: mutualCount, error: mutualError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_fid', profile.farcaster_fid)
          .eq('is_mutual', true)

        if (mutualError) {
          console.error(`❌ Error getting mutual count for FID ${profile.farcaster_fid}:`, mutualError)
        }

        return {
          ...profile,
          followers_count: followersCount || profile.followers_count || 0,
          mutual_follows_count: mutualCount || profile.mutual_follows_count || 0
        }
      } catch (countError) {
        console.error(`❌ Error calculating counts for FID ${profile.farcaster_fid}:`, countError)
        // Return profile with existing counts if calculation fails
        return profile
      }
    }))

    console.log('✅ Profiles with counts:', profilesWithCounts.map(p => ({
      fid: p.farcaster_fid,
      followers: p.followers_count,
      mutual: p.mutual_follows_count
    })))

    return c.json({ 
      success: true, 
      profiles: profilesWithCounts || [],
      count: profilesWithCounts?.length || 0
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
    
    // Check environment variables at runtime (Vercel may not expose them at module load)
    if (!supabase) {
      // Check both VITE_ and direct env vars at runtime
      const runtimeUrlDirect = process.env.SUPABASE_URL
      const runtimeUrlVite = process.env.VITE_SUPABASE_URL
      const runtimeServiceKeyDirect = process.env.SUPABASE_SERVICE_KEY
      const runtimeServiceKeyVite = process.env.VITE_SUPABASE_SERVICE_KEY
      const runtimeAnonKeyDirect = process.env.SUPABASE_ANON_KEY
      const runtimeAnonKeyVite = process.env.VITE_SUPABASE_ANON_KEY
      
      const finalRuntimeUrl = runtimeUrlDirect || runtimeUrlVite
      const finalRuntimeServiceKey = runtimeServiceKeyDirect || runtimeServiceKeyVite
      const finalRuntimeAnonKey = runtimeAnonKeyDirect || runtimeAnonKeyVite
      const finalRuntimeKey = finalRuntimeServiceKey || finalRuntimeAnonKey
      
      console.log('🔄 Runtime environment check:', {
        url: finalRuntimeUrl ? '✅ Set' : '❌ Missing',
        serviceKey: finalRuntimeServiceKey ? '✅ Set' : '❌ Missing',
        anonKey: finalRuntimeAnonKey ? '✅ Set' : '❌ Missing',
        sources: {
          url: runtimeUrlDirect ? 'SUPABASE_URL' : (runtimeUrlVite ? 'VITE_SUPABASE_URL' : 'none'),
          serviceKey: runtimeServiceKeyDirect ? 'SUPABASE_SERVICE_KEY' : (runtimeServiceKeyVite ? 'VITE_SUPABASE_SERVICE_KEY' : 'none'),
          anonKey: runtimeAnonKeyDirect ? 'SUPABASE_ANON_KEY' : (runtimeAnonKeyVite ? 'VITE_SUPABASE_ANON_KEY' : 'none')
        }
      })
      
      const runtimeUrl = finalRuntimeUrl
      const runtimeKey = finalRuntimeKey
      
      if (!runtimeUrl || !runtimeKey) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured',
          details: {
            SUPABASE_URL: runtimeUrl ? 'Set' : 'Missing',
            VITE_SUPABASE_URL: runtimeUrlVite ? 'Set' : 'Missing',
            SUPABASE_SERVICE_KEY: finalRuntimeServiceKey ? 'Set' : 'Missing',
            VITE_SUPABASE_SERVICE_KEY: runtimeServiceKeyVite ? 'Set' : 'Missing',
            SUPABASE_ANON_KEY: finalRuntimeAnonKey ? 'Set' : 'Missing',
            VITE_SUPABASE_ANON_KEY: runtimeAnonKeyVite ? 'Set' : 'Missing'
          },
          hint: 'Please configure SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY (or VITE_SUPABASE_SERVICE_KEY) in Vercel Environment Variables. RLS is enabled, so SERVICE_KEY is recommended to bypass RLS.'
        })
      }
    }

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

