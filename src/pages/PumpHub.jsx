import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAccount, useReadContract, usePublicClient, useBalance } from 'wagmi'
import { formatEther, formatUnits, parseEther } from 'viem'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { 
  Rocket, TrendingUp, Users, Zap, Search, Filter, Plus, ArrowLeft, 
  ExternalLink, Copy, Check, Flame, Clock, BarChart3, Globe, Star,
  ChevronDown, ChevronUp, RefreshCw, Wallet, AlertCircle, X, ArrowUpRight, Share2
} from 'lucide-react'
import ReactApexChart from 'react-apexcharts'
import NetworkGuard from '../components/NetworkGuard'
import BackButton from '../components/BackButton'
import { usePumpHub, usePumpHubData } from '../hooks/usePumpHub'
import { useFarcaster } from '../contexts/FarcasterContext'
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
    if (!src) { setStatus('error'); return }
    setGatewayIdx(0)
    setCurrentSrc(toFastGateway(src, 0))
    setStatus('loading')
  }, [src])

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
      background: status === 'error' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(30,30,40,0.6)',
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
          src={currentSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: status === 'loaded' ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />
      ) : (
        <Rocket size={size * 0.4} color="#fff" />
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
const MiniTokenCard = ({ token, onClick, isSelected }) => {
  return (
    <div 
      onClick={onClick}
      style={{
        background: isSelected 
          ? 'linear-gradient(145deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.2) 100%)'
          : 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.95) 100%)',
        borderRadius: '10px',
        padding: '8px 12px',
        cursor: 'pointer',
        border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '120px',
        flexShrink: 0,
        transition: 'all 0.2s ease'
      }}
    >
      <TokenImage src={token.image} alt={token.name} size={32} borderRadius="8px" />
      <div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{token.symbol}</div>
        <div style={{ fontSize: '10px', color: '#9ca3af' }}>{formatMarketCap(parseFloat(token.virtualETH || 1) * ETH_PRICE_USD)}</div>
      </div>
    </div>
  )
}

// ============================================
// TOKEN CHART PANEL
// ============================================
const TokenChartPanel = ({ tokenData, tokenAddress }) => {
  const [timeframe, setTimeframe] = useState('4h')
  const [tradeHistory, setTradeHistory] = useState([])
  const [loadingTrades, setLoadingTrades] = useState(true)
  
  // Fetch trade history from Supabase
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
  }, [tokenAddress])
  
  // Calculate market cap
  const virtualETH = parseFloat(tokenData?.tokenData?.virtualETH || tokenData?.virtualETH || 1)
  const realETH = parseFloat(tokenData?.tokenData?.realETH || tokenData?.realETH || 0)
  const marketCapETH = virtualETH + realETH
  const marketCapUSD = marketCapETH * ETH_PRICE_USD
  const initialMarketCapUSD = 1 * ETH_PRICE_USD // 1 ETH virtual at start
  
  // Progress to graduation
  const progress = Math.min((realETH / 5) * 100, 100)
  
  // Generate candlestick data from Supabase trades for ApexCharts
  const candlestickData = useMemo(() => {
    const data = []
    
    // Token creation time
    const createdAt = tokenData?.tokenData?.createdAt 
      ? parseInt(tokenData.tokenData.createdAt) * 1000 
      : Date.now() - 24 * 60 * 60 * 1000
    
    const now = Date.now()
    
    // Time bucket based on timeframe
    const bucketMinutes = {
      '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440
    }
    const bucketMs = (bucketMinutes[timeframe] || 240) * 60 * 1000
    
    // Calculate number of buckets
    const timeDiff = now - createdAt
    const numBuckets = Math.min(Math.max(Math.ceil(timeDiff / bucketMs), 10), 50)
    
    // Create time buckets
    let runningMC = initialMarketCapUSD
    
    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = createdAt + i * bucketMs
      const bucketEnd = bucketStart + bucketMs
      
      // Find trades in this bucket
      const bucketTrades = (tradeHistory || []).filter(t => {
        const tradeTime = new Date(t.created_at).getTime()
        return tradeTime >= bucketStart && tradeTime < bucketEnd
      })
      
      const open = runningMC
      let high = runningMC
      let low = runningMC
      
      // Process trades in this bucket
      bucketTrades.forEach(trade => {
        const ethAmount = parseFloat(trade.eth_amount || 0)
        const mcChange = ethAmount * ETH_PRICE_USD * 2
        
        if (trade.trade_type === 'buy') {
          runningMC += mcChange
        } else {
          runningMC -= mcChange
        }
        runningMC = Math.max(runningMC, initialMarketCapUSD * 0.3)
        
        high = Math.max(high, runningMC)
        low = Math.min(low, runningMC)
      })
      
      const close = runningMC
      
      // Add candle - ApexCharts format: [open, high, low, close]
      data.push({
        x: new Date(bucketStart),
        y: [open, high, low, close]
      })
    }
    
    return data
  }, [tradeHistory, initialMarketCapUSD, timeframe, tokenData])
  
  // ApexCharts options
  const chartOptions = useMemo(() => ({
    chart: {
      type: 'candlestick',
      height: 350,
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: false,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
        autoSelected: 'zoom',
        offsetX: -10
      },
      animations: {
        enabled: true,
        speed: 500
      },
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true
      },
      offsetX: 0,
      offsetY: 0,
      sparkline: {
        enabled: false
      }
    },
    theme: {
      mode: 'dark'
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '11px'
        },
        datetimeFormatter: {
          year: 'yyyy',
          month: "MMM 'yy",
          day: 'dd MMM',
          hour: 'HH:mm'
        }
      },
      axisBorder: {
        color: 'rgba(255,255,255,0.1)'
      },
      axisTicks: {
        color: 'rgba(255,255,255,0.1)'
      }
    },
    yaxis: {
      opposite: true,
      floating: false,
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '11px'
        },
        formatter: (val) => formatMarketCap(val),
        offsetX: 0
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      tooltip: {
        enabled: true
      },
      crosshairs: {
        show: true,
        stroke: {
          color: '#3b82f6',
          width: 1,
          dashArray: 3
        }
      }
    },
    grid: {
      borderColor: 'rgba(255,255,255,0.08)',
      strokeDashArray: 4
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#22c55e',
          downward: '#ef4444'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      x: {
        format: 'dd MMM HH:mm'
      },
      y: {
        formatter: (val) => formatMarketCap(val)
      }
    },
    annotations: {
      yaxis: [{
        y: marketCapUSD,
        borderColor: '#3b82f6',
        strokeDashArray: 5,
        borderWidth: 1,
        label: {
          borderColor: 'transparent',
          style: {
            color: '#fff',
            background: '#3b82f6',
            fontSize: '10px',
            fontWeight: 600,
            padding: {
              left: 5,
              right: 5,
              top: 2,
              bottom: 2
            }
          },
          text: formatMarketCap(marketCapUSD),
          position: 'right',
          offsetX: 0,
          offsetY: 0
        }
      }]
    }
  }), [marketCapUSD])
  
  const chartSeries = useMemo(() => [{
    name: 'Market Cap',
    data: candlestickData
  }], [candlestickData])

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
      borderRadius: '16px',
      padding: '16px',
      border: '1px solid rgba(59, 130, 246, 0.2)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
            {formatMarketCap(marketCapUSD)}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>Market Cap</div>
        </div>
        
        {/* Timeframe buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: 'none',
                background: timeframe === tf ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                color: timeframe === tf ? '#fff' : '#9ca3af',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
          <span style={{ color: '#9ca3af' }}>Progress to LP Lock</span>
          <span style={{ color: progress >= 100 ? '#10b981' : '#3b82f6' }}>
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
      
      {/* Chart */}
      <div style={{ 
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)', 
        borderRadius: '12px', 
        padding: '8px',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        minHeight: '380px'
      }}>
        {loadingTrades ? (
          <div style={{ 
            height: '350px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#9ca3af'
          }}>
            <RefreshCw size={24} className="animate-spin" style={{ marginRight: '10px' }} />
            Loading chart data...
          </div>
        ) : (
          <ReactApexChart
            options={chartOptions}
            series={chartSeries}
            type="candlestick"
            height={350}
          />
        )}
      </div>
      
      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginTop: '12px'
      }}>
        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>24h High</div>
          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
            {formatMarketCap(candlestickData.length > 0 ? Math.max(...candlestickData.map(d => d.y[1])) : marketCapUSD)}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>24h Low</div>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>
            {formatMarketCap(candlestickData.length > 0 ? Math.min(...candlestickData.map(d => d.y[2])) : initialMarketCapUSD)}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>Volume</div>
          <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
            {formatNumber(tokenData?.tokenStats?.volume || 0)} ETH
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>Txns</div>
          <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
            {parseInt(tokenData?.tokenStats?.buys || 0) + parseInt(tokenData?.tokenStats?.sells || 0)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TOKEN TRADE PANEL
// ============================================
const TokenTradePanel = ({ tokenData, tokenAddress }) => {
  const { address, isConnected } = useAccount()
  const [tradeMode, setTradeMode] = useState('buy')
  const [amount, setAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { buyTokens, sellTokens, claimFees, isLoading, error } = usePumpHub()
  
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
      borderRadius: '16px',
      padding: '16px',
      border: '1px solid rgba(59, 130, 246, 0.2)'
    }}>
      {/* Trade mode tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => { setTradeMode('buy'); setAmount('') }}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: tradeMode === 'buy' 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontWeight: 'bold',
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
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: tradeMode === 'sell' 
              ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
              : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Sell
        </button>
      </div>
      
      {/* Balance display */}
      <div style={{
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '10px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
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
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '10px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          padding: '12px'
        }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tradeMode === 'buy' ? 'ETH amount' : 'Token amount'}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              outline: 'none'
            }}
          />
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            {tradeMode === 'buy' ? 'ETH' : tokenData?.tokenMeta?.symbol || 'TOKEN'}
          </span>
        </div>
      </div>
      
      {/* Quick amounts */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {quickAmounts.map(val => (
          <button
            key={val}
            onClick={() => handleQuickAmount(val)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              fontSize: '12px',
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
          padding: '14px',
          borderRadius: '12px',
          border: 'none',
          background: !isConnected || !amount || parseFloat(amount) <= 0 || isLoading || isProcessing
            ? 'rgba(255,255,255,0.1)'
            : tradeMode === 'buy'
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '16px',
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
          marginTop: '16px',
          padding: '12px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
          borderRadius: '10px',
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
  const [tokens, setTokens] = useState([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [category, setCategory] = useState('all')
  
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
  const [isSharingCast, setIsSharingCast] = useState(false)
  
  const farcaster = useFarcaster()
  const isInFarcaster = farcaster?.isInFarcaster ?? false
  const sdk = farcaster?.sdk ?? null
  
  const handleShareCast = async () => {
    if (!sdk?.actions?.composeCast) return
    setIsSharingCast(true)
    try {
      const castText = `🚀 PumpHub on BaseHub – Launch & trade meme tokens! 🔥\n\n✨ Fair launch, no presale\n💎 Create token with 0.001 ETH\n📈 Bonding curve → graduate to DEX\n🎯 Earn 2000 XP for creating, 100 XP per trade\n\nTry it on Base 👇\n\n#BaseHub #PumpHub #Base #Memecoin\n\n🌐 Web: https://www.basehub.fun/pumphub\n🎭 Farcaster: https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub`
      await sdk.actions.composeCast({
        text: castText,
        embeds: ['https://www.basehub.fun/pumphub']
      })
    } catch (err) {
      console.error('PumpHub cast failed:', err)
    } finally {
      setIsSharingCast(false)
    }
  }
  
  const { 
    createToken, 
    isLoading, 
    error, 
    lastCreatedToken, 
    clearLastCreatedToken 
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

  // Fetch tokens: hybrid Supabase-first, then background RPC sync
  useEffect(() => {
    let cancelled = false

    const fetchTokens = async () => {
      if (!publicClient) { setLoadingTokens(false); return }

      try {
        // Step 1: Get on-chain token count & addresses (2 lightweight RPC calls)
        let onChainCount = 0
        try {
          const countRaw = await publicClient.readContract({
            address: PUMPHUB_FACTORY_ADDRESS,
            abi: PUMPHUB_FACTORY_ABI,
            functionName: 'getAllTokensCount',
          })
          onChainCount = Number(countRaw)
        } catch { /* ignore */ }

        if (onChainCount === 0) {
          setTokens([])
          setLoadingTokens(false)
          return
        }

        let tokenAddresses = []
        try {
          tokenAddresses = await publicClient.readContract({
            address: PUMPHUB_FACTORY_ADDRESS,
            abi: PUMPHUB_FACTORY_ABI,
            functionName: 'getTokens',
            args: [0n, BigInt(Math.min(onChainCount, 100))]
          })
        } catch (e) {
          console.error('getTokens RPC failed:', e)
          setLoadingTokens(false)
          return
        }

        // Step 2: Load whatever we have in Supabase (fast, single query)
        let sbMap = {}
        if (supabase?.from) {
          try {
            const lowerAddrs = tokenAddresses.map(a => a.toLowerCase())
            const { data: sbRows } = await supabase
              .from('pumphub_tokens')
              .select('*')
              .in('token_address', lowerAddrs)
            if (sbRows) {
              sbRows.forEach(r => { sbMap[r.token_address] = r })
            }
          } catch (e) {
            console.error('Supabase fetch failed:', e)
          }
        }

        // Step 3: Show Supabase data immediately (fast first paint)
        const sbTokens = tokenAddresses.map(addr => {
          const row = sbMap[addr.toLowerCase()]
          if (row && row.name && row.name !== 'Unknown') {
            return {
              address: addr,
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
            }
          }
          return { address: addr, name: 'Loading...', symbol: '...', _fromSupabase: false }
        })

        if (!cancelled) {
          setTokens(sbTokens)
          setLoadingTokens(false)
        }

        // Step 4: Background RPC sync via multicall (fills missing/stale data)
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

        // Parse results and merge with Supabase images
        const fullTokens = []
        const upsertRows = []
        for (let i = 0; i < tokenAddresses.length; i++) {
          const addr = tokenAddresses[i]
          const metaR = mcResults[i * 3]
          const coreR = mcResults[i * 3 + 1]
          const statsR = mcResults[i * 3 + 2]

          if (metaR?.status === 'failure' || coreR?.status === 'failure' || statsR?.status === 'failure') {
            const existing = sbTokens.find(t => t.address === addr)
            if (existing && existing._fromSupabase) fullTokens.push(existing)
            continue
          }

          const meta = metaR.result
          const core = coreR.result
          const stats = statsR.result
          const sbRow = sbMap[addr.toLowerCase()]
          const onChainImage = meta[3] || ''
          const supabaseImage = sbRow?.image_uri || ''
          // Prefer Supabase values for fields that might be richer, fall back to on-chain
          const bestImage = supabaseImage || onChainImage
          const bestName = (sbRow?.name && sbRow.name !== 'Unknown') ? sbRow.name : (meta[0] || '')
          const bestSymbol = (sbRow?.symbol && sbRow.symbol !== '???') ? sbRow.symbol : (meta[1] || '')
          const bestDesc = sbRow?.description || meta[2] || ''

          const token = parseOnChainToken(addr, meta, core, stats)
          token.image = bestImage
          token.name = bestName || token.name
          token.symbol = bestSymbol || token.symbol
          token.description = bestDesc || token.description
          fullTokens.push(token)

          // Prepare Supabase upsert -- never overwrite non-empty fields with empty
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

        if (!cancelled) {
          setTokens(fullTokens)
        }

        // Step 5: Upsert all token data back to Supabase (background, best-effort)
        if (supabase?.from && upsertRows.length > 0) {
          try {
            await supabase.from('pumphub_tokens').upsert(upsertRows, { onConflict: 'token_address' })
          } catch (e) {
            console.error('Supabase sync upsert failed:', e)
          }
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
  
  // Fetch selected token data
  useEffect(() => {
    const fetchSelectedTokenData = async () => {
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
        console.error('Error fetching selected token data:', err)
      }
    }
    
    fetchSelectedTokenData()
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
      setSelectedToken(lastCreatedToken.address)
      setActiveTab('tokens')
      clearLastCreatedToken()
    }
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page" style={{ overflow: 'hidden' }}>
        <div 
          className="deploy-container" 
          style={{ 
            padding: isMobile ? '12px' : '20px',
            maxWidth: '1400px',
            margin: '0 auto',
            overflowX: 'hidden'
          }}
        >
          <BackButton />
          
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? '12px' : '16px', 
            marginBottom: '20px' 
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
            <div>
              <h1 style={{ 
                fontSize: isMobile ? '24px' : '32px', 
                fontWeight: 'bold', 
                color: '#fff',
                margin: 0
              }}>
                PumpHub
              </h1>
              <p style={{ 
                color: '#9ca3af', 
                margin: 0,
                fontSize: isMobile ? '12px' : '14px'
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
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Total Tokens</div>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                {platformStats ? platformStats.totalTokens : '0'}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Graduated</div>
              <div style={{ color: '#3b82f6', fontSize: '20px', fontWeight: 'bold' }}>
                {platformStats ? platformStats.graduated : '0'}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Total Volume</div>
              <div style={{ color: '#3b82f6', fontSize: '20px', fontWeight: 'bold' }}>
                {platformStats ? `${platformStats.totalVolumeETH.toFixed(2)} ETH` : '0 ETH'}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Trading Fee</div>
              <div style={{ color: '#3b82f6', fontSize: '20px', fontWeight: 'bold' }}>0.6%</div>
            </div>
          </div>
          
          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px',
            overflowX: 'auto',
            paddingBottom: '4px'
          }}>
            <button
              onClick={() => { setActiveTab('tokens'); setSelectedToken(null) }}
              style={{
                padding: isMobile ? '10px 16px' : '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'tokens' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                fontSize: isMobile ? '13px' : '14px'
              }}
            >
              <Flame size={isMobile ? 16 : 18} />
              Tokens
            </button>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                padding: isMobile ? '10px 16px' : '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'create' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                fontSize: isMobile ? '13px' : '14px'
              }}
            >
              <Plus size={isMobile ? 16 : 18} />
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
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      marginBottom: '12px' 
                    }}>
                      <button
                        onClick={() => setSelectedToken(null)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#60a5fa',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <ArrowLeft size={14} />
                        Back
                      </button>
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        maxWidth: '250px'
                      }}>
                        <Search size={14} color="#9ca3af" />
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
                            fontSize: '12px',
                            marginLeft: '8px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '8px'
                    }}>
                      {filteredTokens.map(token => (
                        <MiniTokenCard
                          key={token.address}
                          token={token}
                          isSelected={token.address === selectedToken}
                          onClick={() => setSelectedToken(token.address)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Token details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 350px',
                    gap: '16px'
                  }}>
                    <TokenChartPanel 
                      tokenData={selectedTokenData} 
                      tokenAddress={selectedToken} 
                    />
                    <TokenTradePanel 
                      tokenData={selectedTokenData} 
                      tokenAddress={selectedToken} 
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Search and filters */}
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    {/* Search */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <Search size={18} color="#9ca3af" />
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
                          fontSize: '14px',
                          marginLeft: '10px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    
                    {/* Sort dropdown */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: '14px',
                        cursor: 'pointer',
                        outline: 'none'
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
                    gap: '8px',
                    marginBottom: '16px',
                    overflowX: 'auto',
                    paddingBottom: '4px'
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
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: category === cat.id ? '1px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
                          background: category === cat.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                          color: category === cat.id ? '#60a5fa' : '#9ca3af',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <cat.icon size={14} />
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
                      padding: '60px',
                      color: '#9ca3af'
                    }}>
                      <RefreshCw size={24} className="animate-spin" style={{ marginRight: '12px' }} />
                      Loading tokens...
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '60px',
                      color: '#9ca3af'
                    }}>
                      <Rocket size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                      <p>No tokens found</p>
                      <button
                        onClick={() => setActiveTab('create')}
                        style={{
                          marginTop: '16px',
                          padding: '12px 24px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          color: '#fff',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Create First Token
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: '16px'
                    }}>
                      {filteredTokens.map(token => (
                        <TokenCard
                          key={token.address}
                          token={token}
                          isMobile={isMobile}
                          onClick={() => setSelectedToken(token.address)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          
          {/* Create Token Tab */}
          {activeTab === 'create' && (
            <div style={{
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <div style={{
                background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
                borderRadius: '20px',
                padding: isMobile ? '20px' : '30px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <h2 style={{ 
                  color: '#fff', 
                  marginBottom: '24px',
                  fontSize: isMobile ? '20px' : '24px'
                }}>
                  🚀 Launch Your Token
                </h2>
                
                <form onSubmit={handleCreateToken}>
                  {/* Logo upload */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Token Logo
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
                        border: '2px dashed rgba(59, 130, 246, 0.4)',
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
                          <Plus size={24} color="#3b82f6" />
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
                        padding: '14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: '16px',
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
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        fontSize: '14px',
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
                  
                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={!isConnected || isLoading || isUploadingLogo}
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '12px',
                      border: 'none',
                      background: !isConnected || isLoading || isUploadingLogo
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '18px',
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
