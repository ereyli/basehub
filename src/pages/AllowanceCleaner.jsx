import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useAllowanceCleaner } from '../hooks/useAllowanceCleaner'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trash2,
  Loader2,
  Search,
  ExternalLink
} from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'
import { formatUnits } from 'viem'

export default function AllowanceCleaner() {
  const { address, isConnected } = useAccount()
  const { 
    scanAllowances, 
    revokeAllowance, 
    revokeAllRisky,
    isLoading, 
    isScanning,
    isRevoking,
    error, 
    allowances,
    hasScanned
  } = useAllowanceCleaner()

  const [revokingIndex, setRevokingIndex] = useState(null)

  const handleScan = async () => {
    try {
      await scanAllowances()
    } catch (err) {
      console.error('Scan failed:', err)
    }
  }

  const handleRevoke = async (tokenAddress, spenderAddress, index) => {
    try {
      setRevokingIndex(index)
      await revokeAllowance(tokenAddress, spenderAddress)
    } catch (err) {
      console.error('Revoke failed:', err)
    } finally {
      setRevokingIndex(null)
    }
  }

  const handleRevokeAllRisky = async () => {
    if (!confirm('Are you sure you want to revoke all risky allowances? This will send multiple transactions.')) {
      return
    }

    try {
      await revokeAllRisky()
    } catch (err) {
      console.error('Batch revoke failed:', err)
    }
  }

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high': return '#ef4444' // red
      case 'medium': return '#f59e0b' // yellow
      case 'low': return '#10b981' // green
      default: return '#6b7280' // gray
    }
  }

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'high': return <AlertTriangle size={16} style={{ color: '#ef4444' }} />
      case 'medium': return <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
      case 'low': return <CheckCircle size={16} style={{ color: '#10b981' }} />
      default: return null
    }
  }

  const riskyCount = allowances.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium').length

  return (
    <NetworkGuard showWarning={true}>
      <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <BackButton />
        
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Shield size={32} style={{ color: '#3b82f6' }} />
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#e5e7eb' }}>
              Allowance Cleaner
            </h1>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            Scan and revoke risky token approvals to protect your assets. Pay 0.01 USDC to scan your wallet.
          </p>
        </div>

        {!isConnected && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            color: '#ef4444',
            marginBottom: '24px'
          }}>
            <AlertTriangle size={24} style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: '600' }}>Please connect your wallet to scan allowances</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
              Your connected wallet will be scanned automatically
            </p>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            color: '#ef4444'
          }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {!hasScanned && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <Shield size={48} style={{ color: '#3b82f6', marginBottom: '16px' }} />
            <h2 style={{ color: '#e5e7eb', marginBottom: '12px' }}>Scan Your Allowances</h2>
            <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
              We'll scan your wallet for all token approvals and identify risky ones that should be revoked.
            </p>
            <button
              onClick={handleScan}
              disabled={!isConnected || isScanning}
              style={{
                background: isConnected && !isScanning ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(59, 130, 246, 0.3)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 28px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isConnected && !isScanning ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto',
                transition: 'all 0.2s'
              }}
            >
              {isScanning ? (
                <>
                  <Loader2 size={20} className="spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Scan Allowances (0.01 USDC)
                </>
              )}
            </button>
          </div>
        )}

        {hasScanned && (
          <>
            <div style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '4px' }}>Total Allowances</div>
                <div style={{ color: '#e5e7eb', fontSize: '24px', fontWeight: 'bold' }}>{allowances.length}</div>
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '4px' }}>Risky Allowances</div>
                <div style={{ color: riskyCount > 0 ? '#ef4444' : '#10b981', fontSize: '24px', fontWeight: 'bold' }}>
                  {riskyCount}
                </div>
              </div>
              {riskyCount > 0 && (
                <button
                  onClick={handleRevokeAllRisky}
                  disabled={isRevoking}
                  style={{
                    background: isRevoking ? 'rgba(239, 68, 68, 0.3)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isRevoking ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isRevoking ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Revoking...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Revoke All Risky ({riskyCount})
                    </>
                  )}
                </button>
              )}
            </div>

            {allowances.length === 0 ? (
              <div style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '40px',
                textAlign: 'center'
              }}>
                <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '16px' }} />
                <h3 style={{ color: '#e5e7eb', marginBottom: '8px' }}>No Allowances Found</h3>
                <p style={{ color: '#9ca3af', margin: 0 }}>
                  Your wallet has no active token approvals. You're all set! 🎉
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {allowances.map((allowance, index) => {
                  const isUnlimited = allowance.amount === 'unlimited' || allowance.amount === 'max'
                  const displayAmount = isUnlimited 
                    ? 'Unlimited' 
                    : formatUnits(BigInt(allowance.amount || '0'), allowance.decimals || 18)

                  return (
                    <div
                      key={`${allowance.tokenAddress}-${allowance.spenderAddress}`}
                      style={{
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: `1px solid ${getRiskColor(allowance.riskLevel)}40`,
                        borderRadius: '12px',
                        padding: '20px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {getRiskIcon(allowance.riskLevel)}
                            <span style={{ 
                              color: getRiskColor(allowance.riskLevel), 
                              fontWeight: '600',
                              fontSize: '14px',
                              textTransform: 'uppercase'
                            }}>
                              {allowance.riskLevel} Risk
                            </span>
                          </div>
                          <div style={{ color: '#e5e7eb', fontWeight: '600', marginBottom: '4px' }}>
                            {allowance.tokenSymbol || 'Unknown Token'}
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'monospace' }}>
                            {allowance.tokenAddress.slice(0, 6)}...{allowance.tokenAddress.slice(-4)}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Approved Amount</div>
                          <div style={{ color: isUnlimited ? '#ef4444' : '#e5e7eb', fontWeight: '600' }}>
                            {displayAmount} {allowance.tokenSymbol || ''}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Spender</div>
                          <div style={{ color: '#e5e7eb', fontSize: '12px', fontFamily: 'monospace', marginBottom: '4px' }}>
                            {allowance.spenderAddress.slice(0, 6)}...{allowance.spenderAddress.slice(-4)}
                          </div>
                          {allowance.spenderName && (
                            <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                              {allowance.spenderName}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {allowance.reason && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px',
                          color: '#ef4444',
                          fontSize: '13px'
                        }}>
                          ⚠️ {allowance.reason}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleRevoke(allowance.tokenAddress, allowance.spenderAddress, index)}
                          disabled={isRevoking || revokingIndex === index}
                          style={{
                            background: (allowance.riskLevel === 'high' || allowance.riskLevel === 'medium')
                              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                              : 'rgba(59, 130, 246, 0.2)',
                            color: (allowance.riskLevel === 'high' || allowance.riskLevel === 'medium') ? 'white' : '#9ca3af',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: (isRevoking || revokingIndex === index) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            opacity: (isRevoking || revokingIndex === index) ? 0.5 : 1
                          }}
                        >
                          {revokingIndex === index ? (
                            <>
                              <Loader2 size={14} className="spin" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <XCircle size={14} />
                              Revoke
                            </>
                          )}
                        </button>
                        <a
                          href={`https://basescan.org/address/${allowance.spenderAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#3b82f6',
                            textDecoration: 'none',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          View on BaseScan
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    </NetworkGuard>
  )
}

