import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Menu, X, Zap, Home, Users, User, Wallet, Repeat, Rocket, TrendingUp, Coins, Dice1, Award } from 'lucide-react'
import { getMobileMenuItems } from '../config/products'
import { useProofOfUsage } from '../hooks/useProofOfUsage'

const LUCIDE_ICONS = { Home, Repeat, Zap, Rocket, Coins, Dice1, TrendingUp, Award, User }
import { getXP, getNFTCount } from '../utils/xpUtils'
import { useSupabase } from '../hooks/useSupabase'

const MobileHeader = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()
  const { totalUsers, loading: proofLoading } = useProofOfUsage()
  const { supabase } = useSupabase()
  const [totalXP, setTotalXP] = React.useState(0)
  const [nftCount, setNftCount] = React.useState(0)
  const [multiplier, setMultiplier] = React.useState(1)
  const [menuOpen, setMenuOpen] = React.useState(false)

  // Close menu when route changes
  React.useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Load NFT count
  React.useEffect(() => {
    const loadNFTCount = async () => {
      if (isConnected && address) {
        try {
          const count = await getNFTCount(address)
          setNftCount(count)
          setMultiplier(count > 0 ? count + 1 : 1)
        } catch (nftError) {
          console.warn('⚠️ Error loading NFT count:', nftError)
          setNftCount(0)
          setMultiplier(1)
        }
      } else {
        setNftCount(0)
        setMultiplier(1)
      }
    }
    loadNFTCount()
  }, [isConnected, address])

  // Load XP from Supabase
  React.useEffect(() => {
    const loadXP = async () => {
      if (isConnected && address && supabase) {
        try {
          const walletAddressLower = address.toLowerCase()
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('total_xp')
            .eq('wallet_address', walletAddressLower)
            .single()

          if (!playerError && player && player.total_xp !== undefined && player.total_xp !== null) {
            setTotalXP(player.total_xp)
          } else {
            const xp = await getXP(address)
            setTotalXP(xp)
          }
        } catch (error) {
          console.error('❌ Error loading XP in header:', error)
          try {
            const xp = await getXP(address)
            setTotalXP(xp)
          } catch (fallbackError) {
            setTotalXP(0)
          }
        }
      } else {
        setTotalXP(0)
      }
    }

    loadXP()
    const interval = setInterval(loadXP, 3000)
    return () => clearInterval(interval)
  }, [isConnected, address, supabase])

  const menuItems = getMobileMenuItems()

  return (
    <>
      <header className="mobile-header">
        {/* Left: Logo + Title */}
        <Link to="/" className="mobile-header-brand">
          <img src="/icon.png" alt="BaseHub" className="mobile-header-logo" />
          <div className="mobile-header-title">
            <span className="mobile-header-name">BASEHUB</span>
            <span className="mobile-header-tagline">Gamified Smart Contracts</span>
          </div>
        </Link>

        {/* Right: XP (always visible) + Menu Button */}
        <div className="mobile-header-right">
          {/* XP Display - Always Visible */}
          {isConnected && address && (
            <div className="mobile-header-xp">
              <Zap size={14} color="#ffc107" />
              <span>{totalXP.toLocaleString()}</span>
              {multiplier > 1 && <span className="mobile-xp-mult">{multiplier}x</span>}
            </div>
          )}

          {/* Menu Toggle */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Slide-out Menu Panel */}
      <div className={`mobile-menu-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      
      <div className={`mobile-menu-panel ${menuOpen ? 'open' : ''}`}>
        {/* Panel Header */}
        <div className="mobile-menu-header">
          <img src="/icon.png" alt="BaseHub" className="mobile-menu-logo" />
          <div className="mobile-menu-brand">
            <span className="mobile-menu-name">BASEHUB</span>
            <span className="mobile-menu-tagline">Gamified Smart Contracts</span>
          </div>
          <button className="mobile-menu-close" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Wallet Connection */}
        <div className="mobile-menu-wallet">
          <Wallet size={18} />
          <span>Connect Wallet</span>
          <div className="mobile-menu-wallet-btn">
            <ConnectButton 
              accountStatus="address"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>

        {/* Stats Section */}
        <div className="mobile-menu-stats">
          <div className="mobile-menu-stat">
            <Users size={16} />
            <span className="mobile-stat-label">Users:</span>
            <span className="mobile-stat-value">{proofLoading ? '...' : totalUsers.toLocaleString()}</span>
          </div>
          {isConnected && (
            <div className="mobile-menu-stat">
              <Zap size={16} color="#ffc107" />
              <span className="mobile-stat-label">XP:</span>
              <span className="mobile-stat-value" style={{ color: '#ffc107' }}>{totalXP.toLocaleString()}</span>
              {multiplier > 1 && (
                <span className="mobile-stat-mult">{multiplier}x</span>
              )}
            </div>
          )}
        </div>

        {/* Menu Label */}
        <div className="mobile-menu-label">QUICK ACCESS</div>

        {/* Menu Items */}
        <nav className="mobile-menu-nav">
          {menuItems.map((item) => {
            const Icon = LUCIDE_ICONS[item.icon]
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                className={`mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path)
                  setMenuOpen(false)
                }}
                style={{ '--item-color': item.color }}
              >
                {Icon && <Icon size={20} style={{ color: item.color }} />}
                <span>{item.label}</span>
                {isActive && <div className="mobile-menu-active-dot" />}
              </button>
            )
          })}
        </nav>

        {/* Footer with Social Links */}
        <div className="mobile-menu-footer">
          <div className="mobile-menu-social">
            <a href="https://x.com/BaseHubb" target="_blank" rel="noopener noreferrer" className="mobile-social-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://warpcast.com/basehub" target="_blank" rel="noopener noreferrer" className="mobile-social-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </a>
            <a href="https://discord.gg/basehub" target="_blank" rel="noopener noreferrer" className="mobile-social-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          </div>
          <div className="mobile-menu-copyright">2026 BASEHUB</div>
        </div>
      </div>
    </>
  )
}

export default MobileHeader
