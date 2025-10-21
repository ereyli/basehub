import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Star, Coins, Zap, Trophy, Wallet, Clock, Home, LogOut, Wifi, RefreshCw, Menu, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getXP, calculateTokens } from '../utils/xpUtils'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useNetworkCheck } from '../hooks/useNetworkCheck'

const FarcasterXPDisplay = () => {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isInFarcaster } = useFarcaster()
  const { isCorrectNetwork, switchToBaseNetwork } = useNetworkCheck()
  const navigate = useNavigate()
  const location = useLocation()
  const [totalXP, setTotalXP] = useState(0)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  // Auto-switch to Base network when wallet connects
  useEffect(() => {
    if (isConnected && !isCorrectNetwork) {
      console.log('🔄 Wallet connected but not on Base network, switching...')
      switchToBaseNetwork().catch(error => {
        console.error('Failed to auto-switch to Base:', error)
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

  const tokenBalance = calculateTokens(totalXP)

  const handleConnect = (connector) => {
    connect({ connector })
  }

  const handleDisconnect = () => {
    disconnect()
  }

  // Smooth scroll to section
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setIsMenuOpen(false)
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
        
        <div className="stat-mini token exciting">
          <Coins size={14} />
          <div className="token-info">
            <span className="token-name">BHUP</span>
            <span className="token-balance">{tokenBalance}</span>
          </div>
        </div>
        
        <button className="claim-button coming-soon" disabled title="Claim feature coming soon!">
          <Clock size={14} />
          <span>Claim</span>
        </button>
        
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
            transition: 'all 0.2s ease',
            minWidth: '28px',
            minHeight: '28px',
            marginLeft: '4px'
          }}
        >
          {isMenuOpen ? <X size={16} style={{ color: 'white' }} /> : <Menu size={16} style={{ color: 'white' }} />}
        </button>
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