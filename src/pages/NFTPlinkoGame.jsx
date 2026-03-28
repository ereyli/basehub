import React, { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { useNFTPlinko, PLINKO_SEGMENTS } from '../hooks/useNFTPlinko'
import { useSupabase } from '../hooks/useSupabase'
import NFTPlinkoBoard from '../components/NFTPlinkoBoard'
import Confetti from '../components/Confetti'
import {
  CircleDot,
  Trophy,
  Lock,
  Clock,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Coins,
  Ticket,
  Zap,
  TrendingUp,
  RotateCw,
} from 'lucide-react'

const NFTPlinkoGame = () => {
  const { address, isConnected } = useAccount()
  const { supabase } = useSupabase()
  const {
    isDropping,
    isPaying,
    targetSlot,
    resultSegmentId,
    resultXp,
    dropsRemaining,
    hasNFT,
    loading,
    error,
    nextResetTime,
    dailyLimit,
    startDrop,
    completeDrop,
  } = useNFTPlinko()

  const [showConfetti, setShowConfetti] = useState(false)
  const [timeUntilReset, setTimeUntilReset] = useState('')
  const [recentWinners, setRecentWinners] = useState([])
  const [loadingWinners, setLoadingWinners] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const updateSize = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 640)
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    if (!nextResetTime) return
    const updateTimer = () => {
      const timeLeft = nextResetTime.getTime() - Date.now()
      if (timeLeft <= 0) {
        setTimeUntilReset('Reset!')
        return
      }
      const h = Math.floor(timeLeft / (1000 * 60 * 60))
      const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((timeLeft % (1000 * 60)) / 1000)
      setTimeUntilReset(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    updateTimer()
    const id = setInterval(updateTimer, 1000)
    return () => clearInterval(id)
  }, [nextResetTime])

  useEffect(() => {
    if (resultSegmentId === 6) setShowConfetti(true)
  }, [resultSegmentId])

  const loadRecentWinners = useCallback(async () => {
    if (!supabase?.from) {
      setRecentWinners([])
      return
    }
    try {
      setLoadingWinners(true)
      const { data, error: err } = await supabase
        .from('nft_plinko_drops')
        .select('wallet_address, final_xp, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (err) {
        setRecentWinners([])
        return
      }
      setRecentWinners(
        (data || []).map((t) => ({
          wallet_address: t.wallet_address || '',
          xp_earned: t.final_xp || 0,
          created_at: t.created_at,
        }))
      )
    } catch (_) {
      setRecentWinners([])
    } finally {
      setLoadingWinners(false)
    }
  }, [supabase])

  useEffect(() => {
    loadRecentWinners()
  }, [loadRecentWinners])

  const handleDropComplete = async () => {
    await completeDrop()
    setTimeout(() => {
      loadRecentWinners()
      setShowConfetti(false)
    }, 500)
  }

  const winningSegment = resultSegmentId != null ? PLINKO_SEGMENTS.find((s) => s.id === resultSegmentId) : null

  const getTimeAgo = (date) => {
    const diff = Date.now() - date.getTime()
    const sec = Math.floor(diff / 1000)
    const min = Math.floor(sec / 60)
    const hr = Math.floor(min / 60)
    const d = Math.floor(hr / 24)
    if (d > 0) return `${d}d ago`
    if (hr > 0) return `${hr}h ago`
    if (min > 0) return `${min}m ago`
    return 'Just now'
  }

  const accent = '#22d3ee'
  const accent2 = '#06b6d4'

  const WinnersPanel = ({ compact }) => (
    <div
      style={{
        width: compact ? '100%' : 280,
        padding: 16,
        background: compact ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.15)',
        backdropFilter: 'blur(10px)',
        borderRadius: 16,
        border: `1px solid rgba(34, 211, 238, 0.2)`,
        maxHeight: compact ? 'none' : 'calc(100vh - 140px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <TrendingUp size={20} color={accent} />
        <h3 style={{ color: '#cbd5e1', fontSize: 16, fontWeight: 600, margin: 0 }}>Live drops</h3>
      </div>
      {loadingWinners ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 14 }}>Loading...</div>
      ) : recentWinners.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentWinners.map((w, index) => {
            const short = `${w.wallet_address.slice(0, 6)}...${w.wallet_address.slice(-4)}`
            return (
              <div
                key={`${w.wallet_address}-${w.created_at}`}
                style={{
                  padding: 10,
                  background: 'rgba(34, 211, 238, 0.06)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background:
                      index < 3
                        ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                        : `linear-gradient(135deg, ${accent2}, #0891b2)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: 'white',
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {index < 3 ? '🏆' : `#${index + 1}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: '#cbd5e1',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'ui-monospace, monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {short}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12, fontWeight: 600 }}>
                    <Zap size={10} />+{Number(w.xp_earned || 0).toLocaleString()} XP
                  </div>
                  <div style={{ color: '#64748b', fontSize: 10 }}>{getTimeAgo(new Date(w.created_at))}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b', fontSize: 13 }}>
          <Trophy size={32} color="#64748b" style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#94a3b8' }}>No drops yet</div>
          <div style={{ fontSize: 11 }}>Be the first to score!</div>
        </div>
      )}
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 35%, #0f172a 100%)',
        padding: isMobile ? 14 : 20,
        paddingTop: isMobile ? 70 : 100,
        paddingBottom: isMobile ? 80 : 120,
      }}
    >
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: '#94a3b8',
          textDecoration: 'none',
          marginBottom: 20,
          fontSize: 16,
          fontWeight: 500,
        }}
      >
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </Link>

      <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 40 }}>
        <h1
          style={{
            fontSize: isMobile ? 26 : 40,
            fontWeight: 800,
            color: '#f1f5f9',
            margin: '0 0 8px 0',
            letterSpacing: '-0.5px',
          }}
        >
          NFT Plinko
        </h1>
        <p style={{ color: '#94a3af', fontSize: isMobile ? 13 : 16, margin: 0, fontWeight: 500 }}>
          Drop the ball — same XP odds as the Wheel · Each drop is paid via{' '}
          <strong style={{ color: '#67e8f9' }}>x402</strong> (USDC on Base) · {dailyLimit}/day
        </p>
      </div>

      {!isConnected ? (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(8, 145, 178, 0.1) 100%)',
            borderRadius: 20,
            border: `2px solid rgba(34, 211, 238, 0.3)`,
            marginBottom: 40,
          }}
        >
          <Lock size={48} color={accent} style={{ marginBottom: 16 }} />
          <h2 style={{ color: '#cbd5e1', marginBottom: 8 }}>Connect Your Wallet</h2>
          <p style={{ color: '#94a3b8' }}>Connect to play Plinko and earn XP.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
            {hasNFT && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 24px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 14,
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircleDot size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>
                    {dropsRemaining}/{dailyLimit}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Drops left today</div>
                </div>
              </div>
            )}
            {hasNFT && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 24px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 14,
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Clock size={18} color="white" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#f1f5f9',
                      lineHeight: 1,
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {timeUntilReset || '--:--:--'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Reset (UTC)</div>
                </div>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 24px',
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: 14,
                border: hasNFT ? '1px solid rgba(71, 85, 105, 0.4)' : '2px solid rgba(251, 191, 36, 0.4)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: hasNFT
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {hasNFT ? <CheckCircle size={18} color="white" /> : <Ticket size={18} color="white" />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: hasNFT ? '#10b981' : '#fbbf24', lineHeight: 1.2 }}>
                  {hasNFT ? 'Verified' : 'Not Found'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{hasNFT ? 'NFT Holder' : 'NFT Required'}</div>
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
                borderRadius: 12,
                border: '2px solid rgba(239, 68, 68, 0.3)',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#ef4444',
              }}
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {!isMobile && (
            <div style={{ position: 'fixed', top: 120, right: 24, zIndex: 10 }}>
              <WinnersPanel compact={false} />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: 'min(100%, 920px)',
              margin: '0 auto',
              padding: '0 8px',
              boxSizing: 'border-box',
            }}
          >
            <NFTPlinkoBoard
              targetSlot={targetSlot}
              isAnimating={isDropping && targetSlot != null}
              onAnimationEnd={handleDropComplete}
            />

            {winningSegment && resultSegmentId != null && !isDropping && (
              <div
                style={{
                  marginTop: 20,
                  padding: '16px 28px',
                  borderRadius: 16,
                  background: winningSegment.isJackpot
                    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15))'
                    : 'rgba(15, 23, 42, 0.7)',
                  border: winningSegment.isJackpot ? '2px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>You won</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9' }}>
                  +{Number(resultXp || winningSegment.xp).toLocaleString()} XP
                </div>
                <div style={{ fontSize: 13, color: accent, fontWeight: 600 }}>{winningSegment.label}</div>
              </div>
            )}

            {!hasNFT && (
              <div
                style={{
                  marginTop: 24,
                  marginBottom: 12,
                  padding: '16px 24px',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
                  borderRadius: 12,
                  border: '2px solid rgba(251, 191, 36, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Ticket size={24} style={{ color: '#fbbf24' }} />
                <span style={{ color: '#fbbf24', fontSize: 16, fontWeight: 600 }}>Early Access NFT required</span>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              {!hasNFT ? (
                <Link
                  to="/early-access"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '18px 48px',
                    fontSize: 20,
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: '#1e293b',
                    borderRadius: 16,
                    textDecoration: 'none',
                    boxShadow: '0 10px 30px rgba(251, 191, 36, 0.4)',
                  }}
                >
                  <Ticket size={24} />
                  <span>Mint Early Access NFT</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={startDrop}
                  disabled={isDropping || isPaying || dropsRemaining <= 0 || loading || resultSegmentId != null}
                  style={{
                    padding: '18px 40px',
                    fontSize: 19,
                    fontWeight: 'bold',
                    background:
                      isDropping || isPaying || dropsRemaining <= 0
                        ? 'linear-gradient(135deg, #475569 0%, #334155 100%)'
                        : `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)`,
                    color: 'white',
                    border: 'none',
                    borderRadius: 16,
                    cursor: isDropping || isPaying || dropsRemaining <= 0 ? 'not-allowed' : 'pointer',
                    boxShadow:
                      isDropping || isPaying || dropsRemaining <= 0 ? 'none' : '0 10px 30px rgba(34, 211, 238, 0.35)',
                    opacity: isDropping || isPaying || dropsRemaining <= 0 ? 0.65 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {isPaying ? (
                    <>
                      <RotateCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Confirming x402 payment…</span>
                    </>
                  ) : isDropping ? (
                    <>
                      <CircleDot size={24} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Dropping…</span>
                    </>
                  ) : dropsRemaining <= 0 ? (
                    <>
                      <Lock size={24} />
                      <span>Daily limit</span>
                    </>
                  ) : (
                    <>
                      <Coins size={24} />
                      <span>Pay via x402 &amp; Drop</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {isMobile && (
            <div style={{ marginTop: 32 }}>
              <WinnersPanel compact />
            </div>
          )}
        </>
      )}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default NFTPlinkoGame
