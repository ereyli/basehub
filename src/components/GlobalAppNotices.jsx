import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

const TYPE_STYLES = {
  success: { color: '#22c55e', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.32)', Icon: CheckCircle },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.32)', Icon: AlertCircle },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.32)', Icon: AlertCircle },
  info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.32)', Icon: Info },
}

export function showGlobalNotice(message, type = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('basehub:notice', {
    detail: { message: String(message || ''), type },
  }))
}

export default function GlobalAppNotices() {
  const [notice, setNotice] = useState(null)

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

    window.alert = (message) => {
      handleNotice({ detail: { message, type: 'warning' } })
    }
    window.addEventListener('basehub:notice', handleNotice)

    return () => {
      window.alert = originalAlert
      window.removeEventListener('basehub:notice', handleNotice)
    }
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5200)
    return () => clearTimeout(timer)
  }, [notice])

  if (!notice) return null

  const typeStyle = TYPE_STYLES[notice.type] || TYPE_STYLES.info
  const Icon = typeStyle.Icon

  return (
    <div
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
            BaseHub Notice
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
    </div>
  )
}
