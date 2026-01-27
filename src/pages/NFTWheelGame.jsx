import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { useNFTWheel, WHEEL_VISUAL_ORDER } from '../hooks/useNFTWheel'
import NFTWheel from '../components/NFTWheel'
import Confetti from '../components/Confetti'
import { 
  Sparkles, 
  Trophy, 
  Gift, 
  Lock, 
  RotateCw, 
  Clock, 
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Coins
} from 'lucide-react'

// Admin wallet address (development only - will be removed for public release)
const ADMIN_WALLET = '0xa7A9B7E0c4B36d9dE8A94c6388449d06F2C5952f'

const NFTWheelGame = () => {
  const { address, isConnected } = useAccount()
  
  // Check if user is admin
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET.toLowerCase()
  const {
    isSpinning,
    isPaying,
    winningSegment,
    spinsRemaining,
    hasNFT,
    loading,
    error,
    nextResetTime,
    spinCost,
    spinWheel,
    completeSpin
  } = useNFTWheel()

  const [showConfetti, setShowConfetti] = useState(false)
  const [timeUntilReset, setTimeUntilReset] = useState('')

  // Update countdown timer
  useEffect(() => {
    if (!nextResetTime) return

    const updateTimer = () => {
      const now = new Date()
      const timeLeft = nextResetTime.getTime() - now.getTime()
      
      if (timeLeft <= 0) {
        setTimeUntilReset('Reset!')
        return
      }

      const hours = Math.floor(timeLeft / (1000 * 60 * 60))
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)
      
      setTimeUntilReset(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [nextResetTime])

  // Show confetti for jackpot
  useEffect(() => {
    if (winningSegment !== null) {
      const segmentData = WHEEL_VISUAL_ORDER.find(s => s.id === winningSegment)
      if (segmentData?.isJackpot) {
        setShowConfetti(true)
      }
    }
  }, [winningSegment])

  const handleSpin = async () => {
    if (!isConnected) {
      return
    }

    await spinWheel()
  }

  const handleSpinComplete = async () => {
    const segmentData = winningSegment !== null ? WHEEL_VISUAL_ORDER.find(s => s.id === winningSegment) : null
    if (segmentData?.isJackpot) {
      // Keep confetti longer for jackpot
      setTimeout(() => {
        setShowConfetti(false)
        completeSpin()
      }, 2000)
    } else {
      completeSpin()
    }
  }

  const winningSegmentData = winningSegment !== null ? WHEEL_VISUAL_ORDER.find(s => s.id === winningSegment) : null

  // Show access restricted message if not admin
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        padding: '20px',
        paddingTop: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '600px',
          padding: '40px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '30px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          textAlign: 'center'
        }}>
          <Lock size={64} color="#ef4444" style={{ marginBottom: '20px' }} />
          <h2 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#ef4444',
            marginBottom: '16px'
          }}>
            Access Restricted
          </h2>
          <p style={{
            fontSize: '18px',
            color: '#94a3b8',
            lineHeight: '1.6',
            marginBottom: '8px'
          }}>
            This feature is currently in development and only available to authorized users.
          </p>
          {isConnected && (
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              marginTop: '16px'
            }}>
              Connected wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          )}
          <Link 
            to="/" 
            style={{
              display: 'inline-block',
              marginTop: '24px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <ArrowLeft size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      padding: '20px',
      paddingTop: '100px',
      paddingBottom: '120px'
    }}>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Back Button */}
      <Link 
        to="/" 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: '#94a3b8',
          textDecoration: 'none',
          marginBottom: '20px',
          fontSize: '16px',
          fontWeight: '500',
          transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.color = '#cbd5e1'}
        onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
      >
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </Link>

      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
          padding: '16px 32px',
          borderRadius: '20px',
          border: '2px solid rgba(139, 92, 246, 0.3)',
          marginBottom: '16px'
        }}>
          <Sparkles size={32} color="#8b5cf6" />
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            NFT Wheel of Fortune
          </h1>
        </div>
        <p style={{
          color: '#94a3b8',
          fontSize: '18px',
          margin: '8px 0 0'
        }}>
          Spin to win massive XP rewards! 🎰
        </p>
      </div>

      {/* NFT Check */}
      {!isConnected ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
          borderRadius: '20px',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          marginBottom: '40px'
        }}>
          <Lock size={48} color="#3b82f6" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#cbd5e1', marginBottom: '8px' }}>Connect Your Wallet</h2>
          <p style={{ color: '#94a3b8' }}>Connect your wallet to spin the NFT Wheel!</p>
        </div>
      ) : !hasNFT ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
          borderRadius: '20px',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '40px'
        }}>
          <Lock size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#cbd5e1', marginBottom: '8px' }}>NFT Required</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
            You need to own an Early Access NFT to spin the wheel!
          </p>
          <Link
            to="/early-access"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = 'none'
            }}
          >
            Get Early Access NFT
          </Link>
        </div>
      ) : (
        <>
          {/* Spin Info Card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '40px'
          }}>
            {/* Spins Remaining */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
              borderRadius: '16px',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              textAlign: 'center'
            }}>
              <RotateCw size={24} color="#3b82f6" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
                {spinsRemaining}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                {spinsRemaining === 1 ? 'Spin Remaining' : 'Spins Remaining'}
              </div>
            </div>

            {/* Next Reset */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
              borderRadius: '16px',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              textAlign: 'center'
            }}>
              <Clock size={24} color="#8b5cf6" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '4px', fontFamily: 'monospace' }}>
                {timeUntilReset || '--:--:--'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                Until Reset
              </div>
            </div>

            {/* NFT Status */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
              borderRadius: '16px',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              textAlign: 'center'
            }}>
              <CheckCircle size={24} color="#10b981" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>
                NFT Verified
              </div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                Ready to Spin!
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
              borderRadius: '12px',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#ef4444'
            }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Wheel Component */}
          <NFTWheel
            isSpinning={isSpinning}
            winningSegment={winningSegment}
            onSpinComplete={handleSpinComplete}
            segments={WHEEL_VISUAL_ORDER}
          />

          {/* Spin Button */}
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            {/* Cost Info */}
            <div style={{
              marginBottom: '16px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Coins size={20} style={{ color: '#3b82f6' }} />
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Cost per spin:</span>
              <span style={{ color: '#3b82f6', fontSize: '18px', fontWeight: '700' }}>{spinCost}</span>
            </div>
            
            <div>
              <button
                onClick={handleSpin}
                disabled={isSpinning || isPaying || spinsRemaining <= 0 || loading}
                style={{
                  padding: '18px 48px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  background: isSpinning || isPaying || spinsRemaining <= 0
                    ? 'linear-gradient(135deg, #475569 0%, #334155 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: isSpinning || isPaying || spinsRemaining <= 0 ? 'not-allowed' : 'pointer',
                  boxShadow: isSpinning || isPaying || spinsRemaining <= 0
                    ? 'none'
                    : '0 10px 30px rgba(139, 92, 246, 0.4)',
                  transition: 'all 0.3s ease',
                  opacity: isSpinning || isPaying || spinsRemaining <= 0 ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!isSpinning && !isPaying && spinsRemaining > 0) {
                    e.target.style.transform = 'translateY(-2px)'
                    e.target.style.boxShadow = '0 15px 40px rgba(139, 92, 246, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)'
                  if (!isSpinning && !isPaying && spinsRemaining > 0) {
                    e.target.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.4)'
                  }
                }}
              >
                {isPaying ? (
                  <>
                    <RotateCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Processing Payment...</span>
                  </>
                ) : isSpinning ? (
                  <>
                    <RotateCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Spinning...</span>
                  </>
                ) : spinsRemaining <= 0 ? (
                  <>
                    <Lock size={24} />
                    <span>Daily Limit Reached</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={24} />
                    <span>Pay {spinCost} & Spin!</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Prize Pool */}
          <div style={{
            marginTop: '60px',
            padding: '32px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)',
            borderRadius: '24px',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '28px'
            }}>
              <Trophy size={24} color="#8b5cf6" />
              <h3 style={{
                color: '#e2e8f0',
                fontSize: '24px',
                fontWeight: '700',
                margin: 0,
                letterSpacing: '0.5px'
              }}>
                Available Rewards
              </h3>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px'
            }}>
              {WHEEL_VISUAL_ORDER.map((segment) => (
                <div
                  key={segment.id}
                  style={{
                    padding: '20px 16px',
                    background: segment.isJackpot
                      ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)'
                      : `linear-gradient(135deg, ${segment.color}15 0%, ${segment.color}08 100%)`,
                    borderRadius: '16px',
                    border: `2px solid ${segment.isJackpot ? 'rgba(251, 191, 36, 0.5)' : `${segment.color}40`}`,
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = `0 8px 24px ${segment.color}30`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {segment.isJackpot && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'rgba(251, 191, 36, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Trophy size={14} color="#fbbf24" />
                    </div>
                  )}
                  <div style={{
                    fontSize: '22px',
                    fontWeight: '800',
                    color: segment.isJackpot ? '#fbbf24' : segment.color,
                    marginBottom: '6px',
                    letterSpacing: '0.5px',
                    textShadow: segment.isJackpot 
                      ? '0 0 12px rgba(251, 191, 36, 0.6)' 
                      : `0 0 8px ${segment.color}50`
                  }}>
                    {segment.label}
                  </div>
                  <div style={{ 
                    color: '#94a3b8', 
                    fontSize: '13px',
                    fontWeight: '600',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Experience Points
                  </div>
                  {segment.isJackpot && (
                    <div style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: 'rgba(251, 191, 36, 0.2)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#fbbf24',
                      letterSpacing: '0.5px'
                    }}>
                      MEGA JACKPOT
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default NFTWheelGame
