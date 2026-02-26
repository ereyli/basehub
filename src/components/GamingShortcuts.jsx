import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Coins, Dice1, Gift, RotateCcw } from 'lucide-react'

const GAMES = [
  { path: '/flip', label: 'Coinflip', icon: Coins, color: '#f59e0b' },
  { path: '/dice', label: 'Dice', icon: Dice1, color: '#10b981' },
  { path: '/slot', label: 'Slots', icon: Gift, color: '#dc2626' },
  { path: '/lucky', label: 'Lucky', icon: RotateCcw, color: '#3b82f6' },
]

export default function GamingShortcuts() {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        marginBottom: '16px',
      }}
    >
      {GAMES.map(({ path, label, icon: Icon, color }) => {
        const isActive = currentPath === path
        return (
          <Link
            key={path}
            to={path}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '600',
              textDecoration: 'none',
              background: isActive ? `${color}22` : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${isActive ? `${color}44` : 'rgba(255, 255, 255, 0.06)'}`,
              color: isActive ? color : '#94a3b8',
              opacity: isActive ? 0.9 : 1,
              pointerEvents: isActive ? 'none' : 'auto',
              transition: 'all 0.2s ease',
            }}
          >
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
