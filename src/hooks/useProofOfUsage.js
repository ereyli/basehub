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
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      console.log('🔍 Fetching 24h transactions since:', last24Hours)

      // 1. Get last 24 hours transaction count (Base + InkChain)
      // Count all transactions from last 24 hours regardless of chain_id
      // This includes both Base and InkChain transactions
      const { count: txCount24h, error: txError24h } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24Hours)

      console.log('📊 24h transaction query result:', { count: txCount24h, error: txError24h })

      // 2. Get last 24 hours active users (unique wallet addresses from transactions)
      const { data: activeUsersData24h, error: usersError24h } = await supabase
        .from('transactions')
        .select('wallet_address')
        .gte('created_at', last24Hours)

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

    return () => clearInterval(interval)
  }, [])

  return {
    last24hTxCount,
    activeUsers,
    totalUsers,
    loading,
    refresh: fetchProofOfUsage
  }
}

