import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'
import { Gamepad2, Home, ExternalLink, Twitter, Menu, X } from 'lucide-react'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getCurrentConfig } from '../config/base'

const WebHeader = () => {
  const location = useLocation()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { isCorrectNetwork } = useNetworkCheck()
  const baseConfig = getCurrentConfig()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  // Handle scroll detection
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      setIsScrolled(scrollTop > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Smooth scroll to section
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setIsMenuOpen(false)
  }

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
            
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                transition: 'all 0.2s ease',
                minWidth: '36px',
                minHeight: '36px',
                marginLeft: '12px'
              }}
            >
              {isMenuOpen ? <X size={20} style={{ color: 'white' }} /> : <Menu size={20} style={{ color: 'white' }} />}
            </button>
          </div>
        </div>
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
          zIndex: 10000,
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
            zIndex: 9999
          }}
        />
      )}
    </header>
  )
}

export default WebHeader
