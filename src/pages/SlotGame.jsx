import React, { useState, useEffect } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { useSupabase } from '../hooks/useSupabase'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import GamingShortcuts from '../components/GamingShortcuts'
import ShareButton from '../components/ShareButton'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { NETWORKS, getContractAddressByNetwork } from '../config/networks'
import { formatEther } from 'viem'
import { Coins, Play, Star, CheckCircle, ExternalLink, TrendingUp, Zap, Gift, RotateCw } from 'lucide-react'
import soundManager from '../utils/soundEffects'

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

  useEffect(() => {
    if (!address) { setCredits(0); return }
    if (playerStats != null && Array.isArray(playerStats) && playerStats[0] !== undefined) {
      setCredits(Number(playerStats[0]))
    }
  }, [address, playerStats])

  const creditPrice = creditPriceWei != null ? formatEther(creditPriceWei) : '0.00002'
  
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

  const [credits, setCredits] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentSymbols, setCurrentSymbols] = useState(['ETH', 'BTC', 'USDC', 'USDT'])
  const [lastResult, setLastResult] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [purchaseAmount, setPurchaseAmount] = useState(10)
  const [customAmount, setCustomAmount] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 640)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const symbolMap = ['ETH', 'BTC', 'USDC', 'USDT']
  const [spinAnimation, setSpinAnimation] = useState(false)
  const [stoppedReels, setStoppedReels] = useState(4)
  
  const playSound = (soundType) => {
    try {
      soundManager.ensureAudioContext()
      switch(soundType) {
        case 'spin':
          soundManager.playSlotSpin()
          break
        case 'win':
        case 'jackpot':
          soundManager.playSlotWin()
          break
        case 'stop':
          soundManager.playSlotStop()
          break
        default:
          soundManager.playClick()
          break
      }
    } catch (error) { /* audio unsupported */ }
  }

  const purchaseCredits = async (amount) => {
    if (!isConnected) { alert('Please connect your wallet first'); return }
    try {
      setLastResult({ symbols: [0,1,2,3], won: false, xpEarned: 0, message: `Purchasing ${amount} credits...` })
      const result = await sendSlotTransaction('purchaseCredits', { amount })
      if (!result) { setLastResult(null); return }
      setCredits(prev => prev + (result.creditsPurchased ?? amount))
      if (refetchCredits) refetchCredits()
      setLastResult({ symbols: [0,1,2,3], won: false, xpEarned: 0, message: `+${amount} credits purchased!` })
      setTimeout(() => setLastResult(null), 2000)
    } catch (error) {
      console.error('Credit purchase failed:', error)
      alert(`Credit purchase failed: ${error.message}`)
      setLastResult(null)
    }
  }

  const spinSlot = async () => {
    if (!isConnected) { alert('Please connect your wallet first'); return }
    if (credits < 1) { alert('You need at least 1 credit to spin.'); return }
    try {
      soundManager.ensureAudioContext()
      setIsSpinning(true); setSpinAnimation(true)
      setStoppedReels(0)
      setLastResult(null)
      const spinInterval = setInterval(() => {
        setCurrentSymbols([
          symbolMap[Math.floor(Math.random() * symbolMap.length)],
          symbolMap[Math.floor(Math.random() * symbolMap.length)],
          symbolMap[Math.floor(Math.random() * symbolMap.length)],
          symbolMap[Math.floor(Math.random() * symbolMap.length)]
        ])
      }, 100)
      playSound('spin')
      await new Promise(resolve => requestAnimationFrame(resolve))
      const result = await sendSlotTransaction('spinSlot')
      clearInterval(spinInterval)
      const finalSymbols = (result.symbols || [0, 1, 2, 3]).map(id => symbolMap[id] || 'ETH')
      finalSymbols.forEach((_, reelIndex) => {
        setTimeout(() => {
          setCurrentSymbols(prev => prev.map((sym, idx) => {
            if (idx <= reelIndex) return finalSymbols[idx]
            return symbolMap[Math.floor(Math.random() * symbolMap.length)]
          }))
          setStoppedReels(reelIndex + 1)
          playSound('stop')
        }, 260 + reelIndex * 330)
      })

      setTimeout(() => {
        setSpinAnimation(false); setIsSpinning(false)
        setStoppedReels(4)
        setCurrentSymbols(finalSymbols)
        setLastResult({ symbols: result.symbols || [0,1,2,3], won: result.won, xpEarned: result.xpEarned })
        if (result.won) {
          const maxCount = Math.max(...Object.values(
            (result.symbols || [0,1,2,3]).reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc }, {})
          ))
          playSound(maxCount === 4 ? 'jackpot' : 'win')
        }
        setCredits(prev => prev - 1)
        setLastTransaction(result)
        if (refetchCredits) refetchCredits()
      }, 1750)
    } catch (error) {
      setIsSpinning(false); setSpinAnimation(false)
      setStoppedReels(4)
      if (error.message.includes('Insufficient credits')) alert('You need at least 1 credit to spin.')
      else alert(`Spin failed: ${error.message}`)
    }
  }

  const presetAmounts = [1, 5, 10, 20, 50, 100]
  const accent = '#3b82f6'
  const accentLight = '#60a5fa'
  const gold = '#f59e0b'
  const goldLight = '#fbbf24'

  const containerStyle = {
    minHeight: '100vh',
    background: '#0b1120',
    fontFamily: 'Poppins, system-ui, -apple-system, sans-serif',
    color: '#e2e8f0',
  }

  const innerStyle = {
    maxWidth: 520,
    margin: '0 auto',
    padding: isMobile ? '14px 12px 90px' : '28px 20px 60px',
    position: 'relative',
  }

  const cardBg = 'rgba(15, 23, 42, 0.6)'
  const cardBorder = '1px solid rgba(255, 255, 255, 0.04)'

  if (!isConnected) {
    return (
      <div style={containerStyle}>
        <div style={innerStyle}>
          <BackButton />
          <GamingShortcuts />
          <div style={{ background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.84))', border: '1px solid rgba(96, 165, 250, 0.12)', borderRadius: 20, padding: isMobile ? 18 : 26, textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 46px rgba(0,0,0,0.26)' }}>
            <div style={{ textAlign: 'center', marginBottom: 14, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#64748b' }}>
              Live reels preview
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: isMobile ? 8 : 12,
              padding: isMobile ? 14 : 20,
              background: 'linear-gradient(180deg, rgba(2,6,23,0.82), rgba(15,23,42,0.72))',
              borderRadius: 14,
              border: '1px solid rgba(148, 163, 184, 0.08)',
              marginBottom: 22,
              boxShadow: 'inset 0 12px 28px rgba(0,0,0,0.34), inset 0 -10px 24px rgba(96,165,250,0.06)',
              perspective: 900,
            }}>
              {currentSymbols.map((symbol, index) => (
                <div key={`${symbol}-${index}`} style={{
                  background: 'rgba(15, 23, 42, 0.58)',
                  borderRadius: 14,
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: `reelSpin3d ${0.32 + index * 0.04}s cubic-bezier(0.2, 0.8, 0.2, 1) infinite`
                }}>
                  <div style={{ position: 'absolute', inset: '8% 14%', borderRadius: 999, background: 'radial-gradient(ellipse, rgba(255,255,255,0.16), transparent 64%)', transform: 'translateY(-24%)', pointerEvents: 'none' }} />
                  <img
                    src={`/crypto-logos/${symbol === 'ETH' ? 'ethereum-eth-logo.png' : symbol === 'BTC' ? 'bitcoin-btc-logo.png' : symbol === 'USDC' ? 'usd-coin-usdc-logo.png' : 'tether-usdt-logo.png'}`}
                    alt={symbol}
                    style={{ width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))' }}
                  />
                </div>
              ))}
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Connect Wallet to Play</h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Connect your wallet to buy credits and spin the reels.</p>
          </div>
          <style>{`
            @keyframes reelSpin3d {
              0% { transform: translateY(-8px) rotateX(18deg) scale(0.94); filter: blur(0.2px); }
              50% { transform: translateY(8px) rotateX(-20deg) scale(1.03); filter: blur(1.2px); }
              100% { transform: translateY(-8px) rotateX(18deg) scale(0.94); filter: blur(0.2px); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <EmbedMeta title="Crypto Slots - BaseHub" description="Spin the reels, match symbols, win XP." buttonText="Play Crypto Slots!" image="/image2.jpeg" />

      {/* Top glow */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 500, height: 350, background: 'radial-gradient(ellipse, rgba(239, 68, 68, 0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ ...innerStyle, zIndex: 1 }}>
        <BackButton />
        <GamingShortcuts />

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: isMobile ? 20 : 28, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Gift size={24} color="#f87171" />
            </div>
            <div>
              <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 800, margin: 0, color: '#f1f5f9', letterSpacing: '-0.5px' }}>Crypto Slots</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem', fontWeight: 400 }}>Match symbols, win XP</p>
            </div>
          </div>
          {/* Credit pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            borderRadius: 99,
          }}>
            <Coins size={15} color={goldLight} />
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: goldLight, fontFamily: "'SF Mono', Menlo, monospace" }}>{credits}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>credits</span>
          </div>
        </div>

        {/* ── Slot Machine ── */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.92), rgba(2, 6, 23, 0.88))', border: '1px solid rgba(96, 165, 250, 0.18)', borderRadius: 18,
          padding: isMobile ? '20px 16px' : '28px 24px',
          marginBottom: 16, position: 'relative', overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -18px 42px rgba(2,6,23,0.48), 0 18px 46px rgba(0,0,0,0.26)'
        }}>
          {/* Top accent line */}
          <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, borderRadius: 2 }} />
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: spinAnimation ? goldLight : '#334155',
                boxShadow: spinAnimation ? `0 0 10px ${goldLight}` : 'none',
                opacity: spinAnimation ? 0.85 : 0.55,
              }} />
            ))}
          </div>

          {/* Reels label */}
          <div style={{ textAlign: 'center', marginBottom: 16, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569' }}>
            Reels
          </div>

          {/* Reel grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isMobile ? 8 : 12,
            padding: isMobile ? 14 : 20,
            background: 'linear-gradient(180deg, rgba(2,6,23,0.94), rgba(15,23,42,0.76))', borderRadius: 12,
            border: '1px solid rgba(148, 163, 184, 0.14)',
            marginBottom: 20,
            boxShadow: 'inset 0 12px 28px rgba(0,0,0,0.42), inset 0 -10px 24px rgba(96,165,250,0.08), 0 0 0 4px rgba(15,23,42,0.55)',
            perspective: 900,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.08) 38%, transparent 58%)', pointerEvents: 'none', zIndex: 2 }} />
            {currentSymbols.map((symbol, index) => {
              let isWinning = false, isJackpot = false
              if (lastResult?.won && lastResult.symbols) {
                const sid = lastResult.symbols[index]
                const cnt = lastResult.symbols.filter(s => s === sid).length
                if (cnt >= 2) isWinning = true
                if (cnt === 4) isJackpot = true
              }
              return (
                <div key={index} style={{
                  background: isJackpot
                    ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)'
                    : isWinning
                      ? 'linear-gradient(145deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.04) 100%)'
                      : 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 10,
                  aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: isJackpot ? `1px solid rgba(245, 158, 11, 0.3)` : isWinning ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(255, 255, 255, 0.04)',
                  boxShadow: isJackpot ? `0 0 20px rgba(245, 158, 11, 0.15)` : isWinning ? '0 0 16px rgba(34, 197, 94, 0.1)' : 'none',
                  transition: 'all 0.3s ease',
                  position: 'relative', overflow: 'hidden',
                  transformStyle: 'preserve-3d',
                  animation: (spinAnimation && index >= stoppedReels) ? `reelSpin3d ${0.28 + index * 0.04}s cubic-bezier(0.2, 0.8, 0.2, 1) infinite` : isJackpot ? 'jackpotPulse 1s ease-in-out infinite' : isWinning ? 'winBounce 0.5s ease-in-out' : 'none',
                  transform: spinAnimation && index < stoppedReels ? 'translateY(0) scale(1.02)' : undefined,
                  zIndex: 1,
                }}>
                  {spinAnimation && index >= stoppedReels && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 44%, rgba(59,130,246,0.08) 100%)', pointerEvents: 'none' }} />
                  )}
                  <div style={{ position: 'absolute', inset: '8% 14%', borderRadius: 999, background: 'radial-gradient(ellipse, rgba(255,255,255,0.16), transparent 64%)', transform: 'translateY(-24%)', pointerEvents: 'none' }} />
                  <img
                    src={`/crypto-logos/${symbol === 'ETH' ? 'ethereum-eth-logo.png' : symbol === 'BTC' ? 'bitcoin-btc-logo.png' : symbol === 'USDC' ? 'usd-coin-usdc-logo.png' : 'tether-usdt-logo.png'}`}
                    alt={symbol}
                    style={{
                      width: isMobile ? 36 : 48, height: isMobile ? 36 : 48,
                      filter: `drop-shadow(0 6px 10px rgba(0,0,0,0.45))`,
                      transition: 'transform 0.2s ease',
                      transform: (spinAnimation && index >= stoppedReels) ? 'scale(0.9)' : 'scale(1)',
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Spin button */}
          <button
            onClick={spinSlot}
            disabled={isLoading || isSpinning || credits < 1}
            style={{
              width: '100%', height: 50, fontSize: '0.92rem', fontWeight: 700,
              fontFamily: 'Poppins, system-ui, sans-serif',
              background: (isLoading || isSpinning || credits < 1)
                ? 'rgba(30, 41, 59, 0.6)'
                : `linear-gradient(135deg, ${accent} 0%, #2563eb 100%)`,
              color: (isLoading || isSpinning || credits < 1) ? '#475569' : '#fff',
              border: 'none', borderRadius: 12,
              cursor: (isLoading || isSpinning || credits < 1) ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: (isLoading || isSpinning || credits < 1) ? 'none' : '0 4px 16px rgba(59, 130, 246, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: '0.5px',
            }}
          >
            {isSpinning ? (
              <><RotateCw size={18} style={{ animation: 'spinIcon 0.6s linear infinite' }} /> Spinning...</>
            ) : credits < 1 ? (
              'Need Credits to Spin'
            ) : (
              <><Play size={18} /> Spin to Win</>
            )}
          </button>
        </div>

        {/* ── Result Banner ── */}
        {lastResult && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
            padding: '12px 16px', marginBottom: 16, borderRadius: 12,
            background: lastResult.won ? 'rgba(34, 197, 94, 0.06)' : 'rgba(15, 23, 42, 0.5)',
            borderLeft: lastResult.won ? '3px solid #34d399' : '3px solid #475569',
          }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: lastResult.won ? '#34d399' : '#94a3b8' }}>
              {lastResult.won ? 'WIN!' : lastResult.message ? '' : 'Try again'}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
              {lastResult.message || (lastResult.won
                ? (lastResult.xpEarned >= 2010 ? `JACKPOT! +${lastResult.xpEarned} XP` : `+${lastResult.xpEarned} XP`)
                : `+${lastResult.xpEarned} XP`
              )}
            </span>
          </div>
        )}

        {/* ── Buy Credits ── */}
        <div style={{
          background: cardBg, border: cardBorder, borderRadius: 20,
          padding: isMobile ? '20px 16px' : '24px 22px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={16} color={goldLight} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9' }}>Get Credits</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{creditPrice} ETH per credit</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {presetAmounts.map((amount) => {
              const cost = (Number(creditPrice) * amount).toFixed(5)
              return (
                <button
                  key={amount}
                  onClick={() => purchaseCredits(amount)}
                  disabled={isLoading}
                  type="button"
                  style={{
                    padding: '11px 8px', fontSize: '0.82rem', fontWeight: 600,
                    fontFamily: 'Poppins, system-ui, sans-serif',
                    background: 'rgba(59, 130, 246, 0.04)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    borderRadius: 10,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                  onMouseOver={(e) => { if (!isLoading) { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)' } }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.1)' }}
                >
                  <span>{amount} credits</span>
                  <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 400 }}>{cost} ETH</span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Custom amount"
              min={1}
              style={{
                flex: 1, padding: '11px 14px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 10, fontSize: '0.85rem',
                background: 'rgba(30, 41, 59, 0.5)',
                color: '#e2e8f0', outline: 'none',
                fontFamily: 'Poppins, system-ui, sans-serif',
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'}
            />
            <button
              type="button"
              onClick={() => { const a = parseInt(customAmount, 10); if (a > 0) { purchaseCredits(a); setCustomAmount('') } }}
              disabled={isLoading || !customAmount || parseInt(customAmount, 10) <= 0}
              style={{
                padding: '11px 20px', fontSize: '0.85rem', fontWeight: 700,
                fontFamily: 'Poppins, system-ui, sans-serif',
                background: `rgba(59, 130, 246, 0.12)`,
                border: `1px solid rgba(59, 130, 246, 0.25)`,
                color: accentLight,
                borderRadius: 10, whiteSpace: 'nowrap',
                cursor: (isLoading || !customAmount) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !customAmount || parseInt(customAmount, 10) <= 0) ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              Buy
            </button>
          </div>
        </div>

        {/* Tx hash */}
        {lastTransaction?.txHash && (
          <div style={{
            marginBottom: 12, padding: '10px 14px',
            background: 'rgba(59, 130, 246, 0.04)', borderLeft: `3px solid ${accent}`,
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ExternalLink size={12} color={accentLight} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction</span>
            </div>
            <div style={{ fontFamily: "'SF Mono', Menlo, monospace", fontSize: '0.7rem', color: '#94a3b8', wordBreak: 'break-all' }}>
              {lastTransaction.txHash || lastTransaction.hash || lastTransaction.transactionHash}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginBottom: 12, padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #ef4444',
            borderRadius: 10, color: '#f87171', fontSize: '0.82rem',
          }}>
            {error}
          </div>
        )}

        {/* Share */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <ShareButton title="Crypto Slots - BaseHub" description="Spin the reels, match symbols, win XP." gameType="slot" />
        </div>

        {/* ── How to Play ── */}
        <div style={{
          background: cardBg, border: cardBorder, borderRadius: 16,
          padding: isMobile ? '16px 14px' : '20px 20px',
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.72rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            How to play
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.9 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={12} style={{ color: goldLight, flexShrink: 0 }} /> Buy credits with ETH ({creditPrice} per credit)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Play size={12} style={{ color: accentLight, flexShrink: 0 }} /> 1 credit = 1 spin</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={12} style={{ color: '#34d399', flexShrink: 0 }} /> 2+ matching symbols = bonus XP</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={12} style={{ color: goldLight, flexShrink: 0 }} /> 4 same = COMBO! +2000 XP</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={12} style={{ color: '#475569', flexShrink: 0 }} /> 150 XP base per spin</li>
          </ul>
          {address && (
            <div style={{ marginTop: 10, fontSize: '0.68rem', color: '#334155', fontFamily: "'SF Mono', Menlo, monospace" }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          )}
        </div>

        <style>{`
          @keyframes reelSpin3d {
            0% { transform: translateY(-10px) rotateX(20deg) scale(0.94); filter: blur(0.2px); }
            48% { transform: translateY(11px) rotateX(-22deg) scale(1.035); filter: blur(1.05px); }
            100% { transform: translateY(-10px) rotateX(20deg) scale(0.94); filter: blur(0.2px); }
          }
          @keyframes spinIcon {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes winBounce {
            0%, 100% { transform: scale(1); }
            40% { transform: scale(1.06); }
            60% { transform: scale(0.98); }
          }
          @keyframes jackpotPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(245, 158, 11, 0.1); }
            50% { transform: scale(1.03); box-shadow: 0 0 24px rgba(245, 158, 11, 0.2); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default SlotGame
