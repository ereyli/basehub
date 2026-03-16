import React, { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import BasehubAssistant from './BasehubAssistant'

/**
 * Global assistant launcher for both web and miniapp.
 *
 * - Mobile: fixed button at bottom center, opens a bottom sheet.
 * - Desktop: floating button at bottom-right, opens a panel.
 * - Uses only BasehubAssistant (which is BaseHub-only and XP-focused).
 */

const AssistantLauncher = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const toggle = () => setOpen((v) => !v)

  const commonButton = (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        cursor: 'pointer',
        color: '#e5f9ff',
        fontSize: isMobile ? 12 : 13,
        fontWeight: 600,
        padding: isMobile ? '8px 14px' : '10px 16px',
        borderRadius: 999,
        background: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 50%, #22c55e 100%)',
        boxShadow: '0 8px 25px rgba(15,23,42,0.9)',
      }}
    >
      <MessageCircle size={isMobile ? 16 : 18} />
      <span>{isMobile ? 'Asistan' : 'BaseHub Assistant'}</span>
    </button>
  )

  if (isMobile) {
    return (
      <>
        {/* Mobile floating button above bottom nav */}
        <div
          style={{
            position: 'fixed',
            bottom: 88,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 1200,
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>{commonButton}</div>
        </div>

        {/* Bottom sheet */}
        {open && (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              zIndex: 1300,
              background: 'rgba(15,23,42,0.65)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
            }}
            onClick={toggle}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxHeight: '70vh',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                background: 'rgba(15,23,42,0.98)',
                borderTop: '1px solid rgba(148,163,184,0.5)',
                padding: '12px 14px 16px',
                boxShadow: '0 -12px 30px rgba(0,0,0,0.9)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#e5e7eb',
                  }}
                >
                  BaseHub Assistant
                </span>
                <button
                  type="button"
                  onClick={toggle}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <BasehubAssistant lastUserMessage="" />
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop: bottom-right floating icon + panel
  return (
    <>
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1200,
        }}
      >
        {commonButton}
      </div>

      {open && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 80,
            width: 360,
            maxWidth: '90vw',
            zIndex: 1300,
          }}
        >
          <div
            style={{
              borderRadius: 20,
              background: 'rgba(15,23,42,0.98)',
              border: '1px solid rgba(148,163,184,0.6)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.85)',
              padding: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#e5e7eb',
                }}
              >
                BaseHub Assistant
              </span>
              <button
                type="button"
                onClick={toggle}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>
            <BasehubAssistant lastUserMessage="" />
          </div>
        </div>
      )}
    </>
  )
}

export default AssistantLauncher

