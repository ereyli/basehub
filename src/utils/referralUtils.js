// Referral system utilities for BaseHub
import { supabase } from '../config/supabase'

export const getOrCreateReferralCode = async (walletAddress) => {
  if (!walletAddress) return null
  const normalized = walletAddress.toLowerCase().trim()

  try {
    const { data, error } = await supabase.rpc('get_or_create_referral_code', {
      p_wallet_address: normalized,
    })
    if (error) throw error
    return data
  } catch (e) {
    console.error('Error getting referral code:', e)
    return null
  }
}

export const applyReferralCode = async (walletAddress, code) => {
  if (!walletAddress || !code) return { success: false, error: 'Missing params' }
  const normalized = walletAddress.toLowerCase().trim()

  try {
    const { data, error } = await supabase.rpc('apply_referral_code', {
      p_referred_wallet: normalized,
      p_code: code.trim().toUpperCase(),
    })
    if (error) throw error
    return data || { success: false }
  } catch (e) {
    console.error('Error applying referral code:', e)
    return { success: false, error: e.message }
  }
}

export const getReferralStats = async (walletAddress) => {
  if (!walletAddress) return null
  const normalized = walletAddress.toLowerCase().trim()

  try {
    const { data, error } = await supabase.rpc('get_referral_stats', {
      p_wallet_address: normalized,
    })
    if (error) throw error
    return data
  } catch (e) {
    console.error('Error getting referral stats:', e)
    return null
  }
}

export const checkAndProcessReferralMilestones = async (walletAddress, currentTotalXP) => {
  if (!walletAddress || currentTotalXP == null) return null
  const normalized = walletAddress.toLowerCase().trim()

  try {
    const { data, error } = await supabase.rpc('process_referral_milestones', {
      p_wallet_address: normalized,
      p_current_total_xp: Math.round(currentTotalXP),
    })
    if (error) throw error
    if (data?.success && data?.milestones > 0) {
      console.log(
        `Referral milestone: ${data.milestones} new milestones, ${data.xp_given} XP given to referrer`
      )
    }
    return data
  } catch (e) {
    console.error('Error processing referral milestones:', e)
    return null
  }
}

// Check if a wallet has already been referred
export const hasUsedReferral = async (walletAddress) => {
  if (!walletAddress) return false
  const normalized = walletAddress.toLowerCase().trim()

  try {
    const { count, error } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referred_wallet', normalized)
    if (error) throw error
    return (count || 0) > 0
  } catch (e) {
    console.error('Error checking referral usage:', e)
    return false
  }
}

// Manually trigger signup reward (primarily for edge cases; normally handled by process_referral_milestones)
export const processReferralSignupReward = async (walletAddress) => {
  if (!walletAddress) return null
  const normalized = walletAddress.toLowerCase().trim()

  try {
    const { data, error } = await supabase.rpc('process_referral_signup_reward', {
      p_referred_wallet: normalized,
    })
    if (error) throw error
    return data
  } catch (e) {
    console.error('Error processing referral signup reward:', e)
    return null
  }
}

// Read ?ref=CODE from URL and apply if valid
export const readReferralFromURL = () => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('ref')?.toUpperCase()?.trim() || null
}

// Build referral share URL
export const buildReferralUrl = (code) => {
  if (!code) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.basehub.fun'
  return `${origin}/?ref=${code}`
}
