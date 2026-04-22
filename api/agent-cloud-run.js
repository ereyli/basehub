import { createClient } from '@supabase/supabase-js'
import { getCloudSession } from './_agentCloud.js'

const RUNS_TABLE = 'agent_cloud_runs'

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
        .in('status', ['active', 'executing', 'paused', 'paused_funding', 'failed_balance'])
        .select('*')

      if (error) throw error
      return json(res, 200, { ok: true, runs: data || [] })
    }

    const subAccountAddress = normalizeAddress(body.subAccountAddress)
    if (!isAddress(subAccountAddress)) {
      return json(res, 400, { error: 'subAccountAddress is required.' })
    }

    const { session, setupError } = await getCloudSession(ownerAddress)
    if (setupError) {
      return json(res, 500, { error: setupError })
    }
    if (!session) {
      return json(res, 409, { error: 'Cloud Agent permission is not registered yet. Run Set up cloud first.' })
    }
    if (String(session.status || '') !== 'ready') {
      return json(res, 409, { error: 'Cloud Agent permission needs to be updated before starting.' })
    }
    if (normalizeAddress(session.sub_account_address) !== subAccountAddress) {
      return json(res, 409, { error: 'Cloud Agent wallet changed. Refresh the page and start again.' })
    }
    if (session.worker_owns_sub_account === false) {
      return json(res, 409, {
        error: 'Saved agent wallet belongs to an older worker permission. Click Update permission once, then start again.',
      })
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
      .in('status', ['active', 'executing', 'paused', 'paused_funding', 'failed_balance'])

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
        agentSignerEncrypted: null,
        agentSignerAddress: null,
        signerModel: 'shared_worker_signer',
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
