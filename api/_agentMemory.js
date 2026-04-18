import { createClient } from '@supabase/supabase-js'

const MEMORY_TABLES = {
  PROFILES: 'agent_profiles',
  MEMORIES: 'agent_memories',
  RUNS: 'agent_runs',
  REFLECTIONS: 'agent_reflections',
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function getAgentMemoryTables() {
  return MEMORY_TABLES
}

export async function getAgentMemorySnapshot(walletAddress) {
  const supabase = getServerSupabase()
  if (!supabase || !walletAddress) {
    return {
      profile: null,
      memories: [],
      runs: [],
      reflections: [],
      available: false,
      setupError: !supabase ? 'Supabase agent memory is not configured.' : null,
    }
  }

  const [profileRes, memoryRes, runRes, reflectionRes] = await Promise.all([
    supabase.from(MEMORY_TABLES.PROFILES).select('*').eq('wallet_address', walletAddress).maybeSingle(),
    supabase.from(MEMORY_TABLES.MEMORIES).select('*').eq('wallet_address', walletAddress).order('created_at', { ascending: false }).limit(8),
    supabase.from(MEMORY_TABLES.RUNS).select('*').eq('wallet_address', walletAddress).order('created_at', { ascending: false }).limit(6),
    supabase.from(MEMORY_TABLES.REFLECTIONS).select('*').eq('wallet_address', walletAddress).order('created_at', { ascending: false }).limit(6),
  ])

  const setupError =
    profileRes.error?.message ||
    memoryRes.error?.message ||
    runRes.error?.message ||
    reflectionRes.error?.message ||
    null

  return {
    profile: profileRes.data || null,
    memories: memoryRes.data || [],
    runs: runRes.data || [],
    reflections: reflectionRes.data || [],
    available: !setupError,
    setupError,
  }
}

export async function upsertAgentProfile({ walletAddress, objective, currentIntent, plannerMode }) {
  const supabase = getServerSupabase()
  if (!supabase || !walletAddress) return

  const { error } = await supabase.from(MEMORY_TABLES.PROFILES).upsert(
    {
      wallet_address: walletAddress,
      objective,
      current_intent: currentIntent,
      planner_mode: plannerMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'wallet_address' }
  )
  if (error) throw new Error(error.message)
}

export async function insertAgentMemory({ walletAddress, memoryType, title, body, meta = {} }) {
  const supabase = getServerSupabase()
  if (!supabase || !walletAddress) return

  const { error } = await supabase.from(MEMORY_TABLES.MEMORIES).insert({
    wallet_address: walletAddress,
    memory_type: memoryType,
    title,
    body,
    meta,
  })
  if (error) throw new Error(error.message)
}

export async function insertAgentRun({ walletAddress, status, summary, plannedActions = 0, executedAction = null }) {
  const supabase = getServerSupabase()
  if (!supabase || !walletAddress) return

  const { error } = await supabase.from(MEMORY_TABLES.RUNS).insert({
    wallet_address: walletAddress,
    status,
    summary,
    planned_actions: plannedActions,
    executed_action: executedAction,
  })
  if (error) throw new Error(error.message)
}

export async function insertAgentReflection({ walletAddress, reflectionType, body, score = null, meta = {} }) {
  const supabase = getServerSupabase()
  if (!supabase || !walletAddress) return

  const { error } = await supabase.from(MEMORY_TABLES.REFLECTIONS).insert({
    wallet_address: walletAddress,
    reflection_type: reflectionType,
    body,
    score,
    meta,
  })
  if (error) throw new Error(error.message)
}
