import React from 'react'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { useFarcaster } from '../contexts/FarcasterContext'

const NetworkGuard = ({ children, showWarning = false }) => {
  const { isCorrectNetwork, networkName, baseNetworkName, switchToBaseNetwork } = useNetworkCheck()
  const { isInFarcaster } = useFarcaster()

  if (isCorrectNetwork) {
    return children
  }

  const handleSwitchNetwork = async () => {
    try {
      await switchToBaseNetwork()
    } catch (error) {
      console.error('Failed to switch network:', error)
      alert('Ağ geçişi başarısız oldu. Lütfen manuel olarak Base ağına geçin.')
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
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>⚠️ Yanlış Ağ Uyarısı</h3>
        <p style={{ margin: '0 0 15px 0', opacity: 0.9 }}>
          Şu anda <strong>{networkName}</strong> ağındasınız.<br/>
          BaseHub sadece <strong>{baseNetworkName}</strong> ağında çalışır.
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
            🔄 Base Ağına Geç
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
        cursor: 'not-allowed'
      }}>
        ⚠️ Yanlış Ağ - İşlem Engellendi
      </div>
    </div>
  )
}

export default NetworkGuard
