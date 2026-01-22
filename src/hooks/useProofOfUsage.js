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

      // Check if Supabase is available
      if (!supabase || !supabase.from) {
        console.log('⚠️ Supabase not available, using default values')
        setLast24hTxCount(0)
        setActiveUsers(0)
        setTotalUsers(0)
        setLoading(false)
        return
      }

      // Get last 24 hours timestamp
      const now = new Date()
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const last24HoursISO = last24Hours.toISOString()
      
      console.log('🔍 Fetching 24h transactions:', {
        now: now.toISOString(),
        last24Hours: last24HoursISO,
        timeDiff: now.getTime() - last24Hours.getTime()
      })

      // 1. Get last 24 hours transaction count (Base + InkChain)
      // Count all transactions from last 24 hours regardless of chain_id
      // This includes both Base and InkChain transactions
      const { count: txCount24h, error: txError24h, data: sampleTxs } = await supabase
        .from('transactions')
        .select('created_at, chain_id, game_type', { count: 'exact' })
        .gte('created_at', last24HoursISO)
        .order('created_at', { ascending: false })
        .limit(5)

      console.log('📊 24h transaction query:', {
        count: txCount24h,
        error: txError24h,
        sampleCount: sampleTxs?.length || 0,
        sampleTransactions: sampleTxs
      })

      // 2. Get last 24 hours active users (unique wallet addresses from transactions)
      const { data: activeUsersData24h, error: usersError24h } = await supabase
        .from('transactions')
        .select('wallet_address')
        .gte('created_at', last24HoursISO)

      // 3. Get total users count from players table
      const { count: totalUsersCount, error: totalUsersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })

      // Set last 24h transaction count
      if (txError24h) {
        console.error('❌ Error fetching 24h transaction count:', txError24h)
        setLast24hTxCount(0)
      } else {
        setLast24hTxCount(txCount24h || 0)
        console.log('✅ Last 24h transaction count:', txCount24h)
      }

      // Set last 24h active users
      if (usersError24h) {
        console.error('❌ Error fetching 24h active users:', usersError24h)
        setActiveUsers(0)
      } else if (activeUsersData24h && activeUsersData24h.length > 0) {
        const uniqueWallets24h = new Set(activeUsersData24h.map(tx => tx.wallet_address))
        setActiveUsers(uniqueWallets24h.size)
        console.log('✅ Last 24h active users:', uniqueWallets24h.size)
      } else {
        setActiveUsers(0)
      }

      // Set total users count
      if (totalUsersError) {
        console.error('❌ Error fetching total users count:', totalUsersError)
        setTotalUsers(0)
      } else {
        setTotalUsers(totalUsersCount || 0)
        console.log('✅ Total users count:', totalUsersCount)
      }
    } catch (error) {
      console.error('❌ Error in fetchProofOfUsage:', error)
      setLast24hTxCount(0)
      setActiveUsers(0)
      setTotalUsers(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProofOfUsage()

    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchProofOfUsage, 30000)

    // Listen for transaction refresh events
    let lastRefreshFlag = null
    const checkRefresh = () => {
      const refreshFlag = localStorage.getItem('basehub_tx_refresh')
      if (refreshFlag && refreshFlag !== lastRefreshFlag) {
        lastRefreshFlag = refreshFlag
        const refreshTime = parseInt(refreshFlag)
        // Only refresh if the flag was set in the last 10 seconds (to avoid duplicate refreshes)
        if (Date.now() - refreshTime < 10000) {
          console.log('🔄 Refreshing transaction count due to new transaction')
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

