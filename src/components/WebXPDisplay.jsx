import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Zap, RefreshCw } from 'lucide-react'
import { getXP } from '../utils/xpUtils'
import { useNetworkCheck } from '../hooks/useNetworkCheck'

const WebXPDisplay = () => {
  const { isConnected, address } = useAccount()
  const { isCorrectNetwork, switchToBaseNetwork } = useNetworkCheck()
  const [totalXP, setTotalXP] = useState(0)
  const [isSwitching, setIsSwitching] = useState(false)
  
  // Auto-switch to Base network when wallet connects
  useEffect(() => {
    if (isConnected && !isCorrectNetwork) {
      console.log('🔄 Wallet connected but not on Base network, switching...')
      switchToBaseNetwork().catch(error => {
        console.error('Failed to auto-switch to Base:', error)
      })
    }
  }, [isConnected, isCorrectNetwork, switchToBaseNetwork])
  
  // Load XP from Supabase and refresh every 3 seconds
  useEffect(() => {
    const loadXP = async () => {
      if (isConnected && address) {
        try {
          const xp = await getXP(address)
          setTotalXP(xp)
        } catch (error) {
          console.error('Error loading XP:', error)
          // Fallback to localStorage
          const xpKey = `xp_${address}`
          const savedXP = localStorage.getItem(xpKey)
          setTotalXP(savedXP ? parseInt(savedXP) : 0)
        }
      } else {
        setTotalXP(0)
      }
    }

    loadXP()
    const interval = setInterval(loadXP, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [isConnected, address])

  const handleSwitchNetwork = async () => {
    setIsSwitching(true)
    try {
      await switchToBaseNetwork()
    } catch (error) {
      console.error('Failed to switch network:', error)
    } finally {
      setIsSwitching(false)
    }
  }

  // If not connected, don't show anything
  if (!isConnected || !address) {
    return null
  }

  return (
    <div className="web-xp-display">
      <div className="xp-stats">
        {/* Switch Network Button - only show when not on Base */}
        {!isCorrectNetwork && (
          <button 
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            className="switch-network-btn"
          >
            {isSwitching ? (
              <>
                <RefreshCw size={14} className="spinning" />
                <span>Switching...</span>
              </>
            ) : (
              <>
                <span>Switch to Base</span>
              </>
            )}
          </button>
        )}

        {/* XP Display */}
        <div className="xp-stat">
          <div className="stat-icon">
            <Zap size={16} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalXP}</div>
            <div className="stat-label">XP</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WebXPDisplay
