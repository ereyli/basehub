// XP utility functions with Supabase integration
import { supabase } from '../config/supabase'
import { createPublicClient, http, fallback } from 'viem'
import { base } from 'viem/chains'
import { isTestnetChainId, NETWORKS } from '../config/networks'

// Base/Coinbase in-app browser: receipt wait often hangs; use RPC path (hash-only) like SwapHub
// Export for useTransactions: Base app'da writeContractAsync bazen resolve etmiyor, hash hook'tan alınır
export function isLikelyBaseApp () {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('coinbase') || ua.includes('base wallet') || ua.includes('cbwallet') || (ua.includes('base') && (ua.includes('app') || ua.includes('in-app')))
}

// Farcaster mini app (iframe / warpcast): same receipt/RPC issues; use RPC path for XP
function isLikelyFarcaster () {
  if (typeof window === 'undefined') return false
  if (window.location !== window.parent.location || window.parent !== window) return true
  const href = (window.location.href || '').toLowerCase()
  return href.includes('farcaster.xyz') || href.includes('warpcast.com')
}

// Farcaster/Base app: receipt beklenmez, hash alındığında hemen XP verilir (web'e dokunulmaz)
export function shouldAwardXPOnHashOnly () {
  return isLikelyBaseApp() || isLikelyFarcaster()
}

// Level calculation - DB calc_level ile uyumlu (max 100)
export const calcLevel = (xp) => {
  if (xp == null || xp < 0) return 1
  if (xp < 1000) return Math.min(10, Math.max(1, Math.floor(xp / 100) + 1))
  return Math.min(100, 10 + Math.floor(Math.log10(Math.max(xp, 1000) / 1000) * 10))
}

// Simple in-memory cache for NFT count checks
const nftCountCache = new Map()
const NFT_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Show a lightweight toast when bonus XP is applied
const showXPToast = (multiplier, nftCount, finalXP, baseXP) => {
  if (typeof document === 'undefined') return
  const existing = document.getElementById('xp-toast-bonus')
  if (existing) {
    // restart animation
    existing.classList.remove('xp-toast-show')
    void existing.offsetWidth
    existing.classList.add('xp-toast-show')
    return
  }
  const toast = document.createElement('div')
  toast.id = 'xp-toast-bonus'
  
  // Show actual XP earned with multiplier info
  if (multiplier > 1) {
    toast.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 16px; font-weight: 700;">🎉 +${finalXP.toLocaleString()} XP earned!</div>
        <div style="font-size: 12px; opacity: 0.9;">${multiplier}x multiplier (${nftCount} NFT${nftCount > 1 ? 's' : ''})</div>
      </div>
    `
  } else {
    toast.textContent = `🎉 +${finalXP.toLocaleString()} XP earned!`
  }
  
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

  setTimeout(fadeOut, 4000)
  document.body.appendChild(toast)
  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })
}

// Mobilde konsol yok; Base/Farcaster'da XP veya tx hatası kullanıcıya toast ile gösterilir
export function showXPErrorToast (message, durationMs = 5500) {
  if (typeof document === 'undefined') return
  const id = 'xp-error-toast'
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.id = id
  toast.textContent = message
  toast.style.position = 'fixed'
  toast.style.bottom = '20px'
  toast.style.left = '12px'
  toast.style.right = '12px'
  toast.style.padding = '14px 16px'
  toast.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)'
  toast.style.color = '#fff'
  toast.style.borderRadius = '12px'
  toast.style.boxShadow = '0 10px 30px rgba(185, 28, 28, 0.35)'
  toast.style.fontSize = '14px'
  toast.style.fontWeight = '600'
  toast.style.zIndex = '10000'
  toast.style.opacity = '0'
  toast.style.transition = 'opacity 0.2s ease'
  document.body.appendChild(toast)
  requestAnimationFrame(() => { toast.style.opacity = '1' })
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast) }, 200)
  }, durationMs)
}

// Get NFT count for wallet (returns 0 if no NFT)
export const getNFTCount = async (walletAddress) => {
  if (!walletAddress) return 0

  // Check cache
  const cached = nftCountCache.get(walletAddress)
  if (cached && Date.now() - cached.timestamp < NFT_CACHE_DURATION) {
    return cached.count
  }

  try {
    const { EARLY_ACCESS_CONFIG, EARLY_ACCESS_ABI } = await import('../config/earlyAccessNFT.js')
    if (!EARLY_ACCESS_CONFIG?.CONTRACT_ADDRESS) {
      return 0
    }

    // Use fallback RPCs to avoid 429 from mainnet.base.org rate limits
    const baseRpcUrls = [
      'https://base.llamarpc.com',
      'https://base-rpc.publicnode.com',
      ...(NETWORKS.BASE.rpcUrls || [])
    ]
    const transport = fallback(
      baseRpcUrls.map((url) => http(url, { retryCount: 1, retryDelay: 500 }))
    )
    const publicClient = createPublicClient({
      chain: base,
      transport
    })

    const balance = await publicClient.readContract({
      address: EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS,
      abi: EARLY_ACCESS_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    })

    const nftCount = Number(balance || 0)
    nftCountCache.set(walletAddress, { count: nftCount, timestamp: Date.now() })
    return nftCount
  } catch (error) {
    console.warn('⚠️ NFT count check failed, using base XP:', error)
    return 0
  }
}

// Add XP to user's wallet address (every game gives XP)
// skipNFTBonus: if true, NFT multiplier will not be applied (used for NFT Wheel)
// transactionHash: optional on-chain tx hash for logging
export const addXP = async (walletAddress, xpAmount, gameType = 'GENERAL', chainId = null, skipNFTBonus = false, transactionHash = null) => {
  if (!walletAddress || !xpAmount) {
    console.log('❌ Missing walletAddress or xpAmount:', { walletAddress, xpAmount })
    return
  }

  // Test ağlarında XP kazanımı kapalı (sadece mainnet'lerde XP verilir)
  if (chainId != null && isTestnetChainId(chainId)) {
    console.log('⏭️ XP atlanıyor (test ağı):', { chainId, gameType })
    return
  }

  const isBase = isLikelyBaseApp()
  const isFarcaster = isLikelyFarcaster()
  if (isBase || isFarcaster) console.log('🎯 Adding XP:', { walletAddress: walletAddress?.slice(0, 10) + '...', xpAmount, gameType, chainId, isBaseApp: isBase, isFarcaster })
  else console.log('🎯 Adding XP:', { walletAddress, xpAmount, gameType, chainId, skipNFTBonus })

  // Get NFT count and calculate multiplier
  let finalXP = xpAmount
  let bonusXP = 0
  let nftCount = 0
  let multiplier = 1
  
  // Maximum NFT count for multiplier (cap at 10 NFTs)
  const MAX_NFT_FOR_MULTIPLIER = 10
  
  // Skip NFT bonus for certain game types (like NFT Wheel)
  if (!skipNFTBonus) {
    try {
      nftCount = await getNFTCount(walletAddress)
      if (nftCount > 0) {
        // Cap NFT count at MAX_NFT_FOR_MULTIPLIER for multiplier calculation
        // Multiplier formula: min(nftCount, MAX_NFT_FOR_MULTIPLIER) + 1
        // 1 NFT = 2x, 2 NFT = 3x, ..., 10 NFT = 11x (max)
        // 11+ NFT = still 11x (capped)
        const effectiveNFTCount = Math.min(nftCount, MAX_NFT_FOR_MULTIPLIER)
        multiplier = effectiveNFTCount + 1
        bonusXP = xpAmount * (multiplier - 1) // Bonus is the extra XP beyond base
        finalXP = xpAmount * multiplier
        
        if (nftCount > MAX_NFT_FOR_MULTIPLIER) {
          console.log(`🎁 ${nftCount} NFT${nftCount > 1 ? 's' : ''} detected (capped at ${MAX_NFT_FOR_MULTIPLIER} for multiplier), applying ${multiplier}x XP: ${xpAmount} -> ${finalXP}`)
        } else {
          console.log(`🎁 ${nftCount} NFT${nftCount > 1 ? 's' : ''} detected, applying ${multiplier}x XP: ${xpAmount} -> ${finalXP}`)
        }
        showXPToast(multiplier, nftCount, finalXP, xpAmount)
      }
    } catch (err) {
      console.warn('⚠️ NFT check error, using base XP:', err)
    }
  } else {
    console.log('🎰 NFT bonus skipped for this XP award')
  }

  // Check if Supabase is available
  if (!supabase || !supabase.from) {
    console.log('⚠️ Supabase not available, XP will be stored locally')
    const localXP = JSON.parse(localStorage.getItem('basehub_xp') || '{}')
    localXP[walletAddress] = (localXP[walletAddress] || 0) + finalXP
    localStorage.setItem('basehub_xp', JSON.stringify(localXP))
    console.log('✅ XP stored locally:', localXP[walletAddress])
    return localXP[walletAddress]
  }

  try {
    // Base app / Farcaster: Edge Function receipt verification often fails/hangs; use direct RPC (hash for logging only), like SwapHub
    const useVerified = transactionHash && chainId != null && supabase?.functions?.invoke && !isLikelyBaseApp() && !isLikelyFarcaster()
    if (useVerified) {
      const invokeVerified = async () => {
        const { data, error } = await supabase.functions.invoke('award-xp-verified', {
          body: {
            wallet_address: walletAddress.toLowerCase(),
            game_type: gameType,
            xp_amount: Math.round(finalXP),
            tx_hash: transactionHash,
            chain_id: Number(chainId)
          }
        })
        let errMsg = null
        if (error) {
          errMsg = error?.message || String(error)
          if (typeof error?.context?.json === 'function') {
            try {
              const body = await error.context.json()
              if (body?.error) errMsg = body.error
            } catch (_) { /* ignore */ }
          }
          throw new Error(errMsg)
        }
        if (data?.error) throw new Error(data.error)
        return data
      }
      const XP_VERIFY_RETRIES = 3
      const XP_VERIFY_DELAY_MS = 4000
      let lastErr = null
      for (let attempt = 1; attempt <= XP_VERIFY_RETRIES; attempt++) {
        try {
          const data = await invokeVerified()
          const newTotalXP = data?.new_total_xp ?? finalXP
          console.log(`✅ XP awarded via verified Edge Function. Total: ${newTotalXP}`)
          localStorage.setItem('basehub_tx_refresh', Date.now().toString())
          return newTotalXP
        } catch (e) {
          lastErr = e
          const msg = (e?.message || '').toLowerCase()
          const isRetryable = /invalid|failed|transaction on-chain/i.test(msg) && attempt < XP_VERIFY_RETRIES
          if (isRetryable) {
            console.warn(`⚠️ XP verification attempt ${attempt}/${XP_VERIFY_RETRIES} failed (RPC lag), retrying in ${XP_VERIFY_DELAY_MS / 1000}s...`, e?.message)
            await new Promise(r => setTimeout(r, XP_VERIFY_DELAY_MS))
          } else {
            console.error('❌ award-xp-verified Edge Function error:', e?.message)
            throw e
          }
        }
      }
      throw lastErr
    }

    // tx_hash yoksa (NFT Wheel vb.) veya Edge Function yoksa: direkt RPC (API-based flows)
    // Farcaster/Base app → miniapp_transactions; web → transactions (RPC içinde p_source ile ayrılır)
    const source = isLikelyBaseApp() ? 'base_app' : (isLikelyFarcaster() ? 'farcaster' : 'web')
    const { data, error } = await supabase.rpc('award_xp', {
      p_wallet_address: walletAddress,
      p_final_xp: Math.round(finalXP),
      p_game_type: gameType,
      p_transaction_hash: transactionHash || null,
      p_source: source
    })
    if (error) {
      console.error('❌ award_xp RPC error:', error)
      const isMiniApp = isLikelyBaseApp() || isLikelyFarcaster()
      if (isMiniApp) {
        try {
          sessionStorage.setItem('basehub_last_xp_error', error?.message || JSON.stringify(error))
        } catch (_) {}
        showXPErrorToast('XP could not be saved. Check connection or try again.')
      }
      throw error
    }
    const newTotalXP = data?.new_total_xp ?? finalXP
    console.log(`✅ XP awarded via RPC. Total: ${newTotalXP}`)
    localStorage.setItem('basehub_tx_refresh', Date.now().toString())
    return newTotalXP
  } catch (error) {
    console.error('❌ Error in addXP:', error)
    const isMiniApp = isLikelyBaseApp() || isLikelyFarcaster()
    if (isMiniApp) {
      try {
        sessionStorage.setItem('basehub_last_xp_error', error?.message || String(error))
      } catch (_) {}
      showXPErrorToast('XP could not be saved. Check connection or try again.')
    }
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
    
    console.log(`🔍 getXP: Querying Supabase for wallet: ${normalizedWalletAddress} (original: ${walletAddress})`)
    
    // Get total XP from players table (includes both game XP and quest XP)
    // All wallet addresses are now normalized to lowercase in Supabase
    const { data: player, error } = await supabase
      .from('players')
      .select('total_xp, wallet_address')
      .eq('wallet_address', normalizedWalletAddress)
      .maybeSingle() // Use maybeSingle() instead of single() to avoid error if not found

    console.log(`🔍 getXP: Supabase response:`, { 
      player, 
      playerWalletAddress: player?.wallet_address,
      error: error?.code, 
      errorMessage: error?.message,
      hasPlayer: !!player
    })

    if (error) {
      console.error('❌ getXP: Supabase error:', error)
      // Don't throw, try to continue
    }

    if (!player) {
      console.log(`⚠️ getXP: No player found for ${normalizedWalletAddress} or ${walletAddress}, returning 0`)
      return 0 // No player found
    }

    const totalXP = player?.total_xp ?? 0
    console.log(`✅ getXP: Total XP from players table: ${totalXP} for ${player.wallet_address}`)
    
    // If total_xp is null or undefined, log warning
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
        level: calcLevel(total_xp),
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

    // Add token_balance + NFT status (parallel RPC for top 10)
    const playersWithTokens = (players || []).map(player => ({
      ...player,
      token_balance: calculateTokens(player.total_xp)
    }))
    const withNft = await Promise.all(playersWithTokens.map(async (p) => {
      try {
        const nftCount = await getNFTCount(p.wallet_address)
        return { ...p, hasNft: nftCount > 0 }
      } catch (_) {
        return { ...p, hasNft: false }
      }
    }))

    console.log('✅ Returning leaderboard data:', withNft)
    return withNft
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
        level: calcLevel(total_xp),
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

    // Add token_balance + NFT status (parallel RPC)
    const playersWithTokens = (players || []).map(player => ({
      ...player,
      token_balance: calculateTokens(player.total_xp)
    }))
    const withNft = await Promise.all(playersWithTokens.map(async (p) => {
      try {
        const nftCount = await getNFTCount(p.wallet_address)
        return { ...p, hasNft: nftCount > 0 }
      } catch (_) {
        return { ...p, hasNft: false }
      }
    }))

    console.log('✅ Returning extended leaderboard data:', withNft)
    return withNft
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
export const addBonusXP = async (walletAddress, gameType, isWin, chainId = null, transactionHash = null) => {
  if (!walletAddress || !gameType) return

  // Base XP for playing (varies by game type)
  let baseXP = 10
  const gameTypeLower = gameType.toLowerCase()
  
  if (gameTypeLower === 'gm' || gameTypeLower === 'gn') {
    baseXP = 150 // GM/GN gives 150 XP
  } else if (gameTypeLower === 'flip' || gameTypeLower === 'luckynumber' || gameTypeLower === 'diceroll' || gameTypeLower === 'slot') {
    baseXP = 150 // Flip, Lucky Number, Dice Roll, Slot give 150 XP
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

  // Map to DB game_type (get_max_xp_for_game_type expects LUCKY_NUMBER, DICE_ROLL, FLIP_GAME, etc.)
  const dbGameType = {
    flip: 'FLIP_GAME',
    luckynumber: 'LUCKY_NUMBER',
    diceroll: 'DICE_ROLL',
    gm: 'GM_GAME',
    gn: 'GN_GAME',
    slot: 'SLOT_GAME'
  }[gameTypeLower] || (gameType.toUpperCase() + '_GAME')

  return await addXP(walletAddress, totalXP, dbGameType, chainId, false, transactionHash)
}

// Claim tokens (convert XP to BHUP tokens) - COMING SOON
export const claimTokens = async (walletAddress, xpAmount) => {
  // This function is disabled for now - minting is not enabled
  throw new Error('Claim feature is coming soon! Minting is not enabled yet.')
}

// Per $100 volume: 5,000 XP (recurring every $100)
export const SWAP_PER_100_XP = 5000
export const SWAP_PER_100_GAME_TYPE = 'SWAP_PER_100'

// Big milestones on total volume bar (max $1M): one-time bonuses
export const SWAP_VOLUME_TIERS = [
  { threshold: 1000, xp: 50000, key: 'SWAP_MILESTONE_1K' },
  { threshold: 10000, xp: 500000, key: 'SWAP_MILESTONE_10K' },
  { threshold: 100000, xp: 5000000, key: 'SWAP_MILESTONE_100K' },
  { threshold: 1000000, xp: 50000000, key: 'SWAP_MILESTONE_1M' }
]
export const SWAP_VOLUME_BAR_MAX_USD = 1_000_000

// Record swap via Edge Function (on-chain verification) - Supabase corsHeaders ile CORS düzeltildi (v8)
export const recordSwapTransaction = async (walletAddress, swapAmountUSD, transactionHash) => {
  if (!walletAddress) {
    console.log('❌ Missing walletAddress for swap record')
    return { xpFromPer100: 0, xpFromMilestones: 0 }
  }
  const amount = typeof swapAmountUSD === 'number' ? swapAmountUSD : parseFloat(swapAmountUSD) || 0
  const normalized = walletAddress.toLowerCase()

  try {
    if (!transactionHash || amount <= 0) {
      console.log('❌ Missing tx_hash or invalid amount for swap record')
      return { xpFromPer100: 0, xpFromMilestones: 0 }
    }

    if (!supabase?.functions?.invoke) {
      console.log('⚠️ Supabase functions not configured')
      return { xpFromPer100: 0, xpFromMilestones: 0 }
    }

    console.log('📝 Recording swap volume (SwapHub via Edge Function):', { wallet: normalized.slice(0, 10) + '...', amountUSD: amount, txHash: transactionHash.slice(0, 10) + '...' })

    const { data, error } = await supabase.functions.invoke('record-swap', {
      body: {
        wallet_address: normalized,
        swap_amount_usd: amount,
        tx_hash: transactionHash
      }
    })

    if (error) {
      let errMsg = error?.message || String(error)
      let body = null
      if (typeof error.context?.json === 'function') {
        try {
          body = await error.context.json()
          if (body?.error) errMsg = body.error
        } catch (_) { /* ignore */ }
      } else if (error.context && typeof error.context === 'object' && !Array.isArray(error.context)) {
        body = error.context
        if (body?.error) errMsg = body.error
      }
      const retryable =
        /invalid|failed|transaction on-chain/i.test(String(errMsg)) ||
        error?.name === 'FunctionsRelayError' ||
        error?.name === 'FunctionsFetchError'
      const err = new Error(errMsg || 'record-swap failed')
      err.retryable = retryable
      throw err
    }

    if (data?.error) {
      const errMsg = data.error
      const err = new Error(errMsg)
      err.retryable = /invalid|failed|transaction on-chain/i.test(String(errMsg))
      throw err
    }

    const xpFromPer100 = data?.xpFromPer100 ?? 0
    const xpFromMilestones = data?.xpFromMilestones ?? 0
    return { xpFromPer100, xpFromMilestones }
  } catch (error) {
    console.error('❌ Error in recordSwapTransaction:', error)
    throw error
  }
}

// Get SwapHub volume and awards from swaphub_volume + transactions (for UI bars)
export const getSwapVolumeForWallet = async (walletAddress) => {
  if (!walletAddress) return { totalVolumeUSD: 0, per100BlocksAwarded: 0, awardedTiers: [] }
  const normalized = walletAddress.toLowerCase()
  try {
    if (!supabase?.from) {
      const vol = JSON.parse(localStorage.getItem('basehub_swaphub_volume') || '{}')
      const totalVolumeUSD = vol[normalized] ?? 0
      const local = JSON.parse(localStorage.getItem('basehub_transactions') || '[]')
      const per100BlocksAwarded = local.filter(t => t.wallet_address?.toLowerCase() === normalized && t.game_type === SWAP_PER_100_GAME_TYPE).length
      const awardedTiers = [...new Set(
        local
          .filter(t => t.wallet_address?.toLowerCase() === normalized && SWAP_VOLUME_TIERS.some(tier => tier.key === t.game_type))
          .map(t => t.game_type)
      )]
      return { totalVolumeUSD, per100BlocksAwarded, awardedTiers }
    }

    const { data: volRow } = await supabase
      .from('swaphub_volume')
      .select('total_volume_usd')
      .eq('wallet_address', normalized)
      .maybeSingle()
    const totalVolumeUSD = parseFloat(volRow?.total_volume_usd ?? 0) || 0

    const { data: per100Rows } = await supabase
      .from('transactions')
      .select('id')
      .eq('wallet_address', normalized)
      .eq('game_type', SWAP_PER_100_GAME_TYPE)
    const per100BlocksAwarded = per100Rows ? per100Rows.length : 0

    const tierKeys = SWAP_VOLUME_TIERS.map(t => t.key)
    const { data: milestoneRows } = await supabase
      .from('transactions')
      .select('game_type')
      .eq('wallet_address', normalized)
      .in('game_type', tierKeys)
    const awardedTiers = [...new Set((milestoneRows || []).map(r => r.game_type).filter(Boolean))]
    return { totalVolumeUSD, per100BlocksAwarded, awardedTiers }
  } catch (e) {
    console.warn('getSwapVolumeForWallet:', e)
    return { totalVolumeUSD: 0, per100BlocksAwarded: 0, awardedTiers: [] }
  }
}

// Check per-$100 blocks and big milestones; award XP. Returns { xpFromPer100, xpFromMilestones } for UI toast.
// NFT holders get 2x (or more) XP on every $100 threshold and milestone bonus (applied in addXP).
export const checkSwapVolumeMilestones = async (walletAddress) => {
  const result = { xpFromPer100: 0, xpFromMilestones: 0 }
  if (!walletAddress) return result

  try {
    const normalized = walletAddress.toLowerCase()
    let totalVolume = 0

    if (supabase?.from) {
      const { data: volRow } = await supabase
        .from('swaphub_volume')
        .select('total_volume_usd')
        .eq('wallet_address', normalized)
        .maybeSingle()
      totalVolume = parseFloat(volRow?.total_volume_usd ?? 0) || 0
    } else {
      const vol = JSON.parse(localStorage.getItem('basehub_swaphub_volume') || '{}')
      totalVolume = vol[normalized] ?? 0
    }

    console.log(`📊 Total swap volume (SwapHub): $${totalVolume.toFixed(2)}`)

    if (!supabase?.from) {
      console.log('⚠️ Supabase not available, skipping milestone XP')
      return result
    }

    // NFT multiplier: actual XP shown in toast = base * multiplier (addXP already applies 2x)
    let nftCount = 0
    try {
      nftCount = await getNFTCount(walletAddress)
    } catch (_) { /* ignore */ }
    const effectiveNFT = Math.min(nftCount, 10)
    const multiplier = effectiveNFT > 0 ? effectiveNFT + 1 : 1

    // 1) Per $100 recurring: every full $100 = 5,000 XP (NFT: 2x = 10,000 XP)
    const blocksReached = Math.floor(totalVolume / 100)
    const { data: per100Rows } = await supabase
      .from('transactions')
      .select('id')
      .eq('wallet_address', normalized)
      .eq('game_type', SWAP_PER_100_GAME_TYPE)
    const blocksAwarded = per100Rows ? per100Rows.length : 0
    for (let b = blocksAwarded + 1; b <= blocksReached; b++) {
      const blockThreshold = b * 100
      await addXP(walletAddress, SWAP_PER_100_XP, SWAP_PER_100_GAME_TYPE, null, false)
      result.xpFromPer100 += SWAP_PER_100_XP * multiplier
      console.log(`✅ Per $100 awarded: $${blockThreshold} → ${SWAP_PER_100_XP * multiplier} XP${multiplier > 1 ? ` (${multiplier}x NFT)` : ''}`)
    }

    // 2) Big milestones: $1k (50k), $10k (500k), $100k (5M), $1M (50M) XP (NFT: 2x)
    const tierKeys = SWAP_VOLUME_TIERS.map(t => t.key)
    const { data: awardedRows } = await supabase
      .from('transactions')
      .select('game_type')
      .eq('wallet_address', normalized)
      .in('game_type', tierKeys)
    const awardedSet = new Set((awardedRows || []).map(r => r.game_type).filter(Boolean))

    for (const tier of SWAP_VOLUME_TIERS) {
      if (totalVolume < tier.threshold) continue
      if (awardedSet.has(tier.key)) continue

      await addXP(walletAddress, tier.xp, tier.key, null, false)
      result.xpFromMilestones += tier.xp * multiplier
      awardedSet.add(tier.key)
      console.log(`✅ Swap milestone awarded: ${tier.key} ($${tier.threshold.toLocaleString()}) → ${(tier.xp * multiplier).toLocaleString()} XP${multiplier > 1 ? ` (${multiplier}x NFT)` : ''}`)
    }
    return result
  } catch (error) {
    console.error('❌ Error in checkSwapVolumeMilestones:', error)
    return result
  }
}
