import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'
import { Gamepad2, Home, Users, Zap } from 'lucide-react'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getCurrentConfig } from '../config/base'
import { useProofOfUsage } from '../hooks/useProofOfUsage'
import { getXP } from '../utils/xpUtils'
import UserProfile from './UserProfile'

const WebHeader = () => {
  const location = useLocation()
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { isCorrectNetwork } = useNetworkCheck()
  const baseConfig = getCurrentConfig()
  const { totalUsers, loading: proofLoading } = useProofOfUsage()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [totalXP, setTotalXP] = React.useState(0)

  // Handle scroll detection
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      setIsScrolled(scrollTop > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Load XP from Supabase and refresh every 3 seconds
  React.useEffect(() => {
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


  return (
    <header className={`web-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <div className="header-content">
          {/* Logo Section */}
          <Link to="/" className="logo-section">
            <div className="logo-icon">
              <Gamepad2 size={24} />
            </div>
            <div className="logo-text">
              <span className="logo-title">BaseHub</span>
              <span className="logo-subtitle">Gamified smart contracts</span>
            </div>
          </Link>
          
          {/* Navigation & Status */}
          <div className="header-right">
            {/* XP Display */}
            {isConnected && address && (
              <div className="header-xp-display">
                <Zap size={16} style={{ color: '#ffc107' }} />
                <span className="header-xp-value">{totalXP.toLocaleString()}</span>
                <span className="header-xp-label">XP</span>
              </div>
            )}

            {/* Proof of Usage */}
            <div className="proof-of-usage">
              <div className="proof-metric">
                <Users size={14} />
                <span className="proof-label">Total Users:</span>
                <span className="proof-value">{proofLoading ? '...' : totalUsers.toLocaleString()}</span>
              </div>
            </div>

            {location.pathname !== '/' && (
              <Link to="/" className="nav-button">
                <Home size={16} />
                <span>Home</span>
              </Link>
            )}

            {/* User Profile */}
            {isConnected && <UserProfile />}
            
            {/* RainbowKit Connect Button */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  )
}

export default WebHeader
