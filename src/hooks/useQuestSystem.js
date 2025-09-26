import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useSupabase } from './useSupabase'

export const useQuestSystem = () => {
  const { address } = useAccount()
  const { supabase } = useSupabase()
  const [questProgress, setQuestProgress] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load quest progress from Supabase
  const loadQuestProgress = async () => {
    if (!address || !supabase) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('quest_progress')
        .select('*')
        .eq('wallet_address', address)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      if (data) {
        setQuestProgress(data)
        // Sync with localStorage
        localStorage.setItem('basehub-quest-progress', JSON.stringify({
          currentDay: data.current_day,
          weeklyBonus: data.weekly_bonus_earned,
          totalXP: data.total_quest_xp,
          questStats: data.quest_stats,
          lastUpdated: data.updated_at
        }))
      } else {
        // Initialize new quest progress
        await initializeQuestProgress()
      }
    } catch (err) {
      console.error('Error loading quest progress:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initialize quest progress for new user
  const initializeQuestProgress = async () => {
    if (!address || !supabase) return

    try {
      const initialProgress = {
        wallet_address: address,
        current_day: 1,
        weekly_bonus_earned: false,
        quest_stats: {},
        total_quest_xp: 0
      }

      const { data, error } = await supabase
        .from('quest_progress')
        .insert(initialProgress)
        .select()
        .single()

      if (error) throw error

      setQuestProgress(data)
      
      // Initialize localStorage
      localStorage.setItem('basehub-quest-progress', JSON.stringify({
        currentDay: 1,
        weeklyBonus: false,
        totalXP: 0,
        questStats: {},
        lastUpdated: new Date().toISOString()
      }))
    } catch (err) {
      console.error('Error initializing quest progress:', err)
      setError(err.message)
    }
  }

  // Update quest progress
  const updateQuestProgress = async (questType, amount) => {
    if (!address || !supabase) return

    try {
      // Get current progress
      const { data: currentData, error: fetchError } = await supabase
        .from('quest_progress')
        .select('*')
        .eq('wallet_address', address)
        .single()

      if (fetchError) throw fetchError

      const currentStats = currentData.quest_stats || {}
      const newStats = {
        ...currentStats,
        [questType]: (currentStats[questType] || 0) + amount
      }

      // Update in Supabase
      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          quest_stats: newStats,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setQuestProgress(data)

      // Update localStorage
      const localProgress = JSON.parse(localStorage.getItem('basehub-quest-progress') || '{}')
      localStorage.setItem('basehub-quest-progress', JSON.stringify({
        ...localProgress,
        questStats: newStats,
        lastUpdated: new Date().toISOString()
      }))

      return data
    } catch (err) {
      console.error('Error updating quest progress:', err)
      setError(err.message)
    }
  }

  // Award quest XP
  const awardQuestXP = async (xpAmount, rewardType, questDay = null, questType = null) => {
    if (!address || !supabase) return

    try {
      // Add to quest_rewards table
      const { error: rewardError } = await supabase
        .from('quest_rewards')
        .insert({
          wallet_address: address,
          reward_type: rewardType,
          xp_amount: xpAmount,
          quest_day: questDay,
          quest_type: questType
        })

      if (rewardError) throw rewardError

      // Update quest_progress total_quest_xp
      const { data: currentData, error: fetchError } = await supabase
        .from('quest_progress')
        .select('total_quest_xp')
        .eq('wallet_address', address)
        .single()

      if (fetchError) throw fetchError

      const newTotalXP = (currentData.total_quest_xp || 0) + xpAmount

      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          total_quest_xp: newTotalXP,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setQuestProgress(data)

      // Update localStorage
      const localProgress = JSON.parse(localStorage.getItem('basehub-quest-progress') || '{}')
      localStorage.setItem('basehub-quest-progress', JSON.stringify({
        ...localProgress,
        totalXP: newTotalXP,
        lastUpdated: new Date().toISOString()
      }))

      return data
    } catch (err) {
      console.error('Error awarding quest XP:', err)
      setError(err.message)
    }
  }

  // Complete quest day
  const completeQuestDay = async (day) => {
    if (!address || !supabase) return

    try {
      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          current_day: day + 1,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setQuestProgress(data)

      // Update localStorage
      const localProgress = JSON.parse(localStorage.getItem('basehub-quest-progress') || '{}')
      localStorage.setItem('basehub-quest-progress', JSON.stringify({
        ...localProgress,
        currentDay: day + 1,
        lastUpdated: new Date().toISOString()
      }))

      return data
    } catch (err) {
      console.error('Error completing quest day:', err)
      setError(err.message)
    }
  }

  // Award weekly bonus
  const awardWeeklyBonus = async () => {
    if (!address || !supabase) return

    try {
      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          weekly_bonus_earned: true,
          total_quest_xp: (questProgress?.total_quest_xp || 0) + 10000,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setQuestProgress(data)

      // Update localStorage
      const localProgress = JSON.parse(localStorage.getItem('basehub-quest-progress') || '{}')
      localStorage.setItem('basehub-quest-progress', JSON.stringify({
        ...localProgress,
        weeklyBonus: true,
        totalXP: (localProgress.totalXP || 0) + 10000,
        lastUpdated: new Date().toISOString()
      }))

      return data
    } catch (err) {
      console.error('Error awarding weekly bonus:', err)
      setError(err.message)
    }
  }

  // Reset quest week
  const resetQuestWeek = async () => {
    if (!address || !supabase) return

    try {
      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          current_day: 1,
          weekly_bonus_earned: false,
          quest_stats: {},
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setQuestProgress(data)

      // Reset localStorage
      localStorage.setItem('basehub-quest-progress', JSON.stringify({
        currentDay: 1,
        weeklyBonus: false,
        totalXP: questProgress?.total_quest_xp || 0, // Keep total XP
        questStats: {},
        lastUpdated: new Date().toISOString()
      }))

      return data
    } catch (err) {
      console.error('Error resetting quest week:', err)
      setError(err.message)
    }
  }

  // Load quest progress on mount
  useEffect(() => {
    if (address && supabase) {
      loadQuestProgress()
    }
  }, [address, supabase])

  return {
    questProgress,
    loading,
    error,
    updateQuestProgress,
    awardQuestXP,
    completeQuestDay,
    awardWeeklyBonus,
    resetQuestWeek,
    loadQuestProgress
  }
}
