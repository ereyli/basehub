import { createClient } from '@supabase/supabase-js'

const RUNS_TABLE = 'agent_cloud_runs'
const SESSIONS_TABLE = 'agent_cloud_sessions'

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim())
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase()
}

function json(res, statusCode, body) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  try {
    const supabase = getServerSupabase()
    if (!supabase) {
      return json(res, 500, { error: 'Supabase service storage is not configured.' })
    }

    if (req.method === 'GET') {
      const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`)
      const ownerAddress = normalizeAddress(url.searchParams.get('ownerAddress'))
      if (!isAddress(ownerAddress)) return json(res, 400, { error: 'ownerAddress is required.' })

      const { data, error } = await supabase
        .from(RUNS_TABLE)
        .select('*')
        .eq('owner_address', ownerAddress)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return json(res, 200, { ok: true, run: data || null })
    }

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed.' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const eventType = String(body.eventType || 'start')
    const ownerAddress = normalizeAddress(body.ownerAddress)
    if (!isAddress(ownerAddress)) return json(res, 400, { error: 'ownerAddress is required.' })

    if (eventType === 'stop') {
      const { data, error } = await supabase
        .from(RUNS_TABLE)
        .update({
          status: 'stopped',
          stopped_at: new Date().toISOString(),
          locked_until: null,
          lock_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_address', ownerAddress)
        .in('status', ['active', 'executing', 'paused'])
        .select('*')

      if (error) throw error
      return json(res, 200, { ok: true, runs: data || [] })
    }

    const subAccountAddress = normalizeAddress(body.subAccountAddress)
    if (!isAddress(subAccountAddress)) {
      return json(res, 400, { error: 'subAccountAddress is required.' })
    }

    const currentPlan = body.currentPlan && typeof body.currentPlan === 'object' ? body.currentPlan : null
    if (!currentPlan || !Array.isArray(currentPlan.queue) || currentPlan.queue.length === 0) {
      return json(res, 400, { error: 'Approved plan queue is required.' })
    }

    await supabase
      .from(RUNS_TABLE)
      .update({
        status: 'replaced',
        stopped_at: new Date().toISOString(),
        locked_until: null,
        lock_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('owner_address', ownerAddress)
      .in('status', ['active', 'executing', 'paused'])

    const { data: session } = await supabase
      .from(SESSIONS_TABLE)
      .select('policy')
      .eq('owner_address', ownerAddress)
      .maybeSingle()

    const sessionPolicy = session?.policy && typeof session.policy === 'object' ? session.policy : {}
    const agentSignerEncrypted = sessionPolicy.agentSignerEncrypted || null
    const agentSignerAddress = sessionPolicy.agentSignerAddress || null

    const payload = {
      owner_address: ownerAddress,
      sub_account_address: subAccountAddress,
      status: 'active',
      current_plan: currentPlan,
      logs: Array.isArray(body.logs) ? body.logs.slice(0, 50) : [],
      spend_permission: body.spendPermission || {},
      sub_account: body.subAccount || {},
      settings: {
        ...(body.settings || {}),
        agentSignerEncrypted,
        agentSignerAddress,
        signerModel: agentSignerEncrypted ? 'per_user_agent_signer' : 'shared_worker_signer',
      },
      interval_minutes: Math.max(1, Number(body.intervalMinutes || body.settings?.intervalMinutes || 4)),
      next_run_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from(RUNS_TABLE)
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    return json(res, 200, { ok: true, run: data })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Cloud Agent run failed.' })
  }
}
