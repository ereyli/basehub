import React, { useState, useEffect } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { NETWORKS, getContractAddressByNetwork } from '../config/networks'
import { formatEther } from 'viem'
import { Coins, Play, Star, CheckCircle, ExternalLink, TrendingUp, Zap, Gift } from 'lucide-react'

const SLOT_GAME_ABI = [
  {
    name: 'getPlayerStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'credits', type: 'uint256' },
      { name: 'spinCount', type: 'uint256' },
      { name: 'totalWins', type: 'uint256' }
    ]
  },
  { name: 'CREDIT_PRICE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
]

const SlotGame = () => {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { sendSlotTransaction, isLoading, error } = useTransactions()
  const { calculateTokens } = useSupabase()

  const slotGameAddress = getContractAddressByNetwork('SLOT_GAME', chainId)
  const { data: playerStats, refetch: refetchCredits } = useReadContract({
    address: slotGameAddress || undefined,
    abi: SLOT_GAME_ABI,
    functionName: 'getPlayerStats',
    args: address ? [address] : undefined
  })
  const { data: creditPriceWei } = useReadContract({
    address: slotGameAddress || undefined,
    abi: SLOT_GAME_ABI,
    functionName: 'CREDIT_PRICE'
  })

  // Sync credits from contract (single source of truth)
  useEffect(() => {
    if (!address) {
      setCredits(0)
      return
    }
    if (playerStats != null && Array.isArray(playerStats) && playerStats[0] !== undefined) {
      setCredits(Number(playerStats[0]))
    }
  }, [address, playerStats])

  // Credit price from contract so UI always matches chain
  const creditPrice = creditPriceWei != null ? formatEther(creditPriceWei) : '0.00002'
  
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

      // Only update credits when tx really succeeded. If user cancelled, result is null.
      if (!result) {
        setLastResult(null)
        return
      }

      console.log('✅ Credits purchased!', result)
      setCredits(prev => prev + (result.creditsPurchased ?? amount))
      if (refetchCredits) refetchCredits()

      setLastResult({
        symbols: [0, 1, 2, 3],
        won: false,
        xpEarned: 0,
        message: `✅ Successfully purchased ${amount} credits!`
      })
      setTimeout(() => setLastResult(null), 2000)
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
        if (refetchCredits) refetchCredits()
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
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <BackButton />
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="game-icon" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', margin: '0 auto 16px' }}>
            <Gift size={32} style={{ color: 'white' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 8, color: '#e5e7eb' }}>
            Connect wallet to play
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>
            Connect your wallet to buy credits and spin the reels.
          </p>
        </div>
      </div>
    )
  }

  const presetAmounts = [1, 5, 10, 20, 50, 100]

    return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <EmbedMeta 
        title="Crypto Slots - BaseHub"
        description="Spin the reels, match symbols, win XP. Play Crypto Slots on BaseHub!"
        buttonText="🎰 Play Crypto Slots!"
        image="/image.svg"
      />
      
      <BackButton />
      
      {/* Header: title + credits pill */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div 
            className="game-icon"
            style={{ 
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              margin: 0,
              flexShrink: 0
            }}
          >
            <Gift size={28} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ 
              fontSize: 'clamp(1.35rem, 4vw, 1.6rem)', 
              fontWeight: 700, 
              margin: 0,
              color: '#e5e7eb',
              letterSpacing: '-0.02em'
            }}>
              Crypto Slots
            </h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>
              Match symbols · Win XP
            </p>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          padding: '10px 16px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.15) 100%)',
          borderRadius: 9999,
          border: '1px solid rgba(245, 158, 11, 0.35)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
        }}>
          <Coins size={18} style={{ color: '#fbbf24' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fcd34d' }}>{credits}</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 2 }}>credits</span>
        </div>
      </div>

      {/* Slot reels */}
      <div className="slot-machine" style={{
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)',
          borderRadius: '16px 16px 0 0'
        }} />
        <div style={{
          textAlign: 'center', marginBottom: 20, color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase'
        }}>
          Reels
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
          padding: 20,
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)'
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
                    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.35) 0%, rgba(245, 158, 11, 0.3) 100%)' 
                    : isWinning 
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.25) 100%)'
                      : 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%)',
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'center',
                  minHeight: 88,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isJackpot ? '2px solid rgba(251, 191, 36, 0.6)' : isWinning ? '2px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: isWinning ? '0 0 20px rgba(34, 197, 94, 0.2)' : 'none',
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
                  color: '#cbd5e1',
                  fontFamily: 'system-ui, sans-serif',
                  letterSpacing: '0.05em'
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
              ? 'rgba(100, 116, 139, 0.5)' 
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            fontSize: 16,
            fontWeight: 600,
            padding: '14px 24px',
            border: 'none',
            borderRadius: 12,
            boxShadow: (isLoading || isSpinning || credits < 1) ? 'none' : '0 4px 14px rgba(59, 130, 246, 0.35)',
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
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: 16,
          background: lastResult.won 
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(51, 65, 85, 0.3) 0%, rgba(30, 41, 59, 0.4) 100%)',
          border: lastResult.won ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {lastResult.won && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.06), transparent)',
              animation: 'shimmer 1.5s linear infinite'
            }} />
          )}
          <span style={{ 
            fontSize: 18,
            fontWeight: 700,
            color: lastResult.won ? '#4ade80' : '#94a3b8',
            animation: lastResult.won ? 'bounce 0.6s ease-in-out' : 'none'
          }}>
            {lastResult.won ? 'WIN!' : 'Spin again'}
          </span>
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>
            {lastResult.message 
              ? lastResult.message
              : lastResult.won 
                ? (lastResult.xpEarned >= 2010 ? `JACKPOT! +${lastResult.xpEarned} XP` : `+${lastResult.xpEarned} XP`)
                : `+${lastResult.xpEarned} XP`
            }
          </span>
        </div>
      )}

      {/* Get credits */}
      <div style={{ 
        marginBottom: 24,
        padding: 20,
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.5) 100%)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Zap size={18} style={{ color: '#fbbf24' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>Get credits</h3>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{creditPrice} ETH each</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {presetAmounts.map((amount) => {
            const cost = (Number(creditPrice) * amount).toFixed(5)
            return (
              <button
                key={amount}
                onClick={() => purchaseCredits(amount)}
                disabled={isLoading}
                type="button"
                style={{ 
                  padding: '12px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#e5e7eb',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 10,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
                }}
                onMouseOver={(e) => { if (!isLoading) { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)' } }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)' }}
              >
                <span>{amount} credits</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{cost} ETH</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Custom amount"
            min={1}
            style={{
              flex: 1,
              padding: '12px 14px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 10,
              fontSize: 14,
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#e5e7eb',
              outline: 'none'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)' }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)' }}
          />
          <button
            type="button"
            onClick={() => {
              const amount = parseInt(customAmount, 10)
              if (amount > 0) { purchaseCredits(amount); setCustomAmount('') }
            }}
            disabled={isLoading || !customAmount || parseInt(customAmount, 10) <= 0}
            style={{ 
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              whiteSpace: 'nowrap',
              cursor: (isLoading || !customAmount) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !customAmount || parseInt(customAmount, 10) <= 0) ? 0.6 : 1
            }}
          >
            Buy
          </button>
        </div>
      </div>

      {lastTransaction?.txHash && (
        <div style={{ 
          marginBottom: 16,
          padding: 12,
          background: 'rgba(59, 130, 246, 0.08)',
          borderRadius: 10,
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ExternalLink size={14} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Tx</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#cbd5e1', wordBreak: 'break-all' }}>
            {lastTransaction.txHash || lastTransaction.hash || lastTransaction.transactionHash}
          </div>
        </div>
      )}

      {error && (
        <div style={{ 
          marginBottom: 16,
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 10,
          color: '#f87171',
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <ShareButton 
          title="Crypto Slots - BaseHub"
          description="Spin the reels, match symbols, win XP. Play on BaseHub!"
          gameType="slot"
        />
      </div>

      {/* How to Play - compact */}
      <div style={{ 
        padding: 16,
        background: 'rgba(15, 23, 42, 0.5)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          How to play
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={12} style={{ color: '#fbbf24', flexShrink: 0 }} /> Buy credits with ETH ({creditPrice} per credit)</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Play size={12} style={{ color: '#60a5fa', flexShrink: 0 }} /> 1 credit = 1 spin</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={12} style={{ color: '#34d399', flexShrink: 0 }} /> 2+ matching symbols = bonus XP</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={12} style={{ color: '#fbbf24', flexShrink: 0 }} /> 4 same = COMBO! +2000 XP</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={12} style={{ color: '#94a3b8', flexShrink: 0 }} /> 150 XP base per spin</li>
          {address && (
            <li style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>{address.slice(0, 6)}…{address.slice(-4)}</li>
          )}
        </ul>
      </div>
      
      {/* Modern Animations CSS */}
      <style>{`
        @keyframes buttonShimmer {
          0%, 100% { opacity: 0; transform: translateX(-100%); }
          50% { opacity: 1; }
          100% { transform: translateX(100%); }
        }
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
