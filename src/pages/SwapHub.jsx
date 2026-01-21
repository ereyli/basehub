import React, { useState, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useChainId, useSwitchChain } from 'wagmi';
import SwapInterface from '../components/SwapInterface.tsx';
import StatsPanel from '../components/StatsPanel.tsx';
import BackButton from '../components/BackButton';
import { NETWORKS } from '../config/networks';

// Error Boundary Component
class SwapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ SwapInterface Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#fff',
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 0, 0, 0.3)'
        }}>
          <h2 style={{ color: '#ff4444', marginBottom: '16px' }}>⚠️ Swap Interface Error</h2>
          <p style={{ marginBottom: '16px', opacity: 0.8 }}>
            An error occurred while loading the swap interface. Please refresh the page.
          </p>
            <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          >
            Refresh Page
          </button>
          {this.state.error && (
            <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '12px', opacity: 0.7 }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error Details</summary>
              <pre style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SwapHub() {
  const navigate = useNavigate();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Swap only works on Base network
  const isOnBase = chainId === NETWORKS.BASE.chainId;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSwapClick = async () => {
    if (!isOnBase) {
      try {
        await switchChain({ chainId: NETWORKS.BASE.chainId });
      } catch (err) {
        console.error('Failed to switch to Base network:', err);
        alert('Please switch to Base network to use SwapHub');
      }
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
      paddingTop: isMobile ? '60px' : '0',
      paddingBottom: isMobile ? '120px' : '20px'
    },
    content: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: isMobile ? '12px 10px' : '40px 20px'
    },
    header: {
      marginBottom: isMobile ? '16px' : '32px',
      textAlign: 'center'
    },
    title: {
      fontSize: isMobile ? '22px' : '36px',
      fontWeight: '700',
      color: '#ffffff',
      marginBottom: '6px',
      background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    subtitle: {
      fontSize: isMobile ? '12px' : '16px',
      color: '#9ca3af',
      lineHeight: '1.4'
    },
    mainGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: isMobile ? '12px' : '24px',
      marginBottom: '24px'
    },
    swapCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.6)',
      borderRadius: '20px',
      padding: isMobile ? '14px' : '24px',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      backdropFilter: 'blur(10px)'
    },
    statsCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.6)',
      borderRadius: '20px',
      padding: isMobile ? '14px' : '24px',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: isMobile ? '350px' : 'auto'
    },
    xpBanner: {
      backgroundColor: 'rgba(30, 41, 59, 0.6)',
      borderRadius: '16px',
      padding: isMobile ? '16px' : '20px 24px',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      backdropFilter: 'blur(10px)',
      marginBottom: isMobile ? '16px' : '24px',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
      boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)'
    },
    xpBannerContent: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isMobile ? '12px' : '20px',
      flexWrap: isMobile ? 'wrap' : 'nowrap'
    },
    xpBannerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '12px' : '16px',
      flex: 1
    },
    xpIcon: {
      width: isMobile ? '40px' : '48px',
      height: isMobile ? '40px' : '48px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.25)',
      backdropFilter: 'blur(8px)'
    },
    xpBannerText: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flex: 1
    },
    xpBannerTitle: {
      fontSize: isMobile ? '16px' : '18px',
      fontWeight: '700',
      color: '#ffffff',
      lineHeight: '1.3'
    },
    xpBannerSubtitle: {
      fontSize: isMobile ? '12px' : '14px',
      color: '#9ca3af',
      lineHeight: '1.4'
    },
    xpRewards: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      alignItems: isMobile ? 'flex-start' : 'flex-end',
      flexShrink: 0
    },
    xpRewardItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: isMobile ? '13px' : '14px',
      color: '#ffffff',
      fontWeight: '600'
    },
    xpBadge: {
      padding: '4px 10px',
      borderRadius: '8px',
      background: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      fontSize: isMobile ? '12px' : '13px',
      fontWeight: '700',
      color: '#60a5fa'
    }
  };

  return (
    <div style={styles.container}>
      <BackButton />
      
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>SwapHub DEX Aggregator</h1>
          <p style={styles.subtitle}>
            Best rates across Uniswap V2 & V3 on Base Chain
          </p>
        </div>

        {/* XP Event Banner */}
        <div style={styles.xpBanner}>
          <div style={styles.xpBannerContent}>
            <div style={styles.xpBannerLeft}>
              <div style={styles.xpIcon}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? '24px' : '28px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  ⭐
                </div>
              </div>
              <div style={styles.xpBannerText}>
                <div style={styles.xpBannerTitle}>
                  XP Rewards Active!
                </div>
                <div style={styles.xpBannerSubtitle}>
                  Earn XP on every swap, reach milestones and unlock bonus rewards!
                </div>
              </div>
            </div>
            <div style={styles.xpRewards}>
              <div style={styles.xpRewardItem}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.4)'
                }}>
                  <div style={{ fontSize: '12px' }}>⚡</div>
                </div>
                <span>Per Swap: <span style={styles.xpBadge}>250 XP</span></span>
              </div>
              <div style={styles.xpRewardItem}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
                }}>
                  <div style={{ fontSize: '12px' }}>🎯</div>
                </div>
                <span>Per $500: <span style={styles.xpBadge}>5000 XP</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Network Warning Banner - Show when not on Base */}
        {!isOnBase && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '16px',
            padding: isMobile ? '16px' : '20px',
            marginBottom: isMobile ? '16px' : '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={24} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: isMobile ? '14px' : '16px', 
                fontWeight: '600', 
                color: '#fbbf24',
                marginBottom: '4px'
              }}>
                SwapHub is only available on Base network
              </div>
              <div style={{ 
                fontSize: isMobile ? '12px' : '14px', 
                color: 'rgba(251, 191, 36, 0.8)' 
              }}>
                Please switch to Base network to use SwapHub DEX Aggregator
              </div>
            </div>
            <button
              onClick={handleSwapClick}
              style={{
                padding: isMobile ? '10px 16px' : '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              Switch to Base
            </button>
          </div>
        )}

        <div style={styles.mainGrid}>
          <div style={styles.swapCard}>
            <SwapErrorBoundary>
              {isOnBase ? (
                <SwapInterface />
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#9ca3af'
                }}>
                  <AlertCircle size={48} style={{ color: '#f59e0b', marginBottom: '16px', margin: '0 auto 16px' }} />
                  <h3 style={{ color: '#fff', marginBottom: '8px' }}>Switch to Base Network</h3>
                  <p style={{ marginBottom: '20px' }}>
                    SwapHub is only available on Base network. Please switch to Base to continue.
                  </p>
                  <button
                    onClick={handleSwapClick}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    Switch to Base Network
                  </button>
                </div>
              )}
            </SwapErrorBoundary>
          </div>

          <div style={styles.statsCard}>
            <SwapErrorBoundary>
              <StatsPanel isMobile={isMobile} />
            </SwapErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

