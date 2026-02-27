import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import GamingShortcuts from '../components/GamingShortcuts'
import ShareButton from '../components/ShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Coins, RotateCcw, TrendingUp, TrendingDown, Star, Play, CheckCircle, ExternalLink } from 'lucide-react'
import Coin3D from '../components/Coin3D'
import Confetti from '../components/Confetti'
import soundManager from '../utils/soundEffects'

const FlipGame = () => {
  const { isConnected, address } = useAccount()
  const { sendFlipTransaction, isLoading, error } = useTransactions()
  const { calculateTokens } = useSupabase()
  // Quest progress is now handled in useTransactions hook
  
  // Safely get Farcaster context - only if not in web environment
  let isInFarcaster = false
  if (!shouldUseRainbowKit()) {
    try {
      const { useFarcaster } = require('../contexts/FarcasterContext')
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      // If FarcasterProvider is not available, default to false
      isInFarcaster = false
    }
  }
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640)
  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  const [selectedSide, setSelectedSide] = useState('heads')
  const [result, setResult] = useState(null)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  
  // Animation states
  const [isSpinning, setIsSpinning] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [xpPopup, setXpPopup] = useState(null)
  const spinSoundIntervalRef = useRef(null)

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (spinSoundIntervalRef.current) {
        soundManager.stopCoinSpinLoop(spinSoundIntervalRef.current)
      }
    }
  }, [])

  const flipCoin = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    // Reset states
    setShowResult(false)
    setShowConfetti(false)
    setIsRevealing(false)
    setResult(null)
    setXpPopup(null)
    
    // Play button click sound
    soundManager.playClick()

    try {
      console.log('🎯 Starting flip transaction, waiting for blockchain confirmation...')
      
      // Start spinning animation when transaction is confirmed
      setIsSpinning(true)
      
      // Start coin spin sound loop
      spinSoundIntervalRef.current = soundManager.startCoinSpinLoop()
      
      // This will wait for transaction confirmation before returning
      const result = await sendFlipTransaction(selectedSide)
      
      console.log('✅ Flip transaction confirmed! Result:', result)
      
      // Stop spinning sound
      if (spinSoundIntervalRef.current) {
        soundManager.stopCoinSpinLoop(spinSoundIntervalRef.current)
        spinSoundIntervalRef.current = null
      }
      
      // Transition to revealing phase
      setIsSpinning(false)
      setIsRevealing(true)
      
      // Play result reveal sound
      soundManager.playResultReveal()
      
      // Set result after a brief delay for smooth transition
      setTimeout(() => {
        setLastTransaction(result)
        setResult(result.result)
        setShowResult(true)
        
        // Play win/lose sound and show effects
        if (result.isWin) {
          setTimeout(() => {
            soundManager.playWinSound()
            setShowConfetti(true)
          }, 300)
        } else {
          setTimeout(() => {
            soundManager.playLoseSound()
          }, 300)
        }
        
        // Show XP popup
        setTimeout(() => {
          setXpPopup({
            amount: result.xpEarned || 10,
            isWin: result.isWin
          })
        }, 500)
        
        // Hide XP popup after animation
        setTimeout(() => {
          setXpPopup(null)
        }, 4000)
      }, 800)
      
    } catch (error) {
      console.error('❌ Coin flip failed (transaction cancelled or failed):', error)
      
      // Stop spinning sound on error
      if (spinSoundIntervalRef.current) {
        soundManager.stopCoinSpinLoop(spinSoundIntervalRef.current)
        spinSoundIntervalRef.current = null
      }
      
      // Reset animation states
      setIsSpinning(false)
      setIsRevealing(false)
      setShowResult(false)
    }
  }

  const handleSideSelect = (side) => {
    setSelectedSide(side)
    soundManager.playClick()
  }

  const handleSpinComplete = () => {
    setIsRevealing(false)
  }

  // Quest progress now handled by useQuestSystem hook

  const busy = isLoading || isSpinning || isRevealing

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px' }}>
        <BackButton />
        <GamingShortcuts />
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 100%)', borderRadius: 24, border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 72, marginBottom: 16, animation: 'floatCoin 3s ease-in-out infinite' }}>🪙</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8, color: '#fbbf24', letterSpacing: '-0.02em' }}>COIN FLIP</h2>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 0 }}>Connect your wallet to play</p>
        </div>
        <style>{`@keyframes floatCoin { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(5deg)} }`}</style>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div style={{ maxWidth: isMobile ? 360 : 480, margin: '0 auto', padding: isMobile ? '0 8px' : '0 12px' }}>
      <EmbedMeta 
        title="Coin Flip - BaseHub"
        description="Flip a coin and win XP! 50% chance to win 500 bonus XP. Play on BaseHub!"
        buttonText="Play Coin Flip!"
        image="/image.svg"
      />
      <BackButton />
      <GamingShortcuts />
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 20px', background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%)', borderRadius: 50, border: '1px solid rgba(245,158,11,0.2)', marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🪙</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>COIN FLIP</span>
          <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 20 }}>50/50</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
            <Star size={12} style={{ color: '#fbbf24' }} />
            <span>150 XP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4ade80' }}>
            <TrendingUp size={12} />
            <span>+500 Win</span>
          </div>
        </div>
      </div>

      {/* 3D Coin Animation */}
      {(isSpinning || isRevealing || showResult) && (
        <Coin3D
          isSpinning={isSpinning}
          isRevealing={isRevealing}
          result={result}
          size={isMobile ? 100 : 160}
          onSpinComplete={handleSpinComplete}
        />
      )}

      {/* XP Popup */}
      {xpPopup && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10001, pointerEvents: 'none', animation: 'xpFloat 3s ease-out forwards' }}>
          <div style={{
            background: xpPopup.isWin ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white', padding: isMobile ? '10px 20px' : '16px 32px', borderRadius: 16, fontSize: isMobile ? 20 : 28, fontWeight: 800,
            boxShadow: xpPopup.isWin ? '0 8px 32px rgba(16,185,129,0.5)' : '0 8px 32px rgba(59,130,246,0.5)',
            display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(10px)'
          }}>
            <Star size={28} style={{ animation: 'spinStar 1s ease-out' }} />
            <span>+{xpPopup.amount} XP</span>
          </div>
        </div>
      )}

      {/* Result Banner */}
      {showResult && lastTransaction && lastTransaction.result && (
        <div style={{
          textAlign: 'center', padding: isMobile ? '10px 14px' : '16px 20px', marginBottom: isMobile ? 10 : 16, borderRadius: isMobile ? 12 : 16,
          background: lastTransaction.isWin
            ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))'
            : 'linear-gradient(135deg, rgba(100,116,139,0.12), rgba(51,65,85,0.1))',
          border: `1px solid ${lastTransaction.isWin ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
          animation: 'resultPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <div style={{ fontSize: isMobile ? 22 : 28, marginBottom: 4 }}>{lastTransaction.isWin ? '🎉' : '😔'}</div>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 16 : 20, color: lastTransaction.isWin ? '#4ade80' : '#94a3b8', marginBottom: 4 }}>
            {lastTransaction.isWin ? 'YOU WIN!' : 'Try Again'}
          </div>
          <div style={{ fontSize: isMobile ? 11 : 13, color: '#cbd5e1' }}>
            {lastTransaction.playerChoice} → {lastTransaction.result} · <span style={{ color: '#fbbf24', fontWeight: 700 }}>+{lastTransaction.xpEarned} XP</span>
          </div>
        </div>
      )}

      {lastTransaction?.txHash && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExternalLink size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lastTransaction.txHash || lastTransaction.hash || lastTransaction.transactionHash}
          </span>
        </div>
      )}

      {/* Side Selection Cards */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {['heads', 'tails'].map(side => {
            const active = selectedSide === side
            return (
              <button
                key={side}
                onClick={() => handleSideSelect(side)}
                disabled={busy}
                style={{
                  position: 'relative', overflow: 'hidden', padding: isMobile ? '16px 10px' : '24px 16px', borderRadius: isMobile ? 14 : 20, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                  background: active
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.15) 100%)'
                    : 'rgba(30,41,59,0.6)',
                  boxShadow: active ? '0 0 24px rgba(245,158,11,0.3), inset 0 0 20px rgba(245,158,11,0.05)' : '0 2px 8px rgba(0,0,0,0.2)',
                  outline: active ? '2px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: active ? 'scale(1.03)' : 'scale(1)',
                  opacity: busy ? 0.5 : 1
                }}
              >
                <div style={{ fontSize: isMobile ? 28 : 40, marginBottom: isMobile ? 4 : 8, transition: 'transform 0.3s ease', transform: active ? 'scale(1.15) rotate(-5deg)' : 'scale(1)' }}>
                  {side === 'heads' ? '🪙' : '⭐'}
                </div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 15, color: active ? '#fbbf24' : '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {side}
                </div>
                {active && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }} />}
              </button>
            )
          })}
        </div>

        {/* Flip Button */}
        <button
          onClick={flipCoin}
          disabled={busy}
          style={{
            width: '100%', padding: isMobile ? '14px 18px' : '18px 24px', borderRadius: isMobile ? 12 : 16, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
            background: busy ? 'rgba(100,116,139,0.3)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
            color: 'white', fontWeight: 800, fontSize: isMobile ? 14 : 16, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: busy ? 'none' : '0 4px 20px rgba(245,158,11,0.4), 0 0 40px rgba(245,158,11,0.1)',
            transition: 'all 0.3s ease',
            transform: busy ? 'none' : 'translateY(0)',
          }}
        >
          {busy ? (
            <>
              <div className="loading" />
              {isSpinning ? 'Spinning...' : isRevealing ? 'Revealing...' : 'Flipping...'}
            </>
          ) : (
            <>
              <RotateCcw size={20} style={{ animation: 'spinIcon 3s linear infinite' }} />
              FLIP {selectedSide.toUpperCase()}
            </>
          )}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <ShareButton title="Coin Flip - BaseHub" description="Flip a coin and win XP! Play on BaseHub!" gameType="flip" />
      </div>

      {/* How to Play */}
      <div style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.4)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>How to play</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '🪙', text: 'Pick a side' },
            { icon: '🎯', text: '50% chance' },
            { icon: '⚡', text: '150 XP base' },
            { icon: '🏆', text: '+500 XP win' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      </div>

      <style>{`
        @keyframes xpFloat {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          70% { transform: translate(-50%, -65%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -85%) scale(0.8); opacity: 0; }
        }
        @keyframes resultPop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spinIcon { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinStar { from { transform: rotate(0deg) scale(1); } to { transform: rotate(360deg) scale(1.2); } }
        @keyframes floatCoin { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(5deg)} }
      `}</style>
    </NetworkGuard>
  )
}

export default FlipGame