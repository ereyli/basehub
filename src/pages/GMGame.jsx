import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
// Quest system is now handled in useTransactions hook
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Sun, Send, Star, CheckCircle, ExternalLink, Coins } from 'lucide-react'

const GMGame = () => {
  const { isConnected, address } = useAccount()
  const { sendGMTransaction, isLoading, error } = useTransactions()
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
  const [message, setMessage] = useState('GM from BaseHub! 🎮')
  const [lastSent, setLastSent] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  const [lastTransaction, setLastTransaction] = useState(null)

  const sendGM = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      console.log('🎯 Starting GM transaction, waiting for blockchain confirmation...')
      
      // This will wait for transaction confirmation before returning
      const result = await sendGMTransaction(message)
      
      console.log('✅ GM transaction confirmed! Result:', result)
      
      // Use the actual result from the transaction (includes blockchain confirmation)
      setLastTransaction(result)
      setLastSent(new Date())
      
      // XP is already added by useTransactions hook after confirmation
      // No need to manually add XP here - it's handled securely in useTransactions
      
      // Quest progress is now updated in useTransactions hook
      
    } catch (error) {
      console.error('❌ GM transaction failed (transaction cancelled or failed):', error)
      // No XP given on failed transactions - this is secure!
    }
  }

  // Quest progress now handled by useQuestSystem hook

  if (!isConnected) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Sun size={64} style={{ 
            color: '#FBBF24', 
            marginBottom: '20px',
            filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.8))'
          }} />
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: '800', 
            marginBottom: '12px',
            color: '#F8FAFC',
            fontFamily: 'Orbitron, sans-serif',
            letterSpacing: '0.05em',
            textShadow: '0 0 15px rgba(139, 92, 246, 0.6)'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ 
            color: '#A78BFA',
            fontFamily: 'Exo 2, sans-serif',
            fontSize: '16px'
          }}>
            Please connect your wallet to start sending GM messages
          </p>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="card">
               <EmbedMeta 
                 title="GM Game - BaseHub"
                 description="Say GM and earn 10 XP! Always wins. Play now on BaseHub!"
                 buttonText="🎮 Say GM!"
                 image="/image.svg"
               />
        
        <BackButton />
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div 
          className="game-icon"
          style={{ 
            background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.5), 0 0 30px rgba(139, 92, 246, 0.4)',
            border: '1px solid rgba(139, 92, 246, 0.5)'
          }}
        >
          <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
        </div>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: '800', 
          marginBottom: '12px',
          color: '#F8FAFC',
          fontFamily: 'Orbitron, sans-serif',
          letterSpacing: '0.05em',
          textShadow: '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)',
          background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          GM Game
        </h1>
        <p style={{ 
          color: '#A78BFA',
          fontSize: '18px',
          fontFamily: 'Exo 2, sans-serif',
          fontWeight: '400'
        }}>
          Send a GM (Good Morning) message and earn XP! 🌅
        </p>
      </div>

      {lastSent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={20} style={{ color: '#10b981' }} />
          <span style={{ color: '#6b7280', fontSize: '14px' }}>
            Last GM sent: {lastSent.toLocaleTimeString()}
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
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ 
          fontSize: '20px', 
          fontWeight: '700', 
          marginBottom: '16px',
          color: '#F8FAFC',
          fontFamily: 'Orbitron, sans-serif',
          letterSpacing: '0.03em'
        }}>
          Your GM Message:
        </h3>
        
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your GM message..."
            style={{
              width: '100%',
              padding: '14px 18px',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '12px',
              fontSize: '16px',
              background: 'rgba(15, 15, 35, 0.8)',
              color: '#F8FAFC',
              fontFamily: 'Exo 2, sans-serif',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            }}
          />
        </div>

        <button
          onClick={sendGM}
          disabled={isLoading || !message.trim()}
          className="btn btn-primary"
          style={{ 
            width: '100%',
            background: isLoading || !message.trim() 
              ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' 
              : 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
            boxShadow: isLoading || !message.trim() 
              ? 'none' 
              : '0 8px 24px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
            border: isLoading || !message.trim() 
              ? '1px solid rgba(107, 114, 128, 0.3)' 
              : '1px solid rgba(139, 92, 246, 0.4)',
            fontFamily: 'Exo 2, sans-serif',
            fontWeight: '600'
          }}
        >
          {isLoading ? (
            <>
              <div className="loading" />
              Sending GM...
            </>
          ) : (
            <>
              <Send size={20} />
              Send GM Message
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
          title="GM Game"
          description="Say GM and earn 10 XP! Always wins. Play now on BaseHub!"
          gameType="gm"
        />
      </div>

      <div style={{ 
        marginTop: '32px',
        padding: '20px',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
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
          <li>Send a GM message to the Base network</li>
          <li>Earn 10 XP for each GM message</li>
          <li>1 XP = 50 BHUP tokens (claim coming soon!)</li>
          <li>Your wallet address: {address?.slice(0, 6)}...{address?.slice(-4)}</li>
        </ul>
        </div>
      </div>
    </NetworkGuard>
  )
}

export default GMGame