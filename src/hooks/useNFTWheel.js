import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { useSupabase } from './useSupabase'
import { getNFTCount, addXP } from '../utils/xpUtils'
import { wrapFetchWithPayment } from 'x402-fetch'

// XP reward segments with weighted probabilities and colors
// Rewards: 5K, 10K, 20K, 40K, 80K, 160K, 320K (jackpot)
// Balanced distribution for fair gameplay
const WHEEL_SEGMENTS = [
  { id: 0, xp: 5000, label: '5K', color: '#3b82f6', weight: 35 },       // 35% chance - blue
  { id: 1, xp: 10000, label: '10K', color: '#10b981', weight: 25 },     // 25% chance - green
  { id: 2, xp: 20000, label: '20K', color: '#8b5cf6', weight: 18 },     // 18% chance - purple
  { id: 3, xp: 40000, label: '40K', color: '#ec4899', weight: 12 },     // 12% chance - pink
  { id: 4, xp: 80000, label: '80K', color: '#06b6d4', weight: 6 },      // 6% chance - cyan
  { id: 5, xp: 160000, label: '160K', color: '#ef4444', weight: 3 },    // 3% chance - red
  { id: 6, xp: 320000, label: '320K', color: '#fbbf24', weight: 1, isJackpot: true } // 1% chance - golden MEGA JACKPOT
]

// Visual order for the wheel (320K jackpot at top, then clockwise)
// This MUST match the order segments are drawn on the wheel
export const WHEEL_VISUAL_ORDER = [
  { id: 6, xp: 320000, label: '320K', color: '#fbbf24', isJackpot: true },
  { id: 0, xp: 5000, label: '5K', color: '#3b82f6' },
  { id: 1, xp: 10000, label: '10K', color: '#10b981' },
  { id: 2, xp: 20000, label: '20K', color: '#8b5cf6' },
  { id: 3, xp: 40000, label: '40K', color: '#ec4899' },
  { id: 4, xp: 80000, label: '80K', color: '#06b6d4' },
  { id: 5, xp: 160000, label: '160K', color: '#ef4444' }
]

const DAILY_SPIN_LIMIT = 3

// x402 Payment cost per spin
const SPIN_COST = '0.05 USDC'
const SPIN_COST_AMOUNT = BigInt(50000) // 0.05 USDC (6 decimals)

// Admin wallet address (development only - will be removed for public release)
const ADMIN_WALLET = '0xa7A9B7E0c4B36d9dE8A94c6388449d06F2C5952f'

export const useNFTWheel = () => {
  const { address } = useAccount()
  
  // Check if user is admin
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET.toLowerCase()
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

    // Admin bypass - no NFT required for admin
    if (isAdmin) {
      setHasNFT(true)
      return true
    }

    try {
      const nftCount = await getNFTCount(address)
      const hasNFT = nftCount > 0
      setHasNFT(hasNFT)
      return hasNFT
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

    const response = await fetchWithPayment('/api/x402-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = 'Payment failed'
      try {
        const errorData = await response.json()
        if (response.status === 402) {
          if (errorData.error === 'insufficient_funds' || errorData.error?.includes?.('insufficient_funds')) {
            errorMessage = 'Insufficient USDC balance. Please ensure you have at least 0.1 USDC.'
          } else if (errorData.error) {
            errorMessage = `Payment error: ${typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error}`
          }
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch (e) {
        errorMessage = `Payment failed with status ${response.status}`
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

    // Admin check - only admin can access during development
    if (!isAdmin) {
      setError('Access restricted. This feature is in development.')
      return
    }

    if (isSpinning || isPaying) {
      return
    }

    // Check NFT ownership (admin bypasses this)
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
      setError(err.message)
      setIsSpinning(false)
      setIsPaying(false)
      setWinningSegment(null)
      setLoading(false)
    }
  }

  // Complete spin and award XP
  const completeSpin = async () => {
    if (!address || winningSegment === null) {
      setIsSpinning(false)
      setLoading(false)
      return
    }

    // Immediately stop spinning to prevent infinite rotation
    setIsSpinning(false)

    try {
      // Find segment by id (not by index)
      const segment = WHEEL_SEGMENTS.find(s => s.id === winningSegment)
      if (!segment) {
        console.error('❌ Segment not found for id:', winningSegment)
        setLoading(false)
        return
      }
      
      const baseXP = segment.xp

      // Get NFT count for multiplier
      const nftCount = await getNFTCount(address)
      const multiplier = nftCount > 0 ? 1 + (nftCount * 0.1) : 1 // 10% per NFT, max 2x for 10 NFTs
      const finalXP = Math.floor(baseXP * multiplier)

      console.log(`🎰 Wheel spin complete: ${baseXP} XP (${multiplier}x multiplier) = ${finalXP} XP`)

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
              multiplier: multiplier,
              final_xp: finalXP,
              nft_count: nftCount
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
      await addXP(address, finalXP, 'NFT_WHEEL')

      // Update spins remaining locally
      setSpinsRemaining(prev => Math.max(0, prev - 1))

      console.log(`✅ Spin completed! ${finalXP} XP added to total XP`)
    } catch (err) {
      console.error('Error completing spin:', err)
      setError(err.message)
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
