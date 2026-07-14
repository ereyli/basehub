import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export const useProofOfUsage = () => {
  const [last24hTxCount, setLast24hTxCount] = useState(0)
  const [activeUsers, setActiveUsers] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchProofOfUsage = async () => {
    try {
      setLoading(true)

      if (!supabase || !supabase.from) {
        return
      }

      const { count: totalUsersCount, error: totalUsersError } = await supabase
        .from('players')
        .select('wallet_address', { count: 'exact', head: true })

      if (!totalUsersError) setTotalUsers(totalUsersCount || 0)
    } catch {
      // Keep the last known header metrics during a temporary Supabase outage.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProofOfUsage()

    // Header metrics do not need aggressive polling on every open page.
    const interval = setInterval(fetchProofOfUsage, 300000)

    // Listen for transaction refresh events
    let lastRefreshFlag = null
    const checkRefresh = () => {
      const refreshFlag = localStorage.getItem('basehub_tx_refresh')
      if (refreshFlag && refreshFlag !== lastRefreshFlag) {
        lastRefreshFlag = refreshFlag
        const refreshTime = parseInt(refreshFlag)
        // Only refresh if the flag was set in the last 10 seconds (to avoid duplicate refreshes)
        if (Date.now() - refreshTime < 10000) {
          fetchProofOfUsage().then(() => {
            // Clear the flag after successful refresh
            localStorage.removeItem('basehub_tx_refresh')
            lastRefreshFlag = null
          })
        }
      }
    }

    // Check for refresh flag every 1 second for faster updates
    const refreshInterval = setInterval(checkRefresh, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(refreshInterval)
    }
  }, [])

  return {
    last24hTxCount,
    activeUsers,
    totalUsers,
    loading,
    refresh: fetchProofOfUsage
  }
}
