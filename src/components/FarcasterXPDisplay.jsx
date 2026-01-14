import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Zap, Wallet, Home, LogOut, Wifi, RefreshCw, Repeat, Users } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getXP } from '../utils/xpUtils'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { useProofOfUsage } from '../hooks/useProofOfUsage'
import UserProfile from './UserProfile'

const FarcasterXPDisplay = () => {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isInFarcaster } = useFarcaster()
  const { isCorrectNetwork, switchToBaseNetwork } = useNetworkCheck()
  const { last24hTxCount, totalUsers, loading: proofLoading } = useProofOfUsage()
  const navigate = useNavigate()
  const location = useLocation()
  const [totalXP, setTotalXP] = useState(0)
  const [isSwitching, setIsSwitching] = useState(false)
  
  // Auto-switch to Base network when wallet connects
  useEffect(() => {
    if (isConnected && !isCorrectNetwork) {
      console.log('🔄 Wallet connected but not on Base network, attempting switch...')
      switchToBaseNetwork().catch(error => {
        // Don't log errors for user-rejected requests (normal in Farcaster)
        if (error.message?.includes('not been authorized') || error.code === 4001) {
          console.log('ℹ️ Network switch request was rejected (this is normal in Farcaster)')
        } else {
          console.error('Failed to auto-switch to Base:', error)
        }
      })
    }
  }, [isConnected, isCorrectNetwork, switchToBaseNetwork])
  
  // Check if we're on home page
  const isHomePage = location.pathname === '/'

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

  const handleConnect = (connector) => {
    connect({ connector })
  }

  const handleDisconnect = () => {
    disconnect()
  }


  const handleHomeClick = () => {
    navigate('/')
  }

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

  // If not connected, show header connect version
  if (!isConnected || !address) {
    return (
      <div className="farcaster-header-bar not-connected">
        <div className="header-left">
          {!isHomePage && (
            <button className="home-button" onClick={handleHomeClick} title="Ana Sayfa">
              <Home size={16} />
            </button>
          )}
          <div className="not-connected-text">
            <Wallet size={16} />
            <span>Not Connected</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="wallet-dropdown">
            <button className="header-connect-button">
              <span>Connect Wallet</span>
            </button>
            <div className="wallet-options">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  className="wallet-option"
                  onClick={() => handleConnect(connector)}
                >
                  <Wallet size={16} />
                  <span>{connector.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* User Profile Button */}
          <UserProfile />
        </div>
      </div>
    )
  }

  return (
    <div className="farcaster-header-bar">
      <div className="header-left">
        {!isHomePage && (
          <button className="home-button" onClick={handleHomeClick} title="Ana Sayfa">
            <Home size={16} />
          </button>
        )}
        <button className="disconnect-button" onClick={handleDisconnect} title="Disconnect Wallet">
          <LogOut size={16} />
        </button>
        <div className="player-info">
          <span className="wallet-address">{address.slice(0, 4)}..{address.slice(-2)}</span>
        </div>
      </div>
      
      <div className="header-right">
        {/* Proof of Usage */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          marginRight: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: '#e5e7eb'
          }}>
            <Repeat size={12} style={{ color: '#3b82f6' }} />
            <span style={{ fontWeight: '500', color: '#9ca3af', fontSize: '10px' }}>24h tx:</span>
            <span style={{ fontWeight: '700', color: '#e5e7eb' }}>
              {proofLoading ? '...' : last24hTxCount.toLocaleString()}
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: '#e5e7eb'
          }}>
            <Users size={12} style={{ color: '#3b82f6' }} />
            <span style={{ fontWeight: '500', color: '#9ca3af', fontSize: '10px' }}>users:</span>
            <span style={{ fontWeight: '700', color: '#e5e7eb' }}>
              {proofLoading ? '...' : totalUsers.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Switch Network Button - only show when not on Base */}
        {isConnected && !isInFarcaster && !isCorrectNetwork && (
          <button 
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            className="switch-network-btn-mini"
          >
            {isSwitching ? (
              <>
                <RefreshCw size={12} className="spinning" />
                <span>Switching...</span>
              </>
            ) : (
              <>
                <Wifi size={12} />
                <span>Switch to Base</span>
              </>
            )}
          </button>
        )}

        <div className="stat-mini xp">
          <Zap size={14} />
          <span>{totalXP}</span>
        </div>
        
        {/* User Profile Button - replaces hamburger menu */}
        <UserProfile />
      </div>
      
      {/* Side Menu */}
      {isMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '0',
          right: '0',
          width: '280px',
          height: '100vh',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(0, 0, 0, 0.1)',
          zIndex: 9998,
          padding: '80px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)'
        }}>
          <button
            onClick={() => scrollToSection('daily-quests')}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              📋
            </div>
            Daily Quests
          </button>
          
          <button
            onClick={() => scrollToSection('leaderboard')}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🏆
            </div>
            Leaderboard
          </button>
        </div>
      )}
      
      {/* Overlay for menu */}
      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 9997
          }}
        />
      )}
    </div>
  )
}

export default FarcasterXPDisplay