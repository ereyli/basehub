import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import { TABLES } from '../config/supabase'

export const useTotalTxCount = () => {
  const [totalTx, setTotalTx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [justIncremented, setJustIncremented] = useState(false)

  const fetchTotalTx = useCallback(async () => {
    if (!supabase?.from) {
      setLoading(false)
      return
    }
    try {
      const { count, error } = await supabase
        .from(TABLES.TRANSACTIONS)
        .select('*', { count: 'exact', head: true })

      if (!error && count !== null) {
        setTotalTx(count)
      }
    } catch (err) {
      console.warn('useTotalTxCount fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTotalTx()
  }, [fetchTotalTx])

  // Supabase Realtime: listen for new transactions
  useEffect(() => {
    if (!supabase?.channel) return

    const channel = supabase
      .channel('basehub_tx_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: TABLES.TRANSACTIONS },
        () => {
          setTotalTx((prev) => prev + 1)
          setJustIncremented(true)
          setTimeout(() => setJustIncremented(false), 450)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { totalTx, loading, justIncremented }
}
