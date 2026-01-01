// XP utility functions with Supabase integration
import { supabase } from '../config/supabase'

// Add XP to user's wallet address (every game gives XP)
export const addXP = async (walletAddress, xpAmount, gameType = 'GENERAL') => {
  if (!walletAddress || !xpAmount) {
    console.log('❌ Missing walletAddress or xpAmount:', { walletAddress, xpAmount })
    return
  }

  console.log('🎯 Adding XP:', { walletAddress, xpAmount, gameType })

  // Check if Supabase is available
  if (!supabase || !supabase.from) {
    console.log('⚠️ Supabase not available, XP will be stored locally')
    // Store in localStorage as fallback
    const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
    localXP[walletAddress] = (localXP[walletAddress] || 0) + xpAmount
    localStorage.setItem('basehub_xp', JSON.stringify(localXP))
    console.log('✅ XP stored locally:', localXP[walletAddress])
    return localXP[walletAddress]
  }

  try {
    console.log('📊 Checking if player exists in Supabase...')
    // First, check if player already exists
    const { data: existingPlayer, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching player:', fetchError)
      throw fetchError
    }

    console.log('🔍 Player lookup result:', { existingPlayer, fetchError: fetchError?.code })

    if (existingPlayer) {
      console.log('👤 Updating existing player:', existingPlayer.wallet_address)
      // Update existing player - add XP
      const newTotalXP = existingPlayer.total_xp + xpAmount
      const newLevel = Math.floor(newTotalXP / 100) + 1
      const newTotalTransactions = existingPlayer.total_transactions + 1

      console.log('📈 Player update data:', { 
        oldXP: existingPlayer.total_xp, 
        xpToAdd: xpAmount, 
        newXP: newTotalXP, 
        newLevel, 
        newTotalTransactions 
      })

      const { error: updateError } = await supabase
        .from('players')
        .update({
          total_xp: newTotalXP,
          level: newLevel,
          total_transactions: newTotalTransactions,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)

      if (updateError) {
        console.error('❌ Error updating player:', updateError)
        throw updateError
      }

      // Record transaction in transactions table
      try {
        await recordTransaction({
          wallet_address: walletAddress,
          game_type: gameType,
          xp_earned: xpAmount,
          transaction_hash: null // Can be added later if needed
        })
      } catch (txError) {
        // Don't fail the XP update if transaction recording fails
        console.warn('⚠️ Failed to record transaction (non-critical):', txError)
      }

      console.log(`✅ Updated ${walletAddress} with ${xpAmount} XP. Total: ${newTotalXP}`)
      return newTotalXP
    } else {
      console.log('🆕 Creating new player for:', walletAddress)
      // Create new player
      const newPlayerData = {
        wallet_address: walletAddress,
        total_xp: xpAmount,
        level: Math.floor(xpAmount / 100) + 1,
        total_transactions: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('📝 New player data:', newPlayerData)

      const { error: insertError } = await supabase
        .from('players')
        .insert([newPlayerData])

      if (insertError) {
        console.error('❌ Error creating player:', insertError)
        throw insertError
      }

      // Record transaction in transactions table
      try {
        await recordTransaction({
          wallet_address: walletAddress,
          game_type: gameType,
          xp_earned: xpAmount,
          transaction_hash: null // Can be added later if needed
        })
      } catch (txError) {
        // Don't fail the player creation if transaction recording fails
        console.warn('⚠️ Failed to record transaction (non-critical):', txError)
      }

      console.log(`✅ Created new player ${walletAddress} with ${xpAmount} XP`)
      return xpAmount
    }
  } catch (error) {
    console.error('❌ Error in addXP:', error)
    throw error
  }
}

// Get XP for user's wallet address (includes game XP + quest XP from players table)
export const getXP = async (walletAddress) => {
  if (!walletAddress) return 0
  
  // Check if Supabase is available
  if (!supabase || !supabase.from) {
    console.log('⚠️ Supabase not available, using local XP storage')
    const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
    return localXP[walletAddress] || 0
  }
  
  try {
    // Get total XP from players table (includes both game XP and quest XP)
    const { data: player, error } = await supabase
      .from('players')
      .select('total_xp')
      .eq('wallet_address', walletAddress)
      .single()

    if (error && error.code === 'PGRST116') return 0 // No player found
    if (error) throw error

    const totalXP = player?.total_xp || 0
    console.log(`📊 Total XP from players table: ${totalXP}`)
    
    return totalXP
  } catch (error) {
    console.error('❌ Error in getXP:', error)
    // Fallback to local storage
    const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
    return localXP[walletAddress] || 0
  }
}

// Get leaderboard (top 10 players)
export const getLeaderboard = async () => {
  try {
    // Check if Supabase is available
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, using local leaderboard')
      // Get local XP data
      const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
      const players = Object.entries(localXP).map(([wallet_address, total_xp]) => ({
        wallet_address,
        total_xp,
        level: Math.floor(total_xp / 100) + 1,
        total_transactions: 1,
        token_balance: calculateTokens(total_xp)
      })).sort((a, b) => b.total_xp - a.total_xp).slice(0, 10)
      
      console.log('✅ Returning local leaderboard data:', players)
      return players
    }

    console.log('🏆 Fetching leaderboard from Supabase...')
    const { data: players, error } = await supabase
      .from('players')
      .select('wallet_address, total_xp, level, total_transactions')
      .order('total_xp', { ascending: false })
      .limit(10)

    console.log('📊 Supabase leaderboard response:', { players, error })

    if (error) {
      console.error('❌ Error fetching leaderboard:', error)
      throw error
    }

    // Add token_balance calculation to each player
    const playersWithTokens = (players || []).map(player => ({
      ...player,
      token_balance: calculateTokens(player.total_xp)
    }))

    console.log('✅ Returning leaderboard data:', playersWithTokens)
    return playersWithTokens
  } catch (error) {
    console.error('❌ Error in getLeaderboard:', error)
    return []
  }
}

// Get extended leaderboard (more players)
export const getExtendedLeaderboard = async (offset = 0, limit = 5) => {
  try {
    // Check if Supabase is available
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, using local extended leaderboard')
      // Get local XP data
      const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
      const players = Object.entries(localXP).map(([wallet_address, total_xp]) => ({
        wallet_address,
        total_xp,
        level: Math.floor(total_xp / 100) + 1,
        total_transactions: 1,
        token_balance: calculateTokens(total_xp)
      })).sort((a, b) => b.total_xp - a.total_xp).slice(offset, offset + limit)
      
      console.log('✅ Returning local extended leaderboard data:', players)
      return players
    }

    console.log('🏆 Fetching extended leaderboard from Supabase...')
    const { data: players, error } = await supabase
      .from('players')
      .select('wallet_address, total_xp, level, total_transactions')
      .order('total_xp', { ascending: false })
      .range(offset, offset + limit - 1)

    console.log('📊 Supabase extended leaderboard response:', { players, error })

    if (error) {
      console.error('❌ Error fetching extended leaderboard:', error)
      throw error
    }

    // Add token_balance calculation to each player
    const playersWithTokens = (players || []).map(player => ({
      ...player,
      token_balance: calculateTokens(player.total_xp)
    }))

    console.log('✅ Returning extended leaderboard data:', playersWithTokens)
    return playersWithTokens
  } catch (error) {
    console.error('❌ Error in getExtendedLeaderboard:', error)
    return []
  }
}

// Calculate tokens from XP (1 XP = 10 BHUP)
export const calculateTokens = (xp) => {
  return Math.floor(xp * 10)
}

// Record transaction in Supabase
export const recordTransaction = async (transactionData) => {
  if (!transactionData || !transactionData.wallet_address) return

  try {
    // Check if Supabase is available
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, storing transaction locally')
      // Store in localStorage as fallback
      const localTransactions = JSON.parse(localStorage.getItem('basehub_transactions') || '[]')
      localTransactions.push({
        ...transactionData,
        created_at: new Date().toISOString()
      })
      localStorage.setItem('basehub_transactions', JSON.stringify(localTransactions))
      console.log('✅ Transaction stored locally')
      return
    }

    console.log('📝 Recording transaction to Supabase:', transactionData)
    
    const { error } = await supabase
      .from('transactions')
      .insert([{
        ...transactionData,
        created_at: new Date().toISOString()
      }])

    if (error) {
      console.error('❌ Error recording transaction:', error)
      throw error
    }

    console.log('✅ Transaction recorded successfully')
  } catch (error) {
    console.error('❌ Error in recordTransaction:', error)
    // Don't throw error - this is not critical for user experience
  }
}

// Add bonus XP for winning games
export const addBonusXP = async (walletAddress, gameType, isWin) => {
  if (!walletAddress || !gameType) return

  // Base XP for playing (varies by game type)
  let baseXP = 10
  const gameTypeLower = gameType.toLowerCase()
  
  if (gameTypeLower === 'gm' || gameTypeLower === 'gn') {
    baseXP = 30 // GM/GN gives 30 XP
  } else if (gameTypeLower === 'flip' || gameTypeLower === 'luckynumber' || gameTypeLower === 'diceroll' || gameTypeLower === 'slot') {
    baseXP = 60 // Flip, Lucky Number, Dice Roll, Slot give 60 XP
  }
  
  // Bonus XP for winning
  let bonusXP = 0
  if (isWin) {
    switch (gameTypeLower) {
      case 'flip':
        bonusXP = 500 // 500 bonus for winning flip
        break
      case 'luckynumber':
        bonusXP = 1000 // 1000 bonus for winning lucky number
        break
      case 'diceroll':
        bonusXP = 1500 // 1500 bonus for winning dice roll
        break
      case 'gm':
      case 'gn':
        bonusXP = 0 // No bonus for GM/GN
        break
      default:
        bonusXP = 0
    }
  }

  const totalXP = baseXP + bonusXP
  console.log(`${gameType} game: Base ${baseXP} XP + Bonus ${bonusXP} XP = ${totalXP} XP total`)
  
  return await addXP(walletAddress, totalXP)
}

// Claim tokens (convert XP to BHUP tokens) - COMING SOON
export const claimTokens = async (walletAddress, xpAmount) => {
  // This function is disabled for now - minting is not enabled
  throw new Error('Claim feature is coming soon! Minting is not enabled yet.')
}

// Record swap transaction with volume tracking
export const recordSwapTransaction = async (walletAddress, swapAmountUSD, transactionHash, xpEarned = 250) => {
  if (!walletAddress || !swapAmountUSD) {
    console.log('❌ Missing walletAddress or swapAmountUSD:', { walletAddress, swapAmountUSD })
    return
  }

  try {
    // Check if Supabase is available
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, storing swap transaction locally')
      const localTransactions = JSON.parse(localStorage.getItem('basehub_transactions') || '[]')
      localTransactions.push({
        wallet_address: walletAddress,
        game_type: 'SWAP_VOLUME',
        swap_amount_usd: swapAmountUSD,
        transaction_hash: transactionHash,
        created_at: new Date().toISOString()
      })
      localStorage.setItem('basehub_transactions', JSON.stringify(localTransactions))
      console.log('✅ Swap transaction stored locally')
      return
    }

    console.log('📝 Recording swap volume:', { walletAddress, swapAmountUSD, transactionHash })
    
    // Record the swap volume (separate from XP transaction)
    await recordTransaction({
      wallet_address: walletAddress,
      game_type: 'SWAP_VOLUME',
      xp_earned: 0, // Volume tracking only, XP already awarded
      swap_amount_usd: swapAmountUSD,
      transaction_hash: transactionHash
    })

    // Check and award milestone bonus
    await checkSwapMilestone(walletAddress)
  } catch (error) {
    console.error('❌ Error in recordSwapTransaction:', error)
  }
}

// Check if user reached $500 swap milestone and award bonus
export const checkSwapMilestone = async (walletAddress) => {
  if (!walletAddress) return

  try {
    // Check if Supabase is available
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, skipping milestone check')
      return
    }

    // Check if milestone bonus already awarded
    const { data: existingMilestone, error: milestoneError } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('game_type', 'SWAP_MILESTONE_500')
      .single()

    if (milestoneError && milestoneError.code !== 'PGRST116') {
      console.error('❌ Error checking milestone:', milestoneError)
      return
    }

    if (existingMilestone) {
      console.log('✅ $500 milestone bonus already awarded')
      return
    }

    // Calculate total swap volume from SWAP_VOLUME transactions
    const { data: swapTransactions, error: swapError } = await supabase
      .from('transactions')
      .select('swap_amount_usd')
      .eq('wallet_address', walletAddress)
      .eq('game_type', 'SWAP_VOLUME')
      .not('swap_amount_usd', 'is', null)

    if (swapError) {
      console.error('❌ Error fetching swap transactions:', swapError)
      return
    }

    const totalVolume = (swapTransactions || []).reduce((sum, tx) => {
      return sum + (parseFloat(tx.swap_amount_usd) || 0)
    }, 0)

    console.log(`📊 Total swap volume: $${totalVolume.toFixed(2)}`)

    // Check if milestone reached
    if (totalVolume >= 500) {
      console.log('🎉 $500 milestone reached! Awarding 5000 XP bonus...')
      
      // Award milestone bonus XP
      await addXP(walletAddress, 5000, 'SWAP_MILESTONE_500')

      // Record milestone transaction
      await recordTransaction({
        wallet_address: walletAddress,
        game_type: 'SWAP_MILESTONE_500',
        xp_earned: 5000,
        swap_amount_usd: totalVolume,
        transaction_hash: null
      })

      console.log('✅ $500 milestone bonus awarded: 5000 XP')
    }
  } catch (error) {
    console.error('❌ Error in checkSwapMilestone:', error)
  }
}
