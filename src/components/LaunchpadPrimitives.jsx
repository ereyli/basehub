import { BadgeCheck, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'

const accentValue = (accent, alpha) => {
  if (accent.startsWith('#') && accent.length === 7) {
    const r = Number.parseInt(accent.slice(1, 3), 16)
    const g = Number.parseInt(accent.slice(3, 5), 16)
    const b = Number.parseInt(accent.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return accent
}

export function LaunchpadStatStrip({ items, accent = '#3b82f6', compact = false }) {
  return (
    <>
      <section
        className="launchpad-stat-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          border: `1px solid ${accentValue(accent, 0.2)}`,
          background: 'linear-gradient(180deg, rgba(15, 26, 45, 0.96), rgba(8, 18, 33, 0.96))',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{
              minWidth: 0,
              minHeight: compact ? 62 : 72,
              padding: compact ? '11px 13px' : '13px 16px',
              borderLeft: index > 0 ? '1px solid rgba(148, 163, 184, 0.14)' : 0,
              display: 'grid',
              alignContent: 'center',
              gap: 5,
            }}
          >
            <span style={{ color: '#8494ae', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>
              {item.label}
            </span>
            <strong style={{ color: item.tone || '#f8fafc', fontSize: compact ? 17 : 20, lineHeight: 1.1 }}>
              {item.value}
            </strong>
            {item.detail && <small style={{ color: '#64748b', fontSize: 10 }}>{item.detail}</small>}
          </div>
        ))}
      </section>
      <style>{`@media (max-width: 600px) { .launchpad-stat-strip { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .launchpad-stat-strip > div:nth-child(3) { border-left: 0 !important; } .launchpad-stat-strip > div:nth-child(n+3) { border-top: 1px solid rgba(148, 163, 184, 0.14); } }`}</style>
    </>
  )
}

export function LaunchpadTrustStrip({ items, accent = '#22c55e' }) {
  const icons = [BadgeCheck, LockKeyhole, ShieldCheck, Sparkles]
  return (
    <>
      <div
        className="launchpad-trust-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
          borderTop: '1px solid rgba(148, 163, 184, 0.12)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          background: 'rgba(6, 14, 27, 0.6)',
        }}
      >
        {items.map((item, index) => {
          const Icon = item.icon || icons[index % icons.length]
          return (
            <div
              key={item.label || item}
              title={item.detail || item.label || item}
              style={{
                minWidth: 'max-content',
                padding: '10px 14px',
                borderLeft: index > 0 ? '1px solid rgba(148, 163, 184, 0.12)' : 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                color: '#aebbd0',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <Icon size={14} color={accent} />
              {item.label || item}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes launchpadArrival { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .launchpad-token-card { animation: launchpadArrival 360ms ease-out both; transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; } .launchpad-token-card:hover { transform: translateY(-2px); } .launchpad-featured-card { box-shadow: 0 12px 30px rgba(34, 197, 94, 0.08); } @media (prefers-reduced-motion: reduce) { .launchpad-token-card { animation: none; transition: none; } }`}</style>
    </>
  )
}

export function LaunchpadProgress({ value, accent = '#3b82f6', graduated = false, label = 'Bonding progress' }) {
  const progress = Math.max(0, Math.min(Number(value || 0), 100))
  const color = graduated ? '#22c55e' : accent
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#8494ae', fontSize: 10, fontWeight: 700 }}>
        <span>{label}</span>
        <strong style={{ color }}>{graduated ? 'Graduated' : `${progress.toFixed(1)}%`}</strong>
      </div>
      <div style={{ height: 5, background: '#071225', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: graduated ? '#22c55e' : `linear-gradient(90deg, ${accent}, ${color})`,
            borderRadius: 4,
            transition: 'width 500ms ease',
            boxShadow: progress > 0 ? `0 0 14px ${accentValue(color, 0.35)}` : 'none',
          }}
        />
      </div>
    </div>
  )
}

export function TokenGridSkeleton({ count = 6, accent = '#3b82f6' }) {
  return (
    <div className="launchpad-skeleton-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          style={{
            minHeight: 168,
            padding: 16,
            border: `1px solid ${accentValue(accent, 0.16)}`,
            borderRadius: 8,
            background: 'linear-gradient(110deg, #0b1527 25%, #101e34 38%, #0b1527 52%)',
            backgroundSize: '240% 100%',
            animation: 'launchpadShimmer 1.35s linear infinite',
          }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 8, background: 'rgba(148, 163, 184, 0.12)', marginBottom: 18 }} />
          <div style={{ width: '52%', height: 12, borderRadius: 4, background: 'rgba(148, 163, 184, 0.12)', marginBottom: 9 }} />
          <div style={{ width: '32%', height: 9, borderRadius: 4, background: 'rgba(148, 163, 184, 0.08)', marginBottom: 22 }} />
          <div style={{ width: '100%', height: 5, borderRadius: 4, background: 'rgba(148, 163, 184, 0.1)' }} />
        </div>
      ))}
      <style>{`@keyframes launchpadShimmer { to { background-position-x: -240%; } }`}</style>
    </div>
  )
}
