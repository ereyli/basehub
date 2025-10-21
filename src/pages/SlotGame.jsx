import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import XPShareButton from '../components/XPShareButton'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Coins, Play, Star, CheckCircle, ExternalLink, TrendingUp, Zap, Gift } from 'lucide-react'

const SlotGame = () => {
  const { isConnected, address } = useAccount()
  const { sendSlotTransaction, isLoading, error } = useTransactions()
  const { calculateTokens } = useSupabase()
  
  // Safely get Farcaster context - only if not in web environment
  let isInFarcaster = false
  if (!shouldUseRainbowKit()) {
    try {
      const { useFarcaster } = require('../contexts/FarcasterContext')
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      isInFarcaster = false
    }
  }

  // Game state
  const [credits, setCredits] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentSymbols, setCurrentSymbols] = useState(['ETH', 'BTC', 'USDC', 'USDT'])
  const [lastResult, setLastResult] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [purchaseAmount, setPurchaseAmount] = useState(10)
  const [customAmount, setCustomAmount] = useState('')

  // Symbol mapping - using crypto logos only
  const symbolMap = ['ETH', 'BTC', 'USDC', 'USDT']
  
  // Animation for spinning
  const [spinAnimation, setSpinAnimation] = useState(false)
  
  // Sound effects
  const playSound = (soundType) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      switch(soundType) {
        case 'spin':
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3)
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          oscillator.start()
          oscillator.stop(audioContext.currentTime + 0.3)
          break
        case 'win':
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime) // C5
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1) // E5
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2) // G5
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
          oscillator.start()
          oscillator.stop(audioContext.currentTime + 0.5)
          break
        case 'jackpot':
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime) // C5
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1) // E5
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2) // G5
          oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.3) // C6
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8)
          oscillator.start()
          oscillator.stop(audioContext.currentTime + 0.8)
          break
      }
    } catch (error) {
      console.log('Audio not supported:', error)
    }
  }

  // Purchase credits
  const purchaseCredits = async (amount) => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      console.log('💰 Purchasing credits...')
      
      // Show purchase message
      setLastResult({
        symbols: [0, 1, 2, 3],
        won: false,
        xpEarned: 0,
        message: `🔄 Purchasing ${amount} credits... Please wait for transaction confirmation.`
      })
      
      const result = await sendSlotTransaction('purchaseCredits', { amount })
      console.log('✅ Credits purchased!', result)
      setCredits(prev => prev + amount)
      
      // Show success message
      setLastResult({
        symbols: [0, 1, 2, 3],
        won: false,
        xpEarned: 0,
        message: `✅ Successfully purchased ${amount} credits!`
      })
      
      // Clear message after 2 seconds
      setTimeout(() => {
        setLastResult(null)
      }, 2000)
    } catch (error) {
      console.error('❌ Credit purchase failed:', error)
      alert(`Credit purchase failed: ${error.message}`)
      setLastResult(null)
    }
  }

  // Spin the slot
  const spinSlot = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    if (credits < 1) {
      alert('You need at least 1 credit to spin. Please purchase credits first.')
      return
    }

    try {
      setIsSpinning(true)
      setSpinAnimation(true)
      
      // Start spinning animation
      const spinInterval = setInterval(() => {
        setCurrentSymbols([
          symbolMap[Math.floor(Math.random() * symbolMap.length)],
          symbolMap[Math.floor(Math.random() * symbolMap.length)],
          symbolMap[Math.floor(Math.random() * symbolMap.length)],
          symbolMap[Math.floor(Math.random() * symbolMap.length)]
        ])
      }, 100)

      console.log('🎰 Spinning slot machine...')
      console.log('Current credits before spin:', credits)
      
      // Play spin sound
      playSound('spin')
      
      // Wait for transaction
      const result = await sendSlotTransaction('spinSlot')
      console.log('Slot spin result:', result)
      
      // Stop animation and show result
      clearInterval(spinInterval)
      setTimeout(() => {
        setSpinAnimation(false)
        setIsSpinning(false)
        
        // Set final symbols from result
        if (result.symbols) {
          console.log('🎰 Frontend symbols from result:', result.symbols)
          console.log('🎰 Mapped symbols:', result.symbols.map(id => symbolMap[id] || 'ETH'))
          setCurrentSymbols(result.symbols.map(id => symbolMap[id] || 'ETH'))
        }
        
        setLastResult({
          symbols: result.symbols || [0, 1, 2, 3],
          won: result.won,
          xpEarned: result.xpEarned
        })
        
        // Play win sound based on result
        if (result.won) {
          const maxCount = Math.max(...Object.values(
            (result.symbols || [0, 1, 2, 3]).reduce((acc, symbol) => {
              acc[symbol] = (acc[symbol] || 0) + 1
              return acc
            }, {})
          ))
          if (maxCount === 4) {
            playSound('jackpot')
          } else {
            playSound('win')
          }
        }
        
        setCredits(prev => prev - 1)
        setLastTransaction(result)
        
        console.log('✅ Slot spin completed!', result)
      }, 2000)
      
    } catch (error) {
      console.error('❌ Slot spin failed:', error)
      setIsSpinning(false)
      setSpinAnimation(false)
      
      if (error.message.includes('Insufficient credits')) {
        alert('You need at least 1 credit to spin. Please purchase credits first.')
      } else if (error.message.includes('Transaction does not have a transaction hash')) {
        alert('Transaction failed. Please check your credits and try again.')
      } else {
        alert(`Slot spin failed: ${error.message}`)
      }
    }
  }

  // Check for wins
  const checkWin = (symbols) => {
    const counts = {}
    symbols.forEach(symbol => {
      counts[symbol] = (counts[symbol] || 0) + 1
    })
    
    const maxCount = Math.max(...Object.values(counts))
    if (maxCount >= 2) {
      if (maxCount === 2) return { type: 'double', xp: 100 }
      if (maxCount === 3) return { type: 'triple', xp: 500 }
      if (maxCount === 4) return { type: 'combo', xp: 2000 }
    }
    return { type: 'none', xp: 10 }
  }

  if (!isConnected) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Coins size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#1f2937'
          }}>
            Connect Wallet to Play
          </h2>
          <p style={{ color: '#6b7280' }}>
            Please connect your wallet to start playing the slot machine
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <EmbedMeta 
        title="Slot Machine Game - BaseHub"
        description="Spin the slot machine and win XP! Match symbols to earn bonus XP. Play now on BaseHub!"
        buttonText="🎰 Play Slot Machine!"
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
          <Coins size={32} style={{ color: 'white' }} />
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          color: '#1f2937'
        }}>
          Crypto Slots
        </h1>
        <p style={{ 
          color: '#6b7280',
          fontSize: '16px'
        }}>
          Spin the reels and match symbols to win XP!
        </p>
      </div>

      {/* Credits Display */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '24px',
        padding: '16px',
        background: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(245, 158, 11, 0.2)'
      }}>
        <Coins size={20} style={{ color: '#f59e0b' }} />
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
          Credits: {credits}
        </span>
      </div>

      {/* Slot Machine Display */}
      <div className="slot-machine" style={{
        background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '24px',
        border: '2px solid #4a5568',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle accent line */}
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: '3px',
          background: 'linear-gradient(90deg, #4299e1, #63b3ed, #90cdf4)',
          borderRadius: '20px 20px 0 0'
        }}></div>
        {/* Slot Machine Title */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
          color: '#e2e8f0',
          fontSize: '24px',
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}>
          Slot Machine
        </div>
        
        {/* Slot Reels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '28px',
          padding: '24px',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          border: '1px solid #4a5568',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
        }}>
          {currentSymbols.map((symbol, index) => {
            // Check if this symbol is part of a winning combination
            let isWinning = false;
            let isJackpot = false;
            
            if (lastResult && lastResult.won && lastResult.symbols) {
              const currentSymbolId = lastResult.symbols[index];
              const symbolCount = lastResult.symbols.filter(s => s === currentSymbolId).length;
              
              if (symbolCount >= 2) {
                isWinning = true;
                if (symbolCount === 4) {
                  isJackpot = true;
                }
              }
            }
            
            return (
              <div
                key={index}
                className={`${isWinning ? 'winning-symbol' : ''} ${isJackpot ? 'jackpot' : ''}`}
                style={{
                  background: isJackpot 
                    ? 'linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)' 
                    : isWinning 
                      ? 'linear-gradient(135deg, #68d391 0%, #48bb78 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  minHeight: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isWinning ? '2px solid #68d391' : '2px solid #e2e8f0',
                  boxShadow: isWinning 
                    ? '0 4px 12px rgba(104, 211, 145, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transform: spinAnimation ? 'rotateY(360deg) scale(1.05)' : 'rotateY(0deg) scale(1)',
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
              {/* Glowing effect for spinning symbols */}
              {spinAnimation && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                  animation: 'shimmer 0.5s linear infinite'
                }}></div>
              )}
              {symbol === 'ETH' || symbol === 'BTC' || symbol === 'USDC' || symbol === 'USDT' ? (
                <img 
                  src={`/crypto-logos/${symbol === 'ETH' ? 'ethereum-eth-logo.png' : 
                                          symbol === 'BTC' ? 'bitcoin-btc-logo.png' :
                                          symbol === 'USDC' ? 'usd-coin-usdc-logo.png' :
                                          'tether-usdt-logo.png'}`}
                  alt={symbol}
                  style={{
                    width: '48px',
                    height: '48px',
                    filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
                    transition: 'transform 0.2s ease'
                  }}
                />
              ) : (
                <div style={{
                  fontSize: '40px',
                  fontWeight: '900',
                  lineHeight: '1',
                  textAlign: 'center',
                  filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
                  transition: 'transform 0.2s ease',
                  color: '#4a5568',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: '1px'
                }}>
                  {symbol}
                </div>
              )}
              </div>
            )
          })}
        </div>

        {/* Spin Button */}
        <button
          onClick={spinSlot}
          disabled={isLoading || isSpinning || credits < 1}
          className="btn btn-primary"
          style={{ 
            width: '100%',
            background: (isLoading || isSpinning || credits < 1) 
              ? '#718096' 
              : 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)',
            fontSize: '16px',
            fontWeight: '600',
            padding: '16px 24px',
            border: 'none',
            borderRadius: '12px',
            boxShadow: (isLoading || isSpinning || credits < 1) 
              ? '0 2px 4px rgba(0, 0, 0, 0.1)'
              : '0 4px 12px rgba(66, 153, 225, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            transform: (isLoading || isSpinning || credits < 1) ? 'none' : 'translateY(-1px)',
            transition: 'all 0.2s ease',
            cursor: (isLoading || isSpinning || credits < 1) ? 'not-allowed' : 'pointer'
          }}
        >
          {/* Button glow effect */}
          {!isLoading && !isSpinning && credits >= 1 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
              animation: 'buttonShimmer 2s infinite'
            }}></div>
          )}
          
          {isSpinning ? (
            <>
              <div className="loading" />
              SPINNING...
            </>
          ) : credits < 1 ? (
            <>
              NEED CREDITS TO SPIN
            </>
          ) : (
            <>
              SPIN TO WIN!
            </>
          )}
        </button>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          justifyContent: 'center',
          padding: '20px',
          background: lastResult.won 
            ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 193, 7, 0.2) 100%)'
            : 'linear-gradient(135deg, rgba(108, 117, 125, 0.2) 0%, rgba(73, 80, 87, 0.2) 100%)',
          border: lastResult.won ? '2px solid #ffd700' : '2px solid #6c757d',
          borderRadius: '15px',
          marginBottom: '24px',
          boxShadow: lastResult.won 
            ? '0 0 20px rgba(255, 215, 0, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.1)'
            : '0 0 10px rgba(108, 117, 125, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Winning sparkle effect */}
          {lastResult.won && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
              animation: 'shimmer 1s linear infinite'
            }}></div>
          )}
          
          <div style={{ 
            fontSize: '24px',
            animation: lastResult.won ? 'bounce 0.6s ease-in-out' : 'none',
            fontWeight: 'bold',
            color: lastResult.won ? '#ffd700' : '#6c757d'
          }}>
            {lastResult.won ? 'WIN!' : 'LOSE'}
          </div>
          
          <span style={{ 
            fontWeight: 'bold',
            fontSize: '18px',
            color: lastResult.won ? '#ffd700' : '#6c757d',
            textShadow: lastResult.won ? '0 0 10px rgba(255, 215, 0, 0.8)' : 'none'
          }}>
            {lastResult.message 
              ? lastResult.message
              : lastResult.won 
                ? (lastResult.xpEarned >= 2010 ? `JACKPOT! +${lastResult.xpEarned} XP` : `WIN! +${lastResult.xpEarned} XP`)
                : `Better luck next time! +${lastResult.xpEarned} XP`
            }
          </span>
        </div>
      )}

      {/* Purchase Credits Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '16px',
          color: '#1f2937',
          textAlign: 'center'
        }}>
          Purchase Credits (0.00005 ETH each)
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          {[1, 5, 10, 20, 50, 100].map((amount) => (
            <button
              key={amount}
              onClick={() => purchaseCredits(amount)}
              disabled={isLoading}
              className="btn"
              style={{ 
                padding: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#1f2937',
                border: '2px solid rgba(245, 158, 11, 0.3)'
              }}
            >
              {amount} Credits
            </button>
          ))}
        </div>
        
        {/* Custom Amount Input */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Custom amount"
            min="1"
            style={{
              flex: 1,
              padding: '12px',
              border: '2px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              background: 'white'
            }}
          />
          <button
            onClick={() => {
              const amount = parseInt(customAmount)
              if (amount > 0) {
                purchaseCredits(amount)
                setCustomAmount('')
              }
            }}
            disabled={isLoading || !customAmount || parseInt(customAmount) <= 0}
            className="btn"
            style={{ 
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 'bold',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#1f2937',
              border: '2px solid rgba(245, 158, 11, 0.3)',
              whiteSpace: 'nowrap'
            }}
          >
            Buy
          </button>
        </div>
      </div>

      {/* Transaction Info */}
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
              gameType="slot"
              xpEarned={lastTransaction.xpEarned || 5}
              totalXP={totalXP}
              transactionHash={lastTransaction.hash || lastTransaction.transactionHash}
              gameResult={{
                won: lastResult?.won,
                symbols: lastResult?.symbols
              }}
            />
          </div>
        </div>
      )}

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

      <div style={{ 
        marginTop: '24px',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <ShareButton 
          title="Slot Machine Game"
          description="Spin the slot machine and win XP! Match symbols to earn bonus XP. Play now on BaseHub!"
          gameType="slot"
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
          <li>• Purchase credits with ETH (0.00005 ETH per credit)</li>
          <li>• Spin costs 1 credit per play</li>
          <li>• Match 2+ symbols to win bonus XP</li>
          <li>• 4 matching symbols = COMBO! (2000 XP)</li>
          <li>• Always earn at least 10 XP per spin</li>
          <li>• Your wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</li>
        </ul>
      </div>
      
      {/* Modern Animations CSS */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
          60% { transform: translateY(-2px); }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(66, 153, 225, 0.3); }
          50% { box-shadow: 0 0 20px rgba(66, 153, 225, 0.6); }
        }
        
        /* Slot machine hover effects - DISABLED */
        .slot-machine:hover {
          transform: none;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        
        /* Winning animation */
        .winning-symbol {
          animation: bounce 0.6s ease-in-out;
        }
        
        /* Jackpot effect */
        .jackpot {
          animation: pulse 1s infinite;
        }
        
        /* Button hover effect */
        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(66, 153, 225, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  )
}

export default SlotGame
