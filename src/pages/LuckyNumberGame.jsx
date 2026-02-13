import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Target, Send, Star, CheckCircle, ExternalLink, Coins, TrendingUp, TrendingDown, Play } from 'lucide-react'
import NumberWheel from '../components/NumberWheel'
import Confetti from '../components/Confetti'
import soundManager from '../utils/soundEffects'

const LuckyNumberGame = () => {
  const { isConnected, address } = useAccount()
  const navigate = useNavigate()
  const { sendLuckyNumberTransaction, isLoading, error } = useTransactions()
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
  const [selectedNumber, setSelectedNumber] = useState(1)
  const [lastPlayed, setLastPlayed] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  
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
        soundManager.stopNumberSpinLoop(spinSoundIntervalRef.current)
      }
    }
  }, [])

  const playLuckyNumber = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    // Reset states
    setShowResult(false)
    setShowConfetti(false)
    setIsRevealing(false)
    setGameResult(null)
    setXpPopup(null)
    
    // Play button click sound
    soundManager.playClick()

    try {
      console.log('🎯 Starting lucky number transaction, waiting for blockchain confirmation...')
      
      // Start spinning animation when transaction is confirmed
      setIsSpinning(true)
      
      // Start number spin sound loop
      spinSoundIntervalRef.current = soundManager.startNumberSpinLoop()
      
      // This will wait for transaction confirmation before returning
      const result = await sendLuckyNumberTransaction(selectedNumber)
      
      console.log('✅ Lucky number transaction confirmed! Result:', result)
      
      // Stop spinning sound
      if (spinSoundIntervalRef.current) {
        soundManager.stopNumberSpinLoop(spinSoundIntervalRef.current)
        spinSoundIntervalRef.current = null
      }
      
      // Transition to revealing phase
      setIsSpinning(false)
      setIsRevealing(true)
      
      // Play result reveal sound
      soundManager.playNumberReveal()
      
      // Set result after a brief delay for smooth transition
      setTimeout(() => {
        setLastTransaction(result)
        setLastPlayed(new Date())
        
        // Set game result from transaction
        const newGameResult = {
          winningNumber: result.winningNumber,
          selectedNumber: result.playerGuess,
          won: result.isWin
        }
        setGameResult(newGameResult)
        setShowResult(true)
        
        // Play win/lose sound and show effects
        if (result.isWin) {
          setTimeout(() => {
            soundManager.playWinSound()
            setShowConfetti(true)
          }, 400)
        } else {
          setTimeout(() => {
            soundManager.playLoseSound()
          }, 400)
        }
        
        // Show XP popup
        setTimeout(() => {
          setXpPopup({
            amount: result.xpEarned || 10,
            isWin: result.isWin
          })
        }, 600)
        
        // Hide XP popup after animation
        setTimeout(() => {
          setXpPopup(null)
        }, 4000)
      }, 800)
      
    } catch (error) {
      console.error('❌ Lucky number game failed (transaction cancelled or failed):', error)
      
      // Stop spinning sound on error
      if (spinSoundIntervalRef.current) {
        soundManager.stopNumberSpinLoop(spinSoundIntervalRef.current)
        spinSoundIntervalRef.current = null
      }
      
      // Reset animation states
      setIsSpinning(false)
      setIsRevealing(false)
      setShowResult(false)
    }
  }

  const handleNumberSelect = (number) => {
    setSelectedNumber(number)
    soundManager.playNumberSelect()
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
          <div className="game-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', margin: '0 auto 16px' }}>
            <Target size={32} style={{ color: 'white' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 8, color: '#e5e7eb' }}>Connect wallet to play</h2>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>Connect your wallet to pick a number and earn XP.</p>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <EmbedMeta 
        title="Lucky Number - BaseHub"
        description="Pick a number 1-10 and win XP! 10% chance to win 1000 bonus XP. Play on BaseHub!"
        buttonText="🍀 Play Lucky Number!"
        image="/image.svg"
      />
      
      <BackButton />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div className="game-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', margin: 0, flexShrink: 0 }}>
          <img src="/crypto-logos/basahub logo/luckynumber.png" alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 12 }} />
        </div>
        <div>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.6rem)', fontWeight: 700, margin: 0, color: '#e5e7eb', letterSpacing: '-0.02em' }}>Lucky Number</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>Guess 1–10 · Win XP</p>
        </div>
      </div>

      {/* Confetti Effect */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Number Wheel Animation */}
      {(isSpinning || isRevealing || showResult) && (
        <NumberWheel
          isSpinning={isSpinning}
          isRevealing={isRevealing}
          winningNumber={gameResult?.winningNumber}
          selectedNumber={gameResult?.selectedNumber || selectedNumber}
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
            animation: 'xpPopup 4s ease-out forwards'
          }}
        >
          <div
            style={{
              background: xpPopup.isWin 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
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
      {showResult && gameResult && (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16,
          background: gameResult.won ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%)' : 'linear-gradient(135deg, rgba(51, 65, 85, 0.3) 0%, rgba(30, 41, 59, 0.4) 100%)',
          border: gameResult.won ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, marginBottom: 20
        }}>
          {gameResult.won ? <TrendingUp size={24} style={{ color: '#4ade80' }} /> : <TrendingDown size={24} style={{ color: '#94a3b8' }} />}
          <span style={{ fontWeight: 700, fontSize: 18, color: gameResult.won ? '#4ade80' : '#94a3b8' }}>
            {gameResult.won ? 'You win!' : 'Try again'}
          </span>
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>You picked {gameResult.selectedNumber}, result was {gameResult.winningNumber} · +{lastTransaction?.xpEarned || 150} XP</span>
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
          Choose your number (1–10)
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => (
            <button
              key={number}
              onClick={() => handleNumberSelect(number)}
              disabled={isSpinning || isRevealing}
              className={`btn ${selectedNumber === number ? 'btn-primary' : ''}`}
              style={{ 
                padding: '16px',
                fontSize: '20px',
                fontWeight: 'bold',
                background: selectedNumber === number 
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                  : 'rgba(30, 41, 59, 0.8)',
                color: selectedNumber === number ? 'white' : '#e5e7eb',
                border: selectedNumber === number ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                transition: 'all 0.3s ease',
                transform: selectedNumber === number ? 'scale(1.1)' : 'scale(1)',
                boxShadow: selectedNumber === number 
                  ? '0 4px 14px rgba(59, 130, 246, 0.35)' 
                  : 'none',
                cursor: (isSpinning || isRevealing) ? 'not-allowed' : 'pointer',
                opacity: (isSpinning || isRevealing) ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSpinning && !isRevealing && selectedNumber !== number) {
                  e.target.style.transform = 'scale(1.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedNumber !== number) {
                  e.target.style.transform = 'scale(1)'
                }
              }}
            >
              {number}
            </button>
          ))}
        </div>

        <button
          onClick={playLuckyNumber}
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
              {isSpinning ? 'Spinning Numbers...' : isRevealing ? 'Revealing Result...' : 'Guessing Number...'}
            </>
          ) : (
            <>
              <Send size={20} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              Guess Number {selectedNumber}
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
        <ShareButton title="Lucky Number - BaseHub" description="Pick a number 1-10 and win XP! Play on BaseHub!" gameType="lucky" />
      </div>

      <div style={{ padding: 16, background: 'rgba(15, 23, 42, 0.5)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How to play</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={12} style={{ color: '#fbbf24', flexShrink: 0 }} /> Pick a number from 1 to 10</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Play size={12} style={{ color: '#60a5fa', flexShrink: 0 }} /> 150 XP base, +1000 XP if you win</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={12} style={{ color: '#34d399', flexShrink: 0 }} /> 10% chance to match</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={12} style={{ color: '#94a3b8', flexShrink: 0 }} /> Pay small fee in ETH per play</li>
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

export default LuckyNumberGame