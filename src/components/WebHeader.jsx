import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'
import { Users, Zap, Sun, Moon, Loader2, Activity, Smartphone, Gamepad2 } from 'lucide-react'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { isTestnetChainId } from '../config/networks'
import { useFastDeployModal } from '../contexts/FastDeployContext'
import { getCurrentConfig } from '../config/base'
import { useProofOfUsage } from '../hooks/useProofOfUsage'
import { useTotalTxCount } from '../hooks/useTotalTxCount'
import { getXP, getNFTCount } from '../utils/xpUtils'
import { useSupabase } from '../hooks/useSupabase'
import { useTransactions } from '../hooks/useTransactions'
import UserProfile from './UserProfile'
import { useOpenInApp } from '../contexts/OpenInAppContext'

const WebHeader = () => {
  const { openModal: openOpenInAppModal } = useOpenInApp()
  const location = useLocation()
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { isCorrectNetwork } = useNetworkCheck()
  const { openModal: openFastDeployModal } = useFastDeployModal()
  const baseConfig = getCurrentConfig()
  const { totalUsers, loading: proofLoading } = useProofOfUsage()
  const { totalTx, loading: txLoading, justIncremented } = useTotalTxCount()
  const { supabase } = useSupabase()
  const { sendGMTransaction, sendGNTransaction } = useTransactions()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [homeScrollTo, setHomeScrollTo] = React.useState(null)
  React.useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && location.pathname !== '/') {
      setHomeScrollTo(sessionStorage.getItem('homeScrollSection'))
    } else {
      setHomeScrollTo(null)
    }
  }, [location.pathname])
  const homeState = homeScrollTo ? { state: { scrollTo: homeScrollTo } } : {}
  const [totalXP, setTotalXP] = React.useState(0)
  const [nftCount, setNftCount] = React.useState(0)
  const [multiplier, setMultiplier] = React.useState(1)
  const [isLoadingGM, setIsLoadingGM] = React.useState(false)
  const [isLoadingGN, setIsLoadingGN] = React.useState(false)
  const [quickActionMessage, setQuickActionMessage] = React.useState('')

  // Quick Action handlers
  const handleQuickGM = async () => {
    if (!isConnected) return
    setIsLoadingGM(true)
    try {
      await sendGMTransaction('GM from BaseHub! 🎮')
      setQuickActionMessage(isTestnetChainId(chainId) ? 'GM sent!' : 'GM sent! +150 XP')
      setTimeout(() => setQuickActionMessage(''), 2000)
    } catch (error) {
      console.error('GM failed:', error)
    } finally {
      setIsLoadingGM(false)
    }
  }

  const handleQuickGN = async () => {
    if (!isConnected) return
    setIsLoadingGN(true)
    try {
      await sendGNTransaction('GN from BaseHub! 🌙')
      setQuickActionMessage(isTestnetChainId(chainId) ? 'GN sent!' : 'GN sent! +150 XP')
      setTimeout(() => setQuickActionMessage(''), 2000)
    } catch (error) {
      console.error('GN failed:', error)
    } finally {
      setIsLoadingGN(false)
    }
  }

  // Handle scroll detection
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      setIsScrolled(scrollTop > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Load NFT count only once when component mounts or address changes
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

  // Load XP from Supabase and refresh every 3 seconds
  React.useEffect(() => {
    const loadXP = async () => {
      if (isConnected && address && supabase) {
        try {
          // Try to get XP directly from Supabase (same as Profile page)
          // All wallet addresses are now normalized to lowercase in Supabase
          const walletAddressLower = address.toLowerCase()
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('total_xp')
            .eq('wallet_address', walletAddressLower)
            .single()

          if (!playerError && player && player.total_xp !== undefined && player.total_xp !== null) {
            console.log('📊 Header: Using total_xp from Supabase:', player.total_xp)
            setTotalXP(player.total_xp)
          } else {
            // Fallback to getXP function
            console.log('⚠️ Header: Player not found in Supabase, using getXP fallback')
            const xp = await getXP(address)
            setTotalXP(xp)
          }
        } catch (error) {
          console.error('❌ Error loading XP in header:', error)
          // Fallback to getXP
          try {
            const xp = await getXP(address)
            setTotalXP(xp)
          } catch (fallbackError) {
            console.error('❌ Error in getXP fallback:', fallbackError)
            setTotalXP(0)
          }
        }
      } else {
        setTotalXP(0)
      }
    }

    loadXP()
    const interval = setInterval(loadXP, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [isConnected, address, supabase])


  const quickActions = [
    { id: 'gm', label: 'GM', icon: Sun, color: '#10b981', onClick: handleQuickGM, loading: isLoadingGM },
    { id: 'gn', label: 'GN', icon: Moon, color: '#3b82f6', onClick: handleQuickGN, loading: isLoadingGN },
    { id: 'fast-deploy', label: 'Fast Deploy', icon: Zap, color: '#ec4899', onClick: openFastDeployModal },
    { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: '#f59e0b', path: '/', hash: 'gaming' },
  ]

  const renderAction = (action) => {
    const IconComponent = action.icon
    if (action.path) {
      const href = action.hash ? `${action.path}#${action.hash}` : action.path
      return (
        <a key={action.id} href={href} className="quick-action-btn" style={{ '--action-color': action.color }}>
          <IconComponent size={16} />
          <span>{action.label}</span>
        </a>
      )
    }
    return (
      <button
        key={action.id}
        onClick={action.onClick}
        disabled={!isConnected || action.loading}
        className="quick-action-btn"
        style={{ '--action-color': action.color }}
      >
        {action.loading ? <Loader2 size={16} className="spinning" /> : <IconComponent size={16} />}
        <span>{action.label}</span>
      </button>
    )
  }

  return (
    <header className={`web-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <div className="header-content">
          <Link to="/" className="logo-section" {...homeState}>
            <div className="header-logo-wrap">
              <img src="/icon.png" alt="BaseHub" className="header-logo-img" />
            </div>
          </Link>

          {/* Quick Actions: GM, GN, Fast Deploy, Gaming */}
          <div className="quick-actions-bar">
            {quickActions.map(renderAction)}
            {quickActionMessage && (
              <div className="quick-action-message">
                {quickActionMessage}
              </div>
            )}
          </div>
          
          {/* Navigation & Status */}
          <div className="header-right">
            {/* XP Display */}
            {isConnected && address && (
              <div className="header-xp-display" title={multiplier > 1 ? `${multiplier}x multiplier (${nftCount} NFT${nftCount > 1 ? 's' : ''})` : ''}>
                <Zap size={16} style={{ color: '#ffc107' }} />
                <span className="header-xp-value">{totalXP.toLocaleString()}</span>
                <span className="header-xp-label">XP</span>
                {multiplier > 1 && (
                  <span className="header-xp-multiplier" style={{
                    marginLeft: '6px',
                    padding: '2px 6px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#fff'
                  }}>
                    {multiplier}x
                  </span>
                )}
              </div>
            )}

            {/* TX Counter - Platform total transactions */}
            <div className="header-tx-display" title="Total platform transactions">
              <Activity size={16} />
              <span className={`header-tx-value ${justIncremented ? 'tx-pulse' : ''}`}>
                {txLoading ? '...' : totalTx.toLocaleString()}
              </span>
              <span className="header-tx-label">TX</span>
            </div>

            {/* Proof of Usage */}
            <div className="proof-of-usage">
              <div className="proof-metric">
                <Users size={14} />
                <span className="proof-label">Users:</span>
                <span className="proof-value">{proofLoading ? '...' : totalUsers.toLocaleString()}</span>
              </div>
            </div>

            {/* Open in Base App / Farcaster - QR modal */}
            <button
              type="button"
              onClick={openOpenInAppModal}
              className="nav-button"
              title="Open BaseHub in Base App or Farcaster"
            >
              <Smartphone size={16} />
              <span>Open in app</span>
            </button>

            {/* User Profile */}
            {isConnected && <UserProfile />}
            
            {/* RainbowKit Connect Button - own row on mobile */}
            <div className="header-wallet-wrap">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default WebHeader
