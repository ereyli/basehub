import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { useRainbowKitSwitchChain } from '../hooks/useRainbowKitSwitchChain'
import { getLeaderboard } from '../utils/xpUtils'
import { useX402Payment } from '../hooks/useX402Payment'
import EmbedMeta from '../components/EmbedMeta'
import TwitterShareButton from '../components/TwitterShareButton'
import DailyQuestSystem from '../components/DailyQuestSystem'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { NETWORKS } from '../config/networks'
import { Gamepad2, MessageSquare, Coins, Zap, Dice1, Dice6, Trophy, User, Star, Medal, Award, TrendingUp, Image, Layers, Package, Twitter, ExternalLink, Rocket, Factory, Menu, X, Search, Shield, Sun, Moon, Trash2, Users, ArrowLeftRight, Repeat, Sparkles } from 'lucide-react'

const Home = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useRainbowKitSwitchChain()
  
  // x402 Payment hook - uses x402-fetch (handles wallet UI automatically)
  const { 
    makePayment: makeX402Payment, 
    isLoading: isLoadingX402,
    error: x402Error,
    isConnected: isX402Connected 
  } = useX402Payment()
  
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
  
  // Check if mobile (for Farcaster compact layout)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const isCompactMode = isInFarcaster && isMobile
  
  // Compact styles for Farcaster mobile
  const compactStyles = {
    // Category container
    categoryContainer: isCompactMode ? {
      background: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '12px',
      padding: '10px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.2)'
    } : {
      background: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '20px',
      padding: '32px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      border: '2px solid rgba(59, 130, 246, 0.2)'
    },
    // Category header
    categoryHeader: isCompactMode ? {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '8px'
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
    } : {
      fontSize: '28px',
      fontWeight: '700',
      color: '#e5e7eb',
      margin: 0,
      fontFamily: 'Poppins, sans-serif'
    },
    // Grid layout
    cardGrid: isCompactMode ? {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
      gap: '6px'
    } : {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px'
    },
    // Card style
    card: (color) => isCompactMode ? {
      textDecoration: 'none',
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      background: color,
      color: 'white',
      padding: '8px',
      borderRadius: '10px',
      transition: 'all 0.2s ease',
      minHeight: '70px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    } : {
      textDecoration: 'none',
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      background: color,
      color: 'white',
      padding: '24px',
      borderRadius: '16px',
      transition: 'all 0.3s ease'
    },
    // Card inner container
    cardInner: isCompactMode ? {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
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
    } : {
      fontSize: '20px',
      fontWeight: '600',
      margin: '0 0 8px 0',
      color: 'white',
      lineHeight: '1.2',
      fontFamily: 'Poppins, sans-serif'
    },
    // Card description (hidden in compact mode)
    cardDescription: isCompactMode ? {
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
    // XP Badge
    xpBadge: isCompactMode ? {
      background: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '6px',
      padding: '2px 6px',
      fontSize: '8px',
      fontWeight: '600',
      color: '#10b981',
      whiteSpace: 'nowrap',
      lineHeight: '1.2',
      fontFamily: 'Poppins, sans-serif'
    } : {
      background: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '12px',
      padding: '4px 10px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#10b981',
      whiteSpace: 'nowrap',
      lineHeight: '1.2',
      fontFamily: 'Poppins, sans-serif'
    },
    // Main layout gap
    mainLayoutGap: isCompactMode ? {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginTop: '8px'
    } : {
      display: 'flex',
      flexDirection: 'column',
      gap: '40px',
      marginTop: '40px'
    },
    // Icon size
    iconSize: isCompactMode ? 14 : 22
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
        return <Trophy size={20} style={{ color: '#f59e0b' }} />
      case 2:
        return <Medal size={20} style={{ color: '#9ca3af' }} />
      case 3:
        return <Award size={20} style={{ color: '#d97706' }} />
      default:
        return <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#6b7280' }}>#{rank}</span>
    }
  }

  // Helper: small inline logos used in category headers
  const renderNetworkLogos = (networks) => {
    if (!networks || networks.length === 0) return null
    
    const size = 20
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
        {networks.includes('katana') && (
          <img 
            src="/katana-logo.jpg" 
            alt="Katana" 
            style={baseStyle} 
          />
        )}
      </div>
    )
  }

  // Helper function to render multi-chain text for ANALYSIS features
  const renderMultiChainText = () => {
    return (
      <span style={{
        fontSize: '12px',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        background: 'rgba(139, 92, 246, 0.2)',
        padding: '4px 10px',
        borderRadius: '8px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        whiteSpace: 'nowrap',
        fontFamily: 'Poppins, sans-serif'
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

  // Render a compact card for Farcaster mobile
  const renderCompactCard = (game, onClick = null, linkTo = null) => {
    const cardContent = (
      <div style={compactStyles.cardInner}>
        {isCompactMode ? (
          <>
            <div style={{ flexShrink: 0 }}>
              {game.icon}
            </div>
            <h3 style={compactStyles.cardTitle}>
              {game.shortTitle || game.title.split(' ')[0]}
            </h3>
            <div style={compactStyles.xpBadge}>
              {game.xpReward}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flexShrink: 0 }}>
                {game.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={compactStyles.cardTitle}>
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
                  background: 'rgba(255, 215, 0, 0.95)',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#92400e',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.2',
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

    if (linkTo) {
      return (
        <Link
          key={game.id}
          to={linkTo}
          className="game-card"
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
            {cardContent}
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
        {cardContent}
      </button>
    )
  }

  // Render a category section
  const renderCategory = (title, shortTitle, icon, iconColor, games, borderColor = 'rgba(59, 130, 246, 0.2)', networks = []) => {
    const categoryIconBoxStyle = {
      ...compactStyles.categoryIconBox,
      background: `rgba(${iconColor}, 0.15)`,
      border: `1px solid rgba(${iconColor}, 0.3)`,
      color: iconColor.startsWith('#') ? iconColor : `rgb(${iconColor})`
    }

    return (
      <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid ${borderColor}` }}>
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

  const games = [
    {
      id: 'ai-nft',
      title: 'AI NFT Launchpad',
      description: 'Generate AI art and mint as NFT',
      icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/ai-nft',
      color: '#f59e0b',
      xpReward: '500 XP',
      bonusXP: null,
      networks: ['base']
    },
    {
      id: 'nft-wheel',
      title: 'NFT Wheel of Fortune',
      description: 'Spin to win massive XP rewards (NFT holders only)',
      icon: <Sparkles size={40} style={{ color: 'white' }} />,
      path: '/nft-wheel',
      color: '#8b5cf6',
      xpReward: '2K-50K XP',
      bonusXP: 'MEGA JACKPOT!',
      networks: ['base'],
      isNFTGated: true
    },
    {
      id: 'x402-premium',
      title: 'x402 test',
      description: 'Pay 0.1 USDC via x402',
      icon: <Star size={40} style={{ color: 'white' }} />,
      path: null, // Special handler
      color: '#8b5cf6',
      xpReward: '500 XP',
      bonusXP: '0.1 USDC',
      isPayment: true, // Mark as payment button
      networks: ['base'],
      isX402: true
    },
    {
      id: 'wallet-analysis',
      title: 'Wallet Analysis',
      description: 'Get fun insights about any wallet',
      icon: <Search size={40} style={{ color: 'white' }} />,
      path: '/wallet-analysis',
      color: '#8b5cf6',
      xpReward: '400 XP',
      bonusXP: '0.40 USDC',
      isX402: true, // Mark as x402 payment
      networks: ['base']
    },
    {
      id: 'contract-security',
      title: 'Contract Security',
      description: 'Analyze smart contract security risks',
      icon: <Shield size={40} style={{ color: 'white' }} />,
      path: '/contract-security',
      color: '#8b5cf6',
      xpReward: '500 XP',
      bonusXP: '0.50 USDC',
      isX402: true, // Mark as x402 payment
      networks: ['base']
    },
    {
      id: 'allowance-cleaner',
      title: 'Allowance Cleaner',
      description: 'Scan and revoke risky token approvals',
      icon: <Trash2 size={40} style={{ color: 'white' }} />,
      path: '/allowance-cleaner',
      color: '#8b5cf6',
      xpReward: '300 XP',
      bonusXP: '0.1 USDC',
      isX402: true, // Mark as x402 payment
      networks: ['base']
    },
    {
      id: 'featured-profiles',
      title: 'Featured Profiles',
      description: 'Register your profile and connect through mutual follows',
      icon: <Star size={40} style={{ color: 'white' }} />,
      path: '/featured-profiles',
      color: '#f59e0b',
      xpReward: '200 XP',
      bonusXP: '0.2-6.0 USDC',
      isX402: true, // Mark as x402 payment
      networks: ['base']
    },
    {
      id: 'deploy-erc721',
      title: 'Deploy ERC721',
      description: 'Deploy your own NFT contract',
      icon: <img src="/crypto-logos/basahub logo/ERC-721.png" alt="Deploy ERC721" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/deploy-erc721',
      color: '#8b5cf6',
      xpReward: '100 XP',
      bonusXP: null,
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'deploy',
      title: 'Deploy Token',
      description: 'Create your own ERC20 token',
      icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/deploy',
      color: '#8b5cf6',
      xpReward: '50 XP',
      bonusXP: null,
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'deploy-erc1155',
      title: 'Deploy ERC1155',
      description: 'Deploy multi-token contract',
      icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/deploy-erc1155',
      color: '#8b5cf6',
      xpReward: '100 XP',
      bonusXP: null,
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'flip',
      title: 'Coin Flip',
      description: 'Flip a coin and earn XP',
      icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/flip',
      color: '#f59e0b',
      xpReward: '60 XP',
      bonusXP: '+500 XP (Win)',
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'lucky',
      title: 'Lucky Number',
      description: 'Guess 1-10 and earn XP',
      icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/lucky',
      color: '#f59e0b',
      xpReward: '60 XP',
      bonusXP: '+1000 XP (Win)',
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'dice',
      title: 'Dice Roll',
      description: 'Roll dice and earn XP',
      icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/dice',
      color: '#f59e0b',
      xpReward: '60 XP',
      bonusXP: '+1500 XP (Win)',
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'slot',
      title: 'Crypto Slots',
      description: 'Spin the reels and win XP',
      icon: <img src="/crypto-logos/basahub logo/CryptoSloth.png" alt="Crypto Slots" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />,
      path: '/slot',
      color: '#f59e0b',
      xpReward: '60 XP',
      bonusXP: '+2000 XP (Combo)',
      networks: ['base', 'ink', 'soneium', 'katana']
    },
    {
      id: 'swap',
      title: 'SwapHub',
      description: 'DEX Aggregator - Swap tokens on Base',
      icon: <ArrowLeftRight size={40} style={{ color: 'white' }} />,
      path: '/swap',
      color: '#3b82f6',
      xpReward: '250 XP',
      bonusXP: '5000 XP (Every $500)',
      networks: ['base']
    },
  ]

  return (
    <div className="home" style={{ 
      maxWidth: '100vw', 
      overflowX: 'hidden',
      boxSizing: 'border-box',
      ...(isInFarcaster && typeof window !== 'undefined' && window.innerWidth <= 768 ? { 
        padding: '12px 12px 80px 12px' 
      } : {})
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

            {/* Network Selector - compact for Farcaster mobile */}
            <div style={{ 
              display: 'flex',
              justifyContent: 'center',
              gap: isCompactMode ? '6px' : '20px',
              marginBottom: isCompactMode ? '12px' : '28px',
              flexWrap: 'wrap'
            }}>
              {[
                { key: 'BASE',  label: 'Base',     logo: '/base-logo.jpg',   chainId: NETWORKS.BASE.chainId },
                { key: 'INK',   label: 'InkChain', logo: '/ink-logo.jpg',    chainId: NETWORKS.INKCHAIN.chainId },
                { key: 'SONE',  label: 'Soneium',  logo: '/soneium-logo.jpg', chainId: NETWORKS.SONEIUM.chainId },
                { key: 'KAT',   label: 'Katana',   logo: '/katana-logo.jpg', chainId: NETWORKS.KATANA.chainId },
              ].map((net) => {
                const isActive = chainId === net.chainId
                return (
                  <button
                    key={net.key}
                    type="button"
                    onClick={async () => {
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
                      borderRadius: isCompactMode ? '10px' : '18px',
                      padding: isCompactMode ? '6px 8px' : '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: isCompactMode ? '4px' : '10px',
                      cursor: 'pointer',
                      boxShadow: isActive 
                        ? '0 4px 12px rgba(59,130,246,0.25)'
                        : '0 2px 8px rgba(15,23,42,0.6)',
                      transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                      transition: 'all 0.2s ease',
                      minWidth: isCompactMode ? 'auto' : '140px',
                      justifyContent: isCompactMode ? 'center' : 'flex-start',
                      flex: isCompactMode ? '1' : 'none',
                      maxWidth: isCompactMode ? '80px' : 'none'
                    }}
                  >
                    <div
                      style={{
                        width: isCompactMode ? '24px' : '40px',
                        height: isCompactMode ? '24px' : '40px',
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
                    {!isCompactMode && (
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 600, 
                          color: '#e5e7eb',
                          fontFamily: 'Poppins, sans-serif'
                        }}>
                          {net.label}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: isActive ? '#a5b4fc' : '#6b7280'
                        }}>
                          {isActive ? 'Connected' : 'Switch network'}
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
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '1px solid #f59e0b',
                borderRadius: isCompactMode ? '8px' : '12px',
                padding: isCompactMode ? '8px 10px' : '16px',
                marginBottom: isCompactMode ? '8px' : '24px'
              }}>
                <p style={{ 
                  color: '#92400e', 
                  margin: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontSize: isCompactMode ? '11px' : '14px'
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
              <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid rgba(245, 158, 11, 0.2)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Rocket size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>
                    {isCompactMode ? 'NFT PASS' : 'EARLY ACCESS NFT'}
                  </h2>
                  <span style={{
                    padding: '4px 10px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    borderRadius: '6px',
                    color: '#3b82f6',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.5px'
                  }}>
                    BETA
                  </span>
                  {!isCompactMode && renderNetworkLogos(['base'])}
                </div>
                <div style={compactStyles.cardGrid}>
                  <Link to="/early-access" className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ ...compactStyles.card('#f59e0b'), height: '100%' }}>
                      <div style={compactStyles.cardInner}>
                        {isCompactMode ? (
                          <>
                            <Rocket size={24} style={{ color: 'white' }} />
                            <h3 style={compactStyles.cardTitle}>Pass</h3>
                            <div style={compactStyles.xpBadge}>3000 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <Rocket size={40} style={{ color: 'white', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={compactStyles.cardTitle}>Early Access Pass</h3>
                                <p style={compactStyles.cardDescription}>Mint your BaseHub Early Access Pass and unlock exclusive benefits</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                              <div style={compactStyles.xpBadge}>3000 XP</div>
                              <div style={{ background: 'rgba(255, 215, 0, 0.95)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#92400e' }}>0.001 ETH</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Link to="/nft-wheel" className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ ...compactStyles.card('linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'), height: '100%' }}>
                      <div style={compactStyles.cardInner}>
                        {isCompactMode ? (
                          <>
                            <Sparkles size={24} style={{ color: 'white' }} />
                            <h3 style={compactStyles.cardTitle}>Wheel</h3>
                            <div style={{ ...compactStyles.xpBadge, color: '#fbbf24' }}>2K-50K</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <Sparkles size={40} style={{ color: 'white', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={compactStyles.cardTitle}>NFT Wheel of Fortune</h3>
                                <p style={compactStyles.cardDescription}>Spin to win 2K-50K XP daily! (NFT holders only)</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                              <div style={{ ...compactStyles.xpBadge, color: '#fbbf24' }}>2K-50K XP</div>
                              <div style={{ background: 'rgba(251, 191, 36, 0.2)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>🎰 MEGA JACKPOT</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 2. DEX Aggregator Category */}
              <div style={compactStyles.categoryContainer}>
                <div style={compactStyles.categoryHeader}>
                  <div style={compactStyles.categoryIconBox}>
                    <Repeat size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>
                    {isCompactMode ? 'DEX' : 'DEX AGGREGATOR'}
                  </h2>
                  {!isCompactMode && renderNetworkLogos(['base'])}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => g.id === 'swap').map((game) => (
                    <Link
                      key={game.id}
                      to={game.path}
                      className="game-card"
                      style={{ 
                        textDecoration: 'none',
                        position: 'relative',
                        display: 'block'
                      }}
                    >
                      <div style={{
                        ...compactStyles.card(game.color),
                        height: '100%'
                      }}>
                        <div style={compactStyles.cardInner}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0 }}>
                                {game.icon}
                              </div>
                              <h3 style={compactStyles.cardTitle}>
                                Swap
                              </h3>
                              <div style={compactStyles.xpBadge}>
                                {game.xpReward}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>
                                  {game.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={compactStyles.cardTitle}>
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
                                    background: 'rgba(255, 215, 0, 0.95)',
                                    borderRadius: '12px',
                                    padding: '4px 10px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#92400e',
                                    whiteSpace: 'nowrap',
                                    lineHeight: '1.2',
                                    fontFamily: 'Poppins, sans-serif'
                                  }}>
                                    {game.bonusXP}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* 3. PumpHub - Token Launchpad Category */}
              <div style={{ 
                ...compactStyles.categoryContainer, 
                background: isCompactMode ? 'rgba(30, 41, 59, 0.95)' : 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 82, 255, 0.1))',
                border: `${isCompactMode ? '1px' : '2px'} solid rgba(0, 212, 255, 0.3)`,
                boxShadow: isCompactMode ? compactStyles.categoryContainer.boxShadow : '0 8px 32px rgba(0, 212, 255, 0.15)'
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
                  <Link to="/pumphub" className="game-card" style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
                    <div style={{ ...compactStyles.card('linear-gradient(135deg, #00d4ff, #0052ff)'), height: '100%' }}>
                      <div style={compactStyles.cardInner}>
                        {isCompactMode ? (
                          <>
                            <Rocket size={24} style={{ color: 'white' }} />
                            <h3 style={compactStyles.cardTitle}>Launch</h3>
                            <div style={compactStyles.xpBadge}>100 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <Rocket size={40} style={{ color: 'white' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={compactStyles.cardTitle}>Token Launchpad</h3>
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
                  <Link to="/pumphub?tab=create" className="game-card" style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
                    <div style={{ ...compactStyles.card('linear-gradient(135deg, #8b5cf6, #6366f1)'), height: '100%' }}>
                      <div style={compactStyles.cardInner}>
                        {isCompactMode ? (
                          <>
                            <Factory size={24} style={{ color: 'white' }} />
                            <h3 style={compactStyles.cardTitle}>Create</h3>
                            <div style={compactStyles.xpBadge}>2000 XP</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <Factory size={40} style={{ color: 'white' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={compactStyles.cardTitle}>Create Token</h3>
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
                  <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <TrendingUp size={20} style={{ color: '#00d4ff' }} />
                    <span style={{ color: '#9ca3af', fontSize: '13px', fontFamily: 'Poppins, sans-serif' }}>
                      Bonding curve • LP locked forever • 0.001 ETH to create • 5 ETH graduation to Uniswap
                    </span>
                  </div>
                )}
              </div>

              {/* GAMING Category */}
              <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid rgba(245, 158, 11, 0.2)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Gamepad2 size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>GAMING</h2>
                  {!isCompactMode && renderNetworkLogos(['base', 'ink', 'soneium', 'katana'])}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['flip', 'dice', 'slot', 'lucky'].includes(g.id)).map((game) => (
                    <Link key={game.id} to={game.path} className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
                        <div style={compactStyles.cardInner}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0 }}>{game.icon}</div>
                              <h3 style={compactStyles.cardTitle}>{game.title.split(' ')[0]}</h3>
                              <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>{game.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={compactStyles.cardTitle}>{game.title}</h3>
                                  <p style={compactStyles.cardDescription}>{game.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                                {game.bonusXP && (
                                  <div style={{ background: 'rgba(255, 215, 0, 0.95)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                                    {game.bonusXP}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* ANALYSIS Category */}
              <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid rgba(139, 92, 246, 0.2)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#8b5cf6' }}>
                    <TrendingUp size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>ANALYSIS</h2>
                  {!isCompactMode && renderMultiChainText()}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['wallet-analysis', 'contract-security', 'allowance-cleaner'].includes(g.id)).map((game) => (
                    <Link key={game.id} to={game.path} className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
                        <div style={compactStyles.cardInner}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0 }}>{game.icon}</div>
                              <h3 style={compactStyles.cardTitle}>{game.title.split(' ')[0]}</h3>
                              <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>{game.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={compactStyles.cardTitle}>{game.title}</h3>
                                  <p style={compactStyles.cardDescription}>{game.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                                {game.bonusXP && (
                                  <div style={{ background: 'rgba(255, 215, 0, 0.95)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                                    {game.bonusXP}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* DEPLOY Category */}
              <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid rgba(59, 130, 246, 0.2)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6' }}>
                    <Rocket size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>DEPLOY</h2>
                  {!isCompactMode && renderNetworkLogos(['base', 'ink', 'soneium', 'katana'])}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['deploy', 'deploy-erc721', 'deploy-erc1155'].includes(g.id)).sort((a, b) => {
                    const order = ['deploy', 'deploy-erc721', 'deploy-erc1155'];
                    return order.indexOf(a.id) - order.indexOf(b.id);
                  }).map((game) => (
                    <Link key={game.id} to={game.path} className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
                        <div style={compactStyles.cardInner}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0 }}>{game.icon}</div>
                              <h3 style={compactStyles.cardTitle}>{game.title.replace('Deploy ', '')}</h3>
                              <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>{game.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={compactStyles.cardTitle}>{game.title}</h3>
                                  <p style={compactStyles.cardDescription}>{game.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* SOCIAL Category */}
              <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid rgba(245, 158, 11, 0.2)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Users size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>SOCIAL</h2>
                  {!isCompactMode && renderNetworkLogos(['base'])}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['featured-profiles'].includes(g.id)).map((game) => (
                    <Link key={game.id} to={game.path} className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
                        <div style={compactStyles.cardInner}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0 }}>{game.icon}</div>
                              <h3 style={compactStyles.cardTitle}>Profiles</h3>
                              <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>{game.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={compactStyles.cardTitle}>{game.title}</h3>
                                  <p style={compactStyles.cardDescription}>{game.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                                {game.bonusXP && (
                                  <div style={{ background: 'rgba(255, 215, 0, 0.95)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                                    {game.bonusXP}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* NFT Category */}
              <div style={{ ...compactStyles.categoryContainer, border: `${isCompactMode ? '1px' : '2px'} solid rgba(245, 158, 11, 0.2)` }}>
                <div style={compactStyles.categoryHeader}>
                  <div style={{ ...compactStyles.categoryIconBox, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                    <Image size={compactStyles.iconSize} />
                  </div>
                  <h2 style={compactStyles.categoryTitle}>NFT</h2>
                  {!isCompactMode && renderNetworkLogos(['base'])}
                </div>
                <div style={compactStyles.cardGrid}>
                  {games.filter(g => ['ai-nft'].includes(g.id)).map((game) => (
                    <Link key={game.id} to={game.path} className="game-card" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ ...compactStyles.card(game.color), height: '100%' }}>
                        <div style={compactStyles.cardInner}>
                          {isCompactMode ? (
                            <>
                              <div style={{ flexShrink: 0 }}>{game.icon}</div>
                              <h3 style={compactStyles.cardTitle}>AI NFT</h3>
                              <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>{game.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={compactStyles.cardTitle}>{game.title}</h3>
                                  <p style={compactStyles.cardDescription}>{game.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                <div style={compactStyles.xpBadge}>{game.xpReward}</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
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
                  <div 
                    className="game-icon"
                    style={{ background: game.color }}
                  >
                    {game.icon}
                  </div>
                  
                  {/* XP Reward Badge */}
                  {game.xpReward && (
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
                  )}

                  {/* Payment Amount Badge */}
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

                  {/* x402 Protocol Badge (for x402 payments) */}
                  {game.isX402 && (
                    <div style={{
                      position: 'absolute',
                      top: game.xpReward ? '40px' : '12px',
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
                  )}

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
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ 
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <Trophy size={32} style={{ color: '#f59e0b' }} />
              </div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '8px',
                color: '#e5e7eb'
              }}>
                Top Players by XP
              </h2>
              <p style={{ 
                color: '#6b7280',
                fontSize: '14px'
              }}>
                See who's leading the BaseHub leaderboard
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {leaderboard.length > 0 ? leaderboard.slice(0, visiblePlayersCount).map((player, index) => (
                <div
                  key={player.wallet_address}
                  className="leaderboard-item"
                  style={{
                    background: index < 3 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                    border: index < 3 ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div className="rank-icon" style={{ 
                    background: index < 3 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                    border: index < 3 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(107, 114, 128, 0.3)'
                  }}>
                    {getRankIcon(index + 1)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      marginBottom: '2px'
                    }}>
                      <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '14px',
                        color: '#e5e7eb'
                      }}>
                        {formatAddress(player.wallet_address)}
                      </span>
                      {index < 3 && (
                        <span style={{
                          background: index === 0 ? 'rgba(245, 158, 11, 0.2)' : 
                                     index === 1 ? 'rgba(192, 192, 192, 0.2)' :
                                     'rgba(205, 127, 50, 0.2)',
                          color: index === 0 ? '#f59e0b' : index === 1 ? '#c0c0c0' : '#cd7f32',
                          border: index === 0 ? '1px solid rgba(245, 158, 11, 0.4)' : 
                                  index === 1 ? '1px solid rgba(192, 192, 192, 0.4)' :
                                  '1px solid rgba(205, 127, 50, 0.4)',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontSize: '9px',
                          fontWeight: '600'
                        }}>
                          TOP {index + 1}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      <span>Level {player.level}</span>
                      <span>{player.total_xp} XP</span>
                    </div>
                  </div>

                  <div style={{ 
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Star size={14} style={{ color: '#f59e0b' }} />
                    <span style={{ 
                      fontWeight: 'bold',
                      color: '#f59e0b',
                      fontSize: '14px'
                    }}>
                      {player.total_xp}
                    </span>
                  </div>
                </div>
              )) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6b7280'
                }}>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                    <Trophy size={48} style={{ color: '#6b7280', opacity: 0.5 }} />
                  </div>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    marginBottom: '8px',
                    color: '#9ca3af'
                  }}>
                    No Players Yet
                  </h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Be the first to play and earn XP!
                  </p>
                </div>
              )}
            </div>

            {leaderboard.length > visiblePlayersCount && (
              <button
                onClick={() => setVisiblePlayersCount(prev => Math.min(prev + 5, leaderboard.length))}
                style={{ 
                  width: '100%',
                textAlign: 'center',
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  color: '#3b82f6',
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: 0
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.2)'
                  e.target.style.transform = 'translateY(-2px)'
                  e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.1)'
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = 'none'
                }}
              >
                Show {Math.min(5, leaderboard.length - visiblePlayersCount)} more players...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Social Links Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            marginBottom: '16px',
            color: '#e5e7eb'
          }}>
            🌐 Connect With Us
          </h3>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <a 
              href="https://x.com/Basehubfun" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link-card twitter"
            >
              <Twitter size={24} />
              <div>
                <span className="social-title">Follow on X</span>
                <span className="social-subtitle">@Basehubfun</span>
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
          background: '#f59e0b',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          animation: 'slideInUp 0.3s ease-out',
          border: '2px solid rgba(255, 255, 255, 0.2)'
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
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#fff',
                margin: '0 0 4px 0',
                lineHeight: '1.2',
                fontFamily: 'Poppins, sans-serif'
              }}>
                Early Access NFT
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.95)',
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
              color: '#fff'
            }}>
              <Zap size={14} />
              <span>2x XP multiplier on ALL activities</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#fff'
            }}>
              <Star size={14} />
              <span>Priority access to airdrops</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#fff'
            }}>
              <Rocket size={14} />
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
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#f59e0b',
              textAlign: 'center',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#fff'
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)'
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)'
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
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 24px;
    text-align: center;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .game-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }


  .game-icon {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
  }

  .game-card:hover .game-icon {
    transform: scale(1.1) rotate(5deg);
  }

  .leaderboard-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .leaderboard-item:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateX(5px);
  }

  .rank-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: 14px;
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
    padding: 16px 20px;
    border-radius: 12px;
    text-decoration: none;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    min-width: 200px;
  }

  .social-link-card.twitter {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-color: rgba(0, 0, 0, 0.2);
  }

  .social-link-card.twitter:hover {
    background: rgba(0, 0, 0, 1);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }

  .social-link-card.website {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.2);
  }

  .social-link-card.website:hover {
    background: rgba(59, 130, 246, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.2);
  }

  .social-title {
    display: block;
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 2px;
  }

  .social-subtitle {
    display: block;
    font-size: 12px;
    opacity: 0.8;
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
      padding: 8px !important;
      border-radius: 10px !important;
      min-height: auto !important;
    }

    /* Card inner container */
    .farcaster-app .game-card > div {
      min-height: 60px !important;
      gap: 4px !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
    }

    /* Card content row - stack vertically */
    .farcaster-app .game-card > div > div:first-child {
      flex-direction: column !important;
      align-items: center !important;
      gap: 4px !important;
    }

    /* Icon container - compact for Farcaster mobile */
    .farcaster-app .game-card img,
    .farcaster-app .game-card svg {
      width: 22px !important;
      height: 22px !important;
      border-radius: 6px !important;
    }

    /* Card title - compact */
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

    /* Hide description on mobile */
    .farcaster-app .game-card p {
      display: none !important;
    }

    /* XP Badge - compact */
    .farcaster-app .game-card [style*="background: 'rgba(30, 41, 59"],
    .farcaster-app .game-card > div > div:last-child {
      margin-top: 2px !important;
      justify-content: center !important;
    }

    .farcaster-app .game-card [style*="padding: '4px 10px'"] {
      padding: 2px 6px !important;
      font-size: 8px !important;
      border-radius: 6px !important;
    }

    /* Hide bonus XP badge on mobile to save space */
    .farcaster-app .game-card > div > div:last-child > div:nth-child(2) {
      display: none !important;
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
      padding: 8px;
      margin-bottom: 6px;
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
