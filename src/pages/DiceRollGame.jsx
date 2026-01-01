import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Dice6, Send, Star, CheckCircle, ExternalLink, Coins, TrendingUp, TrendingDown } from 'lucide-react'
import Dice3D from '../components/Dice3D'
import Confetti from '../components/Confetti'
import soundManager from '../utils/soundEffects'

const DiceRollGame = () => {
  const { isConnected, address } = useAccount()
  const { sendDiceRollTransaction, isLoading, error } = useTransactions()
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
  const [isRolling, setIsRolling] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [xpPopup, setXpPopup] = useState(null)
  const rollSoundIntervalRef = useRef(null)

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (rollSoundIntervalRef.current) {
        soundManager.stopDiceRollLoop(rollSoundIntervalRef.current)
      }
    }
  }, [])

  const playDiceRoll = async () => {
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
      console.log('🎯 Starting dice roll transaction, waiting for blockchain confirmation...')
      
      // Start rolling animation when transaction is confirmed
      setIsRolling(true)
      
      // Start dice roll sound loop
      rollSoundIntervalRef.current = soundManager.startDiceRollLoop()
      
      // This will wait for transaction confirmation before returning
      const result = await sendDiceRollTransaction(selectedNumber)
      
      console.log('✅ Dice roll transaction confirmed! Result:', result)
      
      // Stop rolling sound
      if (rollSoundIntervalRef.current) {
        soundManager.stopDiceRollLoop(rollSoundIntervalRef.current)
        rollSoundIntervalRef.current = null
      }
      
      // Transition to revealing phase
      setIsRolling(false)
      setIsRevealing(true)
      
      // Play result reveal sound
      soundManager.playDiceReveal()
      
      // Set result after a brief delay for smooth transition
      setTimeout(() => {
        setLastTransaction(result)
        setLastPlayed(new Date())
        
        // Set game result from transaction
        const newGameResult = {
          dice1: result.dice1,
          dice2: result.dice2,
          diceTotal: result.diceTotal,
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
      console.error('❌ Dice roll failed (transaction cancelled or failed):', error)
      
      // Stop rolling sound on error
      if (rollSoundIntervalRef.current) {
        soundManager.stopDiceRollLoop(rollSoundIntervalRef.current)
        rollSoundIntervalRef.current = null
      }
      
      // Reset animation states
      setIsRolling(false)
      setIsRevealing(false)
      setShowResult(false)
    }
  }

  const handleNumberSelect = (number) => {
    setSelectedNumber(number)
    soundManager.playDiceSelect()
  }

  const handleRollComplete = () => {
    setIsRevealing(false)
  }

  // Quest progress now handled by useQuestSystem hook

  if (!isConnected) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Dice6 size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#e5e7eb'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ color: '#9ca3af' }}>
            Please connect your wallet to start playing the dice roll game
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <EmbedMeta 
        title="Dice Roll Game - BaseHub"
        description="Roll two dice and win XP! 1/36 chance to win 1500 bonus XP. Play now on BaseHub!"
        buttonText="🎲 Play Dice Roll!"
        image="/image.svg"
      />
      
      <BackButton />
      
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div 
          className="game-icon"
          style={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            margin: '0 auto 16px'
          }}
        >
          <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          color: '#e5e7eb'
        }}>
          Dice Roll Game
        </h1>
        <p style={{ 
          color: '#9ca3af',
          fontSize: '16px'
        }}>
          Roll the dice and guess the result to earn XP!
        </p>
      </div>

      {/* Confetti Effect */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* 3D Dice Animation */}
      {(isRolling || isRevealing || showResult) && (
        <Dice3D
          isRolling={isRolling}
          isRevealing={isRevealing}
          dice1={gameResult?.dice1}
          dice2={gameResult?.dice2}
          onRollComplete={handleRollComplete}
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
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
          <CheckCircle size={20} style={{ color: '#f59e0b' }} />
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
          
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '16px',
          color: '#e5e7eb'
        }}>
          Choose your dice number (1-6):
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[1, 2, 3, 4, 5, 6].map((number) => (
            <button
              key={number}
              onClick={() => handleNumberSelect(number)}
              disabled={isRolling || isRevealing}
              className={`btn ${selectedNumber === number ? 'btn-primary' : ''}`}
              style={{ 
                padding: '20px',
                fontSize: '28px',
                fontWeight: 'bold',
                background: selectedNumber === number 
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                  : 'rgba(30, 41, 59, 0.8)',
                color: selectedNumber === number ? 'white' : '#e5e7eb',
                border: selectedNumber === number 
                  ? 'none' 
                  : '2px solid rgba(245, 158, 11, 0.3)',
                transition: 'all 0.3s ease',
                transform: selectedNumber === number ? 'scale(1.1)' : 'scale(1)',
                boxShadow: selectedNumber === number 
                  ? '0 4px 15px rgba(245, 158, 11, 0.4)' 
                  : 'none',
                cursor: (isRolling || isRevealing) ? 'not-allowed' : 'pointer',
                opacity: (isRolling || isRevealing) ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isRolling && !isRevealing && selectedNumber !== number) {
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
          onClick={playDiceRoll}
          disabled={isLoading || isRolling || isRevealing}
          className="btn btn-primary"
          style={{ 
            width: '100%',
            background: (isLoading || isRolling || isRevealing) 
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            transition: 'all 0.3s ease',
            transform: (isLoading || isRolling || isRevealing) ? 'none' : 'scale(1)',
            boxShadow: (isLoading || isRolling || isRevealing) 
              ? 'none' 
              : '0 4px 15px rgba(245, 158, 11, 0.4)',
            cursor: (isLoading || isRolling || isRevealing) ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !isRolling && !isRevealing) {
              e.target.style.transform = 'scale(1.02)'
              e.target.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && !isRolling && !isRevealing) {
              e.target.style.transform = 'scale(1)'
              e.target.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.4)'
            }
          }}
        >
          {(isLoading || isRolling || isRevealing) ? (
            <>
              <div className="loading" />
              {isRolling ? 'Rolling Dice...' : isRevealing ? 'Revealing Result...' : 'Rolling Dice...'}
            </>
          ) : (
            <>
              <Send size={20} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              Roll Dice for {selectedNumber}
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
          title="Dice Roll Game"
          description="Roll two dice and win XP! 1/36 chance to win 1500 bonus XP. Play now on BaseHub!"
          gameType="dice"
        />
      </div>

      <div style={{ 
        marginTop: '32px',
        padding: '20px',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
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
          <li>Choose a number from 1 to 6 (dice faces)</li>
          <li>Earn 10 XP for playing, +1500 bonus XP for winning</li>
          <li>1 XP = 50 BHUP tokens (claim coming soon!)</li>
          <li>Your wallet address: {address?.slice(0, 6)}...{address?.slice(-4)}</li>
        </ul>
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
    </div>
  )
}

export default DiceRollGame