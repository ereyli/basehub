import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Wallet, Home, Wifi, WifiOff, Gamepad2, Zap, Shield } from 'lucide-react'
import { useWallet } from '../hooks/useWallet'
import { useFarcaster } from '../contexts/FarcasterContext'
import { getCurrentConfig } from '../config/base'

const Header = () => {
  const location = useLocation()
  const { isConnected, address, connectWallet, disconnectWallet, chainId, switchToBaseNetwork } = useWallet()
  const { isInFarcaster, user } = useFarcaster()
  const baseConfig = getCurrentConfig()
  const [isScrolled, setIsScrolled] = useState(false)

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
              <span className="logo-subtitle">Gaming Platform</span>
            </div>
          </Link>
          
          {/* Navigation & Status */}
          <div className="header-right">
            {location.pathname !== '/' && (
              <Link to="/" className="nav-button">
                <Home size={16} />
                <span>Home</span>
              </Link>
            )}

            {/* Status Indicators */}
            <div className="status-indicators">
              {/* Farcaster Status */}
              {isInFarcaster && (
                <div className="status-badge farcaster">
                  <Zap size={14} />
                  <span>Farcaster</span>
                </div>
              )}

              {/* Network Status */}
              {isConnected && !isInFarcaster && (
                <div className={`status-badge ${isOnBaseNetwork ? 'connected' : 'error'}`}>
                  {isOnBaseNetwork ? (
                    <Wifi size={14} />
                  ) : (
                    <WifiOff size={14} />
                  )}
                  <span>{isOnBaseNetwork ? 'Base' : 'Wrong Network'}</span>
                </div>
              )}
            </div>
            
            {/* Wallet Section */}
            {isConnected ? (
              <div className="wallet-section">
                <div className="wallet-address">
                  <Shield size={14} />
                  <span>{formatAddress(address)}</span>
                </div>
                {!isInFarcaster && !isOnBaseNetwork && (
                  <button 
                    onClick={switchToBaseNetwork}
                    className="action-button secondary"
                  >
                    Switch to Base
                  </button>
                )}
                <button 
                  onClick={disconnectWallet}
                  className="action-button danger"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                className="action-button primary"
              >
                <Wallet size={16} />
                <span>Connect Wallet</span>
              </button>
            )}
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
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
  }

  .logo-section:hover .logo-icon {
    transform: scale(1.05) rotate(5deg);
    box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .logo-title {
    font-size: 24px;
    font-weight: 800;
    color: #1f2937;
    line-height: 1;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .logo-subtitle {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    text-decoration: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.3s ease;
    border: 1px solid rgba(102, 126, 234, 0.2);
  }

  .nav-button:hover {
    background: rgba(102, 126, 234, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
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
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }

  .action-button.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
  }

  .action-button.secondary {
    background: rgba(107, 114, 128, 0.1);
    color: #6b7280;
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

  @media (max-width: 768px) {
    .header-container {
      padding: 0 16px;
    }

    .header-content {
      height: 70px;
      gap: 16px;
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
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = headerStyles
  document.head.appendChild(styleSheet)
}
