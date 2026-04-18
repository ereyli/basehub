/**
 * Base App notifications — admin-only broadcast (server secrets only).
 *
 * Vercel env (no VITE_*):
 *   ADMIN_NOTIFICATIONS_SECRET   — long random string; must match panel POST body `adminSecret`
 *   BASE_DASHBOARD_API_KEY       — Base Dashboard → Settings → API Key
 *   BASE_APP_NOTIFICATIONS_APP_URLS — comma-separated app_url list (priority order), e.g.
 *     https://www.basehub.fun,https://basehub.fun,https://basehub-alpha.vercel.app
 *   BASE_APP_NOTIFICATIONS_APP_URL — fallback single URL if URLS unset
 *
 * POST JSON (send): { adminSecret, title, message, targetPath?, dryRun? }
 * POST JSON (history): { adminSecret, action: "list", limit?, search? }
 * Limits: title ≤30, message ≤200 (Base API).
 * Geçmiş: SUPABASE_URL + SUPABASE_SERVICE_KEY (veya VITE_SUPABASE_URL) — gönderim başarılı olunca insert; list aynı secret ile.
 *
 * Ref: https://docs.base.org/apps/technical-guides/base-notifications
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const API_BASE = 'https://dashboard.base.org/api/v1'

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function clean(s) {
  if (s == null) return ''
  return String(s).trim()
}

function getAppUrls() {
  const rawList = clean(process.env.BASE_APP_NOTIFICATIONS_APP_URLS)
  let urls
  if (rawList) {
    urls = rawList.split(',').map((x) => clean(x)).filter(Boolean)
  } else {
    const single = clean(process.env.BASE_APP_NOTIFICATIONS_APP_URL) || 'https://www.basehub.fun'
    urls = [single]
  }
  const out = []
  const seen = new Set()
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

async function fetchAllAddresses(apiKey, appUrl) {
  const addresses = []
  let cursor = null
  const encApp = encodeURIComponent(appUrl)

  for (;;) {
    let qs = `app_url=${encApp}&notification_enabled=true&limit=100`
    if (cursor) qs += `&cursor=${encodeURIComponent(cursor)}`

    const res = await fetch(`${API_BASE}/notifications/app/users?${qs}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
        'User-Agent': 'BaseHub-admin-notifications/1.0',
      },
    })
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`GET users invalid JSON (${res.status}): ${text.slice(0, 200)}`)
    }
    if (!res.ok || !data.success) {
      throw new Error(data.message || `GET users failed: ${res.status}`)
    }
    for (const u of data.users || []) {
      if (u && u.address) addresses.push(String(u.address))
    }
    const next = (data.nextCursor || '').trim()
    if (!next) break
    cursor = next
  }
  return addresses
}

async function postSend(apiKey, appUrl, wallets, title, message, targetPath) {
  const res = await fetch(`${API_BASE}/notifications/send`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'BaseHub-admin-notifications/1.0',
    },
    body: JSON.stringify({
      app_url: appUrl,
      wallet_addresses: wallets,
      title,
      message,
      target_path: targetPath,
    }),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`send invalid JSON (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(data.message || `send failed: ${res.status}`)
  }
  return data
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function saveBroadcastLog(row) {
  const supabase = getServerSupabase()
  if (!supabase) return { skipped: true }
  const { error } = await supabase.from('admin_notification_broadcasts').insert(row)
  if (error) {
    console.error('admin-notifications supabase insert:', error.message)
    return { error: error.message }
  }
  return { ok: true }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expectedSecret = process.env.ADMIN_NOTIFICATIONS_SECRET
  const apiKey = process.env.BASE_DASHBOARD_API_KEY

  if (!expectedSecret || !apiKey) {
    return res.status(404).json({ error: 'not_found' })
  }

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const adminSecret = clean(body.adminSecret)
  if (!timingSafeEqualString(adminSecret, expectedSecret)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (clean(body.action) === 'list') {
    const supabase = getServerSupabase()
    if (!supabase) {
      return res.status(503).json({ error: 'History not configured (Supabase service key missing)' })
    }
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 50, 1), 100)
    const rawSearch = clean(body.search)
    const safeSearch = rawSearch.replace(/[%_\\]/g, '').slice(0, 80)

    let query = supabase
      .from('admin_notification_broadcasts')
      .select('id, created_at, title, message, target_path, total_unique_wallets, counts_by_url, app_urls')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (safeSearch.length >= 1) {
      const v = `%${safeSearch}%`.replace(/"/g, '""')
      query = query.or(`title.ilike."${v}",message.ilike."${v}"`)
    }

    const { data, error } = await query
    if (error) {
      console.error('admin-notifications history:', error.message)
      return res.status(502).json({ error: 'Failed to load history', detail: error.message })
    }
    return res.status(200).json({ ok: true, items: data || [] })
  }

  const title = clean(body.title)
  const message = clean(body.message)
  const targetPath = clean(body.targetPath) || '/'
  const dryRun = Boolean(body.dryRun)

  if (!title || title.length > 30) {
    return res.status(400).json({ error: 'title required, max 30 characters' })
  }
  if (!message || message.length > 200) {
    return res.status(400).json({ error: 'message required, max 200 characters' })
  }
  if (targetPath !== '/' && !targetPath.startsWith('/')) {
    return res.status(400).json({ error: 'targetPath must start with /' })
  }

  const appUrls = getAppUrls()
  const fetchedByUrl = {}
  try {
    for (const u of appUrls) {
      const raw = await fetchAllAddresses(apiKey, u)
      const local = new Map()
      for (const a of raw) local.set(a.toLowerCase(), a)
      fetchedByUrl[u] = [...local.values()]
    }
  } catch (e) {
    console.error('admin-notifications fetch users:', e.message)
    return res.status(502).json({ error: 'Failed to fetch audience', detail: e.message })
  }

  const assignedByUrl = {}
  for (const u of appUrls) assignedByUrl[u] = []
  const seenGlobal = new Set()
  for (const u of appUrls) {
    for (const a of fetchedByUrl[u]) {
      const k = a.toLowerCase()
      if (seenGlobal.has(k)) continue
      seenGlobal.add(k)
      assignedByUrl[u].push(a)
    }
  }

  const totalUnique = appUrls.reduce((n, u) => n + assignedByUrl[u].length, 0)
  const summary = {
    appUrls,
    countsByUrl: Object.fromEntries(appUrls.map((u) => [u, assignedByUrl[u].length])),
    totalUniqueWallets: totalUnique,
  }

  if (dryRun) {
    return res.status(200).json({ ok: true, dryRun: true, ...summary })
  }

  const results = []
  const chunkSize = 1000
  try {
    for (const u of appUrls) {
      const wallets = assignedByUrl[u]
      if (!wallets.length) continue
      const batches = chunk(wallets, chunkSize)
      for (let i = 0; i < batches.length; i++) {
        const out = await postSend(apiKey, u, batches[i], title, message, targetPath)
        results.push({ appUrl: u, batch: i + 1, response: out })
        if (i + 1 < batches.length) await new Promise((r) => setTimeout(r, 7000))
      }
    }
  } catch (e) {
    console.error('admin-notifications send:', e.message)
    return res.status(502).json({
      error: 'Send failed',
      detail: e.message,
      partial: results,
      ...summary,
    })
  }

  const logResult = await saveBroadcastLog({
    title,
    message,
    target_path: targetPath,
    total_unique_wallets: totalUnique,
    counts_by_url: summary.countsByUrl,
    app_urls: appUrls,
    results,
  })

  return res.status(200).json({ ok: true, ...summary, results, savedToSupabase: logResult })
}
