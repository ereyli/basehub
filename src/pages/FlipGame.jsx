import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
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

  if (!isConnected) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <BackButton />
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="game-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', margin: '0 auto 16px' }}>
            <Coins size={32} style={{ color: 'white' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 8, color: '#e5e7eb' }}>Connect wallet to play</h2>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>Connect your wallet to flip the coin and earn XP.</p>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <EmbedMeta 
        title="Coin Flip - BaseHub"
        description="Flip a coin and win XP! 50% chance to win 500 bonus XP. Play on BaseHub!"
        buttonText="🪙 Play Coin Flip!"
        image="/image.svg"
      />
      
      <BackButton />
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div className="game-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', margin: 0, flexShrink: 0 }}>
          <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 12 }} />
        </div>
        <div>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.6rem)', fontWeight: 700, margin: 0, color: '#e5e7eb', letterSpacing: '-0.02em' }}>Coin Flip</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>Heads or tails · Win XP</p>
        </div>
      </div>

      {/* 3D Coin Animation */}
      {(isSpinning || isRevealing || showResult) && (
        <Coin3D
          isSpinning={isSpinning}
          isRevealing={isRevealing}
          result={result}
          size={160}
          onSpinComplete={handleSpinComplete}
        />
      )}

      {/* XP Popup Animation */}
      {xpPopup && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10001,
            pointerEvents: 'none',
            animation: 'xpPopup 3s ease-out forwards'
          }}
        >
          <div
            style={{
              background: xpPopup.isWin 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              padding: '20px 40px',
              borderRadius: '16px',
              fontSize: '32px',
              fontWeight: 'bold',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Star size={32} />
            <span>+{xpPopup.amount} XP</span>
          </div>
        </div>
      )}

      {/* Result */}
      {showResult && lastTransaction && lastTransaction.result && (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16,
          background: lastTransaction.isWin ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%)' : 'linear-gradient(135deg, rgba(51, 65, 85, 0.3) 0%, rgba(30, 41, 59, 0.4) 100%)',
          border: lastTransaction.isWin ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, marginBottom: 20
        }}>
          {lastTransaction.isWin ? <TrendingUp size={24} style={{ color: '#4ade80' }} /> : <TrendingDown size={24} style={{ color: '#94a3b8' }} />}
          <span style={{ fontWeight: 700, fontSize: 18, color: lastTransaction.isWin ? '#4ade80' : '#94a3b8' }}>
            {lastTransaction.isWin ? 'You win!' : 'Try again'}
          </span>
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>{lastTransaction.playerChoice} → {lastTransaction.result} · +{lastTransaction.xpEarned} XP</span>
        </div>
      )}

      {lastTransaction?.txHash && (
        <div style={{ marginBottom: 16, padding: 12, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ExternalLink size={14} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Tx</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#cbd5e1', wordBreak: 'break-all' }}>
            {lastTransaction.txHash || lastTransaction.hash || lastTransaction.transactionHash}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24, padding: 20, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.5) 100%)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>
          Choose your side
        </h3>
        
        <div style={{ 
          display: 'flex', 
          gap: '12px',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => handleSideSelect('heads')}
            className={`btn ${selectedSide === 'heads' ? 'btn-primary' : ''}`}
            disabled={isSpinning || isRevealing}
            style={{ 
              flex: 1,
              background: selectedSide === 'heads' 
                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                : 'rgba(30, 41, 59, 0.8)',
              color: selectedSide === 'heads' ? 'white' : '#e5e7eb',
              border: selectedSide === 'heads' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
              transition: 'all 0.3s ease',
              transform: selectedSide === 'heads' ? 'scale(1.05)' : 'scale(1)',
              boxShadow: selectedSide === 'heads' 
                ? '0 4px 15px rgba(245, 158, 11, 0.4)' 
                : 'none',
              cursor: (isSpinning || isRevealing) ? 'not-allowed' : 'pointer',
              opacity: (isSpinning || isRevealing) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSpinning && !isRevealing && selectedSide !== 'heads') {
                e.target.style.transform = 'scale(1.02)'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSide !== 'heads') {
                e.target.style.transform = 'scale(1)'
              }
            }}
          >
            🪙 Heads
          </button>
          <button
            onClick={() => handleSideSelect('tails')}
            className={`btn ${selectedSide === 'tails' ? 'btn-primary' : ''}`}
            disabled={isSpinning || isRevealing}
            style={{ 
              flex: 1,
              background: selectedSide === 'tails' 
                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                : 'rgba(30, 41, 59, 0.8)',
              color: selectedSide === 'tails' ? 'white' : '#e5e7eb',
              border: selectedSide === 'tails' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
              transition: 'all 0.3s ease',
              transform: selectedSide === 'tails' ? 'scale(1.05)' : 'scale(1)',
              boxShadow: selectedSide === 'tails' 
                ? '0 4px 15px rgba(245, 158, 11, 0.4)' 
                : 'none',
              cursor: (isSpinning || isRevealing) ? 'not-allowed' : 'pointer',
              opacity: (isSpinning || isRevealing) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSpinning && !isRevealing && selectedSide !== 'tails') {
                e.target.style.transform = 'scale(1.02)'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSide !== 'tails') {
                e.target.style.transform = 'scale(1)'
              }
            }}
          >
            🪙 Tails
          </button>
        </div>

        <button
          onClick={flipCoin}
          disabled={isLoading || isSpinning || isRevealing}
          className="btn btn-primary"
          style={{ 
            width: '100%',
            background: (isLoading || isSpinning || isRevealing) 
              ? 'rgba(100, 116, 139, 0.5)' 
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            transition: 'all 0.3s ease',
            transform: (isLoading || isSpinning || isRevealing) ? 'none' : 'scale(1)',
            boxShadow: (isLoading || isSpinning || isRevealing) ? 'none' : '0 4px 14px rgba(59, 130, 246, 0.35)',
            cursor: (isLoading || isSpinning || isRevealing) ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !isSpinning && !isRevealing) {
              e.target.style.transform = 'scale(1.02)'
              e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && !isSpinning && !isRevealing) {
              e.target.style.transform = 'scale(1)'
              e.target.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.35)'
            }
          }}
        >
          {(isLoading || isSpinning || isRevealing) ? (
            <>
              <div className="loading" />
              {isSpinning ? 'Spinning Coin...' : isRevealing ? 'Revealing Result...' : 'Flipping Coin...'}
            </>
          ) : (
            <>
              <RotateCcw size={20} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              Flip Coin for {selectedSide}
            </>
          )}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10, color: '#f87171', fontSize: 14 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <ShareButton title="Coin Flip - BaseHub" description="Flip a coin and win XP! Play on BaseHub!" gameType="flip" />
      </div>

      <div style={{ padding: 16, background: 'rgba(15, 23, 42, 0.5)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How to play</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={12} style={{ color: '#fbbf24', flexShrink: 0 }} /> Pick heads or tails and flip</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Play size={12} style={{ color: '#60a5fa', flexShrink: 0 }} /> 150 XP base, +500 XP if you win</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={12} style={{ color: '#34d399', flexShrink: 0 }} /> 50% chance to win</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={12} style={{ color: '#94a3b8', flexShrink: 0 }} /> Pay small fee in ETH per flip</li>
          {address && <li style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>{address.slice(0, 6)}…{address.slice(-4)}</li>}
        </ul>
      </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes winReveal {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes loseReveal {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        @keyframes xpPopup {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
          }
          20% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          80% {
            transform: translate(-50%, -70%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -90%) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </NetworkGuard>
  )
}

export default FlipGame