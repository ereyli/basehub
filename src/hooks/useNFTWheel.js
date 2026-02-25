import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { useSupabase } from './useSupabase'
import { getNFTCount, addXP } from '../utils/xpUtils'
import { wrapFetchWithPayment } from 'x402-fetch'

// XP reward segments with weighted probabilities and colors
// Lower rewards have much higher chances, higher rewards are rare
// Jackpot has 3% chance for exciting but rare wins
const WHEEL_SEGMENTS = [
  { id: 0, xp: 3500, label: '3.5K', color: '#3b82f6', weight: 40 },      // 40% chance - blue (most common)
  { id: 1, xp: 7000, label: '7K', color: '#10b981', weight: 30 },        // 30% chance - green
  { id: 2, xp: 14000, label: '14K', color: '#8b5cf6', weight: 15 },      // 15% chance - purple
  { id: 3, xp: 28000, label: '28K', color: '#ec4899', weight: 7 },       // 7% chance - pink (reduced)
  { id: 4, xp: 56000, label: '56K', color: '#06b6d4', weight: 3 },       // 3% chance - cyan (reduced)
  { id: 5, xp: 112000, label: '112K', color: '#ef4444', weight: 2 },     // 2% chance - red (very rare)
  { id: 6, xp: 224000, label: '224K', color: '#fbbf24', weight: 3, isJackpot: true } // 3% chance - golden MEGA JACKPOT
]

// Visual order for the wheel (224K jackpot at top, then clockwise)
// This MUST match the order segments are drawn on the wheel
export const WHEEL_VISUAL_ORDER = [
  { id: 6, xp: 224000, label: '224K', color: '#fbbf24', isJackpot: true },
  { id: 0, xp: 3500, label: '3.5K', color: '#3b82f6' },
  { id: 1, xp: 7000, label: '7K', color: '#10b981' },
  { id: 2, xp: 14000, label: '14K', color: '#8b5cf6' },
  { id: 3, xp: 28000, label: '28K', color: '#ec4899' },
  { id: 4, xp: 56000, label: '56K', color: '#06b6d4' },
  { id: 5, xp: 112000, label: '112K', color: '#ef4444' }
]

const DAILY_SPIN_LIMIT = 3

// x402 Payment cost per spin
const SPIN_COST = '0.05 USDC'
const SPIN_COST_AMOUNT = BigInt(50000) // 0.05 USDC (6 decimals)

export const useNFTWheel = () => {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { supabase } = useSupabase()
  const [isSpinning, setIsSpinning] = useState(false)
  const [winningSegment, setWinningSegment] = useState(null)
  const [spinsRemaining, setSpinsRemaining] = useState(DAILY_SPIN_LIMIT)
  const [lastSpinTime, setLastSpinTime] = useState(null)
  const [hasNFT, setHasNFT] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [nextResetTime, setNextResetTime] = useState(null)
  const [isPaying, setIsPaying] = useState(false)

  // Check NFT ownership
  const checkNFTOwnership = async () => {
    if (!address) {
      setHasNFT(false)
      return false
    }

    try {
      const nftCount = await getNFTCount(address)
      const ownsNFT = nftCount > 0
      setHasNFT(ownsNFT)
      return ownsNFT
    } catch (err) {
      console.error('Error checking NFT ownership:', err)
      setHasNFT(false)
      return false
    }
  }

  // Load daily spin data from Supabase
  const loadSpinData = async () => {
    if (!address || !supabase) {
      console.log('❌ loadSpinData skipped: missing address or supabase')
      return
    }

    // Normalize wallet address to lowercase (must match how we save it)
    const normalizedAddress = address.toLowerCase()
    console.log('🔄 Loading spin data for:', normalizedAddress)

    try {
      setLoading(true)
      
      // Get today's date in UTC (start of day)
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const tomorrow = new Date(today)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      
      setNextResetTime(tomorrow)
      
      console.log('📅 Checking spins between:', today.toISOString(), 'and', tomorrow.toISOString())

      // Count spins today from nft_wheel_spins table
      const { data: spins, error: spinsError } = await supabase
        .from('nft_wheel_spins')
        .select('id, created_at, final_xp')
        .eq('wallet_address', normalizedAddress)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      if (spinsError) {
        // Check if error is due to missing table or schema cache
        const errorMsg = spinsError.message || ''
        if (errorMsg.includes('does not exist') || 
            errorMsg.includes('schema cache') ||
            spinsError.code === '42P01' || 
            spinsError.code === 'PGRST116' ||
            spinsError.code === 'PGRST204') {
          console.warn('⚠️ nft_wheel_spins table not found or schema issue. Run SQL script in Supabase!')
          console.warn('📝 SQL script: supabase-nft-wheel-table.sql')
          setSpinsRemaining(DAILY_SPIN_LIMIT)
          return
        }
        throw spinsError
      }

      const spinsCount = spins?.length || 0
      const remaining = Math.max(0, DAILY_SPIN_LIMIT - spinsCount)
      setSpinsRemaining(remaining)

      console.log(`✅ Spin data loaded: ${spinsCount} spins today, ${remaining} remaining`)
      if (spins && spins.length > 0) {
        console.log('📊 Today\'s spins:', spins.map(s => ({ id: s.id, xp: s.final_xp, time: s.created_at })))
      }
    } catch (err) {
      console.error('❌ Error loading spin data:', err)
      // On error, be conservative and allow spins (better UX than blocking)
      setSpinsRemaining(DAILY_SPIN_LIMIT)
    } finally {
      setLoading(false)
    }
  }

  // Get spin count directly from database (for security check before spin)
  const getSpinCountFromDB = async () => {
    if (!address || !supabase) return 0
    
    const normalizedAddress = address.toLowerCase()
    
    try {
      // Get today's date range in UTC
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const tomorrow = new Date(today)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      
      const { data: spins, error } = await supabase
        .from('nft_wheel_spins')
        .select('id')
        .eq('wallet_address', normalizedAddress)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
      
      if (error) {
        console.error('❌ Error checking spin count:', error)
        return 0 // On error, allow spin (will be validated on save)
      }
      
      return spins?.length || 0
    } catch (err) {
      console.error('❌ Error in getSpinCountFromDB:', err)
      return 0
    }
  }

  // Calculate weighted random segment
  const getRandomSegment = () => {
    const totalWeight = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0)
    let random = Math.random() * totalWeight

    for (const segment of WHEEL_SEGMENTS) {
      random -= segment.weight
      if (random <= 0) {
        return segment
      }
    }

    // Fallback to first segment
    return WHEEL_SEGMENTS[0]
  }

  // Make x402 payment for spin
  const makeSpinPayment = async () => {
    if (!walletClient) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    console.log('🎰 Starting x402 payment for wheel spin...')
    
    const fetchWithPayment = wrapFetchWithPayment(
      fetch,
      walletClient,
      SPIN_COST_AMOUNT
    )

    const response = await fetchWithPayment('/api/x402-nft-wheel', {
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
            errorMessage = 'Insufficient USDC. You need at least 0.05 USDC on Base to spin the wheel.'
          } else if (errStr && (errStr.toLowerCase().includes('reject') || errStr.toLowerCase().includes('denied') || errStr.toLowerCase().includes('declined'))) {
            errorMessage = 'Payment was declined or cancelled.'
          } else if (errStr) {
            errorMessage = `Payment error: ${errStr}. Please check your wallet and try again.`
          } else {
            errorMessage = 'Payment required. Complete the payment in your wallet to spin.'
          }
        } else if (response.status === 500) {
          errorMessage = 'Payment could not be completed. Make sure you have at least 0.05 USDC on Base and try again.'
        } else if (errorData.message) {
          const msg = String(errorData.message).toLowerCase()
          if (msg.includes('insufficient') || msg.includes('usdc')) {
            errorMessage = 'Insufficient USDC. You need at least 0.05 USDC on Base to spin the wheel.'
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
    console.log('✅ Wheel spin payment successful:', result)
    return result
  }

  // Spin the wheel
  const spinWheel = async () => {
    if (!address || !supabase) {
      setError('Wallet not connected')
      return
    }

    if (!walletClient) {
      setError('Wallet not ready. Please try again.')
      return
    }

    if (isSpinning || isPaying) {
      return
    }

    // Check NFT ownership
    const hasNFT = await checkNFTOwnership()
    if (!hasNFT) {
      setError('You need to own an Early Access NFT to spin the wheel!')
      return
    }

    // IMPORTANT: Check daily limit directly from database before allowing spin
    // This prevents abuse from page refresh
    const currentSpins = await getSpinCountFromDB()
    const actualRemaining = Math.max(0, DAILY_SPIN_LIMIT - currentSpins)
    
    console.log(`🔒 Security check: ${currentSpins} spins today, ${actualRemaining} remaining`)
    
    if (actualRemaining <= 0) {
      setSpinsRemaining(0)
      setError(`Daily spin limit reached! You've used all ${DAILY_SPIN_LIMIT} spins today. Come back tomorrow!`)
      return
    }
    
    // Update local state to match database
    setSpinsRemaining(actualRemaining)

    try {
      setLoading(true)
      setError(null)
      setIsPaying(true)

      // Process x402 payment first
      console.log('💰 Processing x402 payment for wheel spin...')
      await makeSpinPayment()
      console.log('✅ Payment successful, starting wheel spin...')

      // Get random winning segment BEFORE setting spinning state
      const segment = getRandomSegment()
      console.log('🎯 Winning segment:', segment)

      setIsPaying(false)
      
      // Set winning segment and spinning state together
      // This ensures the wheel knows where to land
      setWinningSegment(segment.id)
      setIsSpinning(true)

      console.log('🎰 Wheel spinning to segment:', segment.id, segment.label)
      
      // Animation is handled by NFTWheel component
      // onSpinComplete callback will be called after animation finishes
      
    } catch (err) {
      console.error('Error spinning wheel:', err)
      const msg = err?.message || ''
      const lower = msg.toLowerCase()
      const userFacing = lower.includes('insufficient') || lower.includes('usdc')
        ? msg
        : lower.includes('reject') || lower.includes('denied') || lower.includes('declined') || lower.includes('user denied')
          ? 'Payment was declined or cancelled.'
          : msg || 'Payment failed. Please try again.'
      setError(userFacing)
      setIsSpinning(false)
      setIsPaying(false)
      setWinningSegment(null)
      setLoading(false)
    }
  }

  // Complete spin and award XP
  const completeSpin = async () => {
    // Store current winning segment before any state changes
    const currentWinningSegment = winningSegment
    
    if (!address || currentWinningSegment === null) {
      setIsSpinning(false)
      setWinningSegment(null)
      setLoading(false)
      return
    }

    try {
      // Find segment by id (not by index)
      const segment = WHEEL_SEGMENTS.find(s => s.id === currentWinningSegment)
      if (!segment) {
        console.error('❌ Segment not found for id:', currentWinningSegment)
        setIsSpinning(false)
        setWinningSegment(null)
        setLoading(false)
        return
      }
      
      const baseXP = segment.xp

      // No NFT bonus for wheel spins - XP is awarded as-is
      const finalXP = baseXP

      console.log(`🎰 Wheel spin complete: ${finalXP} XP (no NFT bonus for wheel)`)

      // Save spin to Supabase nft_wheel_spins table (for tracking daily limits)
      if (supabase) {
        try {
          // Normalize wallet address to lowercase
          const normalizedAddress = address.toLowerCase()
          
          const { error: spinError } = await supabase
            .from('nft_wheel_spins')
            .insert({
              wallet_address: normalizedAddress,
              segment_id: segment.id,
              base_xp: baseXP,
              multiplier: 1.0, // No multiplier for wheel
              final_xp: finalXP,
              nft_count: 0 // Not tracking for wheel
            })

          if (spinError) {
            // Check if error is due to missing table
            if (spinError.message?.includes('does not exist') || 
                spinError.message?.includes('schema cache') ||
                spinError.code === '42P01' ||
                spinError.code === 'PGRST204') {
              console.warn('⚠️ nft_wheel_spins table not found. Please run the SQL script in Supabase.')
              console.warn('📝 SQL script location: supabase-nft-wheel-table.sql')
            } else {
              console.error('Error saving spin:', spinError)
            }
            // Continue anyway - don't block XP award
          } else {
            console.log('✅ Spin saved to nft_wheel_spins table')
          }
        } catch (tableError) {
          // Table might not exist yet - this is okay during development
          console.warn('⚠️ Could not save spin to database (table may not exist):', tableError.message)
        }
      }

      // Award XP directly to main XP (players.total_xp)
      // This uses the existing addXP function which updates the players table
      // skipNFTBonus = true to prevent NFT multiplier for wheel spins
      await addXP(address, finalXP, 'NFT_WHEEL', null, true)

      // Update spins remaining locally
      setSpinsRemaining(prev => Math.max(0, prev - 1))

      console.log(`✅ Spin completed! ${finalXP} XP added to total XP`)
      
      // Reset states after a delay to allow result to be displayed
      setTimeout(() => {
        setIsSpinning(false)
        setWinningSegment(null)
        console.log('🔄 Wheel reset for next spin')
      }, 3000)
      
    } catch (err) {
      console.error('Error completing spin:', err)
      setError(err.message)
      setIsSpinning(false)
      setWinningSegment(null)
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount and when address changes
  useEffect(() => {
    if (address && supabase) {
      checkNFTOwnership()
      loadSpinData()
    } else {
      setHasNFT(false)
      setSpinsRemaining(DAILY_SPIN_LIMIT)
    }
  }, [address, supabase])

  // Update countdown timer
  useEffect(() => {
    if (!nextResetTime) return

    const updateTimer = () => {
      const now = new Date()
      const timeLeft = nextResetTime.getTime() - now.getTime()
      
      if (timeLeft <= 0) {
        // Reset day - reload spin data
        loadSpinData()
      }
    }

    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [nextResetTime])

  return {
    isSpinning,
    isPaying,
    winningSegment,
    spinsRemaining,
    hasNFT,
    loading,
    error,
    nextResetTime,
    segments: WHEEL_SEGMENTS,
    spinCost: SPIN_COST,
    spinWheel,
    completeSpin,
    checkNFTOwnership,
    loadSpinData
  }
}
