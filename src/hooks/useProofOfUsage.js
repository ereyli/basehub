import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export const useProofOfUsage = () => {
  const [last24hTxCount, setLast24hTxCount] = useState(0)
  const [activeUsers, setActiveUsers] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchProofOfUsage = async () => {
    try {
      setLoading(true)

      // Check if Supabase is available
      if (!supabase || !supabase.from) {
        console.log('⚠️ Supabase not available, using default values')
        setLast24hTxCount(0)
        setActiveUsers(0)
        setLoading(false)
        return
      }

      // Get last 24 hours timestamp
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      // Get data from transactions table (now that addXP records transactions)
      const { count: txCount, error: txError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24Hours)

      const { data: activeUsersData, error: usersError } = await supabase
        .from('transactions')
        .select('wallet_address')
        .gte('created_at', last24Hours)

      if (txError) {
        console.error('❌ Error fetching transaction count:', txError)
        setLast24hTxCount(0)
      } else {
        setLast24hTxCount(txCount || 0)
        console.log('✅ Transaction count:', txCount)
      }

      if (usersError) {
        console.error('❌ Error fetching active users:', usersError)
        setActiveUsers(0)
      } else if (activeUsersData && activeUsersData.length > 0) {
        // Get unique wallet addresses
        const uniqueWallets = new Set(activeUsersData.map(tx => tx.wallet_address))
        setActiveUsers(uniqueWallets.size)
        console.log('✅ Active users:', uniqueWallets.size)
      } else {
        setActiveUsers(0)
        console.log('⚠️ No active users found in last 24 hours')
      }
    } catch (error) {
      console.error('❌ Error in fetchProofOfUsage:', error)
      setLast24hTxCount(0)
      setActiveUsers(0)
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
    loading,
    refresh: fetchProofOfUsage
  }
}

