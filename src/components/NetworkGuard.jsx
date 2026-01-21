import React from 'react'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { NETWORKS } from '../config/networks'

const NetworkGuard = ({ children, showWarning = false }) => {
  const { isCorrectNetwork, currentNetworkConfig, switchToNetwork } = useNetworkCheck()
  
  // Safely get Farcaster context - only if not in web environment
  let isInFarcaster = false
  if (!shouldUseRainbowKit()) {
    try {
      const { useFarcaster } = require('../contexts/FarcasterContext')
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      // If FarcasterProvider is not available, default to false
      isInFarcaster = false
    }
  }

  if (isCorrectNetwork) {
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
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px',
        textAlign: 'center',
        margin: '20px 0',
        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>⚠️ Wrong Network</h3>
        <p style={{ margin: '0 0 15px 0', opacity: 0.9 }}>
          You are currently on <strong>{currentNetworkConfig?.chainName || 'Unknown'}</strong> network.<br/>
          BaseHub works on <strong>Base</strong> or <strong>InkChain</strong> networks.
        </p>
        {!isInFarcaster && (
          <button 
            onClick={handleSwitchNetwork}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)'
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)'
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)'
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }}
          >
            🔄 Switch to Base
          </button>
        )}
      </div>
    )
  }

  // If not showing warning, block content completely
  return (
    <div style={{
      position: 'relative',
      filter: 'blur(3px)',
      pointerEvents: 'none',
      opacity: 0.5
    }}>
      {children}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(239, 68, 68, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#dc2626',
        fontWeight: 'bold',
        fontSize: '18px',
        pointerEvents: 'all',
        cursor: 'not-allowed',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🚫</div>
          <div>Wrong Network - Action Blocked</div>
          <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.8 }}>
            Please switch to Base or InkChain network
          </div>
        </div>
      </div>
    </div>
  )
}

export default NetworkGuard
