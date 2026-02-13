import React from 'react'
import { useAccount } from 'wagmi'
import { X, Rocket, Loader2, CheckCircle } from 'lucide-react'
import { useFastDeployModal } from '../contexts/FastDeployContext'
import { useFastDeploy } from '../hooks/useFastDeploy'

const STEP_LABELS = {
  1: 'ERC20 Token',
  2: 'ERC721 NFT',
  3: 'ERC1155 Multi',
}

export default function FastDeployModal() {
  const { isOpen, closeModal } = useFastDeployModal()
  const { isConnected } = useAccount()
  const { startFastDeploy, isRunning, step, error, results } = useFastDeploy()

  const handleStart = async () => {
    try {
      await startFastDeploy()
    } catch (e) {
      console.error('Fast deploy error:', e)
    }
  }

  const done = results.length >= 3 && !isRunning
  const canClose = !isRunning

  if (!isOpen) return null

  return (
    <div
      className="fast-deploy-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16,
      }}
      onClick={canClose ? (e) => e.target === e.currentTarget && closeModal() : undefined}
    >
      <div
        className="fast-deploy-modal"
        style={{
          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 16,
          border: '1px solid rgba(59, 130, 246, 0.3)',
          maxWidth: 420,
          width: '100%',
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Rocket size={20} color="#3b82f6" />
            Fast Deploy
          </h3>
          {canClose && (
            <button
              type="button"
              onClick={closeModal}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {!isConnected ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>Please connect your wallet and try again.</p>
        ) : !isRunning && !done ? (
          <>
            <p style={{ color: '#cbd5e1', marginBottom: 20, lineHeight: 1.5 }}>
              3 contracts will be deployed in sequence: <strong>ERC20</strong> → <strong>ERC721</strong> → <strong>ERC1155</strong>.
              You will approve each step in your wallet. Same XP rewards (850 XP per deploy) apply.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: '1px solid #475569',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStart}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Start
              </button>
            </div>
          </>
        ) : isRunning ? (
          <div style={{ color: '#cbd5e1', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Loader2 size={20} className="spinning" style={{ flexShrink: 0 }} />
              <span>
                {step >= 1 && step <= 3 ? (
                  <>Step {step}/3: {STEP_LABELS[step]} — Approve in your wallet...</>
                ) : (
                  'Preparing...'
                )}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'rgba(59, 130, 246, 0.2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(step / 3) * 100}%`,
                  background: '#3b82f6',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        ) : done ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 12 }}>
              <CheckCircle size={22} />
              <span style={{ fontWeight: 600 }}>3/3 deploys completed</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              +850 XP (ERC20) + 850 XP (ERC721) + 850 XP (ERC1155) earned.
            </p>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button
              type="button"
              onClick={closeModal}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
                Close
            </button>
          </>
        ) : null}

        {error && !done && (
          <p style={{ color: '#ef4444', fontSize: 14, marginTop: 12 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
