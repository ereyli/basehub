import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import XPShareButton from '../components/XPShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Target, Send, Star, CheckCircle, ExternalLink, Coins, TrendingUp, TrendingDown } from 'lucide-react'
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
      <div className="card">
        <BackButton />
        
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Target size={48} style={{ color: '#8b5cf6', marginBottom: '16px' }} />
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#e5e7eb'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ color: '#9ca3af' }}>
            Please connect your wallet to start playing the lucky number game
          </p>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="card">
      <EmbedMeta 
        title="Lucky Number Game - BaseHub"
        description="Pick a number 1-10 and win XP! 10% chance to win 1000 bonus XP. Play now on BaseHub!"
        buttonText="🍀 Play Lucky Number!"
        image="/image.svg"
      />
      
      <BackButton />
      
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div 
          className="game-icon"
          style={{ 
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            margin: '0 auto 16px'
          }}
        >
          <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          color: '#e5e7eb'
        }}>
          Lucky Number Game
        </h1>
        <p style={{ 
          color: '#9ca3af',
          fontSize: '16px'
        }}>
          Guess a number from 1-10 and earn XP!
        </p>
      </div>

      {/* Confetti Effect */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Number Wheel Animation */}
      {(isSpinning || isRevealing || showResult) && gameResult && (
        <NumberWheel
          isSpinning={isSpinning}
          isRevealing={isRevealing}
          winningNumber={gameResult.winningNumber}
          selectedNumber={gameResult.selectedNumber}
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

      {/* Result Display with Animations */}

      {lastPlayed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <CheckCircle size={20} style={{ color: '#8b5cf6' }} />
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            Last played: {lastPlayed.toLocaleTimeString()}
          </span>
        </div>
      )}

      {lastTransaction && (
        <div style={{ 
          marginTop: '12px',
          padding: '12px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ExternalLink size={16} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#e5e7eb' }}>
              Transaction Hash:
            </span>
          </div>
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: '12px', 
            color: '#9ca3af',
            wordBreak: 'break-all'
          }}>
            {lastTransaction.hash || lastTransaction.transactionHash}
          </div>
          
          {/* XP Share Button */}
          <div style={{ 
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <XPShareButton 
              gameType="lucky"
              xpEarned={lastTransaction.xpEarned || 10}
              totalXP={totalXP}
              transactionHash={lastTransaction.hash || lastTransaction.transactionHash}
              gameResult={{
                won: lastTransaction.isWin,
                selectedNumber: lastTransaction.selectedNumber,
                result: lastTransaction.result
              }}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '16px',
          color: '#e5e7eb'
        }}>
          Choose your lucky number (1-10):
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
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
                  : 'rgba(30, 41, 59, 0.8)',
                color: selectedNumber === number ? 'white' : '#e5e7eb',
                border: selectedNumber === number 
                  ? 'none' 
                  : '2px solid rgba(139, 92, 246, 0.3)',
                transition: 'all 0.3s ease',
                transform: selectedNumber === number ? 'scale(1.1)' : 'scale(1)',
                boxShadow: selectedNumber === number 
                  ? '0 4px 15px rgba(139, 92, 246, 0.4)' 
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
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            transition: 'all 0.3s ease',
            transform: (isLoading || isSpinning || isRevealing) ? 'none' : 'scale(1)',
            boxShadow: (isLoading || isSpinning || isRevealing) 
              ? 'none' 
              : '0 4px 15px rgba(139, 92, 246, 0.4)',
            cursor: (isLoading || isSpinning || isRevealing) ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !isSpinning && !isRevealing) {
              e.target.style.transform = 'scale(1.02)'
              e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && !isSpinning && !isRevealing) {
              e.target.style.transform = 'scale(1)'
              e.target.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.4)'
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
          <div style={{ 
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ 
        marginTop: '24px',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <ShareButton 
          title="Lucky Number Game"
          description="Pick a number 1-10 and win XP! 10% chance to win 1000 bonus XP. Play now on BaseHub!"
          gameType="lucky"
        />
      </div>

      <div style={{ 
        marginTop: '32px',
        padding: '20px',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '12px'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 'bold', 
          marginBottom: '12px',
          color: '#e5e7eb'
        }}>
          How to Play:
        </h3>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          margin: 0,
          color: '#9ca3af',
          fontSize: '14px',
          lineHeight: '1.6',
          paddingLeft: '20px'
        }}>
          <li>Choose a number from 1 to 10</li>
          <li>Earn 10 XP for playing, +1000 bonus XP for winning</li>
          <li>1 XP = 50 BHUP tokens (claim coming soon!)</li>
          <li>Your wallet address: {address?.slice(0, 6)}...{address?.slice(-4)}</li>
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