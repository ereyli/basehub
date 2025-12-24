import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import XPShareButton from '../components/XPShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Coins, RotateCcw, TrendingUp, TrendingDown, Star } from 'lucide-react'
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
          soundManager.playWinSound()
          setShowConfetti(true)
        } else {
          soundManager.playLoseSound()
        }
        
        // Show XP popup
        setXpPopup({
          amount: result.xpEarned || 10,
          isWin: result.isWin
        })
        
        // Hide XP popup after animation
        setTimeout(() => {
          setXpPopup(null)
        }, 3000)
      }, 500)
      
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
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Coins size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#e5e7eb'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ color: '#9ca3af' }}>
            Please connect your wallet to start playing the coin flip game
          </p>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="card">
      <EmbedMeta 
        title="Flip Game - BaseHub"
        description="Flip a coin and win XP! 50% chance to win 500 bonus XP. Play now on BaseHub!"
        buttonText="🪙 Play Flip Game!"
        image="/image.svg"
      />
      
      <BackButton />
      
      {/* Confetti Effect */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div 
          className="game-icon"
          style={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            margin: '0 auto 16px'
          }}
        >
          <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          color: '#e5e7eb'
        }}>
          Coin Flip Game
        </h1>
        <p style={{ 
          color: '#9ca3af',
          fontSize: '16px'
        }}>
          Bet on heads or tails and earn XP!
        </p>
      </div>

      {/* 3D Coin Animation */}
      {(isSpinning || isRevealing || showResult) && (
        <Coin3D
          isSpinning={isSpinning}
          isRevealing={isRevealing}
          result={result}
          size={140}
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

      {/* Result Display with Animations */}
      {showResult && lastTransaction && lastTransaction.result && (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '8px',
            justifyContent: 'center',
            padding: '24px',
            background: lastTransaction.isWin 
              ? 'rgba(16, 185, 129, 0.15)' 
              : 'rgba(239, 68, 68, 0.15)',
            border: lastTransaction.isWin 
              ? '2px solid rgba(16, 185, 129, 0.3)' 
              : '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            marginBottom: '24px',
            animation: lastTransaction.isWin ? 'winReveal 0.6s ease-out' : 'loseReveal 0.6s ease-out',
            boxShadow: lastTransaction.isWin
              ? '0 0 30px rgba(16, 185, 129, 0.3)'
              : '0 0 20px rgba(239, 68, 68, 0.2)'
          }}
        >
          {lastTransaction.isWin ? (
            <TrendingUp size={32} style={{ color: '#10b981', animation: 'bounce 0.6s ease-out' }} />
          ) : (
            <TrendingDown size={32} style={{ color: '#ef4444', animation: 'shake 0.6s ease-out' }} />
          )}
          <div 
            style={{ 
              fontWeight: 'bold',
              fontSize: '24px',
              color: lastTransaction.isWin ? '#10b981' : '#ef4444',
              animation: lastTransaction.isWin ? 'bounce 0.6s ease-out 0.2s both' : 'shake 0.6s ease-out 0.2s both'
            }}
          >
            {lastTransaction.isWin ? '🎉 YOU WIN!' : '😔 YOU LOST!'} 
          </div>
          <div style={{ fontSize: '16px', color: '#9ca3af', marginTop: '8px' }}>
            Your choice: <strong style={{ color: '#e5e7eb' }}>{lastTransaction.playerChoice}</strong> | 
            Result: <strong style={{ color: '#e5e7eb' }}>{lastTransaction.result}</strong>
          </div>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: lastTransaction.isWin ? '#10b981' : '#3b82f6',
            marginTop: '8px'
          }}>
            XP Earned: +{lastTransaction.xpEarned} XP
          </div>
        </div>
      )}

      {showResult && lastTransaction && (
        <div style={{ 
          marginTop: '12px',
          padding: '12px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Star size={16} style={{ color: '#3b82f6' }} />
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
            {lastTransaction.txHash || lastTransaction.hash || lastTransaction.transactionHash}
          </div>
          
          {/* XP Share Button */}
          <div style={{ 
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <XPShareButton 
              gameType="flip"
              xpEarned={lastTransaction.xpEarned || 10}
              totalXP={totalXP}
              transactionHash={lastTransaction.txHash || lastTransaction.hash || lastTransaction.transactionHash}
              gameResult={{
                won: lastTransaction.isWin,
                playerChoice: lastTransaction.playerChoice,
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
          Choose your side:
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
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                : 'rgba(30, 41, 59, 0.8)',
              color: selectedSide === 'heads' ? 'white' : '#e5e7eb',
              border: selectedSide === 'heads' 
                ? 'none' 
                : '2px solid rgba(245, 158, 11, 0.3)',
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
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                : 'rgba(30, 41, 59, 0.8)',
              color: selectedSide === 'tails' ? 'white' : '#e5e7eb',
              border: selectedSide === 'tails' 
                ? 'none' 
                : '2px solid rgba(245, 158, 11, 0.3)',
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
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            transition: 'all 0.3s ease',
            transform: (isLoading || isSpinning || isRevealing) ? 'none' : 'scale(1)',
            boxShadow: (isLoading || isSpinning || isRevealing) 
              ? 'none' 
              : '0 4px 15px rgba(245, 158, 11, 0.4)',
            cursor: (isLoading || isSpinning || isRevealing) ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !isSpinning && !isRevealing) {
              e.target.style.transform = 'scale(1.02)'
              e.target.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && !isSpinning && !isRevealing) {
              e.target.style.transform = 'scale(1)'
              e.target.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.4)'
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
          title="Flip Game"
          description="Flip a coin and win XP! 50% chance to win 500 bonus XP. Play now on BaseHub!"
          gameType="flip"
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
          <li>Choose heads or tails and flip the coin</li>
          <li>Earn 10 XP for playing, +500 bonus XP for winning</li>
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

export default FlipGame