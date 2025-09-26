import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
import { useQuestSystem } from '../hooks/useQuestSystem'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import XPShareButton from '../components/XPShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Target, Send, Star, CheckCircle, ExternalLink, Coins, TrendingUp, TrendingDown } from 'lucide-react'

const LuckyNumberGame = () => {
  const { isConnected, address } = useAccount()
  const navigate = useNavigate()
  const { sendLuckyNumberTransaction, isLoading, error } = useTransactions()
  const { calculateTokens } = useSupabase()
  const { updateQuestProgress } = useQuestSystem()
  
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

  const playLuckyNumber = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      console.log('🎯 Starting lucky number transaction, waiting for blockchain confirmation...')
      
      // This will wait for transaction confirmation before returning
      const result = await sendLuckyNumberTransaction(selectedNumber)
      
      console.log('✅ Lucky number transaction confirmed! Result:', result)
      
      // Use the actual result from the transaction (includes blockchain confirmation)
      setLastTransaction(result)
      setLastPlayed(new Date())
      
      // Set game result from transaction
      setGameResult({
        winningNumber: result.winningNumber,
        selectedNumber: result.playerGuess,
        won: result.isWin
      })
      
      // XP is already added by useTransactions hook after confirmation
      // No need to manually add XP here - it's handled securely in useTransactions
      
      // Update quest progress
      await updateQuestProgress('luckyNumberUsed', 1)
      await updateQuestProgress('transactions', 1)
      
    } catch (error) {
      console.error('❌ Lucky number game failed (transaction cancelled or failed):', error)
      
      // No XP given on failed transactions - this is secure!
    }
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
            color: '#1f2937'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ color: '#6b7280' }}>
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
          <Target size={32} style={{ color: 'white' }} />
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          color: '#1f2937'
        }}>
          Lucky Number Game
        </h1>
        <p style={{ 
          color: '#6b7280',
          fontSize: '16px'
        }}>
          Guess a number from 1-10 and earn XP!
        </p>
      </div>

      {gameResult && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          justifyContent: 'center',
          padding: '12px',
          background: gameResult.won ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: gameResult.won ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          {gameResult.won ? (
            <TrendingUp size={20} style={{ color: '#10b981' }} />
          ) : (
            <TrendingDown size={20} style={{ color: '#ef4444' }} />
          )}
          <span style={{ 
            fontWeight: 'bold',
            color: gameResult.won ? '#10b981' : '#ef4444'
          }}>
            {gameResult.won ? 'You Won!' : 'You Lost!'} 
            Your number: {gameResult.selectedNumber}, Winning number: {gameResult.winningNumber}
          </span>
        </div>
      )}

      {lastPlayed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <CheckCircle size={20} style={{ color: '#8b5cf6' }} />
          <span style={{ color: '#6b7280', fontSize: '14px' }}>
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
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>
              Transaction Hash:
            </span>
          </div>
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: '12px', 
            color: '#6b7280',
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
          color: '#1f2937'
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
              onClick={() => setSelectedNumber(number)}
              className={`btn ${selectedNumber === number ? 'btn-primary' : ''}`}
              style={{ 
                padding: '12px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: selectedNumber === number 
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
                  : 'rgba(255, 255, 255, 0.8)',
                color: selectedNumber === number ? 'white' : '#1f2937',
                border: selectedNumber === number 
                  ? 'none' 
                  : '2px solid rgba(139, 92, 246, 0.3)'
              }}
            >
              {number}
            </button>
          ))}
        </div>

        <button
          onClick={playLuckyNumber}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ 
            width: '100%',
            background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
          }}
        >
          {isLoading ? (
            <>
              <div className="loading" />
              Guessing Number...
            </>
          ) : (
            <>
              <Send size={20} />
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
          color: '#1f2937'
        }}>
          How to Play:
        </h3>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          margin: 0,
          color: '#6b7280',
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
    </NetworkGuard>
  )
}

export default LuckyNumberGame