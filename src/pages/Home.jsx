import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { useRainbowKitSwitchChain } from '../hooks/useRainbowKitSwitchChain'
import { getLeaderboard } from '../utils/xpUtils'
import { useX402Payment } from '../hooks/useX402Payment'
import { useTransactions } from '../hooks/useTransactions'
import EmbedMeta from '../components/EmbedMeta'
import TwitterShareButton from '../components/TwitterShareButton'
import DailyQuestSystem from '../components/DailyQuestSystem'
import { useFastDeployModal } from '../contexts/FastDeployContext'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { NETWORKS, getNetworkKey } from '../config/networks'
import { getProductsForHome, getProductsForHomeByNetwork, getNetworksForProductIds } from '../config/products'
import { Gamepad2, MessageSquare, Coins, Zap, Dice1, Dice6, Trophy, User, Star, Medal, Award, TrendingUp, Image, Layers, Package, Twitter, ExternalLink, Rocket, Factory, Menu, X, Search, Shield, Sun, Moon, Trash2, Users, ArrowLeftRight, Repeat, Sparkles, RotateCcw, Gift, LayoutGrid } from 'lucide-react'

const LUCIDE_ICONS = { Coins, RotateCcw, Dice1, Gift, Search, Shield, Trash2, Star, Layers, Package, Factory, Rocket, Image, Sparkles, ArrowLeftRight, Repeat, Zap, Users, LayoutGrid }

const Home = () => {
  const location = useLocation()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useRainbowKitSwitchChain()

  // Scroll to section when returning from a subpage (e.g. Home button with scrollTo state)
  useEffect(() => {
    const scrollTo = location.state?.scrollTo
    if (scrollTo && typeof document !== 'undefined') {
      const el = document.getElementById(scrollTo)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [location.state?.scrollTo])
  const { openModal: openFastDeployModal } = useFastDeployModal()
  
  // x402 Payment hook - uses x402-fetch (handles wallet UI automatically)
  const { 
    makePayment: makeX402Payment, 
    isLoading: isLoadingX402,
    error: x402Error,
    isConnected: isX402Connected 
  } = useX402Payment()
  
  // GM/GN transactions
  const { sendGMTransaction, sendGNTransaction, isLoading: isGMGNLoading } = useTransactions()
  
  // Safely get Farcaster context
  let isInFarcaster = false
  try {
    const farcasterContext = useFarcaster()
    isInFarcaster = farcasterContext?.isInFarcaster || false
  } catch (error) {
    // Not in Farcaster environment, continue normally
    isInFarcaster = false
  }
  
  // Check if we're on web (not Farcaster)
  const isWeb = shouldUseRainbowKit()
  
  // Check if mobile (for Farcaster compact + web mobile 2-column layout); reactive on resize
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Mobil (hem tarayıcı hem miniapp) aynı compact layout ve kart görünümü
  const isCompactMode = isMobile
  const isWebMobile = isWeb && isMobile
  const networksUseGrid = isWebMobile && !isMobile
  
  // Compact styles: Farcaster mobile (very compact) | Web mobile (2 columns, compact) | Desktop
  const compactStyles = {
    // Category container — clean dark surface
    categoryContainer: isCompactMode ? {
      background: 'rgba(15, 23, 42, 0.8)',
      borderRadius: '14px',
      padding: '12px',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.06)'
    } : isWebMobile ? {
      background: 'rgba(15, 23, 42, 0.8)',
      borderRadius: '16px',
      padding: '14px',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.06)'
    } : {
      background: 'rgba(15, 23, 42, 0.8)',
      borderRadius: '22px',
      padding: '32px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(255, 255, 255, 0.06)'
    },
    // Category header
    categoryHeader: isCompactMode ? {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '8px'
    } : isWebMobile ? {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '10px'
    } : {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '24px'
    },
    // Category icon box
    categoryIconBox: isCompactMode ? {
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      background: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#3b82f6',
      flexShrink: 0
    } : isWebMobile ? {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#3b82f6',
      flexShrink: 0
    } : {
      width: '44px',
      height: '44px',
      borderRadius: '10px',
      background: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#3b82f6'
    },
    // Category title
    categoryTitle: isCompactMode ? {
      fontSize: '14px',
      fontWeight: '700',
      color: '#e5e7eb',
      margin: 0,
      fontFamily: 'Poppins, sans-serif'
    } : isWebMobile ? {
      fontSize: '13px',
      fontWeight: '700',
      color: '#e5e7eb',
      margin: 0,
      fontFamily: 'Poppins, sans-serif'
    } : {
      fontSize: '28px',
      fontWeight: '700',
      color: '#e5e7eb',
      margin: 0,
      fontFamily: 'Poppins, sans-serif'
    },
    // Grid layout: web mobile = 2 columns for more info on screen
    cardGrid: isCompactMode ? {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
      gap: '6px'
    } : isWebMobile ? {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '10px'
    } : {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px'
    },
    // Card style — dark with colored tint
    card: (color) => {
      const c = color.startsWith('linear') ? '#3b82f6' : color
      const base = {
        textDecoration: 'none',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        color: 'white',
        transition: 'all 0.25s ease',
        background: `linear-gradient(145deg, ${c}20 0%, ${c}10 30%, rgba(15,23,42,0.97) 70%, rgba(15,23,42,0.98) 100%)`,
        borderLeft: `3px solid ${c}`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 ${c}15`,
        overflow: 'hidden',
      }
      if (isCompactMode) return { ...base, padding: '10px 8px', borderRadius: '12px', minHeight: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: `2px solid ${c}` }
      if (isWebMobile) return { ...base, padding: '14px 12px', borderRadius: '14px', minHeight: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }
      return { ...base, padding: '24px', borderRadius: '18px' }
    },
    // Card inner container
    cardInner: isCompactMode ? {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
    } : isWebMobile ? {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: '100%',
      minHeight: 0
    } : {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minHeight: '140px'
    },
    // Card title
    cardTitle: isCompactMode ? {
      fontSize: '10px',
      fontWeight: '600',
      margin: 0,
      color: 'white',
      lineHeight: '1.2',
      fontFamily: 'Poppins, sans-serif',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%'
    } : isWebMobile ? {
      fontSize: '12px',
      fontWeight: '600',
      margin: 0,
      color: 'white',
      lineHeight: '1.25',
      fontFamily: 'Poppins, sans-serif',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical'
    } : {
      fontSize: '20px',
      fontWeight: '600',
      margin: '0 0 8px 0',
      color: 'white',
      lineHeight: '1.2',
      fontFamily: 'Poppins, sans-serif'
    },
    // Card description (hidden in compact / web mobile to save space)
    cardDescription: isCompactMode ? {
      display: 'none'
    } : isWebMobile ? {
      display: 'none'
    } : {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '14px',
      margin: 0,
      lineHeight: '1.4',
      fontFamily: 'Poppins, sans-serif',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    // XP Badge — pill style with subtle glow
    xpBadge: isCompactMode ? {
      background: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      borderRadius: '20px',
      padding: '2px 8px',
      fontSize: '9px',
      fontWeight: '700',
      color: '#34d399',
      whiteSpace: 'nowrap',
      lineHeight: '1.3',
      fontFamily: 'Poppins, sans-serif'
    } : isWebMobile ? {
      background: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      borderRadius: '20px',
      padding: '3px 10px',
      fontSize: '10px',
      fontWeight: '700',
      color: '#34d399',
      whiteSpace: 'nowrap',
      lineHeight: '1.3',
      fontFamily: 'Poppins, sans-serif'
    } : {
      background: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      borderRadius: '20px',
      padding: '4px 12px',
      fontSize: '12px',
      fontWeight: '700',
      color: '#34d399',
      whiteSpace: 'nowrap',
      lineHeight: '1.3',
      fontFamily: 'Poppins, sans-serif'
    },
    // Main layout gap
    mainLayoutGap: isCompactMode ? {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginTop: '8px'
    } : isWebMobile ? {
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      marginTop: '16px'
    } : {
      display: 'flex',
      flexDirection: 'column',
      gap: '40px',
      marginTop: '40px'
    },
    // Icon size
    iconSize: isCompactMode ? 14 : isWebMobile ? 18 : 22
  }

  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showEarlyAccessNotification, setShowEarlyAccessNotification] = useState(false)
  const [visiblePlayersCount, setVisiblePlayersCount] = useState(5)

  // Load leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLeaderboardLoading(true)
        console.log('Loading leaderboard for home page...')
        const data = await getLeaderboard()
        console.log('Home page leaderboard data:', data)
        setLeaderboard(data)
        // Reset visible players count when leaderboard reloads
        setVisiblePlayersCount(5)
      } catch (error) {
        console.error('Error loading leaderboard:', error)
      } finally {
        setLeaderboardLoading(false)
      }
    }

    loadLeaderboard()
    // Only load once when component mounts, no auto-refresh
  }, [])

  // Show Early Access NFT notification after 5-10 seconds
  useEffect(() => {
    // Check if user has already dismissed the notification
    const hasDismissed = localStorage.getItem('earlyAccessNotificationDismissed')
    if (hasDismissed) return

    // Random delay between 5-10 seconds
    const delay = Math.random() * 5000 + 5000 // 5000-10000ms
    const timer = setTimeout(() => {
      setShowEarlyAccessNotification(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [])


  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleX402Payment = async (e) => {
    e.preventDefault()
    setSuccessMessage('')

    try {
      // Use Coinbase Wallet SDK for x402 payment
      const result = await makeX402Payment()
      // XP notification is shown via toast in xpUtils.js
      console.log('x402 Payment successful:', result)
    } catch (err) {
      // Error is already set in hook
      console.error('x402 Payment error:', err)
    }
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy size={18} style={{ color: '#fbbf24' }} />
      case 2:
        return <Medal size={18} style={{ color: '#cbd5e1' }} />
      case 3:
        return <Award size={18} style={{ color: '#f59e0b' }} />
      default:
        return <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', fontFamily: 'Poppins, sans-serif' }}>#{rank}</span>
    }
  }

  // Helper: small inline logos used in category headers (mobilde daha küçük)
  const renderNetworkLogos = (networks) => {
    if (!networks || networks.length === 0) return null
    
    const size = isCompactMode ? 14 : (isWebMobile ? 16 : 20)
    const baseStyle = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
    }

    return (
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        alignItems: 'center'
      }}>
        {networks.includes('base') && (
          <img 
            src="/base-logo.jpg" 
            alt="Base" 
            style={baseStyle} 
          />
        )}
        {networks.includes('ink') && (
          <img 
            src="/ink-logo.jpg" 
            alt="InkChain" 
            style={baseStyle} 
          />
        )}
        {networks.includes('soneium') && (
          <img 
            src="/soneium-logo.jpg" 
            alt="Soneium" 
            style={baseStyle} 
          />
        )}
        {networks.includes('megaeth') && (
          <img 
            src="/megaeth-logo.jpg" 
            alt="MegaETH" 
            style={baseStyle} 
            onError={(e) => { e.target.style.display = 'none' }}
          />
        )}
        {networks.includes('katana') && (
          <img 
            src="/katana-logo.jpg" 
            alt="Katana" 
            style={baseStyle} 
          />
        )}
        {networks.includes('arc-restnet') && (
          <img 
            src="/arc-testnet-logo.jpg" 
            alt="Arc Testnet" 
            style={{ ...baseStyle, objectFit: 'contain' }} 
          />
        )}
        {networks.includes('robinhood-testnet') && (
          <img 
            src="/robinhood-testnet-logo.png" 
            alt="Robinhood Chain Testnet" 
            style={{ ...baseStyle, objectFit: 'contain' }} 
          />
        )}
      </div>
    )
  }

  // Helper function to render multi-chain text for ANALYSIS features
  const renderMultiChainText = () => {
    return (
      <span style={{
        fontSize: '10px',
        fontWeight: '700',
        color: '#a78bfa',
        background: 'rgba(139, 92, 246, 0.10)',
        padding: '3px 10px',
        borderRadius: '20px',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        whiteSpace: 'nowrap',
        fontFamily: 'Poppins, sans-serif',
        letterSpacing: '0.3px'
      }}>
        Multi-chain
      </span>
    )
  }

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      })
    }
  }

  // Render a compact card for Farcaster mobile. sectionId: when linking from Home, pass so we can scroll back to that section.
  const renderCompactCard = (game, onClick = null, linkTo = null, sectionId = null) => {
    const titleColor = game.color?.startsWith?.('linear') ? '#3b82f6' : (game.color || '#e5e7eb')
    const iconWrapStyle = isCompactMode ? {
      flexShrink: 0,
      width: '36px', height: '36px',
      borderRadius: '10px',
      background: `${game.color}22`,
      border: `1px solid ${game.color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    } : {
      flexShrink: 0,
      width: '44px', height: '44px',
      borderRadius: '12px',
      background: `${game.color}22`,
      border: `1px solid ${game.color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }
    const cardContent = (
      <div style={compactStyles.cardInner}>
        {isCompactMode ? (
          <>
            <div style={iconWrapStyle}>
              {game.icon}
            </div>
            <h3 style={{ ...compactStyles.cardTitle, color: titleColor }}>
              {game.shortTitle || game.title.split(' ')[0]}
            </h3>
            <div style={compactStyles.xpBadge}>
              {game.xpReward}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={iconWrapStyle}>
                {game.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ ...compactStyles.cardTitle, color: titleColor }}>
                  {game.title}
                </h3>
                <p style={compactStyles.cardDescription}>
                  {game.description}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
              <div style={compactStyles.xpBadge}>
                {game.xpReward}
              </div>
              {game.bonusXP && (
                <div style={{
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#fbbf24',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.3',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  {game.bonusXP}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )

    const glowOverlay = (
      <div style={{
        position: 'absolute',
        top: '-20%', right: '-20%',
        width: '70%', height: '70%',
        background: `radial-gradient(ellipse, ${game.color}20 0%, ${game.color}0c 35%, ${game.color}04 60%, transparent 85%)`,
        pointerEvents: 'none',
        filter: 'blur(8px)'
      }} />
    )

    if (linkTo) {
      const linkState = sectionId ? { state: { fromHomeSection: sectionId } } : {}
      return (
        <Link
          key={game.id}
          to={linkTo}
          className="game-card"
          style={{ textDecoration: 'none', display: 'block' }}
          {...linkState}
        >
          <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
            {glowOverlay}
            <div style={{ position: 'relative', zIndex: 1 }}>{cardContent}</div>
          </div>
        </Link>
      )
    }

    return (
      <button
        key={game.id}
        onClick={onClick}
        className="game-card"
        style={{ 
          ...compactStyles.card(game.color),
          border: 'none',
          cursor: onClick ? 'pointer' : 'default'
        }}
      >
        {glowOverlay}
        <div style={{ position: 'relative', zIndex: 1 }}>{cardContent}</div>
      </button>
    )
  }

  // Render a category section. sectionId: optional id for scroll-into-view when returning from subpage.
  const renderCategory = (title, shortTitle, icon, iconColor, games, borderColor = 'rgba(59, 130, 246, 0.2)', networks = [], sectionId = null) => {
    const categoryIconBoxStyle = {
      ...compactStyles.categoryIconBox,
      background: `rgba(${iconColor}, 0.15)`,
      border: `1px solid rgba(${iconColor}, 0.3)`,
      color: iconColor.startsWith('#') ? iconColor : `rgb(${iconColor})`
    }

    return (
      <div id={sectionId || undefined} style={{ ...compactStyles.categoryContainer, border: `1px solid ${borderColor}` }}>
        <div style={compactStyles.categoryHeader}>
          <div style={categoryIconBoxStyle}>
            {icon}
          </div>
          <h2 style={compactStyles.categoryTitle}>
            {isCompactMode ? shortTitle : title}
          </h2>
          {!isCompactMode && networks.length > 0 && renderNetworkLogos(networks)}
        </div>
        <div style={compactStyles.cardGrid}>
          {games}
        </div>
      </div>
    )
  }

  const games = React.useMemo(() => {
    const iconStyle = { width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }
    const products = getProductsForHomeByNetwork(chainId, getNetworkKey)
    return products.map(p => {
      const icon = p.iconImage
        ? <img src={p.iconImage} alt={p.title} loading="lazy" style={iconStyle} />
        : (() => { const Icon = LUCIDE_ICONS[p.icon]; return Icon ? <Icon size={40} style={{ color: 'white' }} /> : null })()
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        icon,
        path: p.path,
        color: p.color,
        xpReward: p.xpReward,
        bonusXP: p.bonusXP ?? null,
        networks: p.networks,
        isNFTGated: p.isNFTGated ?? false,
        isX402: p.isX402 ?? false,
        isPayment: p.isPayment ?? false,
      }
    })
  }, [chainId])

  return (
    <div className="home" style={{ 
      maxWidth: '100vw', 
      overflowX: 'hidden',
      boxSizing: 'border-box',
      ...(isCompactMode ? { padding: '12px 12px 80px 12px' } : {})
    }}>
      <EmbedMeta 
        title="BaseHub - Web3 Tools & Interactions"
        description="Multi-chain Web3 platform. Deploy smart contracts, swap tokens, analyze wallets, and interact with blockchain to earn XP across multiple EVM networks. Available on Base and InkChain!"
        buttonText="Explore BaseHub"
      />
      


      <div className="welcome-section">
        <div className="card" style={isCompactMode ? { padding: '12px', marginBottom: '8px' } : {}}>
          <div style={{ textAlign: 'center', marginBottom: isCompactMode ? '12px' : '32px' }}>
            <p style={{ 
              fontSize: isCompactMode ? '11px' : '15px', 
              color: '#9ca3af',
              marginBottom: isCompactMode ? '10px' : '20px',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '400',
              maxWidth: '720px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              {isCompactMode ? 'Web3 hub for Base, InkChain & more' : 'Games, tokens and XP on Base, InkChain and more — all in one Web3 hub.'}
            </p>

            {/* Network Selector - miniapp (Farcaster + Base app): flex wrap 5+2; sadece web mobil tarayıcıda 2 sütun grid */}
            <div style={{ 
              display: networksUseGrid ? 'grid' : 'flex',
              gridTemplateColumns: networksUseGrid ? 'repeat(2, minmax(0, 1fr))' : undefined,
              justifyContent: networksUseGrid ? 'stretch' : 'center',
              gap: isCompactMode ? '6px' : networksUseGrid ? '8px' : '20px',
              marginBottom: isCompactMode ? '12px' : networksUseGrid ? '16px' : '28px',
              flexWrap: networksUseGrid ? undefined : 'wrap',
              maxWidth: networksUseGrid ? '320px' : undefined,
              marginLeft: networksUseGrid ? 'auto' : undefined,
              marginRight: networksUseGrid ? 'auto' : undefined
            }}>
              {[
                { key: 'BASE',  label: 'Base',     logo: '/base-logo.jpg',   chainId: NETWORKS.BASE.chainId },
                { key: 'INK',   label: 'InkChain', logo: '/ink-logo.jpg',    chainId: NETWORKS.INKCHAIN.chainId },
                { key: 'SONE',  label: 'Soneium',  logo: '/soneium-logo.jpg', chainId: NETWORKS.SONEIUM.chainId },
                { key: 'KAT',   label: 'Katana',   logo: '/katana-logo.jpg', chainId: NETWORKS.KATANA.chainId },
                { key: 'MEGA',  label: 'MegaETH',  logo: '/megaeth-logo.jpg', chainId: NETWORKS.MEGAETH.chainId },
                ...(NETWORKS.ARC_RESTNET ? [{ key: 'ARC', label: 'Arc Testnet', logo: '/arc-testnet-logo.jpg', chainId: NETWORKS.ARC_RESTNET.chainId }] : []),
                ...(NETWORKS.ROBINHOOD_TESTNET ? [{ key: 'RH', label: 'Robinhood Testnet', logo: '/robinhood-testnet-logo.png', chainId: NETWORKS.ROBINHOOD_TESTNET.chainId }] : []),
              ].map((net) => {
                // Miniapp: sadece Base kullanılır, geçiş yok; Base seçili görünsün, diğerlerine tıklanınca tepki verme
                const isActive = isInFarcaster
                  ? net.chainId === NETWORKS.BASE.chainId
                  : chainId === net.chainId
                const logoSize = isCompactMode ? 24 : networksUseGrid ? 28 : 40
                const showLabel = !isCompactMode
                const isMiniappNoSwitch = isInFarcaster
                return (
                  <button
                    key={net.key}
                    type="button"
                    onClick={async () => {
                      if (isMiniappNoSwitch) return
                      try {
                        await switchChain({ chainId: net.chainId })
                      } catch (err) {
                        console.error('Network switch failed:', err)
                      }
                    }}
                    style={{
                      border: 'none',
                      background: isActive 
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(37,99,235,0.35))'
                        : 'rgba(15,23,42,0.9)',
                      borderRadius: isCompactMode ? '10px' : networksUseGrid ? '12px' : '18px',
                      padding: isCompactMode ? '6px 8px' : networksUseGrid ? '8px 10px' : '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: isCompactMode ? '4px' : networksUseGrid ? '8px' : '10px',
                      cursor: isMiniappNoSwitch ? 'default' : 'pointer',
                      boxShadow: isActive 
                        ? '0 4px 12px rgba(59,130,246,0.25)'
                        : '0 2px 8px rgba(15,23,42,0.6)',
                      transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                      transition: 'all 0.2s ease',
                      minWidth: isCompactMode ? 'auto' : networksUseGrid ? 0 : '140px',
                      width: networksUseGrid ? '100%' : undefined,
                      justifyContent: isCompactMode ? 'center' : 'flex-start',
                      flex: isCompactMode ? '1' : 'none',
                      maxWidth: isCompactMode ? '80px' : undefined
                    }}
                  >
                    <div
                      style={{
                        width: logoSize,
                        height: logoSize,
                        minWidth: logoSize,
                        minHeight: logoSize,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: isActive
                          ? '2px solid rgba(248,250,252,0.9)'
                          : '1px solid rgba(148,163,184,0.4)',
                        boxShadow: '0 2px 6px rgba(15,23,42,0.6)',
                        background: '#020617',
                        flexShrink: 0
                      }}
                    >
                      <img
                        src={net.logo}
                        alt={net.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    {showLabel && (
                      <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                        <div style={{ 
                          fontSize: networksUseGrid ? '12px' : '14px', 
                          fontWeight: 600, 
                          color: '#e5e7eb',
                          fontFamily: 'Poppins, sans-serif',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {net.label}
                        </div>
                        <div style={{ 
                          fontSize: networksUseGrid ? '10px' : '11px', 
                          color: isActive ? '#a5b4fc' : '#6b7280'
                        }}>
                          {isActive ? 'Connected' : 'Switch'}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            
            {/* Twitter Share Button for Web Users - hide on Farcaster mobile */}
            {!isCompactMode && (
              <div style={{ 
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <TwitterShareButton 
                  title="BaseHub"
                  description="Your all-in-one Web3 hub on Base & InkChain. Play games, launch tokens, earn XP."
                  hashtags={["BaseHub", "Base", "InkChain", "Web3Gaming", "DEX", "XP"]}
                />
              </div>
            )}
            
            {!isConnected && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderLeft: '3px solid #fbbf24',
                borderRadius: isCompactMode ? '10px' : '14px',
                padding: isCompactMode ? '10px 12px' : '16px',
                marginBottom: isCompactMode ? '8px' : '24px'
              }}>
                <p style={{ 
                  color: '#fbbf24', 
                  margin: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: isCompactMode ? '11px' : '13px',
                  fontWeight: '600',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  <Zap size={isCompactMode ? 12 : 16} /> {isCompactMode ? 'Connect wallet to earn XP' : 'Connect your wallet to start playing and earning XP'}
                </p>
              </div>
            )}
            
            {/* Success Message */}
            {successMessage && successMessage.includes('failed') && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginTop: '16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#ef4444',
                textAlign: 'center',
                animation: 'slideInDown 0.3s ease-out'
              }}>
                {successMessage}
              </div>
            )}
            
          </div>

          {/* Categorized Layout - Both Web and Farcaster */}
          {true ? (
            <div style={compactStyles.mainLayoutGap}>
              {/* 1. Early Access NFT Category */}
              <div id="early-access" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(245, 158, 11, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Rocket size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>
                    {isCompactMode ? 'NFT PASS' : 'EARLY ACCESS NFT'}
                  </h2>
                  <span style={{
                    padding: '3px 10px',
                    background: 'rgba(59, 130, 246, 0.10)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '20px',
                    color: '#60a5fa',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    BETA
                  </span>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['early-access', 'nft-wheel']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  <Link to="/early-access" className="game-card" style={{ textDecoration: 'none', display: 'block' }} state={{ fromHomeSection: 'early-access' }}>
                    <div style={{ ...compactStyles.card('#f59e0b'), height: '100%' }}>
                      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #f59e0b20 0%, #f59e0b0c 35%, #f59e0b04 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                      <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                        {isCompactMode ? (
                          <>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#f59e0b22', border: '1px solid #f59e0b44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Rocket size={18} style={{ color: 'white' }} />
                            </div>
                            <h3 style={{ ...compactStyles.cardTitle, color: '#f59e0b' }}>Pass</h3>
                            <div style={compactStyles.xpBadge}>3000 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#f59e0b22', border: '1px solid #f59e0b44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Rocket size={22} style={{ color: 'white' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ ...compactStyles.cardTitle, color: '#f59e0b' }}>Early Access Pass</h3>
                                <p style={compactStyles.cardDescription}>Mint your BaseHub Early Access Pass and unlock exclusive benefits</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                              <div style={compactStyles.xpBadge}>3000 XP</div>
                              <div style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: '700', color: '#fbbf24' }}>0.001 ETH</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Link to="/nft-wheel" className="game-card" style={{ textDecoration: 'none', display: 'block' }} state={{ fromHomeSection: 'early-access' }}>
                    <div style={{ ...compactStyles.card('#8b5cf6'), height: '100%' }}>
                      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #8b5cf620 0%, #8b5cf60c 35%, #8b5cf604 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                      <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                        {isCompactMode ? (
                          <>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Sparkles size={18} style={{ color: 'white' }} />
                            </div>
                            <h3 style={{ ...compactStyles.cardTitle, color: '#8b5cf6' }}>Wheel</h3>
                            <div style={{ ...compactStyles.xpBadge, color: '#fbbf24' }}>2K-50K</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sparkles size={22} style={{ color: 'white' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ ...compactStyles.cardTitle, color: '#8b5cf6' }}>NFT Wheel of Fortune</h3>
                                <p style={compactStyles.cardDescription}>Spin to win 2K-50K XP daily! (NFT holders only)</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                              <div style={{ ...compactStyles.xpBadge, color: '#fbbf24' }}>2K-50K XP</div>
                              <div style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: '700', color: '#fbbf24' }}>MEGA JACKPOT</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 2. DEX Aggregator Category */}
              <div id="dex" style={compactStyles.categoryContainer}>
                <div style={compactStyles.categoryHeader}>
                  <div style={compactStyles.categoryIconBox}>
                    <Repeat size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>
                    {isCompactMode ? 'DEX' : isWebMobile ? 'DEX' : 'DEX AGGREGATOR'}
                  </h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['swap']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => g.id === 'swap').map((game) =>
                    renderCompactCard(game, null, game.path, 'dex')
                  )}
                </div>
              </div>

              {/* 3. PumpHub - Token Launchpad Category (same window style as NFT/PREDICTION) */}
              <div id="pumphub" style={{ 
                ...compactStyles.categoryContainer, 
                border: `1px solid rgba(0, 212, 255, 0.12)`
              }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0, 212, 255, 0.3)', color: '#00d4ff' }}>
                    <Rocket size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>PUMPHUB</h2>
                  {!isCompactMode && renderNetworkLogos(['base'])}
                </div>
                {!isCompactMode && (
                  <p style={{ color: '#9ca3af', fontSize: '15px', marginBottom: '24px', lineHeight: '1.6', fontFamily: 'Poppins, sans-serif' }}>
                    Launch your own token with bonding curve. Fair launch, no presale. 0.3% trade fee goes to creator.
                  </p>
                )}
                <div style={compactStyles.cardGrid}>
                  <Link to="/pumphub" className="game-card" style={{ textDecoration: 'none', display: 'block', position: 'relative' }} state={{ fromHomeSection: 'pumphub' }}>
                    <div style={{ ...compactStyles.card('#00d4ff'), height: '100%' }}>
                      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #00d4ff20 0%, #00d4ff0c 35%, #00d4ff04 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                      <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                        {isCompactMode ? (
                          <>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#00d4ff22', border: '1px solid #00d4ff44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Rocket size={18} style={{ color: 'white' }} />
                            </div>
                            <h3 style={{ ...compactStyles.cardTitle, color: '#00d4ff' }}>Launch</h3>
                            <div style={compactStyles.xpBadge}>100 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#00d4ff22', border: '1px solid #00d4ff44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Rocket size={22} style={{ color: 'white' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ ...compactStyles.cardTitle, color: '#00d4ff' }}>Token Launchpad</h3>
                                <p style={compactStyles.cardDescription}>Browse and trade launched tokens</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto' }}>
                              <div style={compactStyles.xpBadge}>100 XP</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Link to="/pumphub?tab=create" className="game-card" style={{ textDecoration: 'none', display: 'block', position: 'relative' }} state={{ fromHomeSection: 'pumphub' }}>
                    <div style={{ ...compactStyles.card('#8b5cf6'), height: '100%' }}>
                      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #8b5cf620 0%, #8b5cf60c 35%, #8b5cf604 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                      <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                        {isCompactMode ? (
                          <>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Factory size={18} style={{ color: 'white' }} />
                            </div>
                            <h3 style={{ ...compactStyles.cardTitle, color: '#8b5cf6' }}>Create</h3>
                            <div style={compactStyles.xpBadge}>2000 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Factory size={22} style={{ color: 'white' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ ...compactStyles.cardTitle, color: '#8b5cf6' }}>Create Token</h3>
                                <p style={compactStyles.cardDescription}>Launch your own token (0.001 ETH)</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto' }}>
                              <div style={compactStyles.xpBadge}>2000 XP</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
                {!isCompactMode && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(0, 212, 255, 0.06)', border: '1px solid rgba(0, 212, 255, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TrendingUp size={16} style={{ color: '#22d3ee', flexShrink: 0 }} />
                    <span style={{ color: '#64748b', fontSize: '12px', fontFamily: 'Poppins, sans-serif' }}>
                      Bonding curve • LP locked forever • 0.001 ETH to create • 5 ETH graduation to Uniswap
                    </span>
                  </div>
                )}
              </div>

              {/* NFT Category - moved up for visibility */}
              <div id="nft" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(59, 130, 246, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6' }}>
                    <Image size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>NFT</h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['nft-launchpad', 'nft-launchpad-explore']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['nft-launchpad', 'nft-launchpad-explore'].includes(g.id)).map((game) =>
                    renderCompactCard(game, null, game.path, 'nft')
                  )}
                </div>
              </div>

              {/* 5. Prediction Category (under NFT) */}
              <div id="prediction" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(20, 184, 166, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(20, 184, 166, 0.15)', border: '1px solid rgba(20, 184, 166, 0.3)', color: '#14b8a6' }}>
                    <Users size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>PREDICTION</h2>
                  <span style={{
                    padding: '3px 10px',
                    background: 'rgba(245, 158, 11, 0.10)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '20px',
                    color: '#fbbf24',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    BETA
                  </span>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['prediction-arena']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => g.id === 'prediction-arena').map((game) =>
                    renderCompactCard(game, null, game.path, 'prediction')
                  )}
                </div>
              </div>

              {/* DEPLOY Category */}
              <div id="deploy" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(59, 130, 246, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6' }}>
                    <Rocket size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>DEPLOY</h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['deploy', 'deploy-erc721', 'deploy-erc1155']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {/* Fast Deploy card - same window as others: do not override padding/background so .game-card frame shows */}
                  {shouldUseRainbowKit() && (
                    <button
                      type="button"
                      onClick={openFastDeployModal}
                      className="game-card"
                      style={{ textDecoration: 'none', display: 'block', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    >
                      <div style={{ ...compactStyles.card('#db2777'), height: '100%' }}>
                        <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #db277720 0%, #db27770c 35%, #db277704 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                        <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#db277722', border: '1px solid #db277744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Zap size={18} style={{ color: 'white' }} />
                              </div>
                              <h3 style={{ ...compactStyles.cardTitle, color: '#db2777' }}>Fast Deploy</h3>
                              <div style={compactStyles.xpBadge}>850 XP each</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#db277722', border: '1px solid #db277744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Zap size={22} style={{ color: 'white' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={{ ...compactStyles.cardTitle, color: '#db2777' }}>Fast Deploy</h3>
                                  <p style={compactStyles.cardDescription}>Deploy ERC20 + ERC721 + ERC1155 in one flow</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                <div style={compactStyles.xpBadge}>850 XP each</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  )}
                  {games.filter(g => ['deploy', 'deploy-nft', 'deploy-erc721', 'deploy-erc1155'].includes(g.id)).sort((a, b) => {
                    const order = ['deploy', 'deploy-nft', 'deploy-erc721', 'deploy-erc1155'];
                    return order.indexOf(a.id) - order.indexOf(b.id);
                  }).map((game) =>
                    renderCompactCard(game, null, game.path, 'deploy')
                  )}
                </div>
              </div>

              {/* ANALYSIS Category */}
              <div id="analysis" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(139, 92, 246, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#8b5cf6' }}>
                    <TrendingUp size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>ANALYSIS</h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['wallet-analysis', 'contract-security', 'allowance-cleaner']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['wallet-analysis', 'contract-security', 'allowance-cleaner'].includes(g.id)).map((game) =>
                    renderCompactCard(game, null, game.path, 'analysis')
                  )}
                </div>
              </div>

              {/* SOCIAL Category */}
              <div id="social" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(245, 158, 11, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Users size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>SOCIAL</h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['featured-profiles']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['featured-profiles'].includes(g.id)).map((game) =>
                    renderCompactCard(game, null, game.path, 'social')
                  )}
                </div>
              </div>

              {/* GM & GN Category */}
              <div id="gm-gn" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(34, 197, 94, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>
                    <MessageSquare size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>GM & GN</h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['flip', 'dice', 'slot', 'lucky']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isConnected) {
                        alert('Please connect your wallet first')
                        return
                      }
                      try {
                        await sendGMTransaction('GM from BaseHub! 🎮')
                      } catch (err) {
                        console.error('GM transaction failed:', err)
                      }
                    }}
                    disabled={isGMGNLoading || !isConnected}
                    className="game-card"
                    style={{
                      textDecoration: 'none',
                      display: 'block',
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      cursor: (isGMGNLoading || !isConnected) ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      opacity: (isGMGNLoading || !isConnected) ? 0.6 : 1,
                    }}
                  >
                    <div style={{ ...compactStyles.card('#f59e0b'), height: '100%' }}>
                      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #f59e0b20 0%, #f59e0b0c 35%, #f59e0b04 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                      <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                        {isCompactMode ? (
                          <>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#f59e0b22', border: '1px solid #f59e0b44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MessageSquare size={18} style={{ color: 'white' }} />
                            </div>
                            <h3 style={{ ...compactStyles.cardTitle, color: '#f59e0b' }}>GM</h3>
                            <div style={compactStyles.xpBadge}>150 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#f59e0b22', border: '1px solid #f59e0b44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MessageSquare size={22} style={{ color: 'white' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ ...compactStyles.cardTitle, color: '#f59e0b' }}>GM</h3>
                                <p style={compactStyles.cardDescription}>
                                  {isGMGNLoading ? 'Confirm in wallet...' : 'Send a GM message and earn XP'}
                                </p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                              <div style={compactStyles.xpBadge}>150 XP</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isConnected) {
                        alert('Please connect your wallet first')
                        return
                      }
                      try {
                        await sendGNTransaction('GN from BaseHub! 🌙')
                      } catch (err) {
                        console.error('GN transaction failed:', err)
                      }
                    }}
                    disabled={isGMGNLoading || !isConnected}
                    className="game-card"
                    style={{
                      textDecoration: 'none',
                      display: 'block',
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      cursor: (isGMGNLoading || !isConnected) ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      opacity: (isGMGNLoading || !isConnected) ? 0.6 : 1,
                    }}
                  >
                    <div style={{ ...compactStyles.card('#8b5cf6'), height: '100%' }}>
                      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, #8b5cf620 0%, #8b5cf60c 35%, #8b5cf604 60%, transparent 85%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                      <div style={{ ...compactStyles.cardInner, position: 'relative', zIndex: 1 }}>
                        {isCompactMode ? (
                          <>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MessageSquare size={18} style={{ color: 'white' }} />
                            </div>
                            <h3 style={{ ...compactStyles.cardTitle, color: '#8b5cf6' }}>GN</h3>
                            <div style={compactStyles.xpBadge}>150 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MessageSquare size={22} style={{ color: 'white' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ ...compactStyles.cardTitle, color: '#8b5cf6' }}>GN</h3>
                                <p style={compactStyles.cardDescription}>
                                  {isGMGNLoading ? 'Confirm in wallet...' : 'Send a GN message and earn XP'}
                                </p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                              <div style={compactStyles.xpBadge}>150 XP</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* GAMING Category - en altta */}
              <div id="gaming" style={{ ...compactStyles.categoryContainer, border: `1px solid rgba(245, 158, 11, 0.12)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Gamepad2 size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>GAMING</h2>
                  {!isCompactMode && renderNetworkLogos(getNetworksForProductIds(['flip', 'dice', 'slot', 'lucky']))}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['flip', 'dice', 'slot', 'lucky'].includes(g.id)).map((game) =>
                    renderCompactCard(game, null, game.path, 'gaming')
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Farcaster: Original Grid Layout */
          <div className="games-grid">
            {games.map((game) => {
              // For x402 premium payment, use special payment button
              if (game.id === 'x402-premium') {
                return (
                  <button
                    key={game.id}
                    onClick={handleX402Payment}
                    disabled={isLoadingX402}
                    className="game-card"
                    style={{ 
                      textDecoration: 'none',
                      border: 'none',
                      cursor: !isLoadingX402 ? 'pointer' : 'not-allowed',
                      opacity: !isLoadingX402 ? 1 : 0.6,
                      position: 'relative'
                    }}
                  >
                    <div 
                      className="game-icon"
                      style={{ background: game.color }}
                    >
                      {game.icon}
                    </div>
                    
                    {/* XP Reward Badge - 500 XP (Top Right) */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(209, 250, 229, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '20px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#059669',
                      border: '1px solid rgba(5, 150, 105, 0.2)',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      {game.xpReward}
                    </div>

                    {/* Payment Amount Badge - 0.1 USDC (Top Left) */}
                    {game.bonusXP && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(255, 215, 0, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '20px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: '#92400e',
                        border: '1px solid rgba(146, 64, 14, 0.2)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                        {game.bonusXP}
                      </div>
                    )}
                    
                    {/* x402 Protocol Badge (Top Right, below XP badge) */}
                    <div style={{
                      position: 'absolute',
                      top: '40px',
                      right: '12px',
                      background: 'rgba(102, 126, 234, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '20px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: 'white',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      x402
                    </div>

                    <h3 style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      marginBottom: '8px',
                      color: '#e5e7eb'
                    }}>
                      {game.title}
                    </h3>
                    <p style={{ 
                      color: '#6b7280',
                      fontSize: '14px',
                      lineHeight: '1.5'
                    }}>
                      {isLoadingX402 ? 'Processing payment...' : game.description}
                    </p>
                    
                    {/* Error message */}
                    {x402Error && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#dc2626',
                        textAlign: 'center'
                      }}>
                        {x402Error}
                      </div>
                    )}
                    
                    {/* Wallet connection status */}
                    {!isX402Connected && !isLoadingX402 && (
                      <p style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#6b7280',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        Connect wallet to pay
                      </p>
                    )}
                  </button>
                )
              }
              
              // For other games, use Link
              return (
                <Link 
                  key={game.id} 
                  to={game.path} 
                  className="game-card"
                  style={{ textDecoration: 'none', position: 'relative' }}
                >
                  <div style={{ position: 'absolute', top: '-40%', right: '-40%', width: '80%', height: '80%', background: `radial-gradient(ellipse, ${game.color}20 0%, ${game.color}0c 35%, ${game.color}04 60%, transparent 85%)`, filter: 'blur(8px)', pointerEvents: 'none' }} />
                  <div 
                    className="game-icon"
                    style={{ background: `${game.color}22`, border: `1px solid ${game.color}44` }}
                  >
                    {game.icon}
                  </div>
                  
                  {game.xpReward && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#34d399',
                    }}>
                      {game.xpReward}
                    </div>
                  )}

                  {game.bonusXP && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(251, 191, 36, 0.15)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#fbbf24',
                    }}>
                      {game.bonusXP}
                    </div>
                  )}

                  {game.isX402 && (
                    <div style={{
                      position: 'absolute',
                      top: game.xpReward ? '40px' : '12px',
                      right: '12px',
                      background: 'rgba(102, 126, 234, 0.15)',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#a5b4fc',
                    }}>
                      x402
                    </div>
                  )}

                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    marginBottom: '6px',
                    color: '#f1f5f9',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    {game.title}
                  </h3>
                  <p style={{ 
                    color: '#94a3b8',
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}>
                    {game.description}
                  </p>
                </Link>
              )
            })}
          </div>
          )}

        </div>
      </div>

      {/* Daily Quest System */}
      <div id="daily-quests">
        <DailyQuestSystem />
      </div>

      {/* Leaderboard Section */}
      {true && (
        <div id="leaderboard" style={{ marginTop: '32px' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '22px',
            padding: isCompactMode ? '16px' : '32px',
            border: '1px solid rgba(245, 158, 11, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '50%', background: 'radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(20px)' }} />

            <div style={{ textAlign: 'center', marginBottom: '28px', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Trophy size={28} style={{ color: '#fbbf24' }} />
              </div>
              <h2 style={{ 
                fontSize: '22px', fontWeight: '700', marginBottom: '6px',
                color: '#f1f5f9', fontFamily: 'Poppins, sans-serif'
              }}>
                Top Players
              </h2>
              <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'Poppins, sans-serif' }}>
                BaseHub XP Leaderboard
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
              {leaderboard.length > 0 ? leaderboard.slice(0, visiblePlayersCount).map((player, index) => {
                const rankColors = [
                  { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.20)', accent: '#fbbf24', label: 'rgba(245, 158, 11, 0.15)', labelBorder: 'rgba(245, 158, 11, 0.35)' },
                  { bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.18)', accent: '#cbd5e1', label: 'rgba(148, 163, 184, 0.12)', labelBorder: 'rgba(148, 163, 184, 0.30)' },
                  { bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.18)', accent: '#f59e0b', label: 'rgba(217, 119, 6, 0.12)', labelBorder: 'rgba(217, 119, 6, 0.30)' }
                ]
                const rc = index < 3 ? rankColors[index] : null
                return (
                  <div
                    key={player.wallet_address}
                    className="leaderboard-item"
                    style={{
                      background: rc ? `linear-gradient(135deg, ${rc.bg} 0%, rgba(15,23,42,0.6) 100%)` : 'rgba(30, 41, 59, 0.5)',
                      border: rc ? `1px solid ${rc.border}` : '1px solid rgba(255,255,255,0.04)',
                      borderLeft: rc ? `3px solid ${rc.accent}` : '3px solid rgba(100,116,139,0.3)',
                    }}
                  >
                    <div className="rank-icon" style={{ 
                      background: rc ? rc.label : 'rgba(51, 65, 85, 0.6)',
                      border: rc ? `1px solid ${rc.labelBorder}` : '1px solid rgba(71, 85, 105, 0.4)'
                    }}>
                      {getRankIcon(index + 1)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#e2e8f0', fontFamily: 'Poppins, sans-serif' }}>
                          {formatAddress(player.wallet_address)}
                        </span>
                        {player.hasNft && (
                          <img
                            src="/BaseHubNFT.png"
                            alt="BaseHub NFT"
                            title="Early Access Pass holder"
                            style={{
                              width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover',
                              border: '1px solid rgba(251, 191, 36, 0.4)', flexShrink: 0
                            }}
                          />
                        )}
                        {index < 3 && (
                          <span style={{
                            background: rc.label,
                            color: rc.accent,
                            border: `1px solid ${rc.labelBorder}`,
                            padding: '2px 8px', borderRadius: '20px',
                            fontSize: '9px', fontWeight: '700', flexShrink: 0,
                            letterSpacing: '0.5px', fontFamily: 'Poppins, sans-serif'
                          }}>
                            TOP {index + 1}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#64748b', fontFamily: 'Poppins, sans-serif' }}>
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: '10px', color: '#60a5fa' }}>
                          Lv.{player.level}
                        </span>
                        <span>{Number(player.total_xp).toLocaleString()} XP</span>
                      </div>
                    </div>

                    <div style={{ 
                      textAlign: 'right', display: 'flex', alignItems: 'center', gap: '5px',
                      flexShrink: 0, minWidth: '70px'
                    }}>
                      <Star size={13} style={{ color: rc ? rc.accent : '#94a3b8' }} />
                      <span style={{ 
                        fontWeight: '700', fontFamily: 'Poppins, sans-serif',
                        color: rc ? rc.accent : '#94a3b8',
                        fontSize: '14px'
                      }}>
                        {Number(player.total_xp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              }) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Trophy size={28} style={{ color: '#475569' }} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px', color: '#94a3b8', fontFamily: 'Poppins, sans-serif' }}>
                    No Players Yet
                  </h3>
                  <p style={{ fontSize: '13px', margin: 0, color: '#64748b' }}>
                    Be the first to play and earn XP!
                  </p>
                </div>
              )}
            </div>

            {leaderboard.length > visiblePlayersCount && (
              <button
                onClick={() => setVisiblePlayersCount(prev => Math.min(prev + 5, leaderboard.length))}
                style={{ 
                  width: '100%', textAlign: 'center', padding: '12px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  cursor: 'pointer', transition: 'all 0.25s ease',
                  color: '#60a5fa', fontSize: '13px', fontWeight: '600',
                  margin: 0, fontFamily: 'Poppins, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.15)'
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.08)'
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.15)'
                }}
              >
                Show {Math.min(5, leaderboard.length - visiblePlayersCount)} more players...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Social Links Section */}
      <div style={{
        marginTop: '24px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '22px',
        padding: isCompactMode ? '16px' : '28px',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ 
            fontSize: '18px', fontWeight: '700', marginBottom: '16px',
            color: '#f1f5f9', fontFamily: 'Poppins, sans-serif'
          }}>
            Connect With Us
          </h3>
          <div style={{ 
            display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap'
          }}>
            <a 
              href="https://x.com/BaseHubb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link-card twitter"
            >
              <Twitter size={24} />
              <div>
                <span className="social-title">Follow on X</span>
                <span className="social-subtitle">@BaseHubb</span>
              </div>
            </a>
            {isInFarcaster && (
            <a 
              href="https://basehub.fun" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link-card website"
            >
              <ExternalLink size={24} />
              <div>
                <span className="social-title">Visit Website</span>
                <span className="social-subtitle">basehub.fun</span>
              </div>
            </a>
            )}
          </div>
        </div>
      </div>

      {/* Early Access NFT Notification Card */}
      {showEarlyAccessNotification && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '320px',
          maxWidth: 'calc(100vw - 40px)',
          background: 'linear-gradient(145deg, rgba(245,158,11,0.15) 0%, rgba(15,23,42,0.97) 50%)',
          borderRadius: '18px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 1000,
          animation: 'slideInUp 0.3s ease-out',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          backdropFilter: 'blur(20px)'
        }}>
          <button
            onClick={() => {
              setShowEarlyAccessNotification(false)
              localStorage.setItem('earlyAccessNotificationDismissed', 'true')
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.4)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.2)'}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} style={{ color: '#fbbf24' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#f1f5f9',
                margin: '0 0 4px 0',
                lineHeight: '1.2',
                fontFamily: 'Poppins, sans-serif'
              }}>
                Early Access NFT
              </h3>
              <p style={{
                fontSize: '13px',
                color: '#94a3b8',
                margin: 0,
                lineHeight: '1.4',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: '400'
              }}>
                Mint your BaseHub Early Access Pass and unlock exclusive benefits!
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#cbd5e1'
            }}>
              <Zap size={14} style={{ color: '#fbbf24' }} />
              <span>2x XP multiplier on ALL activities</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#cbd5e1'
            }}>
              <Star size={14} style={{ color: '#fbbf24' }} />
              <span>Priority access to airdrops</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#cbd5e1'
            }}>
              <Rocket size={14} style={{ color: '#fbbf24' }} />
              <span>Exclusive quests & rewards</span>
            </div>
          </div>

          <Link
            to="/early-access"
            onClick={() => {
              setShowEarlyAccessNotification(false)
              localStorage.setItem('earlyAccessNotificationDismissed', 'true')
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              textAlign: 'center',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.2s',
              fontFamily: 'Poppins, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(245, 158, 11, 0.25)'
              e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(245, 158, 11, 0.15)'
              e.target.style.borderColor = 'rgba(245, 158, 11, 0.3)'
            }}
          >
            Mint Now →
          </Link>
        </div>
      )}

      <style>{`
        @keyframes slideInUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export default Home

// Modern CSS Styles
const styles = `
  .home {
    min-height: 100vh;
    background: transparent;
    padding: 20px;
  }

  .welcome-section {
    margin-bottom: 40px;
  }

  .card {
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    color: #e5e7eb;
  }

  .card:hover {
    transform: translateY(-5px);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  }

  .games-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-top: 32px;
  }

  .game-card {
    position: relative;
    backdrop-filter: blur(20px);
    border-radius: 18px;
    padding: 24px;
    text-align: center;
    transition: all 0.25s ease;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .game-card:hover {
    transform: translateY(-3px);
    filter: brightness(1.1);
    border-color: rgba(255,255,255,0.12);
  }


  .game-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: transform 0.25s ease;
  }

  .game-card:hover .game-icon {
    transform: scale(1.08);
  }

  .leaderboard-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 14px;
    transition: all 0.2s ease;
  }

  .leaderboard-item:hover {
    filter: brightness(1.15);
    transform: translateX(3px);
  }

  .rank-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    flex-shrink: 0;
  }

  .loading {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { 
      opacity: 1;
      transform: scale(1);
    }
    50% { 
      opacity: 0.8;
      transform: scale(1.05);
    }
  }

  .social-link-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 14px;
    text-decoration: none;
    transition: all 0.2s ease;
    min-width: 180px;
  }

  .social-link-card.twitter {
    background: rgba(30, 41, 59, 0.6);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid #e2e8f0;
  }

  .social-link-card.twitter:hover {
    background: rgba(30, 41, 59, 0.9);
    filter: brightness(1.15);
  }

  .social-link-card.website {
    background: rgba(59, 130, 246, 0.08);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.12);
    border-left: 3px solid #60a5fa;
  }

  .social-link-card.website:hover {
    background: rgba(59, 130, 246, 0.15);
    filter: brightness(1.15);
  }

  .social-title {
    display: block;
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 2px;
    font-family: Poppins, sans-serif;
  }

  .social-subtitle {
    display: block;
    font-size: 11px;
    opacity: 0.6;
    font-family: Poppins, sans-serif;
  }

  @media (max-width: 768px) {
    /* ========================================
       FARCASTER MOBILE COMPACT LAYOUT
       ======================================== */
    
    /* Main container */
    .farcaster-app .home {
      padding: 8px 8px 80px 8px !important;
      max-width: 100vw;
      overflow-x: hidden;
      box-sizing: border-box;
    }

    /* Welcome section - more compact */
    .farcaster-app .welcome-section {
      padding: 0;
      margin-bottom: 8px;
    }

    .farcaster-app .card {
      padding: 10px;
      margin: 0;
      border-radius: 12px;
    }

    /* Hide welcome text on mobile for more space */
    .farcaster-app .welcome-section h1 {
      font-size: 18px !important;
      margin-bottom: 4px !important;
    }

    .farcaster-app .welcome-section p {
      font-size: 11px !important;
      margin-bottom: 8px !important;
    }

    /* ========================================
       CATEGORY SECTIONS - COMPACT
       ======================================== */
    
    /* Category container - minimal padding */
    .farcaster-app .category-section,
    .farcaster-app [style*="padding: '32px'"] {
      padding: 10px !important;
      border-radius: 12px !important;
      margin-bottom: 8px !important;
    }

    /* Category header - compact */
    .farcaster-app .category-header,
    .farcaster-app [style*="marginBottom: '24px'"] {
      margin-bottom: 8px !important;
      gap: 6px !important;
    }

    /* Category title - smaller */
    .farcaster-app .category-header h2,
    .farcaster-app [style*="fontSize: '28px'"] {
      font-size: 14px !important;
    }

    /* Category icon - smaller */
    .farcaster-app .category-icon,
    .farcaster-app [style*="width: '44px'"] {
      width: 28px !important;
      height: 28px !important;
    }

    .farcaster-app .category-icon svg,
    .farcaster-app [style*="width: '44px'"] svg {
      width: 14px !important;
      height: 14px !important;
    }

    /* Gap between categories */
    .farcaster-app [style*="gap: '40px'"] {
      gap: 8px !important;
      margin-top: 8px !important;
    }

    /* ========================================
       GAME CARDS GRID - COMPACT 2-4 COLUMNS
       ======================================== */
    
    .farcaster-app .games-grid,
    .farcaster-app [style*="gridTemplateColumns"] {
      grid-template-columns: repeat(auto-fit, minmax(75px, 1fr)) !important;
      gap: 6px !important;
    }

    /* ========================================
       GAME CARDS - COMPACT STYLE
       ======================================== */
    
    .farcaster-app .game-card {
      padding: 0 !important;
      border-radius: 12px !important;
      min-height: auto !important;
    }

    .farcaster-app .game-card > div {
      min-height: 70px !important;
      gap: 4px !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .farcaster-app .game-card > div > div:first-child {
      flex-direction: column !important;
      align-items: center !important;
      gap: 4px !important;
    }

    .farcaster-app .game-card img,
    .farcaster-app .game-card svg {
      width: 18px !important;
      height: 18px !important;
    }

    .farcaster-app .game-card h3 {
      font-size: 10px !important;
      margin: 0 !important;
      text-align: center !important;
      line-height: 1.2 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
    }

    .farcaster-app .game-card p {
      display: none !important;
    }

    .farcaster-app .game-card > div > div:last-child {
      margin-top: 2px !important;
      justify-content: center !important;
    }

    /* ========================================
       NETWORK LOGOS - SMALLER
       ======================================== */
    
    .farcaster-app [style*="borderRadius: '50%'"] {
      width: 14px !important;
      height: 14px !important;
    }

    /* ========================================
       SOCIAL LINKS - COMPACT
       ======================================== */
    
    .farcaster-app .social-link-card {
      min-width: 100px;
      padding: 8px 12px;
      font-size: 11px;
    }

    /* ========================================
       LEADERBOARD - COMPACT
       ======================================== */
    
    .farcaster-app .leaderboard-item {
      padding: 10px 12px;
      gap: 10px;
    }

    .farcaster-app .rank-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
    }

    /* ========================================
       PREVENT OVERFLOW
       ======================================== */
    
    .farcaster-app * {
      max-width: 100%;
      box-sizing: border-box;
    }

    .farcaster-app {
      overflow-x: hidden;
      width: 100%;
      max-width: 100vw;
    }
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}
