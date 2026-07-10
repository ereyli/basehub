import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

const TYPE_STYLES = {
  success: { color: '#22c55e', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.32)', Icon: CheckCircle },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.32)', Icon: AlertCircle },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.32)', Icon: AlertCircle },
  info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.32)', Icon: Info },
}

const TYPE_LABELS = { success: 'Success', error: 'Action failed', warning: 'Attention', info: 'Information' }
const confirmationResolvers = new Map()

export function showGlobalNotice(message, type = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('basehub:notice', {
    detail: { message: String(message || ''), type },
  }))
}

export function showGlobalConfirm({ title = 'Confirm action', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger' }) {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return new Promise((resolve) => {
    confirmationResolvers.set(id, resolve)
    window.dispatchEvent(new CustomEvent('basehub:confirm', {
      detail: { id, title, message, confirmLabel, cancelLabel, tone },
    }))
  })
}

export default function GlobalAppNotices() {
  const [notice, setNotice] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const originalAlert = window.alert
    const handleNotice = (event) => {
      const detail = event.detail || {}
      const message = String(detail.message || '').trim()
      if (!message) return
      setNotice({
        id: Date.now(),
        message,
        type: detail.type || 'info',
      })
    }
    const handleConfirm = (event) => setConfirmation(event.detail || null)

    window.alert = (message) => {
      handleNotice({ detail: { message, type: 'warning' } })
    }
    window.addEventListener('basehub:notice', handleNotice)
    window.addEventListener('basehub:confirm', handleConfirm)

    return () => {
      window.alert = originalAlert
      window.removeEventListener('basehub:notice', handleNotice)
      window.removeEventListener('basehub:confirm', handleConfirm)
    }
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5200)
    return () => clearTimeout(timer)
  }, [notice])

  const resolveConfirmation = (accepted) => {
    if (!confirmation?.id) return
    confirmationResolvers.get(confirmation.id)?.(accepted)
    confirmationResolvers.delete(confirmation.id)
    setConfirmation(null)
  }

  const typeStyle = notice ? (TYPE_STYLES[notice.type] || TYPE_STYLES.info) : TYPE_STYLES.info
  const Icon = typeStyle.Icon

  return (
    <>
    {notice && <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        left: 'auto',
        zIndex: 10000,
        maxWidth: 'min(420px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 14px',
          borderRadius: 14,
          border: `1px solid ${typeStyle.border}`,
          background: 'rgba(15,23,42,0.94)',
          color: '#e5e7eb',
          boxShadow: '0 18px 50px rgba(0,0,0,0.36)',
          backdropFilter: 'blur(14px)',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: typeStyle.bg,
            border: `1px solid ${typeStyle.border}`,
            color: typeStyle.color,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: typeStyle.color, marginBottom: 2 }}>
            {TYPE_LABELS[notice.type] || 'BaseHub'}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: '#cbd5e1' }}>
            {notice.message}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setNotice(null)}
          aria-label="Dismiss notice"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.78)',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>}
    {confirmation && (
      <div
        role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) resolveConfirmation(false) }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 11000,
          display: 'grid',
          placeItems: 'center',
          padding: 16,
          background: 'rgba(2, 6, 23, 0.72)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="basehub-confirm-title"
          aria-describedby="basehub-confirm-message"
          style={{
            width: 'min(440px, 100%)',
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.24)',
            background: '#0f172a',
            boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)' }}>
              <AlertCircle size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="basehub-confirm-title" style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>{confirmation.title}</h2>
              <p id="basehub-confirm-message" style={{ margin: '7px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.55 }}>{confirmation.message}</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={() => resolveConfirmation(false)} style={{ minHeight: 42, padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.24)', background: '#111c31', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>
              {confirmation.cancelLabel}
            </button>
            <button type="button" onClick={() => resolveConfirmation(true)} style={{ minHeight: 42, padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)', background: confirmation.tone === 'danger' ? '#b91c1c' : '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              {confirmation.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
