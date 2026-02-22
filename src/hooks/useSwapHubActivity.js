import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import { TABLES } from '../config/supabase'
import { SWAP_VOLUME_TIERS, SWAP_PER_100_GAME_TYPE } from '../utils/xpUtils'

const SWAP_XP_GAME_TYPES = [SWAP_PER_100_GAME_TYPE, ...SWAP_VOLUME_TIERS.map(t => t.key)]

const MILESTONE_LABELS = {
  [SWAP_PER_100_GAME_TYPE]: { short: '$100', xpKey: 'xp' },
  SWAP_MILESTONE_1K: { short: '$1k', xpKey: 'xp' },
  SWAP_MILESTONE_10K: { short: '$10k', xpKey: 'xp' },
  SWAP_MILESTONE_100K: { short: '$100k', xpKey: 'xp' },
  SWAP_MILESTONE_1M: { short: '$1M', xpKey: 'xp' }
}

export function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export function useSwapHubActivity(limit = 20) {
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchActivity = useCallback(async () => {
    if (!supabase?.from) {
      setActivity([])
      setLoading(false)
      return
    }
    try {
      setError(null)
      const [swapsRes, xpRes] = await Promise.all([
        supabase
          .from(TABLES.SWAPHUB_SWAPS)
          .select('id, wallet_address, amount_usd, created_at')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from(TABLES.TRANSACTIONS)
          .select('id, wallet_address, game_type, xp_earned, created_at')
          .in('game_type', SWAP_XP_GAME_TYPES)
          .order('created_at', { ascending: false })
          .limit(limit)
      ])

      const swapItems = (swapsRes.data || []).map(row => ({
        type: 'swap',
        id: row.id ? `swap-${row.id}` : `swap-${row.created_at}-${row.wallet_address}-${row.amount_usd}`,
        wallet_address: row.wallet_address,
        amount_usd: parseFloat(row.amount_usd) || 0,
        created_at: row.created_at
      }))

      const xpItems = (xpRes.data || []).map((row, idx) => ({
        type: 'xp',
        id: row.id ? `xp-${row.id}` : `xp-${row.created_at}-${row.wallet_address}-${row.game_type}-${idx}`,
        wallet_address: row.wallet_address,
        game_type: row.game_type,
        xp_earned: row.xp_earned || 0,
        created_at: row.created_at
      }))

      const merged = [...swapItems, ...xpItems]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
      setActivity(merged)
    } catch (e) {
      console.warn('useSwapHubActivity fetch:', e)
      setError(e.message)
      setActivity([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  useEffect(() => {
    if (!supabase?.channel) return
    const channel = supabase
      .channel('swaphub_swaps_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: TABLES.SWAPHUB_SWAPS },
        (payload) => {
          const row = payload.new
          if (!row) return
          setActivity(prev => {
            const newItem = {
              type: 'swap',
              id: row.id ? `swap-${row.id}` : `swap-${row.created_at}-${row.wallet_address}-${row.amount_usd}`,
              wallet_address: row.wallet_address,
              amount_usd: parseFloat(row.amount_usd) || 0,
              created_at: row.created_at
            }
            const filtered = prev.filter(i => i.id !== newItem.id)
            return [newItem, ...filtered].slice(0, limit)
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [limit])

  return { activity, loading, error, refresh: fetchActivity, MILESTONE_LABELS }
}
