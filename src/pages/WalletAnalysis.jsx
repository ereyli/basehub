import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useWalletAnalysis } from '../hooks/useWalletAnalysis'
import { Search, Wallet, Coins, Image, Activity, TrendingUp, Award, Sparkles, AlertCircle, Loader2, Calendar, BarChart3, Zap } from 'lucide-react'
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
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        minHeight: '100vh',
      }}>
        <BackButton />
        
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}>
            🔍
          </div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Wallet Analysis
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            marginBottom: '8px',
          }}>
            Get comprehensive insights about any wallet on Base
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
          }}>
            <Coins size={16} />
            <span>0.01 USDC per analysis</span>
          </div>
        </div>

        {/* Input Section */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder={address ? `Analyze your wallet (${address.slice(0, 6)}...${address.slice(-4)})` : "Enter wallet address (0x...)"}
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !isConnected}
              style={{
                padding: '12px 24px',
                background: isLoading 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading || !isConnected ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: isLoading || !isConnected ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Search size={20} />
                  <span>Analyze Wallet</span>
                </>
              )}
            </button>
          </div>

          {!isConnected && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#92400e',
              fontSize: '14px',
            }}>
              <AlertCircle size={16} />
              <span>Please connect your wallet to analyze</span>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#991b1b',
              fontSize: '14px',
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && hasAnalyzed && (
          <div style={{
            animation: 'fadeIn 0.5s ease-in',
          }}>
            {/* Wallet Score Card - Large and Prominent */}
            <div style={{
              background: `linear-gradient(135deg, ${getScoreColor(analysis.walletScore)} 0%, ${getScoreColor(analysis.walletScore)}dd 100%)`,
              borderRadius: '24px',
              padding: '48px 32px',
              color: 'white',
              marginBottom: '32px',
              textAlign: 'center',
              boxShadow: `0 12px 32px ${getScoreColor(analysis.walletScore)}40`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div style={{
                fontSize: '80px',
                marginBottom: '20px',
                position: 'relative',
                zIndex: 1,
              }}>
                {getScoreEmoji(analysis.walletScore)}
              </div>
              <div style={{
                fontSize: '72px',
                fontWeight: 'bold',
                marginBottom: '12px',
                position: 'relative',
                zIndex: 1,
              }}>
                {analysis.walletScore}/100
              </div>
              <div style={{
                fontSize: '24px',
                opacity: 0.95,
                marginBottom: '20px',
                position: 'relative',
                zIndex: 1,
              }}>
                Wallet Score
              </div>
              <div style={{
                fontSize: '22px',
                opacity: 0.9,
                position: 'relative',
                zIndex: 1,
              }}>
                {analysis.activityLevel}
              </div>
            </div>

            {/* Main Stats Grid - 4 columns */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}>
              <LargeStatCard
                icon={<Wallet size={32} />}
                label="Native Balance"
                value={`${parseFloat(analysis.nativeBalance || 0).toFixed(6)} ETH`}
                color="#3b82f6"
                bgGradient="linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)"
              />
              <LargeStatCard
                icon={<Activity size={32} />}
                label="Total Transactions"
                value={analysis.totalTransactions?.toLocaleString() || '0'}
                color="#10b981"
                bgGradient="linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)"
              />
              <LargeStatCard
                icon={<Coins size={32} />}
                label="Token Diversity"
                value={analysis.tokenDiversity || 0}
                color="#f59e0b"
                bgGradient="linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)"
              />
              <LargeStatCard
                icon={<Image size={32} />}
                label="NFTs Owned"
                value={analysis.nftCount || 0}
                color="#8b5cf6"
                bgGradient="linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
              />
            </div>

            {/* Secondary Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}>
              <DetailCard
                title="Total Value Moved"
                value={`${parseFloat(analysis.totalValueMoved || 0).toFixed(6)} ETH`}
                icon={<TrendingUp size={24} />}
                color="#3b82f6"
              />
              <DetailCard
                title="Days Active"
                value={analysis.daysActive || 0}
                subtitle={analysis.daysActive > 0 ? 'days' : 'No activity yet'}
                icon={<Calendar size={24} />}
                color="#10b981"
              />
              {analysis.firstTransactionDate && (
                <DetailCard
                  title="First Transaction"
                  value={analysis.firstTransactionDate}
                  icon={<Award size={24} />}
                  color="#f59e0b"
                />
              )}
              {analysis.mostActiveDay && (
                <DetailCard
                  title="Most Active Day"
                  value={analysis.mostActiveDay.split(' (')[0]}
                  subtitle={analysis.mostActiveDay.split('(')[1]?.replace(')', '')}
                  icon={<BarChart3 size={24} />}
                  color="#8b5cf6"
                />
              )}
              {analysis.favoriteToken && (
                <DetailCard
                  title="Favorite Token"
                  value={analysis.favoriteToken}
                  subtitle="Most traded token"
                  icon={<Zap size={24} />}
                  color="#ec4899"
                />
              )}
            </div>

            {/* Top Tokens Section */}
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px',
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#1f2937',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <Coins size={20} />
                </div>
                Token Holdings
              </h3>
              {analysis.topTokens && analysis.topTokens.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '16px',
                }}>
                  {analysis.topTokens.map((token, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '20px',
                        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: '#1f2937',
                      }}>
                        {token.symbol}
                      </div>
                      <div style={{
                        fontSize: '16px',
                        color: '#6b7280',
                        fontFamily: 'monospace',
                      }}>
                        {parseFloat(token.balance).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '16px',
                }}>
                  No token holdings found
                </div>
              )}
            </div>

            {/* Fun Facts Section */}
            {analysis.funFacts && analysis.funFacts.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '20px',
                padding: '32px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                marginBottom: '24px',
              }}>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#1f2937',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}>
                    <Sparkles size={20} />
                  </div>
                  Fun Facts
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '16px',
                }}>
                  {analysis.funFacts.map((fact, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '20px',
                        background: 'white',
                        borderRadius: '12px',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>✨</span>
                      <span style={{ color: '#1f2937', fontWeight: '500' }}>{fact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet Address Footer */}
            <div style={{
              marginTop: '32px',
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '16px',
              textAlign: 'center',
            }}>
              <div style={{
                color: '#6b7280',
                fontSize: '14px',
                marginBottom: '8px',
              }}>
                Analyzed Wallet Address
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                wordBreak: 'break-all',
              }}>
                {analysis.walletAddress}
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
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
      borderRadius: '20px',
      padding: '32px 24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      border: `2px solid ${color}20`,
      transition: 'all 0.3s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-8px)'
      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}
    >
      <div style={{
        color: color,
        background: 'white',
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#1f2937',
        textAlign: 'center',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '16px',
        color: '#6b7280',
        fontWeight: '600',
        textAlign: 'center',
      }}>
        {label}
      </div>
    </div>
  )
}

function DetailCard({ title, value, subtitle, icon, color }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      border: `2px solid ${color}20`,
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = `${color}60`
      e.currentTarget.style.transform = 'translateY(-4px)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = `${color}20`
      e.currentTarget.style.transform = 'translateY(0)'
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#6b7280',
        }}>
          {title}
        </span>
      </div>
      <div style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: subtitle ? '4px' : '0',
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '14px',
          color: '#9ca3af',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
