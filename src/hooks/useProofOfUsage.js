import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export const useProofOfUsage = () => {
  const [last24hTxCount, setLast24hTxCount] = useState(0)
  const [activeUsers, setActiveUsers] = useState(0)
  const [allTimeTxCount, setAllTimeTxCount] = useState(0)
  const [allTimeUsers, setAllTimeUsers] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchProofOfUsage = async () => {
    try {
      setLoading(true)

      // Check if Supabase is available
      if (!supabase || !supabase.from) {
        console.log('⚠️ Supabase not available, using default values')
        setLast24hTxCount(0)
        setActiveUsers(0)
        setAllTimeTxCount(0)
        setAllTimeUsers(0)
        setLoading(false)
        return
      }

      // Get last 24 hours timestamp
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      // 1. Get last 24 hours data
      const { count: txCount24h, error: txError24h } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24Hours)

      const { data: activeUsersData24h, error: usersError24h } = await supabase
        .from('transactions')
        .select('wallet_address')
        .gte('created_at', last24Hours)

      // 2. Get all-time data
      const { count: txCountAllTime, error: txErrorAllTime } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })

      const { data: activeUsersDataAllTime, error: usersErrorAllTime } = await supabase
        .from('transactions')
        .select('wallet_address')

      // Set last 24h data
      if (txError24h) {
        console.error('❌ Error fetching 24h transaction count:', txError24h)
        setLast24hTxCount(0)
      } else {
        setLast24hTxCount(txCount24h || 0)
        console.log('✅ Last 24h transaction count:', txCount24h)
      }

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

      // Set all-time data
      if (txErrorAllTime) {
        console.error('❌ Error fetching all-time transaction count:', txErrorAllTime)
        setAllTimeTxCount(0)
      } else {
        setAllTimeTxCount(txCountAllTime || 0)
        console.log('✅ All-time transaction count:', txCountAllTime)
      }

      if (usersErrorAllTime) {
        console.error('❌ Error fetching all-time active users:', usersErrorAllTime)
        setAllTimeUsers(0)
      } else if (activeUsersDataAllTime && activeUsersDataAllTime.length > 0) {
        const uniqueWalletsAllTime = new Set(activeUsersDataAllTime.map(tx => tx.wallet_address))
        setAllTimeUsers(uniqueWalletsAllTime.size)
        console.log('✅ All-time active users:', uniqueWalletsAllTime.size)
      } else {
        setAllTimeUsers(0)
      }
    } catch (error) {
      console.error('❌ Error in fetchProofOfUsage:', error)
      setLast24hTxCount(0)
      setActiveUsers(0)
      setAllTimeTxCount(0)
      setAllTimeUsers(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProofOfUsage()

    // Refresh every 2 minutes (120 seconds)
    const interval = setInterval(fetchProofOfUsage, 120000)

    return () => clearInterval(interval)
  }, [])

  return {
    last24hTxCount,
    activeUsers,
    allTimeTxCount,
    allTimeUsers,
    loading,
    refresh: fetchProofOfUsage
  }
}

