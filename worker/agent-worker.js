import { createClient } from '@supabase/supabase-js'
import { executeCloudAction } from '../api/agent-cloud-execute.js'

const RUNS_TABLE = 'agent_cloud_runs'
const MEMORY_RUNS_TABLE = 'agent_runs'
const MEMORY_REFLECTIONS_TABLE = 'agent_reflections'

const POLL_MS = Math.max(5000, Number(process.env.AGENT_WORKER_POLL_MS || 15000))
const LOCK_MS = Math.max(30000, Number(process.env.AGENT_WORKER_LOCK_MS || 180000))
const BATCH_SIZE = Math.max(1, Math.min(10, Number(process.env.AGENT_WORKER_BATCH_SIZE || 3)))

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY are required.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function getSupabaseHost() {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    return new URL(url).host
  } catch {
    return 'unknown'
  }
}

function nowIso() {
  return new Date().toISOString()
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Math.max(1, Number(minutes || 1)) * 60 * 1000).toISOString()
}

function normalizeQueue(plan = {}) {
  return Array.isArray(plan.queue) ? plan.queue : []
}

function getNextAction(plan = {}) {
  return normalizeQueue(plan)
    .filter((item) => ['approved', 'scheduled', 'draft'].includes(item.status || 'draft'))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))[0] || null
}

function toExecutionAction(item = {}) {
  return {
    id: item.id,
    targetId: item.executorMapping || item.actionType || item.targetId,
    targetType: item.targetType,
    title: item.title,
    summary: item.reason || item.summary || '',
    estimatedSpendWei: item.estimatedSpendWei || '0',
    estimatedSpendEth: item.estimatedCostEth || '0',
    payload: item.params || item.payload || {},
    status: item.status,
    requiresApproval: item.requiresApproval,
    priority: item.priority,
  }
}

function patchQueueItem(plan = {}, actionId, patch = {}) {
  return {
    ...plan,
    queue: normalizeQueue(plan).map((item) => (
      item.id === actionId ? { ...item, ...patch } : item
    )),
  }
}

function appendRunLog(logs = [], log = {}) {
  return [
    {
      id: `worker_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: nowIso(),
      ...log,
    },
    ...(Array.isArray(logs) ? logs : []),
  ].slice(0, 100)
}

function compactError(error) {
  return (
    error?.shortMessage ||
    error?.message ||
    error?.cause?.shortMessage ||
    error?.cause?.message ||
    'Cloud Agent execution failed.'
  )
}

async function acquireRun(supabase, run) {
  const lockId = `worker_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const lockedUntil = new Date(Date.now() + LOCK_MS).toISOString()

  const { data, error } = await supabase
    .from(RUNS_TABLE)
    .update({
      status: 'executing',
      lock_id: lockId,
      locked_until: lockedUntil,
      updated_at: nowIso(),
    })
    .eq('id', run.id)
    .eq('status', 'active')
    .is('lock_id', null)
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data ? { ...data, lockId } : null
}

async function releaseRun(supabase, runId, lockId, patch = {}) {
  const { error } = await supabase
    .from(RUNS_TABLE)
    .update({
      ...patch,
      lock_id: null,
      locked_until: null,
      updated_at: nowIso(),
    })
    .eq('id', runId)
    .eq('lock_id', lockId)

  if (error) throw error
}

async function writeMemory(supabase, run, action, result, status, summary) {
  await supabase.from(MEMORY_RUNS_TABLE).insert({
    wallet_address: run.sub_account_address,
    status,
    summary,
    planned_actions: normalizeQueue(run.current_plan).length,
    executed_action: action?.title || action?.targetId || null,
  }).throwOnError()

  await supabase.from(MEMORY_REFLECTIONS_TABLE).insert({
    wallet_address: run.sub_account_address,
    reflection_type: status === 'success' ? 'execution' : 'failure',
    body: status === 'success'
      ? `Cloud worker executed ${action?.title || action?.targetId} successfully.`
      : summary,
    meta: {
      targetId: action?.targetId,
      txHash: result?.hash || null,
    },
  }).throwOnError()
}

async function processRun(supabase, run) {
  const locked = await acquireRun(supabase, run)
  if (!locked) {
    console.log(`[agent-worker] skipped run ${run.id}: lock not acquired`)
    return
  }

  const actionItem = getNextAction(locked.current_plan)
  if (!actionItem) {
    await releaseRun(supabase, locked.id, locked.lockId, {
      status: 'completed',
      stopped_at: nowIso(),
      last_error: null,
    })
    console.log(`[agent-worker] run ${locked.id} completed: no actions left`)
    return
  }

  const action = toExecutionAction(actionItem)
  const executingPlan = patchQueueItem(locked.current_plan, actionItem.id, {
    status: 'executing',
    scheduledFor: nowIso(),
  })

  await supabase
    .from(RUNS_TABLE)
    .update({ current_plan: executingPlan, updated_at: nowIso() })
    .eq('id', locked.id)
    .eq('lock_id', locked.lockId)
    .throwOnError()

  try {
    console.log(`[agent-worker] executing run ${locked.id}: ${action.title || action.targetId}`)
    const result = await executeCloudAction({
      ownerAddress: locked.sub_account_address,
      subAccount: locked.sub_account || {},
      spendPermission: locked.spend_permission || null,
      action,
      settings: {
        ...(locked.settings || {}),
        walletAddress: locked.sub_account_address,
      },
      logs: locked.logs || [],
    })

    const completedPlan = patchQueueItem(executingPlan, actionItem.id, {
      status: 'completed',
      executedAt: nowIso(),
      result: {
        txHash: result.hash,
        spentWei: result.spentWei,
        spentEth: result.spentEth,
      },
    })
    const logs = appendRunLog(locked.logs, {
      status: 'success',
      title: action.title,
      summary: action.summary,
      targetId: action.targetId,
      targetType: action.targetType,
      payload: action.payload,
      txHash: result.hash,
      spentWei: result.spentWei,
    })

    await writeMemory(supabase, locked, action, result, 'success', action.summary || action.title)
      .catch((error) => console.warn('[agent-worker] memory write failed:', error.message))

    await releaseRun(supabase, locked.id, locked.lockId, {
      status: 'active',
      current_plan: completedPlan,
      logs,
      next_run_at: addMinutes(new Date(), locked.interval_minutes),
      last_error: null,
    })
    console.log(`[agent-worker] success ${result.hash || ''}`)
  } catch (error) {
    const message = compactError(error)
    const failedPlan = patchQueueItem(executingPlan, actionItem.id, {
      status: 'failed',
      executedAt: nowIso(),
      error: message,
    })
    const logs = appendRunLog(locked.logs, {
      status: 'failed',
      title: action.title || 'Execution failed',
      summary: message,
      targetId: action.targetId,
      targetType: action.targetType,
      payload: action.payload,
    })

    await writeMemory(supabase, locked, action, null, 'failed', message)
      .catch((memoryError) => console.warn('[agent-worker] memory write failed:', memoryError.message))

    await releaseRun(supabase, locked.id, locked.lockId, {
      status: 'active',
      current_plan: failedPlan,
      logs,
      next_run_at: addMinutes(new Date(), locked.interval_minutes),
      last_error: message,
    })
    console.warn(`[agent-worker] failed run ${locked.id}: ${message}`)
  }
}

async function tick(supabase) {
  const startedAt = nowIso()
  const { data, error } = await supabase
    .from(RUNS_TABLE)
    .select('*')
    .in('status', ['active'])
    .lte('next_run_at', nowIso())
    .order('next_run_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) throw error
  console.log(`[agent-worker] tick ${startedAt}: due_runs=${(data || []).length}`)
  for (const run of data || []) {
    await processRun(supabase, run)
  }
}

async function main() {
  const supabase = getSupabase()
  console.log(`[agent-worker] started. poll=${POLL_MS}ms batch=${BATCH_SIZE} supabase=${getSupabaseHost()}`)

  let running = false
  const runTick = async () => {
    if (running) return
    running = true
    try {
      await tick(supabase)
    } catch (error) {
      console.error('[agent-worker] tick failed:', error.message || error)
    } finally {
      running = false
    }
  }

  await runTick()
  const timer = setInterval(runTick, POLL_MS)

  const shutdown = () => {
    clearInterval(timer)
    console.log('[agent-worker] stopped')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[agent-worker] boot failed:', error.message || error)
  process.exit(1)
})
