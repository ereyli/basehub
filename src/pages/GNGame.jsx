import React, { useState } from 'react'
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
import { Moon, Send, Star, CheckCircle, ExternalLink, Coins } from 'lucide-react'

const GNGame = () => {
  const { isConnected, address } = useAccount()
  const { sendGNTransaction, isLoading, error } = useTransactions()
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
  const [message, setMessage] = useState('GN from BaseHub! 🌙')
  const [lastSent, setLastSent] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  const [lastTransaction, setLastTransaction] = useState(null)

  const sendGN = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      console.log('🎯 Starting GN transaction, waiting for blockchain confirmation...')
      
      // This will wait for transaction confirmation before returning
      const result = await sendGNTransaction(message)
      
      console.log('✅ GN transaction confirmed! Result:', result)
      
      // Use the actual result from the transaction (includes blockchain confirmation)
      setLastTransaction(result)
      setLastSent(new Date())
      
      // XP is already added by useTransactions hook after confirmation
      // No need to manually add XP here - it's handled securely in useTransactions
      
      // Quest progress is now updated in useTransactions hook
      
    } catch (error) {
      console.error('❌ GN transaction failed (transaction cancelled or failed):', error)
      // No XP given on failed transactions - this is secure!
    }
  }

  // Quest progress now handled by useQuestSystem hook

  if (!isConnected) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Moon size={48} style={{ color: '#3b82f6', marginBottom: '16px' }} />
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#1f2937'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ color: '#6b7280' }}>
            Please connect your wallet to start sending GN messages
          </p>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="card">
               <EmbedMeta 
                 title="GN Game - BaseHub"
                 description="Say GN and earn 10 XP! Always wins. Play now on BaseHub!"
                 buttonText="🌙 Say GN!"
                 image="/image.svg"
               />
        
        <BackButton />
      
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div 
          className="game-icon"
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            margin: '0 auto 16px'
          }}
        >
          <img src="/crypto-logos/basahub logo/GN.png" alt="GN Game" loading="lazy" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          color: '#1f2937'
        }}>
          GN Game
        </h1>
        <p style={{ 
          color: '#6b7280',
          fontSize: '16px'
        }}>
          Send a GN (Good Night) message and earn XP!
        </p>
      </div>

      {lastSent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={20} style={{ color: '#3b82f6' }} />
          <span style={{ color: '#6b7280', fontSize: '14px' }}>
            Last GN sent: {lastSent.toLocaleTimeString()}
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
              gameType="gn"
              xpEarned={10}
              totalXP={totalXP}
              transactionHash={lastTransaction.hash || lastTransaction.transactionHash}
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
          Your GN Message:
        </h3>
        
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your GN message..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              fontSize: '16px',
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#1f2937'
            }}
          />
        </div>

        <button
          onClick={sendGN}
          disabled={isLoading || !message.trim()}
          className="btn btn-primary"
          style={{ 
            width: '100%',
            background: isLoading || !message.trim() ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
          }}
        >
          {isLoading ? (
            <>
              <div className="loading" />
              Sending GN...
            </>
          ) : (
            <>
              <Send size={20} />
              Send GN Message
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
          title="GN Game"
          description="Say GN and earn 10 XP! Always wins. Play now on BaseHub!"
          gameType="gn"
        />
      </div>

      <div style={{ 
        marginTop: '32px',
        padding: '20px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
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
          <li>Send a GN message to the Base network</li>
          <li>Earn 10 XP for each GN message</li>
          <li>1 XP = 50 BHUP tokens (claim coming soon!)</li>
          <li>Your wallet address: {address?.slice(0, 6)}...{address?.slice(-4)}</li>
        </ul>
        </div>
      </div>
    </NetworkGuard>
  )
}

export default GNGame