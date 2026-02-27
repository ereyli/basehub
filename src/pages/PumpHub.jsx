import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAccount, useReadContract, usePublicClient, useBalance } from 'wagmi'
import { formatEther, formatUnits, parseEther } from 'viem'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { 
  Rocket, TrendingUp, Users, Zap, Search, Filter, Plus, ArrowLeft, 
  ExternalLink, Copy, Check, Flame, Clock, BarChart3, Globe, Star,
  ChevronDown, ChevronUp, RefreshCw, Wallet, AlertCircle, X, ArrowUpRight, Share2, Link2
} from 'lucide-react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import NetworkGuard from '../components/NetworkGuard'
import BackButton from '../components/BackButton'
import { usePumpHub, usePumpHubData } from '../hooks/usePumpHub'
import { useFarcaster } from '../contexts/FarcasterContext'
import { getFarcasterUniversalLink } from '../config/farcaster'
import { supabase } from '../config/supabase'
import { uploadToIPFS } from '../utils/pinata'

// Contract address
const PUMPHUB_FACTORY_ADDRESS = '0xE7c2Fe007C65349C91B8ccAC3c5BE5a7f2FDaF21'

// Contract ABI for reading tokens
const PUMPHUB_FACTORY_ABI = [
  {
    inputs: [{ name: 'o', type: 'uint256' }, { name: 'l', type: 'uint256' }],
    name: 'getTokens',
    outputs: [{ name: 'r', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getAllTokensCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'getTokenMeta',
    outputs: [
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'tokenCore',
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'virtualETH', type: 'uint256' },
      { name: 'virtualTokens', type: 'uint256' },
      { name: 'realETH', type: 'uint256' },
      { name: 'creatorAllocation', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'uniswapPair', type: 'address' },
      { name: 'graduated', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'tokenStats',
    outputs: [
      { name: 'buys', type: 'uint256' },
      { name: 'sells', type: 'uint256' },
      { name: 'vol', type: 'uint256' },
      { name: 'holders', type: 'uint256' },
      { name: 'gradAt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'a', type: 'address' }],
    name: 'fees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getPlatformStats',
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

// ERC20 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
]

// ETH price constant (you can make this dynamic later)
const ETH_PRICE_USD = 3000

// Helper functions
const formatMarketCap = (value) => {
  if (!value || value === 0) return '$0'
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

const formatNumber = (num) => {
  if (!num) return '0'
  const n = parseFloat(num)
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(2)}B`
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
  return n.toFixed(2)
}

const shortenAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Unknown'
  const now = Date.now()
  const time = parseInt(timestamp) * 1000
  const diff = now - time
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}


// ============================================
// IPFS gateway helpers
// gateway.pinata.cloud is slow/rate-limited; use faster alternatives
const FAST_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]

const extractIPFSCid = (url) => {
  if (!url) return null
  // Handle gateway.pinata.cloud/ipfs/Qm... or any /ipfs/Qm... URL
  const match = url.match(/\/ipfs\/(Qm[a-zA-Z0-9]{44,}|bafy[a-zA-Z0-9]+)/)
  if (match) return match[1]
  // Handle ipfs://Qm...
  const ipfsMatch = url.match(/^ipfs:\/\/(Qm[a-zA-Z0-9]{44,}|bafy[a-zA-Z0-9]+)/)
  if (ipfsMatch) return ipfsMatch[1]
  return null
}

const toFastGateway = (url, gatewayIndex = 0) => {
  const cid = extractIPFSCid(url)
  if (cid) return FAST_GATEWAYS[gatewayIndex % FAST_GATEWAYS.length] + cid
  return url
}

// ============================================
// LAZY TOKEN IMAGE (with fast IPFS gateway + multi-retry)
// ============================================
const TokenImage = ({ src, alt, size = 64, borderRadius = '14px' }) => {
  const [status, setStatus] = useState(src ? 'loading' : 'error')
  const [gatewayIdx, setGatewayIdx] = useState(0)
  const [currentSrc, setCurrentSrc] = useState(() => src ? toFastGateway(src, 0) : '')

  useEffect(() => {
    if (!src) {
      setStatus('error')
      setCurrentSrc('')
      return
    }
    setGatewayIdx(0)
    const url = toFastGateway(src, 0)
    setCurrentSrc(url)
    setStatus('loading')
  }, [src])

  // Fallback: if onLoad never fires (e.g. cached image, race), show image after delay so logos appear on refresh
  useEffect(() => {
    if (!currentSrc || status !== 'loading') return
    const t = setTimeout(() => setStatus(s => (s === 'loading' ? 'loaded' : s)), 600)
    return () => clearTimeout(t)
  }, [currentSrc, status])

  const handleError = () => {
    const cid = extractIPFSCid(src)
    const nextIdx = gatewayIdx + 1
    if (cid && nextIdx < FAST_GATEWAYS.length) {
      setGatewayIdx(nextIdx)
      setCurrentSrc(FAST_GATEWAYS[nextIdx] + cid)
      setStatus('loading')
    } else {
      setStatus('error')
    }
  }

  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius,
      overflow: 'hidden', flexShrink: 0, position: 'relative',
      background: status === 'error' ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))' : 'rgba(30,30,40,0.6)',
      border: status === 'error' ? '1px solid rgba(71, 85, 105, 0.5)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(110deg, rgba(30,30,40,0.6) 30%, rgba(59,130,246,0.15) 50%, rgba(30,30,40,0.6) 70%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
      )}
      {currentSrc && status !== 'error' ? (
        <img
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: 1,
            visibility: status === 'loading' ? 'hidden' : 'visible',
            transition: 'visibility 0.2s ease',
          }}
        />
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size > 48 ? '4px' : '0',
          padding: '4px',
        }}>
          <Rocket size={size * 0.35} color="rgba(148, 163, 184, 0.9)" />
          {size > 48 && (
            <span style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.8)', textAlign: 'center', lineHeight: 1.1 }}>
              No image
            </span>
          )}
        </div>
      )}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  )
}

// ============================================
// TOKEN CARD COMPONENT
// ============================================
const TokenCard = ({ token, onClick, isMobile = false }) => {
  const virtualETH = parseFloat(token.virtualETH || 1)
  const realETH = parseFloat(token.realETH || 0)
  const marketCapETH = virtualETH + realETH
  const marketCapUSD = marketCapETH * ETH_PRICE_USD
  const progress = Math.min((realETH / 5) * 100, 100)
  const initialMarketCapUSD = 1 * ETH_PRICE_USD
  const changePercent = initialMarketCapUSD > 0 
    ? ((marketCapUSD - initialMarketCapUSD) / initialMarketCapUSD) * 100 
    : 0
  const isNew = realETH === 0
  const isPositive = changePercent > 0
  const isNeutral = changePercent === 0

  const imgSize = isMobile ? 56 : 72

  return (
    <div 
      onClick={onClick}
      style={{
        background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.95) 100%)',
        borderRadius: isMobile ? '14px' : '18px',
        padding: isMobile ? '14px' : '18px',
        cursor: 'pointer',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.3)'
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)'
      }}
    >
      {/* Progress bar at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'rgba(59, 130, 246, 0.2)', borderRadius: '18px 18px 0 0'
      }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: progress >= 100 
            ? 'linear-gradient(90deg, #10b981, #34d399)' 
            : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          borderRadius: '18px 18px 0 0', transition: 'width 0.5s ease'
        }} />
      </div>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px', marginTop: '4px' }}>
        <TokenImage src={token.image} alt={token.name} size={imgSize} />
        
        {/* Name & Symbol */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: 'bold', fontSize: isMobile ? '15px' : '17px', color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {token.name || 'Unknown'}
          </div>
          <div style={{ 
            fontSize: isMobile ? '12px' : '13px', color: '#9ca3af',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            ${token.symbol || '???'}
            {token.graduated && (
              <span style={{
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold'
              }}>
                GRADUATED
              </span>
            )}
          </div>
        </div>
        
        {/* Price Change */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 'bold', color: '#fff' }}>
            {formatMarketCap(marketCapUSD)}
          </div>
          <div style={{ 
            fontSize: isMobile ? '11px' : '12px',
            color: isNew ? '#60a5fa' : isPositive ? '#10b981' : isNeutral ? '#9ca3af' : '#ef4444',
            fontWeight: '600'
          }}>
            {isNew ? 'NEW' : `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`}
          </div>
        </div>
      </div>
      
      {/* Stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: '12px', padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px', fontSize: '12px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#9ca3af' }}>Volume</div>
          <div style={{ color: '#fff', fontWeight: '600' }}>{formatNumber(token.volume)} ETH</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#9ca3af' }}>Txns</div>
          <div style={{ color: '#fff', fontWeight: '600' }}>{(parseInt(token.buys || 0) + parseInt(token.sells || 0))}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#9ca3af' }}>Progress</div>
          <div style={{ color: progress >= 100 ? '#10b981' : '#3b82f6', fontWeight: '600' }}>{progress.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MINI TOKEN CARD (for horizontal scroll when token selected)
// ============================================
const MiniTokenCard = ({ token, onClick, isSelected, isMobile = false }) => {
  return (
    <div 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); } }}
      style={{
        background: isSelected 
          ? 'linear-gradient(145deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.2) 100%)'
          : 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.95) 100%)',
        borderRadius: 10,
        padding: isMobile ? '12px 14px' : '8px 12px',
        cursor: 'pointer',
        border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 8,
        minWidth: isMobile ? 130 : 120,
        minHeight: isMobile ? 56 : undefined,
        flexShrink: 0,
        transition: 'all 0.2s ease'
      }}
    >
      <TokenImage src={token.image} alt={token.name} size={isMobile ? 36 : 32} borderRadius="8px" />
      <div>
        <div style={{ fontSize: isMobile ? 14 : 12, fontWeight: 'bold', color: '#fff' }}>{token.symbol}</div>
        <div style={{ fontSize: isMobile ? 11 : 10, color: '#9ca3af' }}>{formatMarketCap(parseFloat(token.virtualETH || 1) * ETH_PRICE_USD)}</div>
      </div>
    </div>
  )
}

// ============================================
// TOKEN CHART PANEL
// ============================================
const TokenChartPanel = ({ tokenData, tokenAddress, lastTradeConfirmedAt, isMobile = false }) => {
  const [tradeHistory, setTradeHistory] = useState([])
  const [loadingTrades, setLoadingTrades] = useState(true)
  
  // Fetch trade history from Supabase (refetch when lastTradeConfirmedAt changes = swap just confirmed)
  useEffect(() => {
    const fetchTrades = async () => {
      if (!tokenAddress || !supabase) {
        setLoadingTrades(false)
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('token_trades')
          .select('*')
          .eq('token_address', tokenAddress.toLowerCase())
          .order('created_at', { ascending: true })
        
        if (error) {
          console.error('Error fetching trades:', error)
        } else {
          setTradeHistory(data || [])
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoadingTrades(false)
      }
    }
    
    fetchTrades()
  }, [tokenAddress, lastTradeConfirmedAt])
  
  // Calculate market cap
  const virtualETH = parseFloat(tokenData?.tokenData?.virtualETH || tokenData?.virtualETH || 1)
  const realETH = parseFloat(tokenData?.tokenData?.realETH || tokenData?.realETH || 0)
  const marketCapETH = virtualETH + realETH
  const marketCapUSD = marketCapETH * ETH_PRICE_USD
  const initialMarketCapUSD = 1 * ETH_PRICE_USD // 1 ETH virtual at start
  
  // Progress to graduation
  const progress = Math.min((realETH / 5) * 100, 100)
  
  // Generate candlestick data: 1 day per candle, only from token creation date (no bars before launch).
  const candlestickData = useMemo(() => {
    const bucketMs = 24 * 60 * 60 * 1000 // 1 day
    const now = Date.now()
    const createdAt = tokenData?.tokenData?.createdAt ? parseInt(tokenData.tokenData.createdAt, 10) * 1000 : null
    const creationDayStart = createdAt ? new Date(createdAt).setHours(0, 0, 0, 0) : now - 30 * bucketMs
    const data = []

    let open = initialMarketCapUSD
    let bucketStart = creationDayStart
    const maxBuckets = 30

    for (let i = 0; i < maxBuckets && bucketStart < now; i++) {
      const bucketEnd = Math.min(bucketStart + bucketMs, now)

      const bucketTrades = (tradeHistory || []).filter(t => {
        const tradeTime = new Date(t.created_at).getTime()
        return tradeTime >= bucketStart && tradeTime < bucketEnd
      })

      let high = open
      let low = open
      let close = open

      bucketTrades.forEach(trade => {
        const ethAmount = parseFloat(trade.eth_amount || 0)
        const mcChange = ethAmount * ETH_PRICE_USD * 2
        if (trade.trade_type === 'buy') {
          close += mcChange
        } else {
          close -= mcChange
        }
        close = Math.max(close, initialMarketCapUSD * 0.3)
        high = Math.max(high, close)
        low = Math.min(low, close)
      })

      data.push({
        x: new Date(bucketStart),
        y: [open, high, low, close]
      })
      open = close
      bucketStart += bucketMs
    }

    return data
  }, [tradeHistory, initialMarketCapUSD, tokenData])

  // TradingView Lightweight Charts format: { time: 'YYYY-MM-DD', open, high, low, close }
  const chartDataTV = useMemo(() => candlestickData.map(d => {
    const t = d.x
    const y = d.y
    return {
      time: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
      open: y[0],
      high: y[1],
      low: y[2],
      close: y[3]
    }
  }), [candlestickData])

  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const lastBarCountRef = useRef(0)

  useEffect(() => {
    lastBarCountRef.current = 0
  }, [tokenAddress])

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (loadingTrades) return
    const container = chartContainerRef.current
    if (!container || container.clientWidth === 0) return
    if (!chartRef.current) {
      const chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { color: 'transparent' },
          textColor: '#9ca3af'
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.06)' },
          horzLines: { color: 'rgba(255,255,255,0.06)' }
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          scaleMargins: { top: 0.1, bottom: 0.1 }
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        handleScale: {
          mouseWheel: true,
          pinch: true
        },
        kineticScroll: {
          touch: true,
          mouse: true
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          timeVisible: false,
          secondsVisible: false,
          rightOffset: 0,
          barSpacing: 12,
          minBarSpacing: 4,
          fixRightEdge: false,
          fixLeftEdge: false,
          tickMarkFormatter: (time, tickMarkType) => {
            const str = typeof time === 'string' ? time : (typeof time === 'object' && time?.year ? `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}` : '')
            if (!str) return null
            const d = new Date(str + 'T00:00:00Z')
            const day = d.getUTCDate()
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            return `${day} ${months[d.getUTCMonth()]}`
          }
        },
        height: isMobile ? 200 : 350
      })
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444'
      })
      chartRef.current = chart
      seriesRef.current = series
      // Ensure scroll/drag is enabled (apply again so it takes effect)
      chart.applyOptions({
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true },
        timeScale: { fixRightEdge: false, fixLeftEdge: false }
      })
    }
    if (chartDataTV.length > 0 && seriesRef.current && chartRef.current) {
      seriesRef.current.setData(chartDataTV)
      const ts = chartRef.current.timeScale()
      const barCount = chartDataTV.length
      if (lastBarCountRef.current === 0) {
        ts.fitContent()
        // Keep minimum ~14 slots so one or few bars don't stretch; range right-aligned to latest data
        const visibleBars = 14
        const from = Math.max(0, barCount - visibleBars)
        const to = barCount + 2
        ts.setVisibleLogicalRange({ from, to })
      }
      lastBarCountRef.current = barCount
    }
  }, [loadingTrades, chartDataTV])

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
      borderRadius: isMobile ? 14 : 16,
      padding: isMobile ? 10 : 16,
      border: '1px solid rgba(59, 130, 246, 0.2)',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 8 : 12, minWidth: 0 }}>
        <div>
          <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#fff' }}>
            {formatMarketCap(marketCapUSD)}
          </div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: '#9ca3af' }}>Market Cap</div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ fontSize: isMobile ? 11 : 12, color: '#9ca3af', fontWeight: '600' }}>1D chart</div>
          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>Drag to scroll · Scroll to zoom</div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{ marginBottom: 12, minWidth: 0 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          gap: 8,
          fontSize: isMobile ? 10 : 11, 
          marginBottom: 4,
          flexWrap: 'wrap'
        }}>
          <span style={{ color: '#94a3b8' }}>Progress to LP Lock</span>
          <span style={{ color: progress >= 100 ? '#10b981' : '#3b82f6', whiteSpace: 'nowrap' }}>
            {progress >= 100 ? '🎓 Graduated' : `${progress.toFixed(1)}% (${realETH.toFixed(3)}/5 ETH)`}
          </span>
        </div>
        <div style={{
          height: '6px',
          background: 'rgba(59, 130, 246, 0.2)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: progress >= 100 
              ? 'linear-gradient(90deg, #10b981, #34d399)' 
              : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>
      
      {/* Chart — wrapper so drag/scroll is captured (not page scroll) */}
      <div style={{ 
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)', 
        borderRadius: '12px', 
        padding: isMobile ? '6px' : '8px',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        minHeight: isMobile ? '220px' : '380px',
        touchAction: 'none',
        cursor: 'grab'
      }}>
        {loadingTrades ? (
          <div style={{ 
            height: isMobile ? '200px' : '350px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#9ca3af'
          }}>
            <RefreshCw size={24} className="animate-spin" style={{ marginRight: '10px' }} />
            Loading chart data...
          </div>
        ) : (
          <div 
            ref={chartContainerRef} 
            style={{ 
              width: '100%', 
              height: isMobile ? '200px' : '350px', 
              minHeight: isMobile ? '200px' : '350px',
              touchAction: 'none',
              cursor: 'grab',
              position: 'relative',
              overflow: 'hidden'
            }} 
          />
        )}
      </div>
      
      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? 6 : 8,
        marginTop: isMobile ? 10 : 12,
        minWidth: 0
      }}>
        <div style={{ textAlign: 'center', padding: isMobile ? 6 : 8, background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#9ca3af' }}>24h High</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: '#10b981', fontWeight: '600' }}>
            {formatMarketCap(candlestickData.length > 0 ? Math.max(...candlestickData.map(d => d.y[1])) : marketCapUSD)}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: isMobile ? 6 : 8, background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#9ca3af' }}>24h Low</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: '#ef4444', fontWeight: '600' }}>
            {formatMarketCap(candlestickData.length > 0 ? Math.min(...candlestickData.map(d => d.y[2])) : initialMarketCapUSD)}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>Volume</div>
          <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
            {formatNumber(tokenData?.tokenStats?.volume || 0)} ETH
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: isMobile ? 6 : 8, background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#9ca3af' }}>Txns</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: '#fff', fontWeight: '600' }}>
            {parseInt(tokenData?.tokenStats?.buys || 0) + parseInt(tokenData?.tokenStats?.sells || 0)}
          </div>
        </div>
      </div>

      {/* Recent transactions - below chart (Account, Type, Amount, Time, Txn) */}
      <div style={{
        marginTop: isMobile ? 12 : 16,
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: isMobile ? 10 : 12,
        border: '1px solid rgba(59, 130, 246, 0.15)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: isMobile ? '10px 12px' : '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: isMobile ? 11 : 12,
          fontWeight: '600',
          color: '#9ca3af'
        }}>
          <BarChart3 size={isMobile ? 14 : 16} />
          Recent transactions
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loadingTrades ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
              <RefreshCw size={18} className="animate-spin" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
              Loading...
            </div>
          ) : !tradeHistory || tradeHistory.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>No transactions yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 11 : 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: isMobile ? '8px 10px' : '10px 14px', color: '#9ca3af', fontWeight: '600' }}>Account</th>
                  <th style={{ textAlign: 'left', padding: isMobile ? '8px 10px' : '10px 14px', color: '#9ca3af', fontWeight: '600' }}>Type</th>
                  <th style={{ textAlign: 'right', padding: isMobile ? '8px 10px' : '10px 14px', color: '#9ca3af', fontWeight: '600' }}>Amount (ETH)</th>
                  <th style={{ textAlign: 'right', padding: isMobile ? '8px 10px' : '10px 14px', color: '#9ca3af', fontWeight: '600' }}>Amount ({tokenData?.tokenMeta?.symbol || 'Token'})</th>
                  <th style={{ textAlign: 'center', padding: isMobile ? '8px 10px' : '10px 14px', color: '#9ca3af', fontWeight: '600' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={isMobile ? 10 : 12} /> Time</span>
                  </th>
                  <th style={{ textAlign: 'right', padding: isMobile ? '8px 10px' : '10px 14px', color: '#9ca3af', fontWeight: '600' }}>Txn</th>
                </tr>
              </thead>
              <tbody>
                {[...tradeHistory].reverse().slice(0, 15).map((t, i) => (
                  <tr key={`${t.tx_hash ?? 'tx'}-${t.trader_address ?? ''}-${t.created_at ?? ''}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: isMobile ? '8px 10px' : '10px 14px', color: '#e2e8f0', fontFamily: 'monospace' }} title={t.trader_address}>
                      {shortenAddress(t.trader_address)}
                    </td>
                    <td style={{ padding: isMobile ? '8px 10px' : '10px 14px' }}>
                      <span style={{
                        color: t.trade_type === 'buy' ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                      }}>
                        {t.trade_type === 'buy' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: isMobile ? '8px 10px' : '10px 14px', color: t.trade_type === 'buy' ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                      {parseFloat(t.eth_amount || 0).toFixed(4)} ETH
                    </td>
                    <td style={{ textAlign: 'right', padding: isMobile ? '8px 10px' : '10px 14px', color: t.trade_type === 'buy' ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                      {t.token_amount ? formatNumber(t.token_amount) : '-'}
                    </td>
                    <td style={{ textAlign: 'center', padding: isMobile ? '8px 10px' : '10px 14px', color: '#94a3b8' }}>
                      {timeAgo(t.created_at ? Math.floor(new Date(t.created_at).getTime() / 1000) : null)}
                    </td>
                    <td style={{ textAlign: 'right', padding: isMobile ? '8px 10px' : '10px 14px' }}>
                      {t.tx_hash ? (
                        <a
                          href={`https://basescan.org/tx/${t.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#60a5fa', textDecoration: 'none', fontFamily: 'monospace' }}
                          title={t.tx_hash}
                        >
                          {t.tx_hash.slice(0, 6)}...{t.tx_hash.slice(-4)}
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// TOKEN CREATOR + TOKEN ADDRESS CARD (below buy/sell)
// ============================================
const Row = ({ label, fullAddress, isMobile }) => {
  const [copied, setCopied] = useState(false)
  const short = fullAddress && fullAddress.length >= 10 ? `${fullAddress.slice(0, 6)}...${fullAddress.slice(-4)}` : (fullAddress || '')
  const copy = () => {
    if (!fullAddress) return
    navigator.clipboard.writeText(fullAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  if (!fullAddress) return null
  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: isMobile ? 8 : 10,
      minWidth: 0
    }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: isMobile ? 12 : 14,
        color: '#e2e8f0',
        letterSpacing: '0.02em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {short}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={copy}
          title="Copy"
          style={{
            padding: isMobile ? '8px' : '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(59, 130, 246, 0.4)',
            background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.15)',
            color: copied ? '#22c55e' : '#60a5fa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: isMobile ? 12 : 12
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {!isMobile && (copied ? 'Copied' : 'Copy')}
        </button>
        <a
          href={`https://basescan.org/address/${fullAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          title="BaseScan"
          style={{
            padding: isMobile ? '8px' : '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(59, 130, 246, 0.4)',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            fontSize: 12
          }}
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  )
}
const TokenCreatorCard = ({ creatorAddress, tokenAddress, isMobile = false }) => {
  return (
    <div style={{
      marginTop: isMobile ? 12 : 20,
      padding: isMobile ? 10 : '14px 16px',
      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
      borderRadius: isMobile ? 10 : 12,
      border: '1px solid rgba(59, 130, 246, 0.25)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      overflow: 'hidden',
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ fontSize: isMobile ? 10 : 11, color: '#94a3b8', marginBottom: 6, fontWeight: '600', letterSpacing: '0.5px' }}>
        TOKEN CREATOR
      </div>
      <Row label="Creator" fullAddress={creatorAddress} isMobile={isMobile} />
      {tokenAddress && (
        <>
          <div style={{ fontSize: isMobile ? 10 : 11, color: '#94a3b8', marginTop: 12, marginBottom: 6, fontWeight: '600', letterSpacing: '0.5px' }}>
            TOKEN ADDRESS
          </div>
          <Row label="Token" fullAddress={tokenAddress} isMobile={isMobile} />
        </>
      )}
    </div>
  )
}

// ============================================
// TOKEN TRADE PANEL
// ============================================
const TokenTradePanel = ({ tokenData, tokenAddress, buyTokens, sellTokens, claimFees, isLoading, error, isMobile = false }) => {
  const { address, isConnected } = useAccount()
  const [tradeMode, setTradeMode] = useState('buy')
  const [amount, setAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const pad = isMobile ? 20 : 16
  const btnPadY = isMobile ? 14 : 12
  const btnPadX = isMobile ? 16 : 12
  const minTouch = 44
  
  // Get user's ETH balance
  const { data: ethBalance } = useBalance({ address })
  
  // Get user's token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress }
  })
  
  // Get creator fees
  const { data: creatorFees } = useReadContract({
    address: PUMPHUB_FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'fees',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })
  
  const userTokenBalance = tokenBalance ? formatUnits(tokenBalance, 18) : '0'
  const userETHBalance = ethBalance ? formatEther(ethBalance.value) : '0'
  const isCreator = tokenData?.tokenData?.creator?.toLowerCase() === address?.toLowerCase()
  const creatorFeesBalance = creatorFees ? formatEther(creatorFees) : '0'
  
  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    if (isProcessing) return
    
    setIsProcessing(true)
    try {
      if (tradeMode === 'buy') {
        await buyTokens(tokenAddress, amount)
      } else {
        await sellTokens(tokenAddress, amount)
      }
      setAmount('')
    } catch (err) {
      console.error('Trade error:', err)
    } finally {
      setIsProcessing(false)
    }
  }
  
  const handleClaimFees = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await claimFees()
    } catch (err) {
      console.error('Claim error:', err)
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Quick amount buttons
  const quickAmounts = tradeMode === 'buy' 
    ? ['0.001', '0.01', '0.05', '0.1']
    : ['25%', '50%', '75%', '100%']
  
  const handleQuickAmount = (val) => {
    if (tradeMode === 'buy') {
      setAmount(val)
    } else {
      const percent = parseInt(val) / 100
      const tokenAmt = parseFloat(userTokenBalance) * percent
      setAmount(tokenAmt.toFixed(6))
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
      borderRadius: isMobile ? 16 : 16,
      padding: isMobile ? 14 : 16,
      paddingBottom: isMobile ? Math.max(pad + 60, 100) : pad,
      border: '1px solid rgba(59, 130, 246, 0.2)',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Trade mode tabs */}
      <div style={{ display: 'flex', gap: isMobile ? 10 : 8, marginBottom: isMobile ? 20 : 16 }}>
        <button
          onClick={() => { setTradeMode('buy'); setAmount('') }}
          style={{
            flex: 1,
            minHeight: minTouch,
            padding: `${btnPadY}px ${btnPadX}px`,
            borderRadius: isMobile ? '12px' : '10px',
            border: 'none',
            background: tradeMode === 'buy' 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: isMobile ? 16 : 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Buy
        </button>
        <button
          onClick={() => { setTradeMode('sell'); setAmount('') }}
          style={{
            flex: 1,
            minHeight: minTouch,
            padding: `${btnPadY}px ${btnPadX}px`,
            borderRadius: isMobile ? '12px' : '10px',
            border: 'none',
            background: tradeMode === 'sell' 
              ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
              : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: isMobile ? 16 : 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Sell
        </button>
      </div>
      
      {/* Balance display */}
      <div style={{
        padding: isMobile ? 16 : 12,
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: isMobile ? 12 : 10,
        marginBottom: isMobile ? 16 : 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 13 }}>
          <span style={{ color: '#9ca3af' }}>
            {tradeMode === 'buy' ? 'ETH Balance' : 'Token Balance'}
          </span>
          <span style={{ color: '#fff', fontWeight: '600' }}>
            {tradeMode === 'buy' 
              ? `${parseFloat(userETHBalance).toFixed(4)} ETH`
              : `${formatNumber(userTokenBalance)} ${tokenData?.tokenMeta?.symbol || 'TOKEN'}`
            }
          </span>
        </div>
      </div>
      
      {/* Amount input */}
      <div style={{ marginBottom: isMobile ? 16 : 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: isMobile ? 12 : 10,
          border: '1px solid rgba(59, 130, 246, 0.3)',
          padding: isMobile ? 16 : 12
        }}>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tradeMode === 'buy' ? 'ETH amount' : 'Token amount'}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: isMobile ? 20 : 18,
              fontWeight: 'bold',
              outline: 'none',
              minWidth: 0
            }}
          />
          <span style={{ color: '#9ca3af', fontSize: isMobile ? 16 : 14 }}>
            {tradeMode === 'buy' ? 'ETH' : tokenData?.tokenMeta?.symbol || 'TOKEN'}
          </span>
        </div>
      </div>
      
      {/* Quick amounts */}
      <div style={{ display: 'flex', gap: isMobile ? 8 : 6, marginBottom: isMobile ? 20 : 16 }}>
        {quickAmounts.map(val => (
          <button
            key={val}
            onClick={() => handleQuickAmount(val)}
            style={{
              flex: 1,
              minHeight: minTouch,
              padding: isMobile ? '12px 8px' : '8px',
              borderRadius: isMobile ? 10 : 8,
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              fontSize: isMobile ? 14 : 12,
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {val}
          </button>
        ))}
      </div>
      
      {/* Trade button */}
      <button
        onClick={handleTrade}
        disabled={!isConnected || !amount || parseFloat(amount) <= 0 || isLoading || isProcessing}
        style={{
          width: '100%',
          minHeight: minTouch,
          padding: isMobile ? 18 : 14,
          borderRadius: isMobile ? 14 : 12,
          border: 'none',
          background: !isConnected || !amount || parseFloat(amount) <= 0 || isLoading || isProcessing
            ? 'rgba(255,255,255,0.1)'
            : tradeMode === 'buy'
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: isMobile ? 18 : 16,
          cursor: !isConnected || !amount || parseFloat(amount) <= 0 || isLoading || isProcessing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        {!isConnected ? 'Connect Wallet' : 
         isLoading || isProcessing ? 'Processing...' :
         tradeMode === 'buy' ? `Buy ${tokenData?.tokenMeta?.symbol || 'TOKEN'}` : `Sell ${tokenData?.tokenMeta?.symbol || 'TOKEN'}`}
      </button>
      
      {/* Creator claim section */}
      {isCreator && parseFloat(creatorFeesBalance) > 0 && (
        <div style={{
          marginTop: isMobile ? 20 : 16,
          padding: isMobile ? 16 : 12,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
          borderRadius: isMobile ? 12 : 10,
          border: '2px solid rgba(59, 130, 246, 0.5)'
        }}>
          <div style={{ fontSize: '12px', color: '#60a5fa', marginBottom: '8px' }}>
            🎉 Creator Fees Available
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>
              {parseFloat(creatorFeesBalance).toFixed(6)} ETH
            </span>
            <button
              onClick={handleClaimFees}
              disabled={isLoading || isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: isLoading || isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              💰 Claim
            </button>
          </div>
        </div>
      )}

      {/* Token Creator + Token Address — below buy/sell area */}
      {(tokenData?.tokenData?.creator || tokenAddress) && (
        <TokenCreatorCard
          creatorAddress={tokenData?.tokenData?.creator}
          tokenAddress={tokenAddress}
          isMobile={isMobile}
        />
      )}
      
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '12px'
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ============================================
// TOKEN CREATION SUCCESS MODAL
// ============================================
const TokenCreationSuccessModal = ({ token, onClose, onViewToken }) => {
  const [copied, setCopied] = useState(false)
  
  const copyAddress = () => {
    navigator.clipboard.writeText(token.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 1) 100%)',
        borderRadius: '20px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        border: '2px solid rgba(16, 185, 129, 0.5)',
        boxShadow: '0 20px 60px rgba(16, 185, 129, 0.3)'
      }}>
        {/* Success icon */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            fontSize: '40px'
          }}>
            🚀
          </div>
          <h2 style={{ color: '#fff', marginTop: '16px', marginBottom: '8px' }}>
            Token Created!
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Your token has been successfully launched
          </p>
        </div>
        
        {/* Token details */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            {token.image ? (
              <img 
                src={token.image} 
                alt={token.name}
                style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Rocket size={24} color="#fff" />
              </div>
            )}
            <div>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>{token.name}</div>
              <div style={{ color: '#9ca3af', fontSize: '14px' }}>${token.symbol}</div>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px'
          }}>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>Contract</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                {shortenAddress(token.address)}
              </span>
              <button
                onClick={copyAddress}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#9ca3af" />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={onViewToken}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <TrendingUp size={18} />
            View Token & Trade
          </button>
          
          <a
            href={`https://basescan.org/token/${token.address}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'transparent',
              color: '#60a5fa',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              textDecoration: 'none'
            }}
          >
            <ExternalLink size={16} />
            View on BaseScan
          </a>
          
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#9ca3af',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PUMPHUB COMPONENT
// ============================================
const PumpHub = () => {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // State
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'tokens')
  const [selectedToken, setSelectedToken] = useState(null)
  const [selectedTokenData, setSelectedTokenData] = useState(null)

  // Sync URL -> selectedToken (open shared link /pumphub?token=0x... or browser back/forward)
  useEffect(() => {
    const t = searchParams.get('token')
    if (!t || typeof t !== 'string') {
      setSelectedToken(null)
      return
    }
    const addr = t.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(addr)) setSelectedToken(addr)
  }, [searchParams])

  // Update URL when user selects a token (each token has its own shareable link)
  const setSelectedTokenAndUrl = useCallback((addr) => {
    setSelectedToken(addr || null)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (addr) next.set('token', addr)
      else next.delete('token')
      return next
    }, { replace: true })
  }, [setSearchParams])
  const [tokens, setTokens] = useState([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [tokensListKey, setTokensListKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [category, setCategory] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  
  const TOKENS_PER_PAGE = 12
  
  // Token creation form
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    logoUrl: '',
    creatorAllocation: 0
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [isSharingCast, setIsSharingCast] = useState(false)
  const [tokenLinkCopied, setTokenLinkCopied] = useState(false)
  
  const copyTokenLink = useCallback(() => {
    if (!selectedToken) return
    const url = `${window.location.origin}${window.location.pathname}?token=${selectedToken}`
    navigator.clipboard.writeText(url)
    setTokenLinkCopied(true)
    setTimeout(() => setTokenLinkCopied(false), 2000)
  }, [selectedToken])
  
  const farcaster = useFarcaster()
  const isInFarcaster = farcaster?.isInFarcaster ?? false
  const sdk = farcaster?.sdk ?? null
  
  const handleShareCast = async () => {
    if (!sdk?.actions?.composeCast) return
    setIsSharingCast(true)
    try {
      const pumphubUrl = getFarcasterUniversalLink('/pumphub')
      const castText = `🚀 PumpHub on BaseHub – Launch & trade meme tokens! 🔥\n\n✨ Fair launch, no presale\n💎 Create token with 0.001 ETH\n📈 Bonding curve → graduate to DEX\n🎯 Earn 2000 XP for creating, 100 XP per trade\n\nTry it on Base 👇\n\n#BaseHub #PumpHub #Base #Memecoin\n\n🌐 Web: https://basehub.fun/pumphub\n🎭 Farcaster: ${pumphubUrl}`
      await sdk.actions.composeCast({
        text: castText,
        embeds: [pumphubUrl]
      })
    } catch (err) {
      console.error('PumpHub cast failed:', err)
    } finally {
      setIsSharingCast(false)
    }
  }
  
  const { 
    createToken, 
    buyTokens,
    sellTokens,
    claimFees,
    isLoading, 
    error, 
    lastCreatedToken, 
    clearLastCreatedToken,
    lastTradeConfirmedAt
  } = usePumpHub()
  
  // Platform stats derived from token list
  const platformStats = useMemo(() => {
    if (!tokens || tokens.length === 0) return null
    const totalTokens = tokens.length
    const graduated = tokens.filter(t => t.graduated).length
    const totalVolumeETH = tokens.reduce((sum, t) => sum + parseFloat(t.volume || 0), 0)
    return { totalTokens, graduated, totalVolumeETH }
  }, [tokens])

  // Helper: parse multicall results into token objects
  const parseOnChainToken = useCallback((addr, meta, core, stats) => ({
    address: addr,
    name: meta[0] || 'Unknown',
    symbol: meta[1] || '???',
    description: meta[2] || '',
    image: meta[3] || '',
    creator: core[0] || '',
    virtualETH: formatEther(core[1] || 0n),
    realETH: formatEther(core[3] || 0n),
    createdAt: core[5]?.toString() || '0',
    graduated: core[7] || false,
    buys: stats[0]?.toString() || '0',
    sells: stats[1]?.toString() || '0',
    volume: formatEther(stats[2] || 0n),
    holders: stats[3]?.toString() || '0',
  }), [])

  // Fetch tokens: Supabase-first (instant UI), then background RPC refresh
  useEffect(() => {
    let cancelled = false

    const fetchTokens = async () => {
      if (!publicClient) return

      try {
        // Step 1: Try Supabase first for instant display while RPC loads in background
        let sbMap = {}
        let sbTokensList = []
        if (supabase?.from) {
          try {
            const { data: sbRows } = await supabase
              .from('pumphub_tokens')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100)
            if (sbRows?.length > 0) {
              sbRows.forEach(r => { sbMap[r.token_address] = r })
              sbTokensList = sbRows.filter(r => r.name && r.name !== 'Unknown').map(row => ({
                address: row.token_address,
                name: row.name,
                symbol: row.symbol || '???',
                description: row.description || '',
                image: row.image_uri || '',
                creator: row.creator || '',
                virtualETH: row.virtual_eth || '1',
                realETH: row.real_eth || '0',
                createdAt: row.created_at
                  ? String(Math.floor(new Date(row.created_at).getTime() / 1000))
                  : '0',
                graduated: row.graduated || false,
                buys: String(row.total_buys || 0),
                sells: String(row.total_sells || 0),
                volume: row.total_volume || '0',
                holders: String(row.holder_count || 0),
                _fromSupabase: true,
              }))
              // Show Supabase data immediately so user sees tokens fast
              if (!cancelled && sbTokensList.length > 0) {
                setTokens(sbTokensList)
                setLoadingTokens(false)
                setTokensListKey(k => k + 1)
              }
            }
          } catch (e) {
            console.error('Supabase fetch failed:', e)
          }
        }

        // Step 2: Get on-chain token count (retry on failure)
        let onChainCount = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const countRaw = await publicClient.readContract({
              address: PUMPHUB_FACTORY_ADDRESS,
              abi: PUMPHUB_FACTORY_ABI,
              functionName: 'getAllTokensCount',
            })
            onChainCount = Number(countRaw)
            break
          } catch (e) {
            console.warn('getAllTokensCount attempt', attempt + 1, 'failed:', e)
            if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
          }
        }

        if (cancelled) return
        if (onChainCount === null || onChainCount === 0) {
          // RPC failed or truly 0 tokens — keep Supabase data if we have it
          if (sbTokensList.length === 0) {
            setTokens([])
          }
          setLoadingTokens(false)
          return
        }

        // Step 3: Get token addresses
        let tokenAddresses = []
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            tokenAddresses = await publicClient.readContract({
              address: PUMPHUB_FACTORY_ADDRESS,
              abi: PUMPHUB_FACTORY_ABI,
              functionName: 'getTokens',
              args: [0n, BigInt(Math.min(onChainCount, 100))]
            })
            if (tokenAddresses?.length > 0) break
          } catch (e) {
            console.warn('getTokens RPC attempt', attempt + 1, 'failed:', e)
            if (attempt < 2) await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
          }
        }

        if (cancelled) return
        if (!tokenAddresses?.length) {
          // RPC failed — keep Supabase data visible
          setLoadingTokens(false)
          return
        }

        // Update sbMap with addresses we now know about
        const lowerAddrs = tokenAddresses.map(a => a.toLowerCase())
        if (supabase?.from && Object.keys(sbMap).length === 0) {
          try {
            const { data: sbRows } = await supabase
              .from('pumphub_tokens')
              .select('*')
              .in('token_address', lowerAddrs)
            if (sbRows) sbRows.forEach(r => { sbMap[r.token_address] = r })
          } catch (_) {}
        }

        // Step 4: RPC multicall for fresh data
        const multicallContracts = []
        tokenAddresses.forEach(addr => {
          multicallContracts.push(
            { address: PUMPHUB_FACTORY_ADDRESS, abi: PUMPHUB_FACTORY_ABI, functionName: 'getTokenMeta', args: [addr] },
            { address: PUMPHUB_FACTORY_ADDRESS, abi: PUMPHUB_FACTORY_ABI, functionName: 'tokenCore', args: [addr] },
            { address: PUMPHUB_FACTORY_ADDRESS, abi: PUMPHUB_FACTORY_ABI, functionName: 'tokenStats', args: [addr] },
          )
        })

        let mcResults
        try {
          mcResults = await publicClient.multicall({ contracts: multicallContracts, allowFailure: true })
        } catch (mcErr) {
          console.error('Multicall failed, trying chunks:', mcErr)
          mcResults = []
          for (let i = 0; i < multicallContracts.length; i += 15) {
            const chunk = multicallContracts.slice(i, i + 15)
            try {
              const res = await publicClient.multicall({ contracts: chunk, allowFailure: true })
              mcResults.push(...res)
            } catch {
              mcResults.push(...chunk.map(() => ({ status: 'failure' })))
            }
            if (i + 15 < multicallContracts.length) await new Promise(r => setTimeout(r, 400))
          }
        }

        if (cancelled) return

        // Step 5: Parse results and merge with Supabase images
        const fullTokens = []
        const upsertRows = []
        for (let i = 0; i < tokenAddresses.length; i++) {
          const addr = tokenAddresses[i]
          const metaR = mcResults[i * 3]
          const coreR = mcResults[i * 3 + 1]
          const statsR = mcResults[i * 3 + 2]

          if (metaR?.status === 'failure' || coreR?.status === 'failure' || statsR?.status === 'failure') {
            const sbRow = sbMap[addr.toLowerCase()]
            if (sbRow && sbRow.name && sbRow.name !== 'Unknown') {
              fullTokens.push({
                address: addr, name: sbRow.name, symbol: sbRow.symbol || '???',
                description: sbRow.description || '', image: sbRow.image_uri || '',
                creator: sbRow.creator || '', virtualETH: sbRow.virtual_eth || '1',
                realETH: sbRow.real_eth || '0', graduated: sbRow.graduated || false,
                buys: String(sbRow.total_buys || 0), sells: String(sbRow.total_sells || 0),
                volume: sbRow.total_volume || '0', holders: String(sbRow.holder_count || 0),
                _fromSupabase: true,
              })
            }
            continue
          }

          const meta = metaR.result
          const core = coreR.result
          const stats = statsR.result
          const sbRow = sbMap[addr.toLowerCase()]
          const bestImage = sbRow?.image_uri || meta[3] || ''
          const bestName = (sbRow?.name && sbRow.name !== 'Unknown') ? sbRow.name : (meta[0] || '')
          const bestSymbol = (sbRow?.symbol && sbRow.symbol !== '???') ? sbRow.symbol : (meta[1] || '')
          const bestDesc = sbRow?.description || meta[2] || ''

          const token = parseOnChainToken(addr, meta, core, stats)
          token.image = bestImage
          token.name = bestName || token.name
          token.symbol = bestSymbol || token.symbol
          token.description = bestDesc || token.description
          fullTokens.push(token)

          upsertRows.push({
            token_address: addr.toLowerCase(),
            creator: (core[0] || sbRow?.creator || '').toLowerCase(),
            name: bestName,
            symbol: bestSymbol,
            description: bestDesc,
            image_uri: bestImage,
            virtual_eth: formatEther(core[1] || 0n),
            virtual_tokens: formatUnits(core[2] || 0n, 18),
            real_eth: formatEther(core[3] || 0n),
            graduated: core[7] || false,
            total_buys: Number(stats[0] || 0),
            total_sells: Number(stats[1] || 0),
            total_volume: formatEther(stats[2] || 0n),
            holder_count: Number(stats[3] || 0),
            updated_at: new Date().toISOString(),
          })
        }

        if (!cancelled && fullTokens.length > 0) {
          setTokens(fullTokens)
          setTokensListKey(k => k + 1)
        }

        // Step 6: Upsert all token data back to Supabase (background, best-effort)
        if (supabase?.from && upsertRows.length > 0) {
          supabase.from('pumphub_tokens').upsert(upsertRows, { onConflict: 'token_address' }).catch(e => {
            console.error('Supabase sync upsert failed:', e)
          })
        }
      } catch (err) {
        console.error('Error fetching tokens:', err)
      } finally {
        if (!cancelled) setLoadingTokens(false)
      }
    }

    fetchTokens()
    return () => { cancelled = true }
  }, [publicClient, parseOnChainToken])
  
  // Fetch selected token data (with retry on 429 rate limit)
  useEffect(() => {
    let cancelled = false
    const maxRetries = 2
    const retryDelayMs = 1800

    const fetchSelectedTokenData = async (attempt = 0) => {
      if (!selectedToken || !publicClient) return
      
      try {
        const [meta, core, stats] = await Promise.all([
          publicClient.readContract({
            address: PUMPHUB_FACTORY_ADDRESS,
            abi: PUMPHUB_FACTORY_ABI,
            functionName: 'getTokenMeta',
            args: [selectedToken]
          }),
          publicClient.readContract({
            address: PUMPHUB_FACTORY_ADDRESS,
            abi: PUMPHUB_FACTORY_ABI,
            functionName: 'tokenCore',
            args: [selectedToken]
          }),
          publicClient.readContract({
            address: PUMPHUB_FACTORY_ADDRESS,
            abi: PUMPHUB_FACTORY_ABI,
            functionName: 'tokenStats',
            args: [selectedToken]
          })
        ])
        
        if (cancelled) return
        setSelectedTokenData({
          tokenMeta: { name: meta[0], symbol: meta[1], description: meta[2], image: meta[3] },
          tokenData: {
            creator: core[0],
            virtualETH: formatEther(core[1] || 0n),
            virtualTokens: formatUnits(core[2] || 0n, 18),
            realETH: formatEther(core[3] || 0n),
            createdAt: core[5]?.toString(),
            graduated: core[7]
          },
          tokenStats: {
            buys: stats[0]?.toString(),
            sells: stats[1]?.toString(),
            volume: formatEther(stats[2] || 0n),
            holders: stats[3]?.toString()
          }
        })
      } catch (err) {
        const msg = (err?.message ?? err?.cause?.message ?? err?.details?.message ?? '').toString().toLowerCase()
        const isRateLimit = msg.includes('429') || msg.includes('rate limit') || msg.includes('over rate limit')
        if (isRateLimit && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelayMs))
          if (!cancelled) fetchSelectedTokenData(attempt + 1)
        } else {
          console.error('Error fetching selected token data:', err)
        }
      }
    }
    
    fetchSelectedTokenData()
    return () => { cancelled = true }
  }, [selectedToken, publicClient])
  
  // Filter and sort tokens
  const filteredTokens = useMemo(() => {
    let result = [...tokens]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t => 
        t.name?.toLowerCase().includes(query) ||
        t.symbol?.toLowerCase().includes(query) ||
        t.address?.toLowerCase().includes(query)
      )
    }
    
    // Category filter
    if (category === 'graduated') {
      result = result.filter(t => t.graduated)
    } else if (category === 'new') {
      const oneDayAgo = Date.now() / 1000 - 86400
      result = result.filter(t => parseInt(t.createdAt || 0) > oneDayAgo)
    }
    
    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => parseInt(b.createdAt || 0) - parseInt(a.createdAt || 0))
        break
      case 'volume':
        result.sort((a, b) => parseFloat(b.volume || 0) - parseFloat(a.volume || 0))
        break
      case 'marketcap':
        result.sort((a, b) => {
          const mcA = (parseFloat(a.virtualETH || 1) + parseFloat(a.realETH || 0)) * ETH_PRICE_USD
          const mcB = (parseFloat(b.virtualETH || 1) + parseFloat(b.realETH || 0)) * ETH_PRICE_USD
          return mcB - mcA
        })
        break
      case 'progress':
        result.sort((a, b) => parseFloat(b.realETH || 0) - parseFloat(a.realETH || 0))
        break
    }
    
    return result
  }, [tokens, searchQuery, category, sortBy])

  // Pagination: show 10 tokens per page
  const totalPages = Math.max(1, Math.ceil(filteredTokens.length / TOKENS_PER_PAGE))
  const paginatedTokens = useMemo(() => {
    const start = (currentPage - 1) * TOKENS_PER_PAGE
    return filteredTokens.slice(start, start + TOKENS_PER_PAGE)
  }, [filteredTokens, currentPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [category, searchQuery, sortBy])

  // Clamp page when total pages shrinks
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [totalPages, currentPage])
  
  // Handle logo upload
  const handleLogoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    
    // Upload to Pinata immediately
    setIsUploadingLogo(true)
    try {
      const ipfsUrl = await uploadToIPFS(file)
      setFormData(prev => ({ ...prev, logoUrl: ipfsUrl }))
      setLogoError(false)
      console.log('✅ Logo uploaded to IPFS:', ipfsUrl)
    } catch (err) {
      console.error('Failed to upload logo:', err)
      alert('Failed to upload logo to IPFS')
    } finally {
      setIsUploadingLogo(false)
    }
  }
  
  // Handle token creation
  const handleCreateToken = async (e) => {
    e.preventDefault()
    
    if (!isConnected) {
      alert('Please connect your wallet')
      return
    }
    
    if (!formData.logoUrl || !formData.logoUrl.trim()) {
      setLogoError(true)
      return
    }
    setLogoError(false)
    
    if (!formData.name || !formData.symbol) {
      alert('Please fill in token name and symbol')
      return
    }
    
    try {
      await createToken(
        formData.name,
        formData.symbol,
        formData.description,
        formData.logoUrl,
        formData.creatorAllocation
      )
    } catch (err) {
      console.error('Create token error:', err)
    }
  }
  
  // Handle success modal actions
  const handleViewCreatedToken = () => {
    if (lastCreatedToken?.address) {
      setSelectedTokenAndUrl(lastCreatedToken.address)
      setActiveTab('tokens')
      clearLastCreatedToken()
    }
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page" style={{ overflow: 'hidden', overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}>
        <div 
          className="deploy-container" 
          style={{ 
            padding: isMobile ? 10 : 20,
            paddingBottom: isMobile ? 100 : 20,
            maxWidth: '1400px',
            width: '100%',
            boxSizing: 'border-box',
            margin: '0 auto',
            overflowX: 'hidden',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 20, flexWrap: 'wrap' }}>
            <BackButton style={{ marginBottom: 0 }} />
            {selectedToken && (
              <button
                type="button"
                onClick={() => setSelectedTokenAndUrl(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  minHeight: isMobile ? 44 : undefined,
                  padding: isMobile ? '12px 16px' : '8px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontSize: isMobile ? 14 : 14,
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Flame size={isMobile ? 18 : 16} />
                Tokens
              </button>
            )}
          </div>
          
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 12 : 16, 
            marginBottom: isMobile ? 16 : 20,
            flexWrap: 'wrap',
            minWidth: 0
          }}>
            <div style={{
              width: isMobile ? '48px' : '60px',
              height: isMobile ? '48px' : '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Rocket size={isMobile ? 24 : 32} color="#fff" />
            </div>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <h1 style={{ 
                fontSize: isMobile ? 22 : 32, 
                fontWeight: 'bold', 
                color: '#fff',
                margin: 0
              }}>
                PumpHub
              </h1>
              <p style={{ 
                color: '#9ca3af', 
                margin: 0,
                fontSize: isMobile ? 12 : 14
              }}>
                Launch and trade meme tokens on Base
              </p>
            </div>
            {isInFarcaster && sdk?.actions?.composeCast && (
              <button
                type="button"
                onClick={handleShareCast}
                disabled={isSharingCast}
                style={{
                  marginLeft: 'auto',
                  padding: isMobile ? '10px 14px' : '12px 18px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  background: isSharingCast
                    ? 'rgba(59, 130, 246, 0.4)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isSharingCast ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isSharingCast ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                <Share2 size={18} />
                {isSharingCast ? 'Sharing...' : 'Share on Farcaster'}
              </button>
            )}
          </div>
          
          {/* Platform Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? 8 : 12,
            marginBottom: isMobile ? 16 : 20
          }}>
            {[
              { label: 'Total Tokens', value: platformStats ? platformStats.totalTokens : '0', color: '#fff' },
              { label: 'Graduated', value: platformStats ? platformStats.graduated : '0', color: '#3b82f6' },
              { label: 'Total Volume', value: platformStats ? `${platformStats.totalVolumeETH.toFixed(2)} ETH` : '0 ETH', color: '#3b82f6' },
              { label: 'Trading Fee', value: '0.6%', color: '#3b82f6' }
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
                  borderRadius: isMobile ? 10 : 12,
                  padding: isMobile ? 12 : 16,
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}
              >
                <div style={{ color: '#9ca3af', fontSize: isMobile ? 11 : 12, marginBottom: 4 }}>{label}</div>
                <div style={{ color, fontSize: isMobile ? 16 : 20, fontWeight: 'bold' }}>{value}</div>
              </div>
            ))}
          </div>
          
          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? 8 : 8, 
            marginBottom: isMobile ? 16 : 20,
            overflowX: 'auto',
            paddingBottom: 4,
            minHeight: isMobile ? 48 : undefined
          }}>
            <button
              onClick={() => { setActiveTab('tokens'); setSelectedTokenAndUrl(null) }}
              style={{
                flex: isMobile ? 1 : undefined,
                minHeight: isMobile ? 48 : undefined,
                padding: isMobile ? '12px 16px' : '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'tokens' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                fontSize: isMobile ? 14 : 14
              }}
            >
              <Flame size={isMobile ? 18 : 18} />
              Tokens
            </button>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                flex: isMobile ? 1 : undefined,
                minHeight: isMobile ? 48 : undefined,
                padding: isMobile ? '12px 16px' : '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'create' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                fontSize: isMobile ? 14 : 14
              }}
            >
              <Plus size={isMobile ? 18 : 18} />
              Create Token
            </button>
          </div>
          
          {/* Content */}
          {activeTab === 'tokens' && (
            <>
              {/* Token selected - show mini cards */}
              {selectedToken ? (
                <>
                  {/* Mini token cards (horizontal scroll) */}
                  <div style={{ marginBottom: isMobile ? 12 : 16 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: isMobile ? 8 : 12, 
                      marginBottom: isMobile ? 10 : 12,
                      flexWrap: 'wrap',
                      minWidth: 0,
                      width: '100%'
                    }}>
                      <button
                        onClick={() => setSelectedTokenAndUrl(null)}
                        style={{
                          minHeight: isMobile ? 44 : undefined,
                          padding: isMobile ? '12px 14px' : '8px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#60a5fa',
                          fontSize: isMobile ? 14 : 12,
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <ArrowLeft size={isMobile ? 18 : 14} />
                        Back
                      </button>
                      <button
                        onClick={copyTokenLink}
                        title="Copy token link"
                        style={{
                          minHeight: isMobile ? 44 : undefined,
                          padding: isMobile ? '12px 14px' : '8px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: tokenLinkCopied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                          color: tokenLinkCopied ? '#22c55e' : '#60a5fa',
                          fontSize: isMobile ? 14 : 12,
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {tokenLinkCopied ? <Check size={isMobile ? 18 : 14} /> : <Link2 size={isMobile ? 18 : 14} />}
                        {tokenLinkCopied ? 'Copied' : 'Copy link'}
                      </button>
                      <div style={{
                        flex: 1,
                        minWidth: isMobile ? '100%' : 120,
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 10,
                        padding: isMobile ? 12 : '6px 12px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        maxWidth: isMobile ? 'none' : 250
                      }}>
                        <Search size={isMobile ? 18 : 14} color="#9ca3af" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search tokens..."
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontSize: isMobile ? 14 : 12,
                            marginLeft: 8,
                            outline: 'none',
                            minWidth: 0
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: isMobile ? 8 : 8,
                      overflowX: 'auto',
                      paddingBottom: 8,
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      {filteredTokens.map(token => (
                        <MiniTokenCard
                          key={token.address}
                          token={token}
                          isSelected={token.address === selectedToken}
                          isMobile={isMobile}
                          onClick={() => setSelectedTokenAndUrl(token.address)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Token details: on mobile trade first (fully visible), then chart; desktop side-by-side */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 350px',
                    gap: isMobile ? 12 : 16,
                    alignItems: 'start',
                    paddingBottom: isMobile ? 100 : 0,
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    overflow: 'hidden'
                  }}>
                    {isMobile ? (
                      <>
                        <TokenTradePanel 
                          tokenData={selectedTokenData} 
                          tokenAddress={selectedToken}
                          buyTokens={buyTokens}
                          sellTokens={sellTokens}
                          claimFees={claimFees}
                          isLoading={isLoading}
                          isMobile={isMobile}
                          error={error}
                        />
                        <TokenChartPanel 
                          tokenData={selectedTokenData} 
                          tokenAddress={selectedToken}
                          lastTradeConfirmedAt={lastTradeConfirmedAt}
                          isMobile={isMobile}
                        />
                      </>
                    ) : (
                      <>
                        <TokenChartPanel 
                          tokenData={selectedTokenData} 
                          tokenAddress={selectedToken}
                          lastTradeConfirmedAt={lastTradeConfirmedAt}
                          isMobile={isMobile}
                        />
                        <TokenTradePanel 
                          tokenData={selectedTokenData} 
                          tokenAddress={selectedToken}
                          buyTokens={buyTokens}
                          sellTokens={sellTokens}
                          claimFees={claimFees}
                          isLoading={isLoading}
                          isMobile={isMobile}
                          error={error}
                        />
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Search and filters */}
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 10 : 12,
                    marginBottom: isMobile ? 14 : 16
                  }}>
                    {/* Search */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 10,
                      padding: isMobile ? 14 : '10px 14px',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <Search size={isMobile ? 20 : 18} color="#9ca3af" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, symbol, or address..."
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: isMobile ? 16 : 14,
                          marginLeft: 10,
                          outline: 'none',
                          minWidth: 0
                        }}
                      />
                    </div>
                    
                    {/* Sort dropdown */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        minHeight: isMobile ? 48 : undefined,
                        padding: isMobile ? '14px 16px' : '10px 14px',
                        borderRadius: 10,
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: isMobile ? 16 : 14,
                        cursor: 'pointer',
                        outline: 'none',
                        width: isMobile ? '100%' : undefined
                      }}
                    >
                      <option value="newest">Newest</option>
                      <option value="volume">Volume</option>
                      <option value="marketcap">Market Cap</option>
                      <option value="progress">Progress</option>
                    </select>
                  </div>
                  
                  {/* Category filters */}
                  <div style={{
                    display: 'flex',
                    gap: isMobile ? 8 : 8,
                    marginBottom: isMobile ? 14 : 16,
                    overflowX: 'auto',
                    paddingBottom: 4,
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    {[
                      { id: 'all', label: 'All', icon: Globe },
                      { id: 'new', label: 'New', icon: Zap },
                      { id: 'graduated', label: 'Graduated', icon: Star }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        style={{
                          minHeight: isMobile ? 44 : undefined,
                          padding: isMobile ? '12px 16px' : '8px 14px',
                          borderRadius: 10,
                          border: category === cat.id ? '1px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
                          background: category === cat.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                          color: category === cat.id ? '#60a5fa' : '#9ca3af',
                          fontSize: isMobile ? 14 : 13,
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <cat.icon size={isMobile ? 16 : 14} />
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* Token grid */}
                  {loadingTokens ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: isMobile ? 40 : 60,
                      color: '#9ca3af',
                      fontSize: isMobile ? 14 : undefined
                    }}>
                      <RefreshCw size={isMobile ? 22 : 24} className="animate-spin" style={{ marginRight: 12 }} />
                      Loading tokens...
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: isMobile ? 40 : 60,
                      color: '#9ca3af'
                    }}>
                      <Rocket size={isMobile ? 40 : 48} style={{ marginBottom: 16, opacity: 0.5 }} />
                      <p style={{ fontSize: isMobile ? 14 : undefined }}>No tokens found</p>
                      <button
                        onClick={() => setActiveTab('create')}
                        style={{
                          marginTop: 16,
                          minHeight: isMobile ? 48 : undefined,
                          padding: isMobile ? '14px 24px' : '12px 24px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          color: '#fff',
                          fontWeight: '600',
                          fontSize: isMobile ? 16 : undefined,
                          cursor: 'pointer'
                        }}
                      >
                        Create First Token
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        key={tokensListKey}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                          gap: '16px'
                        }}
                      >
                        {paginatedTokens.map(token => (
                          <TokenCard
                            key={token.address}
                            token={token}
                            isMobile={isMobile}
                            onClick={() => setSelectedTokenAndUrl(token.address)}
                          />
                        ))}
                      </div>
                      {/* Pagination: 1, 2, 3, 4, 5... */}
                      {totalPages > 1 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: isMobile ? 8 : 6,
                          marginTop: isMobile ? 20 : 24,
                          flexWrap: 'wrap',
                          paddingBottom: isMobile ? 24 : 16
                        }}>
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{
                              minHeight: isMobile ? 44 : undefined,
                              padding: isMobile ? '12px 14px' : '8px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.15)',
                              color: currentPage === 1 ? '#6b7280' : '#60a5fa',
                              fontWeight: '600',
                              fontSize: isMobile ? 16 : 14,
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ←
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              style={{
                                minWidth: isMobile ? 44 : 36,
                                minHeight: isMobile ? 44 : undefined,
                                padding: isMobile ? '12px' : '8px 10px',
                                borderRadius: 10,
                                border: currentPage === page ? '1px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
                                background: currentPage === page ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(0, 0, 0, 0.2)',
                                color: currentPage === page ? '#fff' : '#9ca3af',
                                fontWeight: '600',
                                fontSize: isMobile ? 16 : 14,
                                cursor: 'pointer'
                              }}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                              minHeight: isMobile ? 44 : undefined,
                              padding: isMobile ? '12px 14px' : '8px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.15)',
                              color: currentPage === totalPages ? '#6b7280' : '#60a5fa',
                              fontWeight: '600',
                              fontSize: isMobile ? 16 : 14,
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                            }}
                          >
                            →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          
          {/* Create Token Tab */}
          {activeTab === 'create' && (
            <div style={{
              maxWidth: isMobile ? '100%' : 600,
              margin: '0 auto',
              paddingBottom: isMobile ? 80 : 0
            }}>
              <div style={{
                background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
                borderRadius: isMobile ? 16 : 20,
                padding: isMobile ? 16 : 30,
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <h2 style={{ 
                  color: '#fff', 
                  marginBottom: isMobile ? 20 : 24,
                  fontSize: isMobile ? 20 : 24
                }}>
                  🚀 Launch Your Token
                </h2>
                
                <form onSubmit={handleCreateToken}>
                  {/* Logo upload - required */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Token Logo <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '16px',
                        background: logoPreview ? 'transparent' : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
                        border: logoError ? '2px solid #ef4444' : '2px dashed rgba(59, 130, 246, 0.4)',
                        boxShadow: logoError ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onClick={() => document.getElementById('logo-input').click()}
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Plus size={24} color={logoError ? '#ef4444' : '#3b82f6'} />
                        )}
                        {isUploadingLogo && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <RefreshCw size={20} color="#fff" className="animate-spin" />
                          </div>
                        )}
                      </div>
                      <input
                        id="logo-input"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        style={{ display: 'none' }}
                      />
                      <div>
                        <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>
                          {isUploadingLogo ? 'Uploading to IPFS...' : formData.logoUrl ? '✅ Logo uploaded!' : 'Click to upload'}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                          PNG, JPG up to 2MB
                        </div>
                        {logoError && (
                          <div style={{ color: '#f87171', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={14} /> Logo is required to launch
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Token name */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Token Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Pepe Token"
                      maxLength={32}
                      required
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: '16px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  
                  {/* Token symbol */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Token Symbol *
                    </label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                      placeholder="e.g., PEPE"
                      maxLength={8}
                      required
                      style={{
                        width: '100%',
                        minHeight: isMobile ? 48 : undefined,
                        padding: isMobile ? 16 : 14,
                        borderRadius: 10,
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: isMobile ? 16 : 16,
                        outline: 'none',
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>
                  
                  {/* Description */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Tell us about your token..."
                      maxLength={256}
                      rows={isMobile ? 3 : 3}
                      style={{
                        width: '100%',
                        padding: isMobile ? 16 : 14,
                        borderRadius: 10,
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: isMobile ? 16 : 14,
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  {/* Creator allocation */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Creator Allocation: {formData.creatorAllocation}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={formData.creatorAllocation}
                      onChange={(e) => setFormData(prev => ({ ...prev, creatorAllocation: parseFloat(e.target.value) }))}
                      style={{
                        width: '100%',
                        accentColor: '#3b82f6'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                      <span>0%</span>
                      <span>Max 10%</span>
                    </div>
                  </div>
                  
                  {/* Info box */}
                  <div style={{
                    padding: '16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    marginBottom: '24px'
                  }}>
                    <div style={{ color: '#60a5fa', fontWeight: '600', marginBottom: '8px' }}>
                      ℹ️ Token Launch Details
                    </div>
                    <ul style={{ color: '#9ca3af', fontSize: '13px', margin: 0, paddingLeft: '20px' }}>
                      <li>Total Supply: 1,000,000,000 tokens</li>
                      <li>Initial Market Cap: ~$3,000 USD</li>
                      <li>Creation Fee: 0.001 ETH</li>
                      <li>Trading Fee: 0.6% (50% to creator, 50% to platform)</li>
                      <li>LP locks at 5 ETH accumulated</li>
                    </ul>
                  </div>
                  
                  {logoError && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      borderRadius: '10px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={18} />
                      Logo is required. Please upload a token logo above to launch.
                    </div>
                  )}
                  
                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={!isConnected || isLoading || isUploadingLogo}
                    style={{
                      width: '100%',
                      minHeight: isMobile ? 52 : undefined,
                      padding: isMobile ? 18 : 16,
                      borderRadius: 12,
                      border: logoError ? '2px solid #ef4444' : 'none',
                      boxShadow: logoError ? '0 0 0 1px rgba(239, 68, 68, 0.3)' : 'none',
                      background: !isConnected || isLoading || isUploadingLogo
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: isMobile ? 18 : 18,
                      cursor: !isConnected || isLoading || isUploadingLogo ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    {!isConnected ? (
                      <>
                        <Wallet size={20} />
                        Connect Wallet
                      </>
                    ) : isLoading ? (
                      <>
                        <RefreshCw size={20} className="animate-spin" />
                        Creating Token...
                      </>
                    ) : (
                      <>
                        <Rocket size={20} />
                        Launch Token (0.001 ETH)
                      </>
                    )}
                  </button>
                  
                  {error && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '10px',
                      color: '#ef4444',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
        
        {/* Success Modal */}
        {lastCreatedToken && (
          <TokenCreationSuccessModal
            token={lastCreatedToken}
            onClose={clearLastCreatedToken}
            onViewToken={handleViewCreatedToken}
          />
        )}
      </div>
    </NetworkGuard>
  )
}

export default PumpHub
