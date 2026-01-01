import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SwapInterface from '../components/SwapInterface.tsx';
import StatsPanel from '../components/StatsPanel.tsx';
import BackButton from '../components/BackButton';

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
      paddingBottom: isMobile ? '80px' : '20px'
    },
    content: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: isMobile ? '20px 16px' : '40px 20px'
    },
    header: {
      marginBottom: '32px',
      textAlign: 'center'
    },
    title: {
      fontSize: isMobile ? '28px' : '36px',
      fontWeight: '700',
      color: '#ffffff',
      marginBottom: '12px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    subtitle: {
      fontSize: isMobile ? '14px' : '16px',
      color: 'rgba(255, 255, 255, 0.6)',
      lineHeight: '1.6'
    },
    mainGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '24px',
      marginBottom: '24px'
    },
    swapCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '20px',
      padding: isMobile ? '20px' : '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)'
    },
    statsCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '20px',
      padding: isMobile ? '20px' : '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column'
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
            <SwapInterface />
          </div>

          <div style={styles.statsCard}>
            <StatsPanel isMobile={isMobile} />
          </div>
        </div>
      </div>
    </div>
  );
}

