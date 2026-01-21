import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { Wallet, Home, Wifi, WifiOff, Gamepad2, Zap, Shield, ExternalLink, Twitter, RefreshCw, Repeat, Users } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getCurrentConfig } from '../config/base'
import { useProofOfUsage } from '../hooks/useProofOfUsage'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import WalletConnect from './WalletConnect'
import UserProfile from './UserProfile'

const Header = () => {
  const location = useLocation()
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { isInFarcaster, user } = useFarcaster()
  const { isCorrectNetwork, isChecking, switchToBaseNetwork } = useNetworkCheck()
  const baseConfig = getCurrentConfig()
  const { last24hTxCount, activeUsers, totalUsers, loading: proofLoading } = useProofOfUsage()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      setIsScrolled(scrollTop > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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

  const isOnBaseNetwork = chainId === baseConfig.chainId

  return (
    <header className={`modern-header ${isScrolled ? 'hidden' : ''}`}>
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
            {/* Proof of Usage */}
            <div className="proof-of-usage">
              <div className="proof-metric">
                <Repeat size={14} />
                <span className="proof-label">24h tx:</span>
                <span className="proof-value">{proofLoading ? '...' : last24hTxCount.toLocaleString()}</span>
              </div>
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

            {/* Social Links */}
            <div className="social-links">
              <a 
                href="https://x.com/Basehub__fun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link twitter"
                title="Follow us on X"
              >
                <Twitter size={16} />
                <span>X</span>
              </a>
              {/* Only show website link in Farcaster */}
              {isInFarcaster && (
                <a 
                  href="https://basehub.fun" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link website"
                  title="Visit our website"
                >
                  <ExternalLink size={16} />
                  <span>Website</span>
                </a>
              )}
            </div>

            {/* Status Indicators */}
            <div className="status-indicators">
              {/* Farcaster Status */}
              {isInFarcaster && (
                <div className="status-badge farcaster">
                  <Zap size={14} />
                  <span>Farcaster</span>
                </div>
              )}

              {/* Network Status - show when not on supported network (fallback) */}
              {isConnected && !isInFarcaster && !isCorrectNetwork && !shouldUseRainbowKit() && (
                <div className={`status-badge error`}>
                  <WifiOff size={14} />
                  <span>Wrong Network</span>
                </div>
              )}
            </div>
            
            {/* User Profile */}
            {isConnected && <UserProfile />}
            
            {/* Wallet Section */}
            <WalletConnect />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

// Modern Header Styles
const headerStyles = `
  .modern-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    transform: translateY(0);
  }

  .modern-header.hidden {
    transform: translateY(-100%);
    opacity: 0;
  }

  .header-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 80px;
    gap: 24px;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    transition: all 0.3s ease;
  }

  .logo-section:hover {
    transform: translateY(-2px);
  }

  .logo-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
    transition: all 0.3s ease;
  }

  .logo-section:hover .logo-icon {
    transform: scale(1.05) rotate(5deg);
    box-shadow: 0 12px 24px rgba(59, 130, 246, 0.4);
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .logo-title {
    font-size: 24px;
    font-weight: 800;
    color: #e5e7eb;
    line-height: 1;
    background: linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .logo-subtitle {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .social-links {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .social-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.3s ease;
    border: 1px solid transparent;
  }

  .social-link.twitter {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-color: rgba(0, 0, 0, 0.2);
  }

  .social-link.twitter:hover {
    background: rgba(0, 0, 0, 1);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }

  .social-link.website {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.2);
  }

  .social-link.website:hover {
    background: rgba(59, 130, 246, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.2);
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    text-decoration: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.3s ease;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .nav-button:hover {
    background: rgba(59, 130, 246, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.2);
  }

  .proof-of-usage {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: rgba(59, 130, 246, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }

  .proof-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .proof-divider {
    width: 1px;
    height: 24px;
    background: rgba(59, 130, 246, 0.2);
  }

  .proof-metric {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #e5e7eb;
  }

  .proof-metric svg {
    color: #3b82f6;
  }

  .proof-label {
    font-weight: 500;
    color: #9ca3af;
  }

  .proof-value {
    font-weight: 700;
    color: #e5e7eb;
    font-variant-numeric: tabular-nums;
  }

  .status-indicators {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .status-badge.farcaster {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .status-badge.connected {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .status-badge.error {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .wallet-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .wallet-address {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: #e5e7eb;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
  }

  .action-button.primary {
    background: linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%);
    color: white;
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
  }

  .action-button.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(59, 130, 246, 0.4);
  }

  .action-button.secondary {
    background: rgba(107, 114, 128, 0.1);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.2);
  }

  .action-button.secondary:hover {
    background: rgba(107, 114, 128, 0.2);
    transform: translateY(-2px);
  }

  .action-button.danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3);
  }

  .action-button.danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(239, 68, 68, 0.4);
  }

  .switch-network-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .switch-network-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
  }

  .switch-network-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .header-container {
      padding: 0 16px;
    }

    .header-content {
      height: 70px;
      gap: 16px;
    }

    .proof-of-usage {
      gap: 8px;
      padding: 6px 10px;
      display: flex;
      flex-shrink: 0;
    }

    .proof-metric {
      font-size: 11px;
      gap: 4px;
    }

    .proof-label {
      display: none;
    }

    .proof-value {
      font-size: 11px;
      font-weight: 700;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
    }

    .logo-title {
      font-size: 20px;
    }

    .logo-subtitle {
      font-size: 10px;
    }

    .header-right {
      gap: 12px;
    }

    .nav-button,
    .action-button {
      padding: 8px 12px;
      font-size: 13px;
    }

    .wallet-address {
      padding: 8px 12px;
      font-size: 13px;
    }

    .status-badge {
      padding: 4px 8px;
      font-size: 11px;
    }

    .social-link {
      padding: 6px 10px;
      font-size: 12px;
    }

    .social-link span {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .logo-subtitle {
      display: none;
    }

    .wallet-address span {
      display: none;
    }

    .nav-button span {
      display: none;
    }

    .action-button span {
      display: none;
    }

    .proof-of-usage {
      gap: 6px;
      padding: 4px 8px;
      display: flex;
      flex-shrink: 0;
    }

    .proof-metric {
      font-size: 10px;
      gap: 3px;
    }

    .proof-metric svg {
      width: 12px;
      height: 12px;
    }

    .proof-value {
      font-size: 10px;
      font-weight: 700;
    }
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = headerStyles
  document.head.appendChild(styleSheet)
}
