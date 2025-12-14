import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { getLeaderboard } from '../utils/xpUtils'
import { useTransactions } from '../hooks/useTransactions'
import { useX402Payment } from '../hooks/useX402Payment'
import EmbedMeta from '../components/EmbedMeta'
import TwitterShareButton from '../components/TwitterShareButton'
import DailyQuestSystem from '../components/DailyQuestSystem'
import { useFarcaster } from '../contexts/FarcasterContext'
import { Gamepad2, MessageSquare, Coins, Zap, Dice1, Dice6, Trophy, User, Star, Medal, Award, TrendingUp, Image, Layers, Package, Twitter, ExternalLink, Rocket, Factory, Menu, X, Search } from 'lucide-react'

const Home = () => {
  const { isConnected } = useAccount()
  const { sendGMTransaction, sendGNTransaction, isLoading: transactionLoading } = useTransactions()
  
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
  
  const [leaderboard, setLeaderboard] = useState([])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoadingGM, setIsLoadingGM] = useState(false)
  const [isLoadingGN, setIsLoadingGN] = useState(false)

  // Load leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLeaderboardLoading(true)
        console.log('Loading leaderboard for home page...')
        const data = await getLeaderboard()
        console.log('Home page leaderboard data:', data)
        setLeaderboard(data)
      } catch (error) {
        console.error('Error loading leaderboard:', error)
      } finally {
        setLeaderboardLoading(false)
      }
    }

    loadLeaderboard()
    // Refresh every 10 seconds
    const interval = setInterval(loadLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [])


  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Direct transaction functions for GM and GN
  const handleGMClick = async (e) => {
    e.preventDefault()
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    
    setIsLoadingGM(true)
    setSuccessMessage('')
    
    try {
      const result = await sendGMTransaction('GM from BaseHub! 🎮')
      setSuccessMessage(`🎉 GM sent successfully! +10 XP earned!`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('GM transaction failed:', error)
      setSuccessMessage('❌ GM transaction failed. Please try again.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setIsLoadingGM(false)
    }
  }

  const handleGNClick = async (e) => {
    e.preventDefault()
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    
    setIsLoadingGN(true)
    setSuccessMessage('')
    
    try {
      const result = await sendGNTransaction('GN from BaseHub! 🌙')
      setSuccessMessage(`🌙 GN sent successfully! +10 XP earned!`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('GN transaction failed:', error)
      setSuccessMessage('❌ GN transaction failed. Please try again.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setIsLoadingGN(false)
    }
  }

  const handleX402Payment = async (e) => {
    e.preventDefault()
    setSuccessMessage('')

    try {
      // Use Coinbase Wallet SDK for x402 payment
      const result = await makeX402Payment()
      setSuccessMessage('✅ Payment successful! +500 XP earned!')
      setTimeout(() => setSuccessMessage(''), 5000)
      console.log('x402 Payment successful:', result)
    } catch (err) {
      // Error is already set in hook
      console.error('x402 Payment error:', err)
    }
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy size={20} style={{ color: '#FFD700' }} />
      case 2:
        return <Medal size={20} style={{ color: '#C0C0C0' }} />
      case 3:
        return <Award size={20} style={{ color: '#CD7F32' }} />
      default:
        return <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#6b7280' }}>#{rank}</span>
    }
  }

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      })
    }
    setIsMenuOpen(false)
  }

  const games = [
    {
      id: 'gm',
      title: 'GM Game',
      description: 'Send a GM message to earn XP',
      icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '25px', objectFit: 'cover' }} />,
      path: '/gm',
      color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      xpReward: '10 XP',
      bonusXP: null
    },
    {
      id: 'gn',
      title: 'GN Game',
      description: 'Send a GN message to earn XP',
      icon: <img src="/crypto-logos/basahub logo/GN.png" alt="GN Game" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '25px', objectFit: 'cover' }} />,
      path: '/gn',
      color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      xpReward: '10 XP',
      bonusXP: null
    },
    {
      id: 'ai-nft',
      title: 'AI NFT Launchpad',
      description: 'Generate AI art and mint as NFT',
      icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '25px', objectFit: 'cover' }} />,
      path: '/ai-nft',
      color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      xpReward: '500 XP',
      bonusXP: null
    },
    {
      id: 'x402-premium',
      title: 'BaseHub x402 Payment',
      description: 'Pay 0.1 USDC via x402',
      icon: <Star size={50} style={{ color: 'white' }} />,
      path: null, // Special handler
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      xpReward: '500 XP',
      bonusXP: '0.1 USDC',
      isPayment: true // Mark as payment button
    },
    {
      id: 'wallet-analysis',
      title: 'Wallet Analysis',
      description: 'Get fun insights about any wallet',
      icon: <Search size={50} style={{ color: 'white' }} />,
      path: '/wallet-analysis',
      color: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      xpReward: '400 XP',
      bonusXP: '0.40 USDC',
      isX402: true // Mark as x402 payment
    },
    {
      id: 'deploy-erc721',
      title: 'Deploy ERC721',
      description: 'Deploy your own NFT contract',
      icon: <img src="/crypto-logos/basahub logo/ERC-721.png" alt="Deploy ERC721" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '25px', objectFit: 'cover' }} />,
      path: '/deploy-erc721',
      color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      xpReward: '100 XP',
      bonusXP: null
    },
    {
      id: 'deploy',
      title: 'Deploy Token',
      description: 'Create your own ERC20 token',
      icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '25px', objectFit: 'cover' }} />,
      path: '/deploy',
      color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      xpReward: '50 XP',
      bonusXP: null
    },
    {
      id: 'deploy-erc1155',
      title: 'Deploy ERC1155',
      description: 'Deploy multi-token contract',
      icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '12px' }} />,
      path: '/deploy-erc1155',
      color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      xpReward: '100 XP',
      bonusXP: null
    },
    {
      id: 'flip',
      title: 'Coin Flip',
      description: 'Flip a coin and earn XP',
      icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '12px' }} />,
      path: '/flip',
      color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      xpReward: '10 XP',
      bonusXP: '+500 XP (Win)'
    },
    {
      id: 'lucky',
      title: 'Lucky Number',
      description: 'Guess 1-10 and earn XP',
      icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '12px' }} />,
      path: '/lucky',
      color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      xpReward: '10 XP',
      bonusXP: '+1000 XP (Win)'
    },
    {
      id: 'dice',
      title: 'Dice Roll',
      description: 'Roll dice and earn XP',
      icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '12px' }} />,
      path: '/dice',
      color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      xpReward: '10 XP',
      bonusXP: '+1500 XP (Win)'
    },
    {
      id: 'slot',
      title: 'Crypto Slots',
      description: 'Spin the reels and win XP',
      icon: <img src="/crypto-logos/basahub logo/CryptoSloth.png" alt="Crypto Slots" loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '12px' }} />,
      path: '/slot',
      color: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      xpReward: '10 XP',
      bonusXP: '+2000 XP (Combo)'
    },
  ]

  return (
    <div className="home">
      <EmbedMeta 
        title="BaseHub - Play Games & Earn XP"
        description="Play games and earn XP on Base network through Farcaster. Join the leaderboard and compete with other players!"
        buttonText="Play BaseHub"
      />
      
      {/* Hamburger Menu */}
      {(
        <div style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 9999
        }}>
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
              minHeight: '36px'
            }}
          >
            {isMenuOpen ? <X size={20} style={{ color: 'white' }} /> : <Menu size={20} style={{ color: 'white' }} />}
          </button>
        </div>
      )}

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
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '8px'
          }}>
            Quick Navigation
          </h3>
          
          <button
            onClick={() => scrollToSection('daily-quests')}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <Trophy size={20} />
            Daily Quests
          </button>
          
          <button
            onClick={() => scrollToSection('leaderboard')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}
          >
            <Star size={20} />
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

      <div className="welcome-section">
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🎮
            </div>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#1f2937'
            }}>
              Welcome to BaseHub
            </h1>
            <p style={{ 
              fontSize: '18px', 
              color: '#6b7280',
              marginBottom: '24px'
            }}>
              Play games and earn XP on the Base network through Farcaster
            </p>
            
            {/* Twitter Share Button for Web Users */}
            <div style={{ 
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <TwitterShareButton 
                title="BaseHub"
                description="Play games and earn XP on Base network!"
                hashtags={["BaseHub", "BaseNetwork", "Web3", "Gaming", "XP", "Farcaster"]}
              />
            </div>
            
            {!isConnected && (
              <div style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '1px solid #f59e0b',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <p style={{ color: '#92400e', margin: 0 }}>
                  💡 Connect your wallet to start playing and earning XP!
                </p>
              </div>
            )}
            
            {/* Success Message */}
            {successMessage && (
              <div style={{
                background: successMessage.includes('❌') 
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                  : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: successMessage.includes('❌') 
                  ? '1px solid #fca5a5'
                  : '1px solid #86efac',
                borderRadius: '12px',
                padding: '12px 16px',
                marginTop: '16px',
                fontSize: '14px',
                fontWeight: '600',
                color: successMessage.includes('❌') ? '#dc2626' : '#16a34a',
                textAlign: 'center',
                animation: 'slideInDown 0.3s ease-out'
              }}>
                {successMessage}
              </div>
            )}
            
          </div>

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
                      color: '#1f2937'
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
                    
                    {/* Success message */}
                    {successMessage && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: '#d1fae5',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        color: '#059669',
                        fontSize: '12px',
                        textAlign: 'center',
                        fontWeight: '500'
                      }}>
                        {successMessage}
                      </div>
                    )}
                    
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
              
              // For GM and GN, use direct transaction buttons
              if (game.id === 'gm' || game.id === 'gn') {
                return (
                  <button
                    key={game.id}
                    onClick={game.id === 'gm' ? handleGMClick : handleGNClick}
                    disabled={!isConnected || (game.id === 'gm' ? isLoadingGM : isLoadingGN)}
                    className="game-card"
                    style={{ 
                      textDecoration: 'none',
                      border: 'none',
                      cursor: isConnected && !(game.id === 'gm' ? isLoadingGM : isLoadingGN) ? 'pointer' : 'not-allowed',
                      opacity: isConnected && !(game.id === 'gm' ? isLoadingGM : isLoadingGN) ? 1 : 0.6
                    }}
                  >
                  <div 
                    className="game-icon"
                    style={{ background: game.color }}
                  >
                    {game.icon}
                  </div>
                  
                  {/* XP Reward Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(255, 255, 255, 0.95)',
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

                  {/* Bonus XP Badge */}
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

                  <h3 style={{ 
                    fontSize: '20px', 
                    fontWeight: 'bold', 
                    marginBottom: '8px',
                    color: '#1f2937'
                  }}>
                    {game.title}
                  </h3>
                  <p style={{ 
                    color: '#6b7280',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}>
                    {(game.id === 'gm' ? isLoadingGM : isLoadingGN) ? 'Sending...' : game.description}
                  </p>
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
                    color: '#1f2937'
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
                fontSize: '32px', 
                marginBottom: '12px',
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                🏆
              </div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '8px',
                color: '#1f2937'
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
              {leaderboard.length > 0 ? leaderboard.slice(0, 5).map((player, index) => (
                <div
                  key={player.wallet_address}
                  className="leaderboard-item"
                  style={{
                    background: index < 3 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                    border: index < 3 ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div className="rank-icon" style={{ 
                    background: index < 3 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
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
                        color: '#1f2937'
                      }}>
                        {formatAddress(player.wallet_address)}
                      </span>
                      {index < 3 && (
                        <span style={{
                          background: index === 0 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 
                                     index === 1 ? 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)' :
                                     'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)',
                          color: 'white',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontSize: '8px',
                          fontWeight: 'bold'
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
                    <Star size={14} style={{ color: '#FFD700' }} />
                    <span style={{ 
                      fontWeight: 'bold',
                      color: '#FFD700',
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
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    marginBottom: '8px',
                    color: '#374151'
                  }}>
                    No Players Yet
                  </h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Be the first to play and earn XP!
                  </p>
                </div>
              )}
            </div>

            {leaderboard.length > 5 && (
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <p style={{ 
                  color: '#6b7280',
                  fontSize: '12px',
                  margin: 0
                }}>
                  And {leaderboard.length - 5} more players...
                </p>
              </div>
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
            color: '#1f2937'
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
              href="https://x.com/BaseHUBB" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link-card twitter"
            >
              <Twitter size={24} />
              <div>
                <span className="social-title">Follow on X</span>
                <span className="social-subtitle">@BaseHUBB</span>
              </div>
            </a>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home

// Modern CSS Styles
const styles = `
  .home {
    min-height: 100vh;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    padding: 20px;
  }

  .welcome-section {
    margin-bottom: 40px;
  }

  .card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
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
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 24px;
    text-align: center;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .game-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }

  .game-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
    border-radius: 20px 20px 0 0;
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
    .games-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .card {
      padding: 20px;
    }
    
    .game-card {
      padding: 20px;
    }

    .social-link-card {
      min-width: 150px;
      padding: 12px 16px;
    }
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}
