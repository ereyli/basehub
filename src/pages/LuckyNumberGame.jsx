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

  const busy = isLoading || isSpinning || isRevealing

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px' }}>
        <BackButton />
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%)', borderRadius: 24, border: '1px solid rgba(139,92,246,0.15)' }}>
          <div style={{ fontSize: 72, marginBottom: 16, animation: 'bounceLucky 2s ease-in-out infinite' }}>🍀</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8, color: '#a78bfa', letterSpacing: '-0.02em' }}>LUCKY NUMBER</h2>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>Connect your wallet to play</p>
        </div>
        <style>{`@keyframes bounceLucky { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.1)} }`}</style>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px' }}>
      <EmbedMeta 
        title="Lucky Number - BaseHub"
        description="Pick a number 1-10 and win XP! 10% chance to win 1000 bonus XP. Play on BaseHub!"
        buttonText="Play Lucky Number!"
        image="/image.svg"
      />
      <BackButton />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 20px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.1) 100%)', borderRadius: 50, border: '1px solid rgba(139,92,246,0.2)', marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🍀</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>LUCKY NUMBER</span>
          <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 20 }}>10%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
            <Star size={12} style={{ color: '#fbbf24' }} />
            <span>150 XP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4ade80' }}>
            <TrendingUp size={12} />
            <span>+1000 Win</span>
          </div>
        </div>
      </div>

      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {(isSpinning || isRevealing || showResult) && (
        <NumberWheel isSpinning={isSpinning} isRevealing={isRevealing} winningNumber={gameResult?.winningNumber} selectedNumber={gameResult?.selectedNumber || selectedNumber} onSpinComplete={handleSpinComplete} />
      )}

      {/* XP Popup */}
      {xpPopup && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10001, pointerEvents: 'none', animation: 'xpFloat 3s ease-out forwards' }}>
          <div style={{
            background: xpPopup.isWin ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: 'white', padding: '16px 32px', borderRadius: 16, fontSize: 28, fontWeight: 800,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 10
          }}>
            <Star size={28} />
            <span>+{xpPopup.amount} XP</span>
          </div>
        </div>
      )}

      {/* Result Banner */}
      {showResult && gameResult && (
        <div style={{
          textAlign: 'center', padding: '16px 20px', marginBottom: 16, borderRadius: 16,
          background: gameResult.won ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))' : 'linear-gradient(135deg, rgba(100,116,139,0.12), rgba(51,65,85,0.1))',
          border: `1px solid ${gameResult.won ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
          animation: 'resultPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{gameResult.won ? '🎉' : '🍀'}</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: gameResult.won ? '#4ade80' : '#94a3b8', marginBottom: 4 }}>
            {gameResult.won ? 'LUCKY WIN!' : 'Try Again'}
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1' }}>
            You picked <span style={{ fontWeight: 700, color: '#a78bfa' }}>{gameResult.selectedNumber}</span>, result was <span style={{ fontWeight: 700, color: gameResult.won ? '#4ade80' : '#f59e0b' }}>{gameResult.winningNumber}</span> · <span style={{ color: '#fbbf24', fontWeight: 700 }}>+{lastTransaction?.xpEarned || 150} XP</span>
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

      {/* Number Selection */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', marginBottom: 10, textAlign: 'center' }}>Pick your lucky number</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => {
            const active = selectedNumber === number
            return (
              <button
                key={number}
                onClick={() => handleNumberSelect(number)}
                disabled={busy}
                style={{
                  position: 'relative', padding: '14px 4px', borderRadius: 14, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                  background: active ? 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(124,58,237,0.2))' : 'rgba(30,41,59,0.6)',
                  boxShadow: active ? '0 0 20px rgba(139,92,246,0.35), inset 0 0 12px rgba(139,92,246,0.08)' : '0 2px 6px rgba(0,0,0,0.2)',
                  outline: active ? '2px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                  opacity: busy ? 0.5 : 1
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: active ? '#c4b5fd' : '#e5e7eb', lineHeight: 1 }}>{number}</div>
                {active && <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />}
              </button>
            )
          })}
        </div>

        <button
          onClick={playLuckyNumber}
          disabled={busy}
          style={{
            width: '100%', padding: '18px 24px', borderRadius: 16, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
            background: busy ? 'rgba(100,116,139,0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)',
            color: 'white', fontWeight: 800, fontSize: 16, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: busy ? 'none' : '0 4px 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.1)',
            transition: 'all 0.3s ease'
          }}
        >
          {busy ? (
            <><div className="loading" />{isSpinning ? 'Spinning...' : isRevealing ? 'Revealing...' : 'Guessing...'}</>
          ) : (
            <><Target size={20} style={{ animation: 'pulseLucky 2s ease-in-out infinite' }} /> GUESS {selectedNumber}</>
          )}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#f87171', fontSize: 13 }}>{error}</div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <ShareButton title="Lucky Number - BaseHub" description="Pick a number 1-10 and win XP! Play on BaseHub!" gameType="lucky" />
      </div>

      <div style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.4)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>How to play</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '🍀', text: 'Pick 1–10' },
            { icon: '🎯', text: '10% chance' },
            { icon: '⚡', text: '150 XP base' },
            { icon: '🏆', text: '+1000 XP win' },
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
        @keyframes resultPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pulseLucky { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes bounceLucky { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.1)} }
      `}</style>
    </NetworkGuard>
  )
}

export default LuckyNumberGame