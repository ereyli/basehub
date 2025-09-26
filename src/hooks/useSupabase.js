import { useState, useEffect } from 'react'
import { supabase, TABLES, XP_CONFIG, GAME_TYPES } from '../config/supabase'

export const useSupabase = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Get or create player
  const getOrCreatePlayer = async (walletAddress) => {
    try {
      setLoading(true)
      setError(null)

      console.log('getOrCreatePlayer called with:', walletAddress)

      // TEMPORARY: Use localStorage for testing
      const storageKey = `player_${walletAddress}`
      let player = JSON.parse(localStorage.getItem(storageKey) || 'null')
      
      if (!player) {
        player = {
          id: Date.now().toString(),
          wallet_address: walletAddress,
          total_xp: 0,
          level: 1,
          total_transactions: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        localStorage.setItem(storageKey, JSON.stringify(player))
        console.log('Created new player in localStorage:', player)
      } else {
        console.log('Found existing player in localStorage:', player)
      }

      return player
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Add XP to player
  const addXP = async (walletAddress, gameType, transactionHash) => {
    try {
      setLoading(true)
      setError(null)

      console.log('addXP called with:', { walletAddress, gameType, transactionHash })
      
      const xpAmount = XP_CONFIG[gameType]
      console.log('XP amount for game type:', { gameType, xpAmount, config: XP_CONFIG })
      
      if (!xpAmount) {
        console.error('Invalid game type:', gameType, 'Available types:', Object.keys(XP_CONFIG))
        throw new Error(`Invalid game type: ${gameType}`)
      }

      // TEMPORARY: Use localStorage for testing
      const storageKey = `player_${walletAddress}`
      let player = JSON.parse(localStorage.getItem(storageKey) || 'null')
      
      if (!player) {
        player = {
          id: Date.now().toString(),
          wallet_address: walletAddress,
          total_xp: 0,
          level: 1,
          total_transactions: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      console.log('Current player:', player)
      
      // Calculate new XP and level
      const newTotalXP = player.total_xp + xpAmount
      const newLevel = calculateLevel(newTotalXP)
      const newTotalTransactions = player.total_transactions + 1

      console.log('Updating player XP:', { 
        oldXP: player.total_xp, 
        newXP: newTotalXP, 
        xpAdded: xpAmount,
        newLevel,
        newTotalTransactions 
      })

      // Update player in localStorage
      player.total_xp = newTotalXP
      player.level = newLevel
      player.total_transactions = newTotalTransactions
      player.updated_at = new Date().toISOString()

      localStorage.setItem(storageKey, JSON.stringify(player))
      console.log('Player updated in localStorage:', player)

      // Record transaction in localStorage
      const transactionKey = `transaction_${Date.now()}`
      const transaction = {
        id: transactionKey,
        wallet_address: walletAddress,
        game_type: gameType,
        xp_earned: xpAmount,
        transaction_hash: transactionHash,
        created_at: new Date().toISOString()
      }
      localStorage.setItem(transactionKey, JSON.stringify(transaction))
      console.log('Transaction recorded in localStorage:', transaction)

      return { success: true, xpEarned: xpAmount, newTotalXP, newLevel }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Record transaction
  const recordTransaction = async (walletAddress, gameType, xpAmount, transactionHash) => {
    try {
      console.log('Recording transaction:', { walletAddress, gameType, xpAmount, transactionHash })
      const { data, error } = await supabase
        .from(TABLES.TRANSACTIONS)
        .insert([
          {
            wallet_address: walletAddress,
            game_type: gameType,
            xp_earned: xpAmount,
            transaction_hash: transactionHash,
            created_at: new Date().toISOString()
          }
        ])
        .select()

      console.log('Transaction recording result:', { data, error })

      if (error) {
        console.error('Error recording transaction:', error)
        throw error
      }
    } catch (err) {
      console.error('Error recording transaction:', err)
      // Don't throw here, as this is not critical
    }
  }

  // Update leaderboard
  const updateLeaderboard = async () => {
    try {
      // Get top 10 players by total XP
      const { data: topPlayers, error } = await supabase
        .from(TABLES.PLAYERS)
        .select('wallet_address, total_xp, level, total_transactions')
        .order('total_xp', { ascending: false })
        .limit(10)

      if (error) {
        throw error
      }

      // Update leaderboard table
      const leaderboardData = topPlayers.map((player, index) => ({
        rank: index + 1,
        wallet_address: player.wallet_address,
        total_xp: player.total_xp,
        level: player.level,
        total_transactions: player.total_transactions,
        updated_at: new Date().toISOString()
      }))

      // Clear and insert new leaderboard
      await supabase.from(TABLES.LEADERBOARD).delete().neq('rank', 0)
      
      if (leaderboardData.length > 0) {
        const { error: insertError } = await supabase
          .from(TABLES.LEADERBOARD)
          .insert(leaderboardData)

        if (insertError) {
          throw insertError
        }
      }
    } catch (err) {
      console.error('Error updating leaderboard:', err)
      // Don't throw here, as this is not critical
    }
  }

  // Get leaderboard
  const getLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from(TABLES.LEADERBOARD)
        .select('*')
        .order('rank', { ascending: true })

      if (error) {
        throw error
      }

      return data || []
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get player stats
  const getPlayerStats = async (walletAddress) => {
    try {
      setLoading(true)
      setError(null)

      // TEMPORARY: Use localStorage for testing
      const storageKey = `player_${walletAddress}`
      const player = JSON.parse(localStorage.getItem(storageKey) || 'null')
      
      if (!player) {
        // Player not found, return default stats
        return {
          wallet_address: walletAddress,
          total_xp: 0,
          level: 1,
          total_transactions: 0
        }
      }

      return player
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get player transactions
  const getPlayerTransactions = async (walletAddress, limit = 10) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from(TABLES.TRANSACTIONS)
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return data || []
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Calculate level from XP
  const calculateLevel = (totalXP) => {
    if (totalXP >= XP_CONFIG.LEVEL_5) return 5
    if (totalXP >= XP_CONFIG.LEVEL_4) return 4
    if (totalXP >= XP_CONFIG.LEVEL_3) return 3
    if (totalXP >= XP_CONFIG.LEVEL_2) return 2
    return 1
  }

  // Calculate tokens from XP
  const calculateTokens = (totalXP) => {
    return Math.floor(totalXP * XP_CONFIG.XP_TO_TOKEN_RATIO)
  }

  // Check if minting is enabled (for now, always false)
  const isMintingEnabled = () => {
    // TODO: Check contract minting status when contract is deployed
    return false; // Initially disabled
  };

  return {
    supabase, // Add supabase client
    loading,
    error,
    getOrCreatePlayer,
    addXP,
    getLeaderboard,
    getPlayerStats,
    getPlayerTransactions,
    calculateLevel,
    calculateTokens,
    isMintingEnabled
  }
}
