import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { useNFTWheel, WHEEL_VISUAL_ORDER } from '../hooks/useNFTWheel'
import { useSupabase } from '../hooks/useSupabase'
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
  Coins,
  Ticket,
  Zap,
  TrendingUp
} from 'lucide-react'

const NFTWheelGame = () => {
  const { address, isConnected } = useAccount()
  const { supabase } = useSupabase()
  
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
  const [recentWinners, setRecentWinners] = useState([])
  const [loadingWinners, setLoadingWinners] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Track viewport width for responsive layout (especially for Farcaster / mobile)
  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 640)
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

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

  // Load recent winners from Supabase
  const loadRecentWinners = async () => {
    console.log('🔄 Loading recent winners...', { supabase: !!supabase, hasFrom: !!(supabase?.from) })
    
    if (!supabase || !supabase.from) {
      console.log('⚠️ Supabase not available, skipping recent winners')
      setRecentWinners([])
      setLoadingWinners(false)
      return
    }

    try {
      setLoadingWinners(true)
      
      // Get recent winners from nft_wheel_spins table
      console.log('📡 Querying Supabase for nft_wheel_spins...')
      const { data, error } = await supabase
        .from('nft_wheel_spins')
        .select('wallet_address, final_xp, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      
      console.log('📊 nft_wheel_spins query result:', { 
        data, 
        error, 
        dataLength: data?.length,
        sample: data?.slice(0, 3)
      })
      
      if (error) {
        console.error('❌ Error loading recent winners:', error)
        setRecentWinners([])
        return
      }
      
      if (data && data.length > 0) {
        // Map to expected format
        const winners = data.map(t => ({
          wallet_address: t.wallet_address || '',
          xp_earned: t.final_xp || 0,
          created_at: t.created_at
        }))
        setRecentWinners(winners)
        console.log('✅ Recent winners loaded:', winners.length, winners)
      } else {
        console.log('⚠️ No recent winners data found in nft_wheel_spins')
        setRecentWinners([])
      }
    } catch (err) {
      console.error('Failed to load recent winners:', err)
    } finally {
      setLoadingWinners(false)
    }
  }

  // Load winners on mount and when supabase changes
  useEffect(() => {
    loadRecentWinners()
  }, [supabase])

  const handleSpin = async () => {
    if (!isConnected) {
      return
    }

    await spinWheel()
  }

  const handleSpinComplete = async () => {
    // Call completeSpin immediately - it will handle stopping the spin
    const segmentData = winningSegment !== null ? WHEEL_VISUAL_ORDER.find(s => s.id === winningSegment) : null
    if (segmentData?.isJackpot) {
      // Keep confetti longer for jackpot
      await completeSpin()
      setTimeout(() => {
        setShowConfetti(false)
      }, 2000)
    } else {
      await completeSpin()
    }
    
    // Refresh recent winners after spin completes
    setTimeout(() => {
      loadRecentWinners()
    }, 2000) // Wait 2 seconds for data to be saved to Supabase
  }

  const winningSegmentData = winningSegment !== null ? WHEEL_VISUAL_ORDER.find(s => s.id === winningSegment) : null

  // Helper function to format time ago
  const getTimeAgo = (date) => {
    const now = new Date()
    const diff = now - date
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      padding: isMobile ? '14px' : '20px',
      paddingTop: isMobile ? '70px' : '100px',
      paddingBottom: isMobile ? '80px' : '120px'
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
        marginBottom: isMobile ? '28px' : '48px'
      }}>
        <h1 style={{
          fontSize: isMobile ? '26px' : '42px',
          fontWeight: '800',
          color: '#f1f5f9',
          margin: '0 0 8px 0',
          letterSpacing: '-0.5px'
        }}>
          Wheel of Fortune
        </h1>
        <p style={{
          color: '#9ca3af',
          fontSize: isMobile ? '13px' : '16px',
          margin: 0,
          fontWeight: '500'
        }}>
          Exclusive rewards for NFT holders
        </p>
      </div>

      {/* Wallet Connection Check */}
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
      ) : (
        <>
          {/* Stats Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '48px',
            flexWrap: 'wrap'
          }}>
            {/* Spins - only show if has NFT */}
            {hasNFT && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: '14px',
                border: '1px solid rgba(71, 85, 105, 0.4)'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <RotateCw size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1 }}>
                    {spinsRemaining}/3
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Daily Spins
                  </div>
                </div>
              </div>
            )}

            {/* Timer - only show if has NFT */}
            {hasNFT && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: '14px',
                border: '1px solid rgba(71, 85, 105, 0.4)'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1, fontFamily: 'ui-monospace, monospace' }}>
                    {timeUntilReset || '--:--:--'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Reset Timer
                  </div>
                </div>
              </div>
            )}

            {/* NFT Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(12px)',
              borderRadius: '14px',
              border: hasNFT 
                ? '1px solid rgba(71, 85, 105, 0.4)' 
                : '2px solid rgba(251, 191, 36, 0.4)'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: hasNFT 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {hasNFT ? (
                  <CheckCircle size={18} color="white" />
                ) : (
                  <Ticket size={18} color="white" />
                )}
              </div>
              <div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: hasNFT ? '#10b981' : '#fbbf24', 
                  lineHeight: 1.2 
                }}>
                  {hasNFT ? 'Verified' : 'Not Found'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                  {hasNFT ? 'NFT Holder' : 'NFT Required'}
                </div>
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

          {/* Recent Winners - Desktop: Top Right Corner - Transparent */}
          {!isMobile && (
            <div style={{
              position: 'fixed',
              top: '120px',
              right: '180px',
              width: '280px',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.15)',
              backdropFilter: 'blur(10px)',
              maxHeight: 'calc(100vh - 140px)',
              overflowY: 'auto',
              zIndex: 10
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <TrendingUp size={20} color="#8b5cf6" />
                <h3 style={{
                  color: '#cbd5e1',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0
                }}>
                  Recent Winners
                </h3>
              </div>
              
              {loadingWinners ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  Loading...
                </div>
              ) : recentWinners.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {recentWinners.map((winner, index) => {
                    const shortAddress = `${winner.wallet_address.slice(0, 6)}...${winner.wallet_address.slice(-4)}`
                    const timeAgo = getTimeAgo(new Date(winner.created_at))
                    
                    return (
                      <div
                        key={`${winner.wallet_address}-${winner.created_at}`}
                        style={{
                          padding: '10px',
                          background: 'rgba(139, 92, 246, 0.05)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)'
                          e.currentTarget.style.transform = 'translateX(2px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)'
                          e.currentTarget.style.transform = 'translateX(0)'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: index < 3 
                            ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                            : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          color: 'white',
                          fontSize: '14px',
                          flexShrink: 0
                        }}>
                          {index < 3 ? '🏆' : `#${index + 1}`}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#cbd5e1',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginBottom: '4px',
                            fontFamily: 'ui-monospace, monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {shortAddress}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#10b981',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginBottom: '2px'
                          }}>
                            <Zap size={10} />
                            <span>+{Number(winner.xp_earned || 0).toLocaleString()} XP</span>
                          </div>
                          <div style={{
                            color: '#64748b',
                            fontSize: '10px'
                          }}>
                            {timeAgo}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '30px 20px',
                  color: '#64748b',
                  fontSize: '13px'
                }}>
                  <Trophy size={32} color="#64748b" style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <div style={{ fontWeight: '600', marginBottom: '4px', color: '#94a3b8' }}>
                    No winners yet
                  </div>
                  <div style={{ fontSize: '11px' }}>
                    Be the first to spin!
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wheel Component - Centered */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <NFTWheel
              isSpinning={isSpinning}
              winningSegment={winningSegment}
              onSpinComplete={handleSpinComplete}
              segments={WHEEL_VISUAL_ORDER}
            />
          </div>

          {/* Spin Button - Centered with Wheel */}
          <div style={{ 
            textAlign: 'center', 
            marginTop: '40px',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            
            {/* NFT Required Warning - show if no NFT */}
            {!hasNFT && (
              <div style={{
                marginBottom: '20px',
                padding: '16px 24px',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
                borderRadius: '12px',
                border: '2px solid rgba(251, 191, 36, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Ticket size={24} style={{ color: '#fbbf24' }} />
                <span style={{ color: '#fbbf24', fontSize: '16px', fontWeight: '600' }}>
                  Early Access NFT required to spin!
                </span>
              </div>
            )}
            
            <div>
              {/* Show Mint NFT button if no NFT, otherwise show Spin button */}
              {!hasNFT ? (
                <Link
                  to="/early-access"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '18px 48px',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: '#1e293b',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(251, 191, 36, 0.4)',
                    transition: 'all 0.3s ease',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(251, 191, 36, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(251, 191, 36, 0.4)'
                  }}
                >
                  <Ticket size={24} />
                  <span>Mint Early Access NFT</span>
                </Link>
              ) : (
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
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 15px 40px rgba(139, 92, 246, 0.5)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    if (!isSpinning && !isPaying && spinsRemaining > 0) {
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.4)'
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
              )}
            </div>
          </div>

          {/* Recent Winners - Mobile: Below Wheel */}
          {isMobile && (
            <div style={{
              width: '100%',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              marginTop: '32px',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <TrendingUp size={18} color="#8b5cf6" />
                <h3 style={{
                  color: '#cbd5e1',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0
                }}>
                  Recent Winners
                </h3>
              </div>
              
              {loadingWinners ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  Loading...
                </div>
              ) : recentWinners.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {recentWinners.map((winner, index) => {
                    const shortAddress = `${winner.wallet_address.slice(0, 6)}...${winner.wallet_address.slice(-4)}`
                    const timeAgo = getTimeAgo(new Date(winner.created_at))
                    
                    return (
                      <div
                        key={`${winner.wallet_address}-${winner.created_at}`}
                        style={{
                          padding: '10px',
                          background: 'rgba(139, 92, 246, 0.08)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: index < 3 
                            ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                            : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          color: 'white',
                          fontSize: '12px',
                          flexShrink: 0
                        }}>
                          {index < 3 ? '🏆' : `#${index + 1}`}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#cbd5e1',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginBottom: '3px',
                            fontFamily: 'ui-monospace, monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {shortAddress}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#10b981',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginBottom: '2px'
                          }}>
                            <Zap size={10} />
                            <span>+{Number(winner.xp_earned || 0).toLocaleString()} XP</span>
                          </div>
                          <div style={{
                            color: '#64748b',
                            fontSize: '10px'
                          }}>
                            {timeAgo}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#64748b',
                  fontSize: '12px'
                }}>
                  <Trophy size={24} color="#64748b" style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <div style={{ fontWeight: '600', marginBottom: '4px', color: '#94a3b8' }}>
                    No winners yet
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    Be the first to spin!
                  </div>
                </div>
              )}
            </div>
          )}

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
