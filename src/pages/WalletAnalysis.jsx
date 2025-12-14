import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useWalletAnalysis } from '../hooks/useWalletAnalysis'
import { Search, Wallet, Coins, Image, Activity, TrendingUp, Award, Sparkles, AlertCircle, Loader2, Calendar, BarChart3, Zap, Eye } from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'

export default function WalletAnalysis() {
  const { address, isConnected } = useAccount()
  const { analyzeWallet, isLoading, error, analysis } = useWalletAnalysis()
  const [targetAddress, setTargetAddress] = useState('')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

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
      await analyzeWallet(addr)
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

  return (
    <NetworkGuard>
      <div style={{
        minHeight: '100vh',
        height: '100%',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 50%, #fce7f3 100%)',
        padding: '20px',
        paddingBottom: '40px',
        position: 'relative',
        overflow: 'hidden',
        margin: 0,
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
              color: '#4b5563',
              marginBottom: '16px',
              fontWeight: '500',
            }}>
              Discover fun insights about any wallet on Base
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
              <span>0.01 USDC per analysis</span>
            </div>
          </div>

          {/* Input Section - Enhanced */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            marginBottom: '32px',
            border: '1px solid rgba(255, 255, 255, 0.5)',
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
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s',
                    background: 'white',
                    fontFamily: 'monospace',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea'
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb'
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
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Search size={22} />
                    <span>Analyze Wallet</span>
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
          </div>

          {/* Analysis Results */}
          {analysis && hasAnalyzed && (
            <div style={{
              animation: 'fadeInUp 0.6s ease-out',
            }}>
              {/* Wallet Score Card - Enhanced */}
              <div style={{
                background: `linear-gradient(135deg, ${getScoreColor(analysis.walletScore)} 0%, ${getScoreColor(analysis.walletScore)}dd 100%)`,
                borderRadius: '32px',
                padding: '56px 40px',
                color: 'white',
                marginBottom: '40px',
                textAlign: 'center',
                boxShadow: `0 20px 60px ${getScoreColor(analysis.walletScore)}50`,
                position: 'relative',
                overflow: 'hidden',
                border: '3px solid rgba(255, 255, 255, 0.3)',
              }}>
                {/* Animated Background Pattern */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-50%',
                  width: '200%',
                  height: '200%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  pointerEvents: 'none',
                  animation: 'rotate 20s linear infinite',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: '-30%',
                  left: '-30%',
                  width: '150%',
                  height: '150%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  pointerEvents: 'none',
                  animation: 'rotate 15s linear infinite reverse',
                }} />
                
                <div style={{
                  fontSize: '100px',
                  marginBottom: '24px',
                  position: 'relative',
                  zIndex: 1,
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))',
                  animation: 'bounce 2s ease-in-out infinite',
                }}>
                  {getScoreEmoji(analysis.walletScore)}
                </div>
                <div style={{
                  fontSize: '96px',
                  fontWeight: '900',
                  marginBottom: '16px',
                  position: 'relative',
                  zIndex: 1,
                  textShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  letterSpacing: '-2px',
                }}>
                  {analysis.walletScore}/100
                </div>
                <div style={{
                  fontSize: '28px',
                  opacity: 0.95,
                  marginBottom: '24px',
                  position: 'relative',
                  zIndex: 1,
                  fontWeight: '600',
                }}>
                  Wallet Score
                </div>
                <div style={{
                  fontSize: '24px',
                  opacity: 0.9,
                  position: 'relative',
                  zIndex: 1,
                  fontWeight: '500',
                }}>
                  {analysis.activityLevel}
                </div>
              </div>

              {/* Main Stats Grid - Enhanced */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '24px',
                marginBottom: '32px',
              }}>
                <LargeStatCard
                  icon={<Wallet size={36} />}
                  label="Native Balance"
                  value={`${parseFloat(analysis.nativeBalance || 0).toFixed(6)} ETH`}
                  color="#3b82f6"
                  bgGradient="linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)"
                />
                <LargeStatCard
                  icon={<Activity size={36} />}
                  label="Total Transactions"
                  value={analysis.totalTransactions?.toLocaleString() || '0'}
                  color="#10b981"
                  bgGradient="linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)"
                />
                <LargeStatCard
                  icon={<Coins size={36} />}
                  label="Token Diversity"
                  value={analysis.tokenDiversity || 0}
                  color="#f59e0b"
                  bgGradient="linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)"
                />
                <LargeStatCard
                  icon={<Image size={36} />}
                  label="NFTs Owned"
                  value={analysis.nftCount || 0}
                  color="#8b5cf6"
                  bgGradient="linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
                />
              </div>

              {/* Secondary Stats Grid - Enhanced */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px',
                marginBottom: '32px',
              }}>
                <DetailCard
                  title="Total Value Moved"
                  value={`${parseFloat(analysis.totalValueMoved || 0).toFixed(6)} ETH`}
                  icon={<TrendingUp size={26} />}
                  color="#3b82f6"
                />
                <DetailCard
                  title="Days Active"
                  value={analysis.daysActive || 0}
                  subtitle={analysis.daysActive > 0 ? 'days' : 'No activity yet'}
                  icon={<Calendar size={26} />}
                  color="#10b981"
                />
                {analysis.firstTransactionDate && (
                  <DetailCard
                    title="First Transaction"
                    value={analysis.firstTransactionDate}
                    icon={<Award size={26} />}
                    color="#f59e0b"
                  />
                )}
                {analysis.mostActiveDay && (
                  <DetailCard
                    title="Most Active Day"
                    value={analysis.mostActiveDay.split(' (')[0]}
                    subtitle={analysis.mostActiveDay.split('(')[1]?.replace(')', '')}
                    icon={<BarChart3 size={26} />}
                    color="#8b5cf6"
                  />
                )}
                {analysis.favoriteToken && (
                  <DetailCard
                    title="Favorite Token"
                    value={analysis.favoriteToken}
                    subtitle="Most traded token"
                    icon={<Zap size={26} />}
                    color="#ec4899"
                  />
                )}
              </div>

              {/* Top Tokens Section - Enhanced */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                marginBottom: '32px',
                border: '1px solid rgba(255, 255, 255, 0.5)',
              }}>
                <h3 style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  marginBottom: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  color: '#1f2937',
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                  }}>
                    <Coins size={24} />
                  </div>
                  Token Holdings
                </h3>
                {analysis.topTokens && analysis.topTokens.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '20px',
                  }}>
                    {analysis.topTokens.map((token, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '24px',
                          background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                          borderRadius: '16px',
                          border: '2px solid #e5e7eb',
                          transition: 'all 0.3s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)'
                          e.currentTarget.style.borderColor = '#667eea'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.borderColor = '#e5e7eb'
                        }}
                      >
                        <div style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          marginBottom: '10px',
                          color: '#1f2937',
                        }}>
                          {token.symbol}
                        </div>
                        <div style={{
                          fontSize: '18px',
                          color: '#6b7280',
                          fontFamily: 'monospace',
                          fontWeight: '600',
                        }}>
                          {parseFloat(token.balance).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '60px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '18px',
                  }}>
                    <Coins size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                    <div>No token holdings found</div>
                  </div>
                )}
              </div>

              {/* Fun Facts Section - Enhanced */}
              {analysis.funFacts && analysis.funFacts.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  borderRadius: '24px',
                  padding: '40px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                  marginBottom: '32px',
                  border: '2px solid rgba(245, 158, 11, 0.3)',
                }}>
                  <h3 style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    marginBottom: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#1f2937',
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    }}>
                      <Sparkles size={24} />
                    </div>
                    Fun Facts
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px',
                  }}>
                    {analysis.funFacts.map((fact, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '24px',
                          background: 'white',
                          borderRadius: '16px',
                          fontSize: '17px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                          transition: 'all 0.3s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)'
                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      >
                        <span style={{ fontSize: '32px' }}>✨</span>
                        <span style={{ color: '#1f2937', fontWeight: '500' }}>{fact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wallet Address Footer - Enhanced */}
              <div style={{
                marginTop: '40px',
                padding: '28px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
              }}>
                <div style={{
                  color: '#6b7280',
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
                  color: '#1f2937',
                  wordBreak: 'break-all',
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: '2px solid #d1d5db',
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
        `}</style>
      </div>
    </NetworkGuard>
  )
}

function LargeStatCard({ icon, label, value, color, bgGradient }) {
  return (
    <div style={{
      background: bgGradient || 'white',
      borderRadius: '24px',
      padding: '36px 28px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
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
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)'
      e.currentTarget.style.borderColor = `${color}30`
    }}
    >
      <div style={{
        color: color,
        background: 'white',
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
        color: '#1f2937',
        textAlign: 'center',
        lineHeight: '1.2',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '18px',
        color: '#6b7280',
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
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '28px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
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
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)'
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
          color: '#6b7280',
        }}>
          {title}
        </span>
      </div>
      <div style={{
        fontSize: '36px',
        fontWeight: '900',
        color: '#1f2937',
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
