import React from 'react'
import { Zap } from 'lucide-react'
import { useFastDeployModal } from '../contexts/FastDeployContext'

export default function FastDeployButton({ label = 'Fast Deploy', style, className, compact }) {
  const { openModal } = useFastDeployModal()

  if (compact) {
    return (
      <button
        type="button"
        onClick={openModal}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid rgba(236, 72, 153, 0.4)',
          background: 'rgba(236, 72, 153, 0.15)',
          color: '#f472b6',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          ...style,
        }}
      >
        <Zap size={14} />
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={openModal}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        borderRadius: 12,
        border: '1px solid rgba(236, 72, 153, 0.4)',
        background: 'rgba(236, 72, 153, 0.15)',
        color: '#f472b6',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      <Zap size={16} />
      {label}
    </button>
  )
}
