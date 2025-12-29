// Follow System Endpoint for BaseHub
// Handles following/unfollowing users and mutual follow detection

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

console.log('🚀 Follow System API loaded')

// Supabase client
// Support both VITE_ prefix (for frontend compatibility) and direct env vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

app.use('/*', cors())

// Follow a user
app.post('/', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    const { follower_fid, following_fid } = await c.req.json()
    
    if (!follower_fid || !following_fid) {
      return c.json({ 
        success: false, 
        error: 'Both follower_fid and following_fid are required' 
      }, 400)
    }

    if (follower_fid === following_fid) {
      return c.json({ 
        success: false, 
        error: 'Cannot follow yourself' 
      }, 400)
    }

    // Check if already following
    const { data: existing } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_fid', follower_fid)
      .eq('following_fid', following_fid)
      .single()

    if (existing) {
      return c.json({ 
        success: false, 
        error: 'Already following this user' 
      }, 400)
    }

    // Check for reverse follow (mutual follow detection)
    const { data: reverseFollow } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_fid', following_fid)
      .eq('following_fid', follower_fid)
      .single()

    const isMutual = !!reverseFollow

    // Create follow relationship
    const { data: follow, error } = await supabase
      .from('follows')
      .insert({
        follower_fid,
        following_fid,
        is_mutual: isMutual
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Follow creation error:', error)
      throw error
    }

    // Update reverse follow if it exists (mark as mutual)
    if (isMutual && reverseFollow) {
      await supabase
        .from('follows')
        .update({ is_mutual: true })
        .eq('id', reverseFollow.id)
        .catch(err => console.error('Error updating reverse follow:', err))
    }

    // Increment followers count for the followed user
    await supabase.rpc('increment_followers', { 
      profile_fid: following_fid 
    }).catch(err => console.error('Error incrementing followers:', err))

    // Increment following count for the follower (using RPC function)
    await supabase.rpc('increment_following', { 
      profile_fid: follower_fid 
    }).catch(() => {}) // Ignore if not a featured profile

    // If mutual, increment mutual follows count for both
    if (isMutual) {
      await supabase.rpc('increment_mutual_follows', { 
        profile_fid: follower_fid 
      }).catch(() => {})
      
      await supabase.rpc('increment_mutual_follows', { 
        profile_fid: following_fid 
      }).catch(() => {})
    }

    console.log(`✅ Follow created: ${follower_fid} → ${following_fid} (mutual: ${isMutual})`)

    return c.json({ 
      success: true, 
      follow,
      is_mutual: isMutual,
      message: isMutual 
        ? '🎉 Mutual follow! You are now following each other!' 
        : 'Follow created successfully' 
    })
  } catch (err) {
    console.error('❌ Follow error:', err)
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to create follow' 
    }, 500)
  }
})

// Unfollow a user
app.delete('/', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    const { follower_fid, following_fid } = await c.req.json()
    
    if (!follower_fid || !following_fid) {
      return c.json({ 
        success: false, 
        error: 'Both follower_fid and following_fid are required' 
      }, 400)
    }

    // Check if following relationship exists
    const { data: existing } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_fid', follower_fid)
      .eq('following_fid', following_fid)
      .single()

    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Not following this user' 
      }, 400)
    }

    const wasMutual = existing.is_mutual

    // Delete follow relationship
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_fid', follower_fid)
      .eq('following_fid', following_fid)

    if (error) {
      console.error('❌ Unfollow error:', error)
      throw error
    }

    // Update reverse follow if it was mutual (remove mutual flag)
    if (wasMutual) {
      await supabase
        .from('follows')
        .update({ is_mutual: false })
        .eq('follower_fid', following_fid)
        .eq('following_fid', follower_fid)
        .catch(err => console.error('Error updating reverse follow:', err))

      // Decrement mutual follows count for both
      await supabase.rpc('decrement_mutual_follows', { 
        profile_fid: follower_fid 
      }).catch(() => {})
      
      await supabase.rpc('decrement_mutual_follows', { 
        profile_fid: following_fid 
      }).catch(() => {})
    }

    // Decrement followers count
    await supabase.rpc('decrement_followers', { 
      profile_fid: following_fid 
    }).catch(() => {})

    // Decrement following count (using RPC function)
    await supabase.rpc('decrement_following', { 
      profile_fid: follower_fid 
    }).catch(() => {})

    console.log(`✅ Unfollow successful: ${follower_fid} → ${following_fid}`)

    return c.json({ 
      success: true, 
      message: 'Unfollowed successfully' 
    })
  } catch (err) {
    console.error('❌ Unfollow error:', err)
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to unfollow' 
    }, 500)
  }
})

// Get followers of a user
app.get('/followers/:fid', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    const fid = parseInt(c.req.param('fid'))
    
    if (isNaN(fid)) {
      return c.json({ success: false, error: 'Invalid FID' }, 400)
    }

    const { data, error } = await supabase
      .from('follows')
      .select('follower_fid, is_mutual, created_at')
      .eq('following_fid', fid)
      .order('created_at', { ascending: false })

    if (error) throw error

    return c.json({ 
      success: true, 
      followers: data || [],
      count: data?.length || 0
    })
  } catch (err) {
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to fetch followers' 
    }, 500)
  }
})

// Get users that a user is following
app.get('/following/:fid', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    const fid = parseInt(c.req.param('fid'))
    
    if (isNaN(fid)) {
      return c.json({ success: false, error: 'Invalid FID' }, 400)
    }

    const { data, error } = await supabase
      .from('follows')
      .select('following_fid, is_mutual, created_at')
      .eq('follower_fid', fid)
      .order('created_at', { ascending: false })

    if (error) throw error

    return c.json({ 
      success: true, 
      following: data || [],
      count: data?.length || 0
    })
  } catch (err) {
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to fetch following' 
    }, 500)
  }
})

// Check if user A follows user B
app.get('/check/:followerFid/:followingFid', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Database not configured' }, 500)
    }

    const followerFid = parseInt(c.req.param('followerFid'))
    const followingFid = parseInt(c.req.param('followingFid'))
    
    if (isNaN(followerFid) || isNaN(followingFid)) {
      return c.json({ success: false, error: 'Invalid FIDs' }, 400)
    }

    const { data, error } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_fid', followerFid)
      .eq('following_fid', followingFid)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return c.json({ 
      success: true, 
      is_following: !!data,
      is_mutual: data?.is_mutual || false
    })
  } catch (err) {
    return c.json({ 
      success: false, 
      error: err.message || 'Failed to check follow status' 
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
    // If the request is to /api/follow, the path in the function is '/'
    // If the request is to /api/follow/check/123/456, the path in the function is '/check/123/456'
    const normalizedPath = path.replace(/^\/api\/follow/, '') || '/'
    
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
    console.error('❌ Follow handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', message: error.message })
    }
  }
}

