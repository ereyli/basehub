/**
 * Internal admin: Base App push notifications (Base Dashboard API).
 * Auth: ADMIN_NOTIFICATIONS_SECRET sent in body; validated only on server.
 */
import React, { useCallback, useState } from 'react'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'

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
  const [adminSecret, setAdminSecret] = useState('')
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
  const [historySearch, setHistorySearch] = useState('')

  const loadHistory = useCallback(async () => {
    if (!adminSecret.trim()) {
      setHistoryError('Önce admin secret girin.')
      return
    }
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await fetch('/api/admin-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecret,
          action: 'list',
          limit: 80,
          search: historySearch.trim() || undefined,
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
  }, [adminSecret, historySearch])

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
          loadHistory()
        }
      } catch (err) {
        setError(err.message || 'Request failed')
      } finally {
        setLoading(false)
      }
    },
    [adminSecret, title, message, targetPath, dryRun, loadHistory]
  )

  return (
    <div className="deploy-token-page" style={{ minHeight: '100vh' }}>
      <EmbedMeta title="Admin — BaseHub" description="Internal" />

      <div className="deploy-container" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        <BackButton />

        <h1 style={{ fontSize: 22, margin: '16px 0 8px', color: '#e2e8f0' }}>Notifications admin</h1>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          Base App bildirimleri. Anahtar ve Dashboard API yalnızca sunucuda (Vercel env). Bu sayfa herkese açık
          URL’dir; erişim <strong>gizli anahtar</strong> ile sınırlıdır.
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
            Admin secret
            <input
              type="password"
              autoComplete="off"
              value={adminSecret}
              onChange={(ev) => setAdminSecret(ev.target.value)}
              placeholder="Vercel: ADMIN_NOTIFICATIONS_SECRET"
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
          <h2 style={{ fontSize: 17, margin: '0 0 10px', color: '#e2e8f0' }}>Gönderim geçmişi</h2>
          <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Sadece gerçek gönderimler Supabase’e yazılır. Satıra tıklayınca formu doldurur (yeniden göndermek için dry run
            kapatabilirsin).
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            <input
              type="search"
              value={historySearch}
              onChange={(ev) => setHistorySearch(ev.target.value)}
              placeholder="Başlık veya mesajda ara…"
              style={{
                flex: '1 1 200px',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: 14,
              }}
            />
            <button
              type="button"
              className="deploy-button"
              disabled={historyLoading}
              onClick={() => loadHistory()}
              style={{ padding: '10px 18px' }}
            >
              {historyLoading ? '…' : 'Geçmişi yükle'}
            </button>
          </div>
          {historyError && (
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
            <p style={{ color: '#64748b', fontSize: 13 }}>Liste boş — “Geçmişi yükle” ile çek veya önce bir bildirim gönder.</p>
          )}
        </section>
      </div>
    </div>
  )
}
