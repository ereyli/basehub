/**
 * Shown when Agent Mode is disabled (default). Full UI stays off until VITE_AGENT_MODE_ENABLED=true.
 */
import React from 'react'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'

export default function AgentModeSoon() {
  return (
    <div className="deploy-token-page" style={{ minHeight: '100vh', position: 'relative' }}>
      <EmbedMeta title="Agent Mode — BaseHub" description="Coming soon" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 2 }}>
        <BackButton />
      </div>

      <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', padding: '0 16px 48px' }}>
        <div
          aria-hidden
          style={{
            filter: 'blur(14px)',
            opacity: 0.55,
            transform: 'scale(0.98)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              height: 120,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
              marginBottom: 16,
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ height: 80, borderRadius: 12, background: 'rgba(96,165,250,0.15)' }} />
            <div style={{ height: 80, borderRadius: 12, background: 'rgba(96,165,250,0.1)' }} />
          </div>
          <div
            style={{
              height: 200,
              borderRadius: 16,
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(148,163,184,0.2)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 14,
            background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.82) 72%)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <span
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 3.75rem)',
              fontWeight: 800,
              letterSpacing: '0.35em',
              color: '#f1f5f9',
              textShadow: '0 0 40px rgba(96,165,250,0.45), 0 4px 24px rgba(0,0,0,0.55)',
            }}
          >
            SOON
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: '#94a3b8',
              maxWidth: 300,
              textAlign: 'center',
              lineHeight: 1.55,
            }}
          >
            Agent Mode is still under development. Check back later for automated BaseHub actions from a dedicated wallet.
          </p>
        </div>
      </div>
    </div>
  )
}
