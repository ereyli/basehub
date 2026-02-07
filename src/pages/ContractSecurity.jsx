import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContractSecurity } from '../hooks/useContractSecurity'
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, BarChart3, FileCode, Lock, Zap } from 'lucide-react'
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

export default function ContractSecurity() {
  const { address, isConnected } = useAccount()
  const { analyzeContract, isLoading, error, analysis } = useContractSecurity()
  const [contractAddress, setContractAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  const buildCastText = () => {
    if (!analysis) return ''
    const parts = []
    parts.push(`🛡️ Contract Security Analysis on ${analysis.network || selectedNetwork}`)
    parts.push(`Score: ${analysis.securityScore}/100 (${analysis.riskLevel || 'n/a'})`)
    parts.push(`Contract: ${analysis.contractName || 'Unknown'}`)
    if (analysis.isVerified) parts.push('✅ Verified')
    if (analysis.risks && analysis.risks.length > 0) {
      parts.push(`⚠️ ${analysis.risks.length} risk(s) found`)
    }
    if (analysis.safeFeatures && analysis.safeFeatures.length > 0) {
      parts.push(`✅ ${analysis.safeFeatures.length} safe feature(s)`)
    }
    parts.push('Powered by BaseHub x402')
    parts.push('Web: https://www.basehub.fun/contract-security')
    parts.push('Farcaster: https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub')
    return parts.join(' • ')
  }

  const handleAnalyze = async () => {
    const addr = contractAddress.trim()
    if (!addr) {
      alert('Please enter a contract address')
      return
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      alert('Invalid contract address format')
      return
    }

    try {
      setHasAnalyzed(false)
      await analyzeContract(addr, selectedNetwork)
      setHasAnalyzed(true)
    } catch (err) {
      console.error('Analysis failed:', err)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981' // green
    if (score >= 60) return '#3b82f6' // blue
    if (score >= 40) return '#f59e0b' // yellow
    return '#dc2626' // dark red for critical
  }

  const getScoreEmoji = (score) => {
    if (score >= 80) return '🛡️'
    if (score >= 60) return '⚠️'
    if (score >= 40) return '🔴'
    return '🚨'
  }

  const getSeverityColor = (severity) => {
    if (severity === 'Critical') return '#dc2626'
    if (severity === 'High') return '#ef4444'
    if (severity === 'Medium') return '#f59e0b'
    return '#6b7280'
  }

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
              🛡️
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
              Contract Security Analysis
            </h1>
            <p style={{
              fontSize: '18px',
              color: '#9ca3af',
              marginBottom: '16px',
              fontWeight: '500',
            }}>
              Analyze smart contract security risks
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
              <span>0.50 USDC per analysis (Paid on Base)</span>
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '12px',
            }}>
              {Object.entries(SUPPORTED_NETWORKS).map(([key, network]) => (
                <button
                  key={key}
                  onClick={() => setSelectedNetwork(key)}
                  style={{
                    padding: '16px',
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
                    textAlign: 'center',
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
                  {network.name}
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
              <span>Payment is always on Base mainnet</span>
            </div>
          </div>

          {/* Input Section */}
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
                  placeholder="Enter contract address (0x...)"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s',
                    background: 'rgba(30, 41, 59, 0.95)',
                    fontFamily: 'monospace',
                    color: '#e5e7eb',
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
                    <Shield size={22} />
                    <span>Analyze Contract</span>
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
                <AlertTriangle size={18} />
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
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Analysis Results */}
          {analysis && hasAnalyzed && (
            <div style={{
              animation: 'fadeInUp 0.6s ease-out',
            }}>
              {/* Farcaster share */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '12px',
              }}>
                <a
                  href={`https://warpcast.com/~/compose?text=${encodeURIComponent(buildCastText())}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #805ad5 0%, #6366f1 100%)',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '14px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(128, 90, 213, 0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)'
                    e.target.style.boxShadow = '0 6px 16px rgba(128, 90, 213, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = '0 4px 12px rgba(128, 90, 213, 0.3)'
                  }}
                >
                  <Zap size={16} />
                  Share on Farcaster
                </a>
              </div>

              {/* Security Score Card */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: '20px',
                padding: '28px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                border: '2px solid rgba(102, 126, 234, 0.1)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    fontSize: '56px',
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                  }}>
                    {getScoreEmoji(analysis.securityScore)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: '#e5e7eb',
                        margin: 0,
                      }}>
                        Security Score
                      </h3>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: '900',
                        color: getScoreColor(analysis.securityScore),
                      }}>
                        {analysis.securityScore}/100
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '12px',
                      background: '#e5e7eb',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: `${analysis.securityScore}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${getScoreColor(analysis.securityScore)} 0%, ${getScoreColor(analysis.securityScore)}dd 100%)`,
                        borderRadius: '6px',
                        transition: 'width 1s ease-out',
                        boxShadow: `0 2px 8px ${getScoreColor(analysis.securityScore)}44`,
                      }} />
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginTop: '10px',
                    }}>
                      <Shield size={18} style={{ color: getScoreColor(analysis.securityScore) }} />
                      <span style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: getScoreColor(analysis.securityScore),
                      }}>
                        {analysis.riskLevel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Checks - All Checks with Pass/Fail */}
              {analysis.securityChecks && analysis.securityChecks.length > 0 && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '20px',
                    color: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <Shield size={20} style={{ color: '#667eea' }} />
                    Security Checks ({analysis.securityChecks.length})
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px',
                  }}>
                    {analysis.securityChecks.map((check, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '16px',
                          background: check.passed
                            ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                            : check.status.includes('⚠️')
                              ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                          border: `2px solid ${check.passed ? '#10b981' : check.status.includes('⚠️') ? '#f59e0b' : '#ef4444'}`,
                          borderRadius: '12px',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '8px',
                        }}>
                          {check.passed ? (
                            <CheckCircle size={20} style={{ color: '#10b981' }} />
                          ) : (
                            <XCircle size={20} style={{ 
                              color: check.status.includes('⚠️') ? '#f59e0b' : '#ef4444' 
                            }} />
                          )}
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#e5e7eb',
                            flex: 1,
                          }}>
                            {check.check}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: check.passed ? '#065f46' : check.status.includes('⚠️') ? '#92400e' : '#991b1b',
                          marginBottom: '6px',
                        }}>
                          {check.status}
                        </div>
                        {check.details && (
                          <div style={{
                            fontSize: '13px',
                            color: check.passed ? '#047857' : check.status.includes('⚠️') ? '#78350f' : '#7f1d1d',
                            lineHeight: '1.5',
                          }}>
                            {check.details}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract Info */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: '20px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  color: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <FileCode size={20} style={{ color: '#667eea' }} />
                  Contract Information
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Contract Name</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                      {analysis.contractName || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Verification Status</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: analysis.isVerified ? '#10b981' : '#ef4444' }}>
                      {analysis.isVerified ? '✅ Verified' : '❌ Not Verified'}
                    </div>
                  </div>
                  {analysis.compilerVersion && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Compiler</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                        {analysis.compilerVersion}
                      </div>
                    </div>
                  )}
                  {analysis.optimizationEnabled && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Optimization</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                        ✅ Enabled
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Risks */}
              {analysis.risks && analysis.risks.length > 0 && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '16px',
                    color: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <XCircle size={20} style={{ color: '#ef4444' }} />
                    Security Risks ({analysis.risks.length})
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    {analysis.risks.map((risk, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '20px',
                          background: risk.severity === 'Critical' || risk.severity === 'High'
                            ? risk.severity === 'Critical'
                              ? 'linear-gradient(135deg, #fecaca 0%, #fee2e2 100%)'
                              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                            : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          border: `2px solid ${getSeverityColor(risk.severity)}`,
                          borderRadius: '12px',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '12px',
                        }}>
                          <AlertTriangle size={22} style={{ 
                            color: getSeverityColor(risk.severity)
                          }} />
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '800',
                            color: '#e5e7eb',
                          }}>
                            {risk.type}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: getSeverityColor(risk.severity),
                            color: 'white',
                            textTransform: 'uppercase',
                          }}>
                            {risk.severity} Risk
                          </div>
                        </div>
                        <div style={{
                          fontSize: '15px',
                          color: '#4b5563',
                          marginBottom: '8px',
                          fontWeight: '600',
                        }}>
                          {risk.description}
                        </div>
                        {risk.details && (
                          <div style={{
                            fontSize: '14px',
                            color: '#9ca3af',
                            marginTop: '8px',
                            lineHeight: '1.6',
                            padding: '12px',
                            background: 'rgba(0, 0, 0, 0.03)',
                            borderRadius: '8px',
                          }}>
                            {risk.details}
                          </div>
                        )}
                        {risk.indicators && risk.indicators.length > 0 && (
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '8px',
                          }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '700',
                              color: '#991b1b',
                              marginBottom: '6px',
                            }}>
                              Honeypot Indicators:
                            </div>
                            <ul style={{
                              margin: 0,
                              paddingLeft: '20px',
                              fontSize: '13px',
                              color: '#7f1d1d',
                            }}>
                              {risk.indicators.map((indicator, idx) => (
                                <li key={idx} style={{ marginBottom: '4px' }}>
                                  {indicator}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {risk.dangerousFunctions && risk.dangerousFunctions.length > 0 && (
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '8px',
                          }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '700',
                              color: '#991b1b',
                              marginBottom: '6px',
                            }}>
                              Dangerous Owner Functions:
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#7f1d1d',
                            }}>
                              {risk.dangerousFunctions.join(', ')}
                            </div>
                          </div>
                        )}
                        {risk.functionCount && (
                          <div style={{
                            marginTop: '8px',
                            fontSize: '12px',
                            color: '#9ca3af',
                            fontStyle: 'italic',
                          }}>
                            Total owner functions: {risk.functionCount}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {analysis.warnings && analysis.warnings.length > 0 && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '16px',
                    color: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
                    Warnings ({analysis.warnings.length})
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    {analysis.warnings.map((warning, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '16px',
                          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          border: '2px solid #fbbf24',
                          borderRadius: '12px',
                        }}
                      >
                        <div style={{
                          fontSize: '14px',
                          color: '#92400e',
                          fontWeight: '600',
                        }}>
                          {typeof warning === 'string' ? warning : warning.description || warning.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safe Features */}
              {analysis.safeFeatures && analysis.safeFeatures.length > 0 && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '16px',
                    color: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <CheckCircle size={20} style={{ color: '#10b981' }} />
                    Safe Features ({analysis.safeFeatures.length})
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                  }}>
                    {analysis.safeFeatures.map((feature, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '16px',
                          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                          border: '2px solid #10b981',
                          borderRadius: '12px',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}>
                          <CheckCircle size={18} style={{ color: '#10b981' }} />
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#e5e7eb',
                          }}>
                            {feature.type}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#065f46',
                        }}>
                          {feature.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract Address Footer */}
              <div style={{
                marginTop: '24px',
                padding: '24px',
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '14px',
                  marginBottom: '12px',
                  fontWeight: '600',
                }}>
                  Analyzed Contract Address
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#e5e7eb',
                  wordBreak: 'break-all',
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '2px solid #d1d5db',
                }}>
                  {analysis.contractAddress}
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
            33% {
              transform: translate(30px, -30px) rotate(120deg);
            }
            66% {
              transform: translate(-20px, 20px) rotate(240deg);
            }
          }
        `}</style>
      </div>
    </NetworkGuard>
  )
}

