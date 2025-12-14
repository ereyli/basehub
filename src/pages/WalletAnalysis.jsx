import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useWalletAnalysis } from '../hooks/useWalletAnalysis'
import { Search, Wallet, Coins, Image, Activity, TrendingUp, Award, Sparkles, AlertCircle, Loader2 } from 'lucide-react'
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
      // Error is handled by the hook
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
        maxWidth: '1200px',
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
            Get fun insights about any wallet on Base
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
            <span>0.3 USDC per analysis</span>
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
            {/* Wallet Score Card */}
            <div style={{
              background: `linear-gradient(135deg, ${getScoreColor(analysis.walletScore)} 0%, ${getScoreColor(analysis.walletScore)}dd 100%)`,
              borderRadius: '20px',
              padding: '32px',
              color: 'white',
              marginBottom: '24px',
              textAlign: 'center',
              boxShadow: `0 8px 24px ${getScoreColor(analysis.walletScore)}40`,
            }}>
              <div style={{
                fontSize: '64px',
                marginBottom: '16px',
              }}>
                {getScoreEmoji(analysis.walletScore)}
              </div>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                marginBottom: '8px',
              }}>
                {analysis.walletScore}/100
              </div>
              <div style={{
                fontSize: '20px',
                opacity: 0.9,
                marginBottom: '16px',
              }}>
                Wallet Score
              </div>
              <div style={{
                fontSize: '18px',
                opacity: 0.8,
              }}>
                {analysis.activityLevel}
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}>
              <StatCard
                icon={<Wallet size={24} />}
                label="Native Balance"
                value={`${analysis.nativeBalance} ETH`}
                color="#3b82f6"
              />
              <StatCard
                icon={<Activity size={24} />}
                label="Transactions"
                value={analysis.totalTransactions.toLocaleString()}
                color="#10b981"
              />
              <StatCard
                icon={<Coins size={24} />}
                label="Token Diversity"
                value={analysis.tokenDiversity}
                color="#f59e0b"
              />
              <StatCard
                icon={<Image size={24} />}
                label="NFTs"
                value={analysis.nftCount}
                color="#8b5cf6"
              />
            </div>

            {/* Additional Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}>
              <InfoCard
                title="Total Value Moved"
                value={`${parseFloat(analysis.totalValueMoved).toFixed(4)} ETH`}
                icon={<TrendingUp size={20} />}
              />
              <InfoCard
                title="Days Active"
                value={analysis.daysActive}
                icon={<Activity size={20} />}
              />
              {analysis.firstTransactionDate && (
                <InfoCard
                  title="First Transaction"
                  value={analysis.firstTransactionDate}
                  icon={<Award size={20} />}
                />
              )}
              {analysis.mostActiveDay && (
                <InfoCard
                  title="Most Active Day"
                  value={analysis.mostActiveDay.split(' (')[0]}
                  subtitle={analysis.mostActiveDay.split('(')[1]?.replace(')', '')}
                  icon={<Sparkles size={20} />}
                />
              )}
            </div>

            {/* Top Tokens */}
            {analysis.topTokens && analysis.topTokens.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                marginBottom: '24px',
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Coins size={20} />
                  Top Token Holdings
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '12px',
                }}>
                  {analysis.topTokens.slice(0, 10).map((token, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '4px',
                      }}>
                        {token.symbol}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                      }}>
                        {token.balance}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fun Facts */}
            {analysis.funFacts && analysis.funFacts.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Sparkles size={20} />
                  Fun Facts
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  {analysis.funFacts.map((fact, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        background: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>✨</span>
                      <span>{fact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet Address */}
            <div style={{
              marginTop: '24px',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '14px',
            }}>
              Analyzed: <span style={{ fontFamily: 'monospace' }}>{analysis.walletAddress}</span>
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

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{
        color: color,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1f2937',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
      }}>
        {label}
      </div>
    </div>
  )
}

function InfoCard({ title, value, subtitle, icon }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        color: '#6b7280',
      }}>
        {icon}
        <span style={{ fontSize: '14px', fontWeight: '600' }}>{title}</span>
      </div>
      <div style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#1f2937',
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '12px',
          color: '#9ca3af',
          marginTop: '4px',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

