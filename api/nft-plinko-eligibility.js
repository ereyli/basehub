// GET ?wallet=0x... — remaining Plinko plays today (uses service role for accurate count)
import { createClient } from '@supabase/supabase-js'

const DAILY_LIMIT = 4

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const wallet = String(req.query?.wallet || '').toLowerCase().trim()
  if (!wallet.startsWith('0x')) {
    return res.status(400).json({ error: 'wallet query required' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({
      remaining: DAILY_LIMIT,
      dailyLimit: DAILY_LIMIT,
      used: 0,
      configured: false,
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const { count, error } = await supabase
      .from('nft_plinko_drops')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', wallet)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())

    if (error) {
      console.error('nft-plinko-eligibility:', error)
      return res.status(200).json({
        remaining: DAILY_LIMIT,
        dailyLimit: DAILY_LIMIT,
        used: 0,
        error: error.message,
      })
    }

    const used = count ?? 0
    const remaining = Math.max(0, DAILY_LIMIT - used)
    return res.status(200).json({
      remaining,
      dailyLimit: DAILY_LIMIT,
      used,
      configured: true,
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}
