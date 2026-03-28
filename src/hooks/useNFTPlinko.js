import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { useSupabase } from './useSupabase'
import { getNFTCount, addXP } from '../utils/xpUtils'
import { wrapFetchWithPayment } from 'x402-fetch'
import { NFT_LUCK_SEGMENTS } from '../config/nftLuckSegments'

// Same pool as NFT Wheel (`src/config/nftLuckSegments.js`)
export const PLINKO_SEGMENTS = NFT_LUCK_SEGMENTS

export function segmentIdToSlotIndex(segmentId) {
  if (segmentId === 0) return 0
  if (segmentId === 1) return 1
  if (segmentId === 2) return 3
  return 2
}

const DAILY_DROP_LIMIT = 4
const DROP_COST = '0.05 USDC'
const SPIN_COST_AMOUNT = BigInt(50000) // 0.05 USDC (6 decimals)

const PLINKO_X402_PAYMENT_PATH = '/api/x402-nft-plinko'

export const useNFTPlinko = () => {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { supabase } = useSupabase()
  const [isDropping, setIsDropping] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [targetSlot, setTargetSlot] = useState(null)
  const [resultSegmentId, setResultSegmentId] = useState(null)
  const [resultXp, setResultXp] = useState(null)
  const resultRef = useRef({ segId: null, xp: null, slot: null })
  const [dropsRemaining, setDropsRemaining] = useState(DAILY_DROP_LIMIT)
  const [hasNFT, setHasNFT] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [nextResetTime, setNextResetTime] = useState(null)

  const checkNFTOwnership = async () => {
    if (!address) {
      setHasNFT(false)
      return false
    }
    try {
      const nftCount = await getNFTCount(address)
      const owns = nftCount > 0
      setHasNFT(owns)
      return owns
    } catch (err) {
      console.error(err)
      setHasNFT(false)
      return false
    }
  }

  const loadDropData = async () => {
    if (!address || !supabase) return
    const normalized = address.toLowerCase()
    try {
      setLoading(true)
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const tomorrow = new Date(today)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      setNextResetTime(tomorrow)

      const { data: rows, error: err } = await supabase
        .from('nft_plinko_drops')
        .select('id')
        .eq('wallet_address', normalized)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      if (err) {
        const msg = err.message || ''
        if (
          msg.includes('does not exist') ||
          msg.includes('schema cache') ||
          err.code === '42P01' ||
          err.code === 'PGRST204'
        ) {
          setDropsRemaining(DAILY_DROP_LIMIT)
          return
        }
        throw err
      }
      const n = rows?.length || 0
      setDropsRemaining(Math.max(0, DAILY_DROP_LIMIT - n))
    } catch (e) {
      console.error(e)
      setDropsRemaining(DAILY_DROP_LIMIT)
    } finally {
      setLoading(false)
    }
  }

  const getDropCountFromDB = async () => {
    if (!address || !supabase) return 0
    const normalized = address.toLowerCase()
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const { data, error: err } = await supabase
      .from('nft_plinko_drops')
      .select('id')
      .eq('wallet_address', normalized)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
    if (err) return 0
    return data?.length || 0
  }

  const refreshEligibilityApi = useCallback(async () => {
    if (!address) return
    try {
      const r = await fetch(`/api/nft-plinko-eligibility?wallet=${encodeURIComponent(address)}`)
      const j = await r.json().catch(() => ({}))
      if (typeof j.remaining === 'number') {
        setDropsRemaining(j.remaining)
      }
    } catch (_) {
      /* ignore */
    }
  }, [address])

  /** Same weighted pick as NFT Wheel `getRandomSegment` */
  const getRandomSegment = () => {
    const totalWeight = PLINKO_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0)
    let random = Math.random() * totalWeight
    for (const segment of PLINKO_SEGMENTS) {
      random -= segment.weight
      if (random <= 0) return segment
    }
    return PLINKO_SEGMENTS[PLINKO_SEGMENTS.length - 1]
  }

  /** Mirrors `makeSpinPayment` in useNFTWheel — x402 only, no extra headers/body */
  const makeDropPayment = async () => {
    if (!walletClient) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient, SPIN_COST_AMOUNT)

    const response = await fetchWithPayment(PLINKO_X402_PAYMENT_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = 'Payment failed. Please try again.'
      try {
        const errorData = await response.json()
        if (response.status === 402) {
          const err = errorData.error
          const errStr = typeof err === 'string' ? err : (err?.message || (typeof err === 'object' ? JSON.stringify(err) : ''))
          if (errStr === 'insufficient_funds' || (errStr && errStr.includes && errStr.includes('insufficient_funds'))) {
            errorMessage = 'Insufficient USDC. You need at least 0.05 USDC on Base to play Plinko.'
          } else if (errStr && (errStr.toLowerCase().includes('reject') || errStr.toLowerCase().includes('denied') || errStr.toLowerCase().includes('declined'))) {
            errorMessage = 'Payment was declined or cancelled.'
          } else if (errStr) {
            errorMessage = `Payment error: ${errStr}. Please check your wallet and try again.`
          } else {
            errorMessage = 'Payment required. Complete the payment in your wallet to play.'
          }
        } else if (response.status === 500) {
          errorMessage = 'Payment could not be completed. Make sure you have at least 0.05 USDC on Base and try again.'
        } else if (errorData.message) {
          const msg = String(errorData.message).toLowerCase()
          if (msg.includes('insufficient') || msg.includes('usdc')) {
            errorMessage = 'Insufficient USDC. You need at least 0.05 USDC on Base to play Plinko.'
          } else if (msg.includes('reject') || msg.includes('denied') || msg.includes('declined')) {
            errorMessage = 'Payment was declined or cancelled.'
          } else {
            errorMessage = errorData.message
          }
        }
      } catch (e) {
        if (response.status === 500) {
          errorMessage = 'Payment could not be completed. Make sure you have at least 0.05 USDC on Base and try again.'
        } else {
          errorMessage = `Payment failed with status ${response.status}. Please try again.`
        }
      }
      throw new Error(errorMessage)
    }

    const result = await response.json()
    return result
  }

  const startDrop = async () => {
    if (!address || !supabase) {
      setError('Wallet not connected')
      return
    }
    if (!walletClient) {
      setError('Wallet not ready. Please try again.')
      return
    }
    if (isDropping || isPaying) return

    const owns = await checkNFTOwnership()
    if (!owns) {
      setError('You need an Early Access NFT to play Plinko.')
      return
    }

    const used = await getDropCountFromDB()
    const actualRemaining = Math.max(0, DAILY_DROP_LIMIT - used)
    if (actualRemaining <= 0) {
      setDropsRemaining(0)
      setError(`Daily limit reached: ${DAILY_DROP_LIMIT} drops per wallet.`)
      return
    }
    setDropsRemaining(actualRemaining)

    try {
      setLoading(true)
      setError(null)
      setIsPaying(true)
      setTargetSlot(null)
      setResultSegmentId(null)
      setResultXp(null)

      await makeDropPayment()

      const segment = getRandomSegment()
      const slot = segmentIdToSlotIndex(segment.id)

      resultRef.current = { segId: segment.id, xp: segment.xp, slot }
      setIsPaying(false)
      setResultSegmentId(segment.id)
      setResultXp(segment.xp)
      setTargetSlot(slot)
      setIsDropping(true)
    } catch (err) {
      console.error(err)
      const msg = err?.message || ''
      const lower = msg.toLowerCase()
      const userFacing =
        lower.includes('insufficient') || lower.includes('usdc')
          ? msg
          : lower.includes('reject') || lower.includes('denied') || lower.includes('declined') || lower.includes('user denied')
            ? 'Payment was declined or cancelled.'
            : msg || 'Payment failed. Please try again.'
      setError(userFacing)
      setIsPaying(false)
      setIsDropping(false)
      setTargetSlot(null)
    } finally {
      setLoading(false)
    }
  }

  /** Mirrors `completeSpin` in useNFTWheel — XP + DB row on client after animation */
  const completeDrop = async () => {
    // Read from ref to avoid stale closure — state may not have propagated yet
    const { segId, xp, slot } = resultRef.current
    if (!address || segId == null) {
      console.warn('completeDrop: no address or segId', { address, segId })
      setIsDropping(false)
      setTargetSlot(null)
      return
    }

    setIsDropping(false)

    const segment = PLINKO_SEGMENTS.find((s) => s.id === segId)
    if (!segment) {
      console.warn('completeDrop: segment not found for id', segId)
      setTargetSlot(null)
      setResultSegmentId(null)
      setResultXp(null)
      return
    }

    const finalXP = segment.xp
    const finalSlot = typeof slot === 'number' ? slot : segmentIdToSlotIndex(segId)

    console.log('completeDrop: saving', { segId, finalXP, finalSlot, address })

    try {
      if (supabase) {
        try {
          const normalized = address.toLowerCase()
          const { error: insErr } = await supabase.from('nft_plinko_drops').insert({
            wallet_address: normalized,
            segment_id: segId,
            slot_index: finalSlot,
            base_xp: finalXP,
            multiplier: 1.0,
            final_xp: finalXP,
            nft_count: 0,
          })
          if (insErr) {
            const m = insErr.message || ''
            if (
              m.includes('does not exist') ||
              m.includes('schema cache') ||
              insErr.code === '42P01' ||
              insErr.code === 'PGRST204'
            ) {
              console.warn('nft_plinko_drops table missing; run supabase-nft-plinko-table.sql')
            } else {
              console.error('Plinko insert error:', insErr)
            }
          } else {
            console.log('completeDrop: Supabase insert OK')
          }
        } catch (e) {
          console.warn('Plinko DB insert:', e?.message)
        }
      } else {
        console.warn('completeDrop: supabase client not available')
      }

      await addXP(address, finalXP, 'NFT_WHEEL', null, true)
      console.log('completeDrop: XP awarded', finalXP)
      setDropsRemaining((prev) => Math.max(0, prev - 1))
    } catch (e) {
      console.error('completeDrop error:', e)
    }

    setTimeout(() => {
      setTargetSlot(null)
      setResultSegmentId(null)
      setResultXp(null)
      resultRef.current = { segId: null, xp: null, slot: null }
      loadDropData()
      refreshEligibilityApi()
    }, 2200)
  }

  useEffect(() => {
    if (address && supabase) {
      checkNFTOwnership()
      loadDropData()
      refreshEligibilityApi()
    } else {
      setHasNFT(false)
      setDropsRemaining(DAILY_DROP_LIMIT)
    }
  }, [address, supabase, refreshEligibilityApi])

  return {
    isDropping,
    isPaying,
    targetSlot,
    resultSegmentId,
    resultXp,
    dropsRemaining,
    hasNFT,
    loading,
    error,
    nextResetTime,
    dropCost: DROP_COST,
    dailyLimit: DAILY_DROP_LIMIT,
    startDrop,
    completeDrop,
    checkNFTOwnership,
    loadDropData,
    segments: PLINKO_SEGMENTS,
  }
}
