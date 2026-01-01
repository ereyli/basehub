import React, { useState, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SwapInterface from '../components/SwapInterface.tsx';
import StatsPanel from '../components/StatsPanel.tsx';
import BackButton from '../components/BackButton';

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
              backgroundColor: '#667eea',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    subtitle: {
      fontSize: isMobile ? '12px' : '16px',
      color: 'rgba(255, 255, 255, 0.6)',
      lineHeight: '1.4'
    },
    mainGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: isMobile ? '12px' : '24px',
      marginBottom: '24px'
    },
    swapCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '20px',
      padding: isMobile ? '14px' : '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)'
    },
    statsCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '20px',
      padding: isMobile ? '14px' : '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: isMobile ? '350px' : 'auto'
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

        <div style={styles.mainGrid}>
          <div style={styles.swapCard}>
            <SwapErrorBoundary>
              <SwapInterface />
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

