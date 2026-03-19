import React, { useState, useEffect } from 'react'
import { MessageCircle, X, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import BasehubAssistant from './BasehubAssistant'
import { EARLY_ACCESS_CONFIG, EARLY_ACCESS_ABI } from '../config/earlyAccessNFT'
import { NETWORKS } from '../config/networks'

const AssistantLauncher = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [open, setOpen] = useState(false)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isOnBase = chainId === NETWORKS.BASE.chainId
  const shouldFetchBalance = !!address && !!EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS && isConnected && isOnBase
  const { data: nftBalance, isFetched: nftBalanceFetched } = useReadContract({
    address: shouldFetchBalance ? EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS : undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'balanceOf',
    args: shouldFetchBalance && address ? [address] : undefined,
    query: { enabled: shouldFetchBalance },
  })
  const isPassHolder = Boolean(shouldFetchBalance && nftBalanceFetched && nftBalance !== undefined && (nftBalance ?? 0n) > 0n)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const toggle = () => setOpen((v) => !v)

  const button = (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        cursor: 'pointer',
        color: '#e5f9ff',
        fontSize: isMobile ? 11 : 13,
        fontWeight: 600,
        padding: isMobile ? '6px 11px' : '9px 15px',
        borderRadius: 999,
        // Daha BaseHub uyumlu: mor-mavi gradient
        background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 45%, #22c55e 100%)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.95)',
      }}
    >
      <MessageCircle size={isMobile ? 14 : 18} />
      <span>{isMobile ? 'AI' : 'BaseHub Assistant'}</span>
    </button>
  )

  if (isMobile) {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            bottom: 82,
            right: 14,
            pointerEvents: 'none',
            zIndex: 1200,
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>{button}</div>
        </div>
        {open && (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              zIndex: 1300,
              background: 'rgba(15,23,42,0.65)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
            }}
            onClick={toggle}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxHeight: '62vh',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                background: 'rgba(15,23,42,0.98)',
                borderTop: '1px solid rgba(148,163,184,0.5)',
                padding: '10px 12px 14px',
                boxShadow: '0 -12px 30px rgba(0,0,0,0.9)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                  BaseHub Assistant
                </span>
                <button
                  type="button"
                  onClick={toggle}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              {!isConnected ? (
                <div style={{ padding: '12px 0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                  Connect your wallet to use the Assistant. The Assistant is for BaseHub Early Access Pass holders.
                </div>
            ) : !isPassHolder ? (
              <div style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Sparkles size={20} color="#f59e0b" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                    {shouldFetchBalance && !nftBalanceFetched ? 'Checking Pass...' : 'Pass holders only'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>
                  The BaseHub Assistant is an exclusive benefit for BaseHub Early Access Pass holders. Mint your pass to get personalized XP tips, mission suggestions, and onchain activity guidance.
                </p>
                {(!shouldFetchBalance || nftBalanceFetched) && (
                  <Link
                    to="/early-access"
                    onClick={toggle}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#111827',
                      fontWeight: 600,
                      fontSize: 12,
                      textDecoration: 'none',
                    }}
                  >
                    Mint BaseHub Early Access Pass
                  </Link>
                )}
              </div>
            ) : (
                <BasehubAssistant lastUserMessage="" />
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          right: 28,
          bottom: 28,
          zIndex: 1200,
        }}
      >
        {button}
      </div>
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 28,
            bottom: 96,
            width: 430,
            maxWidth: '92vw',
            zIndex: 1300,
          }}
        >
          <div
            style={{
              borderRadius: 20,
              background: 'rgba(15,23,42,0.98)',
              border: '1px solid rgba(148,163,184,0.6)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.85)',
              padding: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                BaseHub Assistant
              </span>
              <button
                type="button"
                onClick={toggle}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>
            {!isConnected ? (
              <div style={{ padding: '16px 0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                Connect your wallet to use the Assistant. The Assistant is for BaseHub Early Access Pass holders.
              </div>
            ) : !isPassHolder ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Sparkles size={20} color="#f59e0b" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                    {shouldFetchBalance && !nftBalanceFetched ? 'Checking Pass...' : 'Pass holders only'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>
                  The BaseHub Assistant is an exclusive benefit for BaseHub Early Access Pass holders. Mint your pass to get personalized XP tips, mission suggestions, and onchain activity guidance.
                </p>
                {(!shouldFetchBalance || nftBalanceFetched) && (
                  <Link
                    to="/early-access"
                    onClick={toggle}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#111827',
                      fontWeight: 600,
                      fontSize: 12,
                      textDecoration: 'none',
                    }}
                  >
                    Mint BaseHub Early Access Pass
                  </Link>
                )}
              </div>
            ) : (
              <BasehubAssistant lastUserMessage="" />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default AssistantLauncher

