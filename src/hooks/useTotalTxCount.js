import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../config/supabase'
import { TABLES } from '../config/supabase'

export const useTotalTxCount = () => {
  const [totalTx, setTotalTx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [justIncremented, setJustIncremented] = useState(false)
  const prevCountRef = useRef(0)

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
        const newCount = count
        if (newCount > prevCountRef.current) {
          setJustIncremented(true)
          setTimeout(() => setJustIncremented(false), 450)
        }
        prevCountRef.current = newCount
        setTotalTx(newCount)
      }
    } catch (err) {
      console.warn('useTotalTxCount fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTotalTx()
    const interval = setInterval(fetchTotalTx, 30000)
    return () => clearInterval(interval)
  }, [fetchTotalTx])

  return { totalTx, loading, justIncremented }
}
