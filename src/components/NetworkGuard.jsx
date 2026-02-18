import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { NETWORKS } from '../config/networks'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const WRONG_NETWORK_DELAY_MS = 900

const NetworkGuard = ({ children, showWarning = false }) => {
  const { isConnected } = useAccount()
  const { isCorrectNetwork, currentNetworkConfig, currentChainId, switchToNetwork } = useNetworkCheck()
  const [showWarningAfterDelay, setShowWarningAfterDelay] = useState(false)

  const isActuallyWrongNetwork = isConnected && currentChainId != null && currentChainId !== 0 && !isCorrectNetwork

  useEffect(() => {
    if (!isActuallyWrongNetwork) {
      setShowWarningAfterDelay(false)
      return
    }
    const t = setTimeout(() => setShowWarningAfterDelay(true), WRONG_NETWORK_DELAY_MS)
    return () => clearTimeout(t)
  }, [isActuallyWrongNetwork])

  let isInFarcaster = false
  if (!shouldUseRainbowKit()) {
    try {
      const { useFarcaster } = require('../contexts/FarcasterContext')
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      isInFarcaster = false
    }
  }

  if (isCorrectNetwork) {
    return children
  }

  if (!isConnected || currentChainId == null || currentChainId === 0 || !showWarningAfterDelay) {
    return children
  }

  const handleSwitchNetwork = async () => {
    try {
      await switchToNetwork(NETWORKS.BASE.chainId)
    } catch (error) {
      console.error('Failed to switch network:', error)
      alert('Network switch failed. Please manually switch to Base or InkChain network.')
    }
  }

  if (showWarning) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(251, 191, 36, 0.35)',
        borderRadius: '14px',
        padding: '20px 24px',
        textAlign: 'center',
        margin: '20px 0',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
          <AlertTriangle size={22} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#e2e8f0' }}>Wrong network</h3>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
          You are on <strong style={{ color: '#cbd5e1' }}>{currentNetworkConfig?.chainName || 'Unknown'}</strong>.
          BaseHub works on <strong style={{ color: '#93c5fd' }}>Base</strong> or <strong style={{ color: '#93c5fd' }}>InkChain</strong>.
        </p>
        {!isInFarcaster && (
          <button
            type="button"
            onClick={handleSwitchNetwork}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              padding: '10px 18px', borderRadius: '10px', cursor: 'pointer',
              fontWeight: '600', fontSize: '14px', transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
            }}
          >
            <RefreshCw size={16} /> Switch to Base
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', filter: 'blur(3px)', pointerEvents: 'none', opacity: 0.6 }}>
      {children}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fbbf24', fontWeight: '600', fontSize: '16px',
        pointerEvents: 'all', cursor: 'not-allowed', textAlign: 'center', padding: '20px',
      }}>
        <div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Wrong network</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Switch to Base or InkChain to continue</div>
        </div>
      </div>
    </div>
  )
}

export default NetworkGuard
