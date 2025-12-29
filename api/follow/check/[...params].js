// Nested API route for /api/follow/check/:followerFid/:followingFid
// Vercel handles /api/follow/check/123/456 as this file

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export default async function handler(req, res) {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' })
    }

    // In Vercel, [...params] becomes req.query.params array
    // For /api/follow/check/123/456, params = ['123', '456']
    const params = req.query.params || []
    
    if (params.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both follower_fid and following_fid are required' 
      })
    }

    const followerFid = parseInt(params[0])
    const followingFid = parseInt(params[1])
    
    if (isNaN(followerFid) || isNaN(followingFid)) {
      return res.status(400).json({ success: false, error: 'Invalid FIDs' })
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

    return res.json({ 
      success: true, 
      is_following: !!data,
      is_mutual: data?.is_mutual || false
    })
  } catch (err) {
    console.error('❌ Follow check error:', err)
    return res.status(500).json({ 
      success: false, 
      error: err.message || 'Failed to check follow status' 
    })
  }
}
