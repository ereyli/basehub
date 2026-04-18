/**
 * Internal admin: Base App push notifications (Base Dashboard API).
 * Secret only on server validation; gate screen then panel (no secret in main form).
 */
import React, { useCallback, useState } from 'react'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'

const HISTORY_LIMIT = 10

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function AdminNotifications() {
  const [unlocked, setUnlocked] = useState(false)
  const [adminSecret, setAdminSecret] = useState('')
  const [gateSecret, setGateSecret] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetPath, setTargetPath] = useState('/')
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  const loadHistory = useCallback(async (secret) => {
    const key = secret ?? adminSecret
    if (!key.trim()) return
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await fetch('/api/admin-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecret: key,
          action: 'list',
          limit: HISTORY_LIMIT,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`)
      }
      setHistoryItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setHistoryError(err.message || 'Geçmiş yüklenemedi')
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [adminSecret])

  const onGateSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const s = gateSecret.trim()
      if (!s) {
        setLoginError('Şifre gerekli.')
        return
      }
      setLoginLoading(true)
      setLoginError(null)
      try {
        const res = await fetch('/api/admin-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminSecret: s,
            action: 'list',
            limit: 1,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) throw new Error('Şifre hatalı.')
          throw new Error(data.detail || data.error || `HTTP ${res.status}`)
        }
        setAdminSecret(s)
        setGateSecret('')
        setUnlocked(true)
        await loadHistory(s)
      } catch (err) {
        setLoginError(err.message || 'Giriş başarısız')
      } finally {
        setLoginLoading(false)
      }
    },
    [gateSecret, loadHistory]
  )

  const lockPanel = useCallback(() => {
    setUnlocked(false)
    setAdminSecret('')
    setGateSecret('')
    setHistoryItems([])
    setResult(null)
    setError(null)
    setHistoryError(null)
    setLoginError(null)
  }, [])

  const applyHistoryRow = useCallback((row) => {
    setTitle(row.title || '')
    setMessage(row.message || '')
    setTargetPath(row.target_path || '/')
    setDryRun(true)
  }, [])

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      setResult(null)
      try {
        const res = await fetch('/api/admin-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminSecret,
            title: title.trim(),
            message: message.trim(),
            targetPath: targetPath.trim() || '/',
            dryRun,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.detail || data.error || `HTTP ${res.status}`)
        }
        setResult(data)
        if (!dryRun && data.ok) {
          loadHistory(adminSecret)
        }
      } catch (err) {
        setError(err.message || 'Request failed')
      } finally {
        setLoading(false)
      }
    },
    [adminSecret, title, message, targetPath, dryRun, loadHistory]
  )

  if (!unlocked) {
    return (
      <div className="deploy-token-page" style={{ minHeight: '100vh' }}>
        <EmbedMeta title="Admin — BaseHub" description="Internal" />

        <div className="deploy-container" style={{ maxWidth: 420, margin: '0 auto', padding: '24px 16px' }}>
          <BackButton />

          <h1 style={{ fontSize: 22, margin: '16px 0 8px', color: '#e2e8f0' }}>Admin girişi</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 22 }}>
            Bildirim paneline erişmek için yönetici şifresini girin.
          </p>

          <form
            onSubmit={onGateSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: 20,
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#94a3b8' }}>
              Şifre
              <input
                type="password"
                autoComplete="current-password"
                value={gateSecret}
                onChange={(ev) => setGateSecret(ev.target.value)}
                placeholder="Admin şifresi"
                required
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#e2e8f0',
                  fontSize: 15,
                }}
              />
            </label>
            {loginError && (
              <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{loginError}</p>
            )}
            <button type="submit" className="deploy-button" disabled={loginLoading} style={{ width: '100%' }}>
              {loginLoading ? '…' : 'Giriş'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="deploy-token-page" style={{ minHeight: '100vh' }}>
      <EmbedMeta title="Admin — BaseHub" description="Internal" />

      <div className="deploy-container" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <BackButton />
          <button
            type="button"
            onClick={lockPanel}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(30, 41, 59, 0.6)',
              color: '#94a3b8',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Çıkış
          </button>
        </div>

        <h1 style={{ fontSize: 22, margin: '16px 0 8px', color: '#e2e8f0' }}>Notifications admin</h1>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          Base App bildirimleri. Anahtar ve Dashboard API yalnızca sunucuda (Vercel env).
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: 18,
            borderRadius: 14,
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            Title (max 30)
            <input
              type="text"
              maxLength={30}
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              required
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            Message (max 200)
            <textarea
              maxLength={200}
              rows={4}
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
              required
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            Target path (optional)
            <input
              type="text"
              value={targetPath}
              onChange={(ev) => setTargetPath(ev.target.value)}
              placeholder="/"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: 14,
              }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={dryRun} onChange={(ev) => setDryRun(ev.target.checked)} />
            Dry run (only counts, no send)
          </label>

          <button
            type="submit"
            className="deploy-button"
            disabled={loading}
            style={{ width: '100%', marginTop: 6 }}
          >
            {loading ? '…' : dryRun ? 'Preview counts' : 'Send notifications'}
          </button>
        </form>

        {error && (
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(127, 29, 29, 0.25)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              color: '#fecaca',
              fontSize: 12,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </pre>
        )}

        {result && (
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(22, 101, 52, 0.2)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#86efac',
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 360,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 10px', color: '#e2e8f0' }}>
            Son gönderimler (en fazla {HISTORY_LIMIT})
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Sadece gerçek gönderimler kayıtlıdır. Satıra tıklayınca formu doldurur.
          </p>
          {historyLoading && (
            <p style={{ color: '#64748b', fontSize: 13 }}>Geçmiş yükleniyor…</p>
          )}
          {historyError && !historyLoading && (
            <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{historyError}</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historyItems.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => applyHistoryRow(row)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <strong style={{ color: '#f1f5f9' }}>{row.title}</strong>
                    <span style={{ color: '#64748b', fontSize: 11, flexShrink: 0 }}>
                      {formatDate(row.created_at)}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', lineHeight: 1.4, marginBottom: 8 }}>{row.message}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    path: {row.target_path || '/'}
                    {typeof row.total_unique_wallets === 'number' ? ` · ~${row.total_unique_wallets} cüzdan` : ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {!historyLoading && historyItems.length === 0 && !historyError && (
            <p style={{ color: '#64748b', fontSize: 13 }}>Henüz kayıtlı gönderim yok — gerçek gönderim yaptığında burada görünür.</p>
          )}
        </section>
      </div>
    </div>
  )
}
