// XP utility functions with Supabase integration
import { supabase } from '../config/supabase'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

// Simple in-memory cache for NFT ownership checks
const nftOwnerCache = new Map()
const NFT_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Show a lightweight toast when 2x XP is applied
const showXPToast = () => {
  if (typeof document === 'undefined') return
  const existing = document.getElementById('xp-toast-2x')
  if (existing) {
    // restart animation
    existing.classList.remove('xp-toast-show')
    void existing.offsetWidth
    existing.classList.add('xp-toast-show')
    return
  }
  const toast = document.createElement('div')
  toast.id = 'xp-toast-2x'
  toast.textContent = '🎉 You earned 2x XP for being an NFT holder!'
  toast.style.position = 'fixed'
  toast.style.bottom = '20px'
  toast.style.right = '20px'
  toast.style.padding = '12px 16px'
  toast.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
  toast.style.color = '#fff'
  toast.style.borderRadius = '12px'
  toast.style.boxShadow = '0 10px 30px rgba(37, 99, 235, 0.35)'
  toast.style.fontSize = '14px'
  toast.style.fontWeight = '600'
  toast.style.zIndex = '9999'
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(10px)'
  toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
  toast.classList.add('xp-toast-show')

  const fadeOut = () => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(10px)'
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 200)
  }

  setTimeout(fadeOut, 2200)
  document.body.appendChild(toast)
  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })
}

// Check if wallet owns Early Access NFT (with cache)
const isWalletNFTOwner = async (walletAddress) => {
  if (!walletAddress) return false

  // cache
  const cached = nftOwnerCache.get(walletAddress)
  if (cached && Date.now() - cached.timestamp < NFT_CACHE_DURATION) {
    return cached.hasNFT
  }

  try {
    const { EARLY_ACCESS_CONFIG, EARLY_ACCESS_ABI } = await import('../config/earlyAccessNFT.js')
    if (!EARLY_ACCESS_CONFIG?.CONTRACT_ADDRESS) {
      return false
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: http()
    })

    const balance = await publicClient.readContract({
      address: EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS,
      abi: EARLY_ACCESS_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    })

    const hasNFT = Number(balance || 0) > 0
    nftOwnerCache.set(walletAddress, { hasNFT, timestamp: Date.now() })
    return hasNFT
  } catch (error) {
    console.warn('⚠️ NFT ownership check failed, skipping 2x XP:', error)
    return false
  }
}

// Add XP to user's wallet address (every game gives XP)
export const addXP = async (walletAddress, xpAmount, gameType = 'GENERAL', chainId = null) => {
  if (!walletAddress || !xpAmount) {
    console.log('❌ Missing walletAddress or xpAmount:', { walletAddress, xpAmount })
    return
  }

  console.log('🎯 Adding XP:', { walletAddress, xpAmount, gameType, chainId })

  // Apply 2x multiplier if wallet holds our NFT
  let finalXP = xpAmount
  let bonusXP = 0
  let isNFTOwner = false
  try {
    isNFTOwner = await isWalletNFTOwner(walletAddress)
    if (isNFTOwner) {
      bonusXP = xpAmount // Bonus equals base XP (2x total)
      finalXP = xpAmount * 2
      console.log(`🎁 NFT detected, applying 2x XP: ${xpAmount} -> ${finalXP}`)
      showXPToast()
    }
  } catch (err) {
    console.warn('⚠️ NFT check error, using base XP:', err)
  }

  // Check if Supabase is available
  if (!supabase || !supabase.from) {
    console.log('⚠️ Supabase not available, XP will be stored locally')
    // Store in localStorage as fallback
    const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
    localXP[walletAddress] = (localXP[walletAddress] || 0) + finalXP
    localStorage.setItem('basehub_xp', JSON.stringify(localXP))
    console.log('✅ XP stored locally:', localXP[walletAddress])
    return localXP[walletAddress]
  }

  try {
    console.log('📊 Checking if player exists in Supabase...')
    // Normalize wallet address to lowercase for consistent querying
    const normalizedWalletAddress = walletAddress.toLowerCase()
    // First, check if player already exists
    // Use .or() to check both lowercase and original case (prevent XP reset bug)
    const { data: existingPlayer, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .or(`wallet_address.eq.${normalizedWalletAddress},wallet_address.eq.${walletAddress}`)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching player:', fetchError)
      throw fetchError
    }

    console.log('🔍 Player lookup result:', { existingPlayer, fetchError: fetchError?.code })

    if (existingPlayer) {
      console.log('👤 Updating existing player:', existingPlayer.wallet_address)
      console.log('🔗 Chain ID for XP update:', chainId)
      
      // CRITICAL: Ensure existingPlayer.total_xp is a valid number
      const currentXP = existingPlayer.total_xp ?? 0
      if (typeof currentXP !== 'number' || isNaN(currentXP)) {
        console.error('❌ CRITICAL: existingPlayer.total_xp is invalid:', existingPlayer.total_xp)
        console.error('❌ Player data:', existingPlayer)
        // Don't proceed if XP is invalid - this could cause data loss
        throw new Error(`Invalid total_xp value: ${existingPlayer.total_xp}`)
      }
      
      // Update existing player - add XP
      const newTotalXP = currentXP + finalXP
      const newLevel = Math.floor(newTotalXP / 100) + 1
      const newTotalTransactions = (existingPlayer.total_transactions || 0) + 1

      console.log('📈 Player update data:', { 
        oldXP: currentXP, 
        xpToAdd: finalXP, 
        newXP: newTotalXP, 
        newLevel, 
        newTotalTransactions,
        chainId
      })

      const { error: updateError } = await supabase
        .from('players')
        .update({
          total_xp: newTotalXP,
          level: newLevel,
          total_transactions: newTotalTransactions,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', normalizedWalletAddress)

      if (updateError) {
        console.error('❌ Error updating player:', updateError)
        throw updateError
      }

      // Note: Transaction is recorded separately in useTransactions.js with transaction_hash
      // We don't record here to avoid duplicate entries
      // Transaction recording happens after transaction confirmation in game hooks

      console.log(`✅ Updated ${walletAddress} with ${xpAmount} XP. Total: ${newTotalXP}`)
      return newTotalXP
    } else {
      console.log('🆕 Creating new player for:', normalizedWalletAddress)
      
      // CRITICAL: Before creating new player, double-check if player exists
      // This prevents race conditions where player might have been created between checks
      // Use .or() to check both lowercase and original case
      const { data: doubleCheckPlayer, error: doubleCheckError } = await supabase
        .from('players')
        .select('total_xp, total_transactions')
        .or(`wallet_address.eq.${normalizedWalletAddress},wallet_address.eq.${walletAddress}`)
        .single()
      
      if (doubleCheckPlayer && !doubleCheckError) {
        console.log('⚠️ Player found on double-check, updating instead of creating')
        // Player exists, update instead
        const currentXP = doubleCheckPlayer.total_xp ?? 0
        const newTotalXP = currentXP + finalXP
        const newLevel = Math.floor(newTotalXP / 100) + 1
        const newTotalTransactions = (doubleCheckPlayer.total_transactions || 0) + 1
        
        const { error: updateError } = await supabase
          .from('players')
          .update({
            total_xp: newTotalXP,
            level: newLevel,
            total_transactions: newTotalTransactions,
            updated_at: new Date().toISOString()
          })
          .eq('wallet_address', normalizedWalletAddress)
        
        if (updateError) {
          console.error('❌ Error updating player on double-check:', updateError)
          throw updateError
        }
        
        console.log(`✅ Updated ${walletAddress} with ${xpAmount} XP (double-check). Total: ${newTotalXP}`)
        return newTotalXP
      }
      
      // Create new player only if double-check confirms player doesn't exist
      const newPlayerData = {
        wallet_address: normalizedWalletAddress,
        total_xp: finalXP,
        level: Math.floor(finalXP / 100) + 1,
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
          wallet_address: normalizedWalletAddress,
          game_type: gameType,
          xp_earned: finalXP,
          base_xp: xpAmount,
          bonus_xp: bonusXP,
          is_nft_owner: isNFTOwner,
          transaction_hash: null // Can be added later if needed
          // Note: chain_id removed - column doesn't exist in Supabase table yet
        })
      } catch (txError) {
        // Don't fail the player creation if transaction recording fails
        console.warn('⚠️ Failed to record transaction (non-critical):', txError)
      }

      console.log(`✅ Created new player ${walletAddress} with ${finalXP} XP`)
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
    // Normalize wallet address to lowercase for consistent querying (same as addXP)
    const normalizedWalletAddress = walletAddress.toLowerCase()
    
    console.log(`🔍 getXP: Querying Supabase for wallet: ${normalizedWalletAddress}`)
    
    // Get total XP from players table (includes both game XP and quest XP)
    const { data: player, error } = await supabase
      .from('players')
      .select('total_xp, wallet_address')
      .eq('wallet_address', normalizedWalletAddress)
      .single()

    console.log(`🔍 getXP: Supabase response:`, { player, error: error?.code, errorMessage: error?.message })

    if (error && error.code === 'PGRST116') {
      console.log(`⚠️ getXP: No player found for ${normalizedWalletAddress}, returning 0`)
      return 0 // No player found
    }
    if (error) {
      console.error('❌ getXP: Supabase error:', error)
      throw error
    }

    const totalXP = player?.total_xp ?? 0
    console.log(`✅ getXP: Total XP from players table: ${totalXP} for ${normalizedWalletAddress}`)
    
    // If total_xp is null or undefined, try to get it from the player object
    if (totalXP === 0 && player) {
      console.log(`⚠️ getXP: total_xp is 0, but player exists:`, player)
    }
    
    return totalXP
  } catch (error) {
    console.error('❌ Error in getXP:', error)
    // Fallback to local storage
    const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
    const fallbackXP = localXP[walletAddress] || 0
    console.log(`⚠️ getXP: Using fallback XP from localStorage: ${fallbackXP}`)
    return fallbackXP
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
    // Normalize wallet_address to lowercase for consistent querying
    const normalizedTransactionData = {
      ...transactionData,
      wallet_address: transactionData.wallet_address.toLowerCase()
    }

    // Check if Supabase is available
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, storing transaction locally')
      // Store in localStorage as fallback
      const localTransactions = JSON.parse(localStorage.getItem('basehub_transactions') || '[]')
      localTransactions.push({
        ...normalizedTransactionData,
        created_at: new Date().toISOString()
      })
      localStorage.setItem('basehub_transactions', JSON.stringify(localTransactions))
      console.log('✅ Transaction stored locally')
      return
    }

    console.log('📝 Recording transaction to Supabase:', normalizedTransactionData)
    
    // Remove chain_id if it exists (column doesn't exist in Supabase table yet)
    const { chain_id, ...transactionWithoutChainId } = normalizedTransactionData
    
    const transactionToInsert = {
      ...transactionWithoutChainId,
      created_at: new Date().toISOString()
    }
    console.log('📝 Transaction data to insert:', transactionToInsert)
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([transactionToInsert])
      .select()

    if (error) {
      console.error('❌ Error recording transaction:', error)
      // Don't throw error - allow XP to be awarded even if transaction recording fails
      console.warn('⚠️ Transaction recording failed, but XP was already awarded')
      return
    }

    console.log('✅ Transaction recorded successfully:', data)
    
    // Trigger header refresh by setting a flag in localStorage
    // Header will check this flag and refresh when it changes
    localStorage.setItem('basehub_tx_refresh', Date.now().toString())
  } catch (error) {
    console.error('❌ Error in recordTransaction:', error)
    // Even if transaction recording fails, try to trigger refresh
    // in case transaction was partially recorded
    try {
      localStorage.setItem('basehub_tx_refresh', Date.now().toString())
    } catch (e) {
      // Ignore localStorage errors
    }
    // Don't throw error - this is not critical for user experience
  }
}

// Add bonus XP for winning games
export const addBonusXP = async (walletAddress, gameType, isWin, chainId = null) => {
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
  
  return await addXP(walletAddress, totalXP, gameType.toUpperCase() + '_GAME', chainId)
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

    // Calculate how many $500 milestones have been reached
    const milestonesReached = Math.floor(totalVolume / 500)
    console.log(`🎯 Milestones reached: ${milestonesReached}`)

    if (milestonesReached === 0) {
      console.log('📊 No milestones reached yet')
      return
    }

    // Get already awarded milestones
    const { data: awardedMilestones, error: milestoneError } = await supabase
      .from('transactions')
      .select('swap_amount_usd')
      .eq('wallet_address', walletAddress)
      .eq('game_type', 'SWAP_MILESTONE_500')
      .not('swap_amount_usd', 'is', null)

    if (milestoneError && milestoneError.code !== 'PGRST116') {
      console.error('❌ Error checking awarded milestones:', milestoneError)
      return
    }

    const alreadyAwardedCount = awardedMilestones ? awardedMilestones.length : 0
    console.log(`✅ Already awarded milestones: ${alreadyAwardedCount}`)

    // Award bonuses for new milestones
    const newMilestonesCount = milestonesReached - alreadyAwardedCount

    if (newMilestonesCount > 0) {
      console.log(`🎉 ${newMilestonesCount} new milestone(s) reached! Awarding ${newMilestonesCount * 5000} XP...`)
      
      const totalBonusXP = newMilestonesCount * 5000
      
      // Award milestone bonus XP
      await addXP(walletAddress, totalBonusXP, 'SWAP_MILESTONE_500')

      // Record milestone transactions for each new milestone
      for (let i = 0; i < newMilestonesCount; i++) {
        const milestoneNumber = alreadyAwardedCount + i + 1
        const milestoneVolume = milestoneNumber * 500
        
        await recordTransaction({
          wallet_address: walletAddress,
          game_type: 'SWAP_MILESTONE_500',
          xp_earned: 5000,
          swap_amount_usd: milestoneVolume,
          transaction_hash: null
        })
      }

      console.log(`✅ ${newMilestonesCount} milestone bonus(es) awarded: ${totalBonusXP} XP total`)
    } else {
      console.log('✅ All milestones already awarded')
    }
  } catch (error) {
    console.error('❌ Error in checkSwapMilestone:', error)
  }
}
