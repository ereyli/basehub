import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'
import { Gamepad2, Home, ExternalLink, Twitter } from 'lucide-react'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getCurrentConfig } from '../config/base'

const WebHeader = () => {
  const location = useLocation()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { isCorrectNetwork } = useNetworkCheck()
  const baseConfig = getCurrentConfig()
  const [isScrolled, setIsScrolled] = React.useState(false)

  // Handle scroll detection
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      setIsScrolled(scrollTop > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

            {/* Social Links */}
            <div className="social-links">
              <a 
                href="https://x.com/BaseHUBB" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link twitter"
                title="Follow us on X"
              >
                <Twitter size={16} />
                <span>X</span>
              </a>
            </div>

            {/* Network Status */}
            {isConnected && (
              <div className={`network-status ${isCorrectNetwork ? 'connected' : 'error'}`}>
                {isCorrectNetwork ? (
                  <span>✅ Base Network</span>
                ) : (
                  <span>❌ Wrong Network</span>
                )}
              </div>
            )}
            
            {/* RainbowKit Connect Button */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  )
}

export default WebHeader
