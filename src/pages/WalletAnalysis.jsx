import React, { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useWalletAnalysis } from '../hooks/useWalletAnalysis'
import { Wallet, Activity, TrendingUp, Award, AlertCircle, Loader2, Calendar, BarChart3, Zap, Eye, CheckCircle2, XCircle, Layers, Compass, Clock, Target, Gauge, Download, Clipboard, Image as ImageIcon } from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'

// Supported networks - must match backend configuration
const SUPPORTED_NETWORKS = {
  'base': { name: 'Base', color: '#4a90e2' },
  'katana': { name: 'Katana', color: '#ff7f50' },
  'opbnb': { name: 'opBNB', color: '#f0b90b' },
  'polygon': { name: 'Polygon', color: '#8247e5' },
  'sei': { name: 'Sei', color: '#ff3b30' },
  'stable': { name: 'Stable', color: '#2dd4bf' },
  'ethereum': { name: 'Ethereum', color: '#627eea' },
  'arbitrum': { name: 'Arbitrum', color: '#28a0f0' },
  'abstract': { name: 'Abstract', color: '#9945ff' },
  'celo': { name: 'Celo', color: '#35d07f' },
  'hyperevm': { name: 'HyperEVM', color: '#ff6b35' },
  'linea': { name: 'Linea', color: '#121212' },
  'monad': { name: 'Monad', color: '#8b5cf6' },
  'sonic': { name: 'Sonic', color: '#3b82f6' },
  'zksync': { name: 'zkSync', color: '#8c8dfc' },
}

export default function WalletAnalysis() {
  const { address, isConnected } = useAccount()
  const { analyzeWallet, isLoading, error, analysis, analysisProgress, isPassHolder, paymentPrice } = useWalletAnalysis()
  const [targetAddress, setTargetAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('base')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [shareStatus, setShareStatus] = useState('')

  useEffect(() => {
    if (!isLoading || !analysisProgress?.stageStartedAt) {
      setElapsedSeconds(0)
      return undefined
    }
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - analysisProgress.stageStartedAt) / 1000)))
    }, 500)
    return () => clearInterval(timer)
  }, [analysisProgress?.stageStartedAt, isLoading])

  const buildXText = () => {
    if (!analysis) return ''
    const report = analysis.airdropReport || {}
    const metrics = report.metrics || {}
    const parts = []
    parts.push(`I checked my ${analysis.network || selectedNetwork} wallet on BaseHub.`)
    parts.push(`Score: ${analysis.walletScore}/100`)
    parts.push(`Tier: ${report.tier || analysis.activityLevel || 'n/a'}`)
    parts.push(`Tx: ${metrics.totalTransactions || analysis.totalTransactions || 0}`)
    if (analysis.reportType === 'base-airdrop-readiness') {
      parts.push(`Active days: ${metrics.activeDays || 0}`)
      parts.push(`Protocols: ${metrics.protocolDiversity || 0}`)
    } else {
      parts.push(`Active span: ${analysis.daysActive || 0} days`)
      parts.push(`Token diversity: ${analysis.tokenDiversity || 0}`)
    }
    parts.push(`basehub.fun/wallet-analysis`)
    return parts.join('\n')
  }

  const createReportCardBlob = async () => {
    if (!analysis) throw new Error('No report available')
    const report = analysis.airdropReport || {}
    const metrics = report.metrics || {}
    const score = report.score ?? analysis.walletScore ?? 0
    const tier = report.tier || analysis.activityLevel || 'Base Wallet'
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 675
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#07111f')
    gradient.addColorStop(0.55, '#12213a')
    gradient.addColorStop(1, '#081320')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const accent = score >= 80 ? '#22c55e' : score >= 60 ? '#38bdf8' : score >= 40 ? '#f59e0b' : '#ef4444'
    drawCanvasRoundRect(ctx, 56, 52, 1088, 571, 34, 'rgba(15, 23, 42, 0.84)', 'rgba(148, 163, 184, 0.22)')
    ctx.fillStyle = accent
    ctx.shadowColor = accent
    ctx.shadowBlur = 28
    ctx.beginPath()
    ctx.arc(146, 146, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#f8fafc'
    ctx.font = '800 24px Inter, Arial'
    ctx.fillText('BaseHub', 198, 132)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 20px Inter, Arial'
    ctx.fillText('Base Airdrop Readiness Report', 198, 166)

    ctx.fillStyle = '#f8fafc'
    ctx.font = '900 104px Inter, Arial'
    ctx.fillText(String(score), 92, 320)
    ctx.fillStyle = accent
    ctx.font = '900 34px Inter, Arial'
    ctx.fillText(tier, 96, 368)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 19px Inter, Arial'
    ctx.fillText(shortAddress(analysis.walletAddress), 96, 404)

    const barX = 96
    const barY = 438
    drawCanvasRoundRect(ctx, barX, barY, 410, 18, 9, 'rgba(148, 163, 184, 0.20)')
    const barGradient = ctx.createLinearGradient(barX, barY, barX + 410, barY)
    barGradient.addColorStop(0, '#38bdf8')
    barGradient.addColorStop(0.5, '#8b5cf6')
    barGradient.addColorStop(1, accent)
    drawCanvasRoundRect(ctx, barX, barY, Math.max(18, 410 * Math.min(100, score) / 100), 18, 9, barGradient)

    const cards = [
      ['Transactions', metrics.totalTransactions || analysis.totalTransactions || 0, '#22c55e'],
      ['Active Days', metrics.activeDays || 0, '#38bdf8'],
      ['Protocols', metrics.protocolDiversity || 0, '#a78bfa'],
      ['Volume', report.display?.stableVolume || '$0.0000', '#f59e0b'],
      ['Recent 30d', `${metrics.recent30Tx || 0} tx`, '#fb7185'],
      ['Native Moved', report.display?.nativeMoved || '0 ETH', '#34d399'],
    ]
    cards.forEach((card, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = 590 + col * 260
      const y = 188 + row * 128
      drawCanvasRoundRect(ctx, x, y, 224, 92, 20, 'rgba(30, 41, 59, 0.92)', `${card[2]}55`)
      ctx.fillStyle = card[2]
      ctx.font = '800 18px Inter, Arial'
      ctx.fillText(card[0], x + 22, y + 34)
      ctx.fillStyle = '#f8fafc'
      ctx.font = '900 30px Inter, Arial'
      ctx.fillText(String(card[1]), x + 22, y + 70)
    })

    ctx.fillStyle = '#64748b'
    ctx.font = '700 18px Inter, Arial'
    ctx.fillText('basehub.fun/wallet-analysis', 96, 560)

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not create report image'))
      }, 'image/png', 0.96)
    })
  }

  const openXIntent = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildXText())}`, '_blank', 'noopener,noreferrer')
  }

  const handleShareOnX = async () => {
    if (!analysis) return
    setShareStatus('')
    try {
      const blob = await createReportCardBlob()
      const file = new File([blob], 'basehub-wallet-report.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          title: 'BaseHub Wallet Report',
          text: buildXText(),
          files: [file],
        })
        setShareStatus('Report card shared.')
        return
      }
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setShareStatus('Report card copied. Paste it into your X post.')
      } else {
        downloadBlob(blob, 'basehub-wallet-report.png')
        setShareStatus('Report card downloaded. Attach it to your X post.')
      }
      openXIntent()
    } catch (err) {
      console.error('Share image failed:', err)
      openXIntent()
      setShareStatus('Opened X composer. Image sharing was not available in this browser.')
    }
  }

  const handleDownloadReportCard = async () => {
    const blob = await createReportCardBlob()
    downloadBlob(blob, 'basehub-wallet-report.png')
    setShareStatus('Report card downloaded.')
  }

  const handleAnalyze = async () => {
    const addr = targetAddress.trim() || address
    if (!addr) {
      alert('Please enter a wallet address or connect your wallet')
      return
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      alert('Invalid wallet address format')
      return
    }

    try {
      setHasAnalyzed(false)
      setShareStatus('')
      await analyzeWallet(addr, selectedNetwork)
      setHasAnalyzed(true)
    } catch (err) {
      console.error('Analysis failed:', err)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981' // green
    if (score >= 60) return '#3b82f6' // blue
    if (score >= 40) return '#f59e0b' // yellow
    return '#ef4444' // red
  }

  const getScoreEmoji = (score) => {
    if (score >= 80) return '🏆'
    if (score >= 60) return '⭐'
    if (score >= 40) return '👍'
    return '🌱'
  }

  const isBaseReport = analysis?.reportType === 'base-airdrop-readiness'

  // Compact StatCard Component
  const StatCard = ({ icon, label, value, color }) => (
    <div style={{
      background: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      border: '2px solid rgba(102, 126, 234, 0.1)',
      transition: 'all 0.2s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
      }}>
        <div style={{ color, display: 'flex' }}>
          {icon}
        </div>
        <div style={{
          fontSize: '13px',
          color: '#9ca3af',
          fontWeight: '600',
        }}>
          {label}
        </div>
      </div>
      <div style={{
        fontSize: '22px',
        fontWeight: '800',
        color: '#e5e7eb',
      }}>
        {value}
      </div>
    </div>
  )

  // Compact InfoCard Component
  const InfoCard = ({ title, value, subtitle, icon }) => (
    <div style={{
      background: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(102, 126, 234, 0.1)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        color: '#667eea',
      }}>
        {icon}
        <div style={{
          fontSize: '12px',
          color: '#9ca3af',
          fontWeight: '600',
        }}>
          {title}
        </div>
      </div>
      <div style={{
        fontSize: '16px',
        fontWeight: '700',
        color: '#e5e7eb',
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '11px',
          color: '#9ca3af',
          marginTop: '4px',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )

  return (
    <NetworkGuard>
      <div style={{
        minHeight: '100vh',
        height: 'auto',
        background: '#0f172a',
        padding: '20px',
        paddingBottom: '60px',
        position: 'relative',
        overflow: 'hidden',
        margin: 0,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Animated Background Elements */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 20s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 15s ease-in-out infinite reverse',
        }} />

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
        }}>
          <BackButton />
          
          {/* Header Section */}
          <div style={{
            textAlign: 'center',
            marginBottom: '48px',
            paddingTop: '20px',
          }}>
            <div style={{
              fontSize: '80px',
              marginBottom: '20px',
              animation: 'bounce 2s ease-in-out infinite',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))',
            }}>
              🔍
            </div>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}>
              Wallet Analysis
            </h1>
            <p style={{
              fontSize: '18px',
              color: '#9ca3af',
              marginBottom: '16px',
              fontWeight: '500',
            }}>
              Discover fun insights about any wallet
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '30px',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}>
              <Eye size={18} />
              <span>{paymentPrice || '0.40'} USDC via x402 {isPassHolder ? '(BaseHub Pass 50% off)' : '(Paid on Base)'}</span>
            </div>
            <div style={{
              marginTop: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '999px',
              background: isPassHolder ? 'rgba(34, 197, 94, 0.12)' : 'rgba(251, 191, 36, 0.1)',
              border: `1px solid ${isPassHolder ? 'rgba(34, 197, 94, 0.28)' : 'rgba(251, 191, 36, 0.22)'}`,
              color: isPassHolder ? '#86efac' : '#fde68a',
              fontSize: '12px',
              fontWeight: '700',
            }}>
              <CheckCircle2 size={14} />
              <span>{isPassHolder ? 'BaseHub Pass verified: discounted x402 endpoint is active.' : 'BaseHub Pass holders get 50% off. The discount is checked server-side before payment.'}</span>
            </div>
          </div>

          {/* Network Selection */}
          <div style={{
            marginBottom: '32px',
            padding: '28px',
            background: 'rgba(30, 41, 59, 0.95)',
            borderRadius: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: '2px solid rgba(102, 126, 234, 0.1)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}>
              <BarChart3 size={24} style={{ color: '#667eea' }} />
              <h3 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#e5e7eb',
                margin: 0,
              }}>
                Select Network to Analyze
              </h3>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}>
              {Object.entries(SUPPORTED_NETWORKS).map(([key, network]) => (
                <button
                  key={key}
                  onClick={() => setSelectedNetwork(key)}
                  style={{
                    padding: '15px 14px',
                    background: selectedNetwork === key 
                      ? `linear-gradient(135deg, ${network.color}22 0%, ${network.color}44 100%)`
                      : 'rgba(30, 41, 59, 0.6)',
                    border: selectedNetwork === key 
                      ? `2px solid ${network.color}`
                      : '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '14px',
                    fontWeight: selectedNetwork === key ? '700' : '600',
                    color: selectedNetwork === key ? network.color : '#9ca3af',
                    textAlign: 'left',
                    boxShadow: selectedNetwork === key 
                      ? `0 4px 12px ${network.color}33`
                      : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedNetwork !== key) {
                      e.target.style.background = `linear-gradient(135deg, ${network.color}15 0%, ${network.color}25 100%)`
                      e.target.style.boxShadow = `0 6px 16px ${network.color}44`
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedNetwork !== key) {
                      e.target.style.background = 'rgba(30, 41, 59, 0.6)'
                      e.target.style.boxShadow = 'none'
                    } else {
                      e.target.style.boxShadow = `0 4px 12px ${network.color}33`
                    }
                  }}
                >
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: '850', marginBottom: '6px' }}>
                    {network.name}
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 7px',
                    borderRadius: '999px',
                    background: selectedNetwork === key ? `${network.color}22` : 'rgba(15, 23, 42, 0.62)',
                    border: `1px solid ${selectedNetwork === key ? `${network.color}55` : 'rgba(148, 163, 184, 0.12)'}`,
                    color: selectedNetwork === key ? '#e0f2fe' : '#64748b',
                    fontSize: '10px',
                    fontWeight: '850',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}>
                    {key === 'base' ? 'Airdrop Report' : 'Wallet Report'}
                  </span>
                </button>
              ))}
            </div>
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Eye size={16} />
              <span>x402 payment is always settled on Base mainnet · Pass holders get 50% off after server-side NFT verification</span>
            </div>
          </div>

          {/* Input Section - Enhanced */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            marginBottom: '32px',
            border: '2px solid rgba(102, 126, 234, 0.1)',
          }}>
            <div style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <input
                  type="text"
                  placeholder={address ? `Analyze your wallet (${address.slice(0, 6)}...${address.slice(-4)})` : "Enter wallet address (0x...)"}
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.3s',
                    background: 'rgba(30, 41, 59, 0.6)',
                    fontFamily: "'SF Mono', Menlo, monospace",
                    color: '#e2e8f0',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.08)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                    e.target.style.boxShadow = 'none'
                  }}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !isConnected}
                style={{
                  padding: '16px 32px',
                  background: isLoading 
                    ? '#9ca3af' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: isLoading || !isConnected ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.3s',
                  boxShadow: isLoading || !isConnected ? 'none' : '0 8px 24px rgba(102, 126, 234, 0.4)',
                  transform: isLoading || !isConnected ? 'none' : 'scale(1)',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && isConnected) {
                    e.target.style.transform = 'scale(1.05)'
                    e.target.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && isConnected) {
                    e.target.style.transform = 'scale(1)'
                    e.target.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)'
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    <span>{analysisProgress?.percent > 0 ? 'Preparing Report...' : 'Processing x402...'}</span>
                  </>
                ) : (
                  <>
                    <Zap size={22} />
                    <span>Pay {paymentPrice || '0.40'} USDC with x402 & Analyze</span>
                  </>
                )}
              </button>
            </div>

            {!isConnected && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '2px solid #fbbf24',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#92400e',
                fontSize: '15px',
                fontWeight: '500',
              }}>
                <AlertCircle size={18} />
                <span>Please connect your wallet to analyze</span>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#991b1b',
                fontSize: '15px',
                fontWeight: '500',
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {isLoading && (
              <ReportPreparationProgress progress={analysisProgress} elapsedSeconds={elapsedSeconds} />
            )}
          </div>

          {/* Analysis Results */}
          {analysis && hasAnalyzed && (
            <div style={{
              animation: 'fadeInUp 0.6s ease-out',
            }}>
              {isBaseReport && (
                <BaseAirdropReport
                  analysis={analysis}
                  onShareX={handleShareOnX}
                  onDownloadCard={handleDownloadReportCard}
                  shareStatus={shareStatus}
                />
              )}

              {!isBaseReport && (
                <NetworkWalletReport
                  analysis={analysis}
                  onShareX={openXIntent}
                />
              )}

              {/* Wallet Address Footer - Enhanced */}
              <div style={{
                marginTop: '40px',
                padding: '28px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                border: '2px solid rgba(102, 126, 234, 0.1)',
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '15px',
                  marginBottom: '12px',
                  fontWeight: '600',
                }}>
                  Analyzed Wallet Address
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#e5e7eb',
                  wordBreak: 'break-all',
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: '2px solid rgba(102, 126, 234, 0.2)',
                }}>
                  {analysis.walletAddress}
                </div>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
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
          @keyframes float {
            0%, 100% {
              transform: translate(0, 0) rotate(0deg);
            }
            50% {
              transform: translate(20px, -20px) rotate(180deg);
            }
          }
          @keyframes rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes progressFlow {
            from {
              background-position: 0% 50%;
            }
            to {
              background-position: 180% 50%;
            }
          }
        `}</style>
      </div>
    </NetworkGuard>
  )
}

function ReportPreparationProgress({ progress, elapsedSeconds }) {
  const currentProgress = progress || {}
  const stage = currentProgress.stage || 'initializing'
  const percent = Math.min(100, Math.max(0, currentProgress.percent || 0))
  const hasPaymentStartedReport = percent > 0
  const steps = [
    { key: 'waiting-payment', label: 'x402 payment', completeAt: 1 },
    { key: 'preparing-report', label: 'Data fetch', completeAt: 38 },
    { key: 'response-received', label: 'API response', completeAt: 82 },
    { key: 'building-report', label: 'Report card', completeAt: 92 },
    { key: 'ready', label: 'Ready', completeAt: 100 },
  ]
  const helperText = stage === 'waiting-payment'
    ? 'The report bar starts after your x402 payment is approved.'
    : stage === 'preparing-report'
      ? `Live report request running for ${elapsedSeconds}s.`
      : currentProgress.detail || 'Preparing your wallet report.'

  return (
    <div style={{
      marginTop: '18px',
      padding: '18px',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.92) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.24)',
      boxShadow: '0 16px 34px rgba(56, 189, 248, 0.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', fontWeight: '850' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: '#38bdf8' }} />
          {currentProgress.label || 'Preparing x402 payment'}
        </div>
        <div style={{ color: hasPaymentStartedReport ? '#86efac' : '#93c5fd', fontSize: '13px', fontWeight: '800' }}>
          {hasPaymentStartedReport ? `${percent}% report progress` : 'Waiting for payment approval'}
        </div>
      </div>
      <div style={{
        color: '#94a3b8',
        fontSize: '13px',
        fontWeight: '650',
        marginBottom: '12px',
      }}>
        {helperText}
      </div>
      <div style={{
        height: '12px',
        borderRadius: '999px',
        overflow: 'hidden',
        background: 'rgba(148, 163, 184, 0.16)',
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: '999px',
          background: hasPaymentStartedReport
            ? 'linear-gradient(90deg, #38bdf8 0%, #8b5cf6 45%, #22c55e 100%)'
            : 'rgba(59, 130, 246, 0.35)',
          backgroundSize: '180% 100%',
          boxShadow: '0 0 24px rgba(56, 189, 248, 0.42)',
          transition: 'width 500ms ease',
          animation: hasPaymentStartedReport ? 'progressFlow 1.6s linear infinite' : 'none',
        }} />
      </div>
      <div style={{
        marginTop: '12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: '8px',
        fontSize: '12px',
        fontWeight: '750',
      }}>
        {steps.map((step) => {
          const isComplete = percent >= step.completeAt
          const isActive = stage === step.key || (!hasPaymentStartedReport && step.key === 'waiting-payment')
          return (
            <span
              key={step.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '7px 8px',
                borderRadius: '999px',
                color: isComplete ? '#bbf7d0' : isActive ? '#bfdbfe' : '#64748b',
                background: isComplete
                  ? 'rgba(34, 197, 94, 0.12)'
                  : isActive
                    ? 'rgba(59, 130, 246, 0.12)'
                    : 'rgba(15, 23, 42, 0.55)',
                border: `1px solid ${isComplete ? 'rgba(34, 197, 94, 0.26)' : isActive ? 'rgba(59, 130, 246, 0.28)' : 'rgba(148, 163, 184, 0.10)'}`,
              }}
            >
              {isComplete ? <CheckCircle2 size={13} /> : isActive ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
              {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function drawCanvasRoundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function shortAddress(address) {
  if (!address || address.length < 12) return address || ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function BaseAirdropReport({ analysis, onShareX, onDownloadCard, shareStatus }) {
  const report = analysis.airdropReport || {}
  const metrics = report.metrics || {}
  const score = report.score ?? analysis.walletScore ?? 0
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444'
  const lastActivity = report.timeline?.lastActivity ? new Date(report.timeline.lastActivity).toLocaleDateString() : 'No activity'
  const firstActivity = report.timeline?.firstActivity ? new Date(report.timeline.firstActivity).toLocaleDateString() : 'No activity'

  return (
    <div style={{
      marginBottom: '28px',
      display: 'grid',
      gap: '18px',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(8, 13, 27, 0.98) 0%, rgba(18, 29, 52, 0.98) 54%, rgba(7, 18, 33, 0.98) 100%)',
        border: `1px solid ${color}66`,
        borderRadius: '20px',
        padding: '26px',
        boxShadow: `0 24px 70px ${color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(120deg, ${color}12 0%, transparent 34%, rgba(56, 189, 248, 0.08) 70%, transparent 100%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '24px',
          alignItems: 'center',
          position: 'relative',
        }}>
          <div style={{
            minHeight: '226px',
            borderRadius: '18px',
            background: `radial-gradient(circle at 50% 20%, ${color}38 0%, rgba(15, 23, 42, 0.45) 45%, rgba(2, 6, 23, 0.72) 100%)`,
            border: `1px solid ${color}66`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}>
            <Gauge size={34} style={{ color }} />
            <div style={{
              fontSize: '58px',
              lineHeight: 1,
              fontWeight: '900',
              color: '#f8fafc',
            }}>
              {score}
            </div>
            <div style={{
              width: '78%',
              height: '9px',
              borderRadius: '999px',
              background: 'rgba(148, 163, 184, 0.22)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, Math.max(0, score))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8 0%, #8b5cf6 48%, #22c55e 100%)',
                borderRadius: '999px',
              }} />
            </div>
            <div style={{
              color,
              fontSize: '16px',
              fontWeight: '800',
              textAlign: 'center',
            }}>
              {report.tier || analysis.activityLevel}
            </div>
            <div style={{
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: '700',
            }}>
              Confidence: {report.confidence || 'Medium'}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.28)',
                color: '#93c5fd',
                fontSize: '13px',
                fontWeight: '800',
              }}>
                <Target size={15} />
                Base Airdrop Readiness Report
              </div>
              <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={onShareX}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '9px',
                    border: '1px solid rgba(255,255,255,0.16)',
                    borderRadius: '12px',
                    padding: '11px 15px',
                    background: 'linear-gradient(135deg, #020617 0%, #111827 48%, #2563eb 100%)',
                    color: '#fff',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: '0 12px 30px rgba(37, 99, 235, 0.28)',
                  }}
                >
                  <ImageIcon size={16} />
                  <span style={{ fontSize: '15px', fontWeight: '900' }}>X</span>
                  Share Card
                </button>
                <button
                  type="button"
                  onClick={onDownloadCard}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '12px',
                    padding: '11px 13px',
                    background: 'rgba(15, 23, 42, 0.72)',
                    color: '#cbd5e1',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  <Download size={16} />
                  PNG
                </button>
              </div>
            </div>
            <h2 style={{
              margin: '0 0 10px',
              color: '#f8fafc',
              fontSize: '30px',
              lineHeight: 1.15,
              fontWeight: '900',
            }}>
              {report.summary || 'Professional Base wallet activity report'}
            </h2>
            <p style={{
              margin: '0 0 18px',
              color: '#cbd5e1',
              fontSize: '15px',
              lineHeight: 1.6,
            }}>
              This report measures activity depth, consistency, protocol diversity, volume signals, and recent usage patterns from available Base data sources.
            </p>
            {shareStatus && (
              <div style={{
                marginBottom: '14px',
                color: '#93c5fd',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Clipboard size={15} />
                {shareStatus}
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '10px',
            }}>
              <ReportMetricCard icon={<Activity size={18} />} label="Transactions" value={metrics.totalTransactions || 0} color="#22c55e" />
              <ReportMetricCard icon={<Calendar size={18} />} label="Active Days" value={metrics.activeDays || 0} color="#38bdf8" />
              <ReportMetricCard icon={<Layers size={18} />} label="Protocols" value={metrics.protocolDiversity || 0} color="#a78bfa" />
              <ReportMetricCard icon={<TrendingUp size={18} />} label="Volume Signal" value={report.display?.stableVolume || '$0.0000'} color="#f59e0b" />
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
      }}>
        <ReportMetricCard icon={<Clock size={20} />} label="First Activity" value={firstActivity} color="#60a5fa" tall />
        <ReportMetricCard icon={<Zap size={20} />} label="Last 30 Days" value={`${metrics.recent30Tx || 0} tx`} color="#fb7185" tall />
        <ReportMetricCard icon={<TrendingUp size={20} />} label="Native Moved" value={report.display?.nativeMoved || '0 ETH'} color="#34d399" tall />
        <ReportMetricCard icon={<Wallet size={20} />} label="Current Balance" value={`${parseFloat(analysis.nativeBalance || 0).toFixed(4)} ETH`} color="#818cf8" tall />
        <ReportMetricCard icon={<Award size={20} />} label="Last Activity" value={lastActivity} color="#fbbf24" tall />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: '16px',
      }}>
        <ReportPanel title="Score Breakdown" icon={<BarChart3 size={20} />} accent={color}>
          {(report.scoreBreakdown || []).map((item) => (
            <ScoreBreakdownRow key={item.label} item={item} color={color} />
          ))}
        </ReportPanel>

        <ReportPanel title="Protocol Footprint" icon={<Compass size={20} />} accent="#38bdf8">
          {report.topCategories && report.topCategories.length > 0 ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {report.topCategories.slice(0, 6).map((item) => (
                <div key={item.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                  borderRadius: '12px',
                }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '750' }}>{item.name}</span>
                  <span style={{ color: '#93c5fd', fontWeight: '850' }}>{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyReportText text="No recognizable protocol footprint detected yet." />
          )}
        </ReportPanel>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
      }}>
        <ReportPanel title="Strong Signals" icon={<CheckCircle2 size={20} />} accent="#22c55e">
          <InsightList items={report.strengths || []} color="#22c55e" fallback="No strong signals detected yet." />
        </ReportPanel>
        <ReportPanel title="Needs Work" icon={<XCircle size={20} />} accent="#f97316">
          <InsightList items={report.gaps || []} color="#f97316" fallback="No major gaps detected from available data." />
        </ReportPanel>
        <ReportPanel title="Next Best Actions" icon={<Target size={20} />} accent="#8b5cf6">
          <InsightList items={report.nextActions || []} color="#8b5cf6" fallback="Keep using Base naturally and consistently." />
        </ReportPanel>
      </div>

      {report.dataSources && (
        <div style={{
          color: '#94a3b8',
          fontSize: '12px',
          fontWeight: '650',
          padding: '0 2px',
        }}>
          Data sources: {report.dataSources.join(', ')}
        </div>
      )}
    </div>
  )
}

function NetworkWalletReport({ analysis, onShareX }) {
  const score = Math.min(100, Math.max(0, analysis.walletScore || 0))
  const color = getReportScoreColor(score)
  const networkName = analysis.network || 'Selected Network'
  const currency = analysis.currency || 'ETH'
  const display = analysis.display || {}
  const dataQuality = analysis.dataQuality || {}
  const breakdown = analysis.scoreBreakdown || [
    { label: 'Transactions', value: Math.min(30, analysis.totalTransactions > 100 ? 30 : analysis.totalTransactions > 50 ? 20 : analysis.totalTransactions > 10 ? 10 : analysis.totalTransactions > 0 ? 5 : 0), max: 30 },
    { label: 'Token Diversity', value: Math.min(30, analysis.tokenDiversity > 10 ? 30 : analysis.tokenDiversity > 5 ? 20 : analysis.tokenDiversity > 0 ? 10 : 0), max: 30 },
    { label: 'Balance Signal', value: parseFloat(analysis.nativeBalance || 0) > 1 ? 20 : parseFloat(analysis.nativeBalance || 0) > 0.1 ? 10 : parseFloat(analysis.nativeBalance || 0) > 0 ? 5 : 0, max: 20 },
    { label: 'Activity Span', value: analysis.daysActive > 365 ? 20 : analysis.daysActive > 180 ? 15 : analysis.daysActive > 30 ? 10 : analysis.daysActive > 0 ? 5 : 0, max: 20 },
  ]
  const insights = analysis.insights || analysis.funFacts || []
  const recommendations = analysis.recommendations || []

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(8, 13, 27, 0.98) 0%, rgba(18, 29, 52, 0.98) 56%, rgba(7, 18, 33, 0.98) 100%)',
        border: `1px solid ${color}66`,
        borderRadius: '20px',
        padding: '26px',
        boxShadow: `0 24px 70px ${color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(120deg, ${color}12 0%, transparent 34%, rgba(56, 189, 248, 0.08) 70%, transparent 100%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '24px',
          alignItems: 'center',
          position: 'relative',
        }}>
          <div style={{
            minHeight: '226px',
            borderRadius: '18px',
            background: `radial-gradient(circle at 50% 20%, ${color}38 0%, rgba(15, 23, 42, 0.45) 45%, rgba(2, 6, 23, 0.72) 100%)`,
            border: `1px solid ${color}66`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{getReportScoreEmoji(score)}</div>
            <div style={{
              fontSize: '64px',
              fontWeight: '950',
              color: '#f8fafc',
              lineHeight: 1,
            }}>
              {score}
            </div>
            <div style={{
              color,
              fontSize: '16px',
              fontWeight: '900',
              marginTop: '8px',
            }}>
              {analysis.activityLevel || 'Wallet Activity'}
            </div>
            <div style={{
              width: '78%',
              height: '10px',
              borderRadius: '999px',
              background: 'rgba(148, 163, 184, 0.18)',
              marginTop: '20px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${score}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8 0%, #8b5cf6 48%, #22c55e 100%)',
                borderRadius: '999px',
              }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.28)',
                color: '#93c5fd',
                fontSize: '13px',
                fontWeight: '800',
              }}>
                <Gauge size={15} />
                Network Wallet Report
              </div>
              <button
                type="button"
                onClick={onShareX}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '9px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: '12px',
                  padding: '11px 15px',
                  background: 'linear-gradient(135deg, #020617 0%, #111827 48%, #2563eb 100%)',
                  color: '#fff',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 12px 30px rgba(37, 99, 235, 0.28)',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: '900' }}>X</span>
                Share Report
              </button>
            </div>
            <h2 style={{
              margin: '0 0 10px',
              color: '#f8fafc',
              fontSize: 'clamp(26px, 4vw, 42px)',
              lineHeight: 1.05,
              fontWeight: '950',
            }}>
              {networkName} wallet profile
            </h2>
            <p style={{
              color: '#94a3b8',
              fontSize: '15px',
              lineHeight: 1.55,
              margin: '0 0 18px',
              maxWidth: '720px',
            }}>
              This report summarizes wallet activity, native movement, token interaction breadth, and activity consistency from the available network indexer data.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
            }}>
              <ReportMetricCard icon={<Activity size={20} />} label="Transactions" value={(analysis.totalTransactions || 0).toLocaleString()} color="#22c55e" />
              <ReportMetricCard icon={<Calendar size={20} />} label="Active Span" value={`${analysis.daysActive || 0} days`} color="#38bdf8" />
              <ReportMetricCard icon={<Layers size={20} />} label="Token Diversity" value={analysis.tokenDiversity || 0} color="#a78bfa" />
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '14px',
      }}>
        <ReportMetricCard icon={<Wallet size={20} />} label="Native Balance" value={display.nativeBalance || `${parseFloat(analysis.nativeBalance || 0).toFixed(4)} ${currency}`} color="#818cf8" tall />
        <ReportMetricCard icon={<TrendingUp size={20} />} label="Native Moved" value={display.totalValueMoved || `${parseFloat(analysis.totalValueMoved || 0).toFixed(4)} ${currency}`} color="#34d399" tall />
        <ReportMetricCard icon={<Award size={20} />} label="First Activity" value={analysis.firstTransactionDate || 'No activity'} color="#fbbf24" tall />
        <ReportMetricCard icon={<BarChart3 size={20} />} label="Most Active Day" value={analysis.mostActiveDay ? analysis.mostActiveDay.split(' (')[0] : 'No peak day'} color="#fb7185" tall />
        <ReportMetricCard icon={<Zap size={20} />} label="Favorite Token" value={analysis.favoriteToken || 'Not detected'} color="#06b6d4" tall />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: '16px',
      }}>
        <ReportPanel title="Score Breakdown" icon={<Gauge size={20} />} accent={color}>
          {breakdown.map((item) => (
            <ScoreBreakdownRow key={item.label} item={item} color={color} />
          ))}
        </ReportPanel>
        <ReportPanel title="Report Signals" icon={<Compass size={20} />} accent="#38bdf8">
          <InsightList items={insights} color="#38bdf8" fallback="No strong activity signals found from available data." />
        </ReportPanel>
        <ReportPanel title="Next Best Actions" icon={<Target size={20} />} accent="#8b5cf6">
          <InsightList items={recommendations} color="#8b5cf6" fallback="Build consistent activity, use more real protocols, and avoid repetitive low-signal transactions." />
        </ReportPanel>
      </div>

      <div style={{
        color: '#94a3b8',
        fontSize: '12px',
        fontWeight: '650',
        padding: '0 2px',
      }}>
        Data quality: {dataQuality.status || 'available'} · Source: {dataQuality.source || 'network indexer'} · Payment: x402 on Base
      </div>
    </div>
  )
}

function ReportMetricCard({ icon, label, value, color, tall = false }) {
  return (
    <div style={{
      minHeight: tall ? '92px' : '76px',
      background: `linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, ${color}12 100%)`,
      border: `1px solid ${color}33`,
      borderRadius: '14px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: `0 10px 24px ${color}10`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color }}>
        {icon}
        <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '800' }}>{label}</span>
      </div>
      <div style={{
        color: '#f8fafc',
        fontSize: tall ? '20px' : '22px',
        fontWeight: '900',
        lineHeight: 1.15,
        overflowWrap: 'anywhere',
      }}>
        {value}
      </div>
    </div>
  )
}

function ReportPanel({ title, icon, accent, children }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.94) 0%, rgba(15, 23, 42, 0.94) 100%)',
      border: `1px solid ${accent}33`,
      borderRadius: '16px',
      padding: '19px',
      boxShadow: `0 14px 32px ${accent}10`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: accent,
        marginBottom: '14px',
      }}>
        {icon}
        <h3 style={{
          margin: 0,
          color: '#f8fafc',
          fontSize: '17px',
          fontWeight: '900',
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

function ScoreBreakdownRow({ item, color }) {
  const pct = item.max ? Math.round((item.value / item.max) * 100) : 0
  const rowColor = getScoreBreakdownColor(item.label, color)
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '7px',
        color: '#cbd5e1',
        fontSize: '13px',
        fontWeight: '750',
      }}>
        <span>{item.label}</span>
        <span>{item.value}/{item.max}</span>
      </div>
      <div style={{
        height: '10px',
        borderRadius: '999px',
        background: 'rgba(148, 163, 184, 0.18)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${rowColor} 0%, ${rowColor}cc 100%)`,
          borderRadius: '999px',
          boxShadow: `0 0 18px ${rowColor}55`,
        }} />
      </div>
    </div>
  )
}

function getScoreBreakdownColor(label, fallback) {
  const key = String(label || '').toLowerCase()
  if (key.includes('transaction')) return '#22c55e'
  if (key.includes('consistency')) return '#38bdf8'
  if (key.includes('diversity')) return '#a78bfa'
  if (key.includes('volume')) return '#f59e0b'
  if (key.includes('recency')) return '#fb7185'
  if (key.includes('balance')) return '#818cf8'
  if (key.includes('span')) return '#38bdf8'
  return fallback
}

function getReportScoreColor(score) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#38bdf8'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function getReportScoreEmoji(score) {
  if (score >= 80) return '🏆'
  if (score >= 60) return '⭐'
  if (score >= 40) return '👍'
  return '🌱'
}

function InsightList({ items, color, fallback }) {
  if (!items || items.length === 0) return <EmptyReportText text={fallback} />
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {items.map((item, index) => (
        <div key={`${item}-${index}`} style={{
          display: 'grid',
          gridTemplateColumns: '18px 1fr',
          gap: '10px',
          alignItems: 'start',
          color: '#e2e8f0',
          fontSize: '14px',
          lineHeight: 1.45,
          fontWeight: '650',
        }}>
          <span style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: color,
            marginTop: '6px',
            boxShadow: `0 0 0 4px ${color}18`,
          }} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyReportText({ text }) {
  return (
    <div style={{
      color: '#94a3b8',
      fontSize: '14px',
      lineHeight: 1.5,
      padding: '12px',
      background: 'rgba(15, 23, 42, 0.55)',
      borderRadius: '10px',
      border: '1px solid rgba(148, 163, 184, 0.12)',
    }}>
      {text}
    </div>
  )
}

function LargeStatCard({ icon, label, value, color, bgGradient }) {
  return (
    <div style={{
      background: bgGradient || 'rgba(30, 41, 59, 0.95)',
      borderRadius: '24px',
      padding: '36px 28px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      border: `3px solid ${color}30`,
      transition: 'all 0.3s',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-12px) scale(1.03)'
      e.currentTarget.style.boxShadow = `0 16px 40px ${color}40`
      e.currentTarget.style.borderColor = `${color}60`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0) scale(1)'
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)'
      e.currentTarget.style.borderColor = `${color}30`
    }}
    >
      <div style={{
        color: color,
        background: 'rgba(15, 23, 42, 0.8)',
        width: '80px',
        height: '80px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 8px 20px ${color}30`,
        border: `3px solid ${color}20`,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: '40px',
        fontWeight: '900',
        color: '#e5e7eb',
        textAlign: 'center',
        lineHeight: '1.2',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '18px',
        color: '#9ca3af',
        fontWeight: '700',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
    </div>
  )
}

function DetailCard({ title, value, subtitle, icon, color }) {
  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '28px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      border: `3px solid ${color}20`,
      transition: 'all 0.3s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = `${color}60`
      e.currentTarget.style.transform = 'translateY(-8px)'
      e.currentTarget.style.boxShadow = `0 16px 40px ${color}30`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = `${color}20`
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)'
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          border: `2px solid ${color}30`,
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#e5e7eb',
        }}>
          {title}
        </span>
      </div>
      <div style={{
        fontSize: '36px',
        fontWeight: '900',
        color: '#e5e7eb',
        marginBottom: subtitle ? '8px' : '0',
        lineHeight: '1.2',
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '15px',
          color: '#9ca3af',
          fontWeight: '600',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
