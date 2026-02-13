import { createClient } from '@supabase/supabase-js'

// Supabase configuration - REQUIRED for production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Database table names
export const TABLES = {
  PLAYERS: 'players',
  TRANSACTIONS: 'transactions',
  LEADERBOARD: 'leaderboard'
}

// XP System Configuration
export const XP_CONFIG = {
  GM_GAME: 150,        // 150 XP per GM
  GN_GAME: 150,       // 150 XP per GN
  FLIP_GAME: 150,     // 150 XP per flip
  LUCKY_NUMBER: 150,  // 150 XP per lucky number
  DICE_ROLL: 150,     // 150 XP per dice roll
  SLOT_GAME: 150,     // 150 XP per slot spin
  CONTRACT_GAME: 30,  // 30 XP per contract interaction
  
  // XP to Token conversion
  XP_TO_TOKEN_RATIO: 10, // 1 XP = 10 BHUP token
  
  // Level system
  LEVEL_1: 100,       // Level 1: 100 XP
  LEVEL_2: 250,       // Level 2: 250 XP
  LEVEL_3: 500,       // Level 3: 500 XP
  LEVEL_4: 1000,      // Level 4: 1000 XP
  LEVEL_5: 2000,      // Level 5: 2000 XP
}

// Game types
export const GAME_TYPES = {
  GM_GAME: 'GM_GAME',
  GN_GAME: 'GN_GAME',
  FLIP_GAME: 'FLIP_GAME',
  LUCKY_NUMBER: 'LUCKY_NUMBER',
  DICE_ROLL: 'DICE_ROLL',
  CONTRACT_GAME: 'CONTRACT_GAME'
}

// Create mock Supabase client for development
const createMockSupabase = () => ({
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null })
  })
})

// Initialize Supabase client
let supabase

// Always try to create real Supabase client first
if (supabaseUrl && supabaseKey) {
  // Create real Supabase client
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'basehub-farcaster@1.0.0'
      }
    }
  })
  console.log('✅ Supabase configured for BaseHub Farcaster Mini App')
} else {
  console.warn('⚠️ Supabase configuration missing! Using mock for development.')
  supabase = createMockSupabase()
  console.log('✅ Mock Supabase configured for development')
}

export { supabase }