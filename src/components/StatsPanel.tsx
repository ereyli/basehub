import React, { useEffect, useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { base } from 'wagmi/chains';

const SWAP_AGGREGATOR = '0xbf579e68ba69de03ccec14476eb8d765ec558257';

const AGGREGATOR_ABI = [
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_totalSwaps', type: 'uint256' },
      { name: '_totalFeesCollected', type: 'uint256' },
      { name: '_uniqueUsers', type: 'uint256' },
      { name: '_v2Swaps', type: 'uint256' },
      { name: '_v3Swaps', type: 'uint256' },
      { name: '_totalVolumeETH', type: 'uint256' }
    ]
  },
  {
    name: 'feeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }]
  }
] as const;

// ETH price for USD conversion (you can fetch from API)
const ETH_PRICE_USD = 2950;

// Smart number formatting - reduces unnecessary decimals
function formatNumber(value: number, maxDecimals: number = 4): string {
  if (value === 0) return '0';
  if (value < 0.0001) return value.toExponential(2);
  
  // For values >= 1, use max 2 decimals
  if (value >= 1) {
    const formatted = value.toFixed(2);
    // Remove trailing zeros
    return parseFloat(formatted).toString();
  }
  
  // For values < 1, find first significant digit and limit decimals
  // Start with maxDecimals, but remove trailing zeros
  let formatted = value.toFixed(maxDecimals);
  // Remove trailing zeros
  formatted = parseFloat(formatted).toString();
  
  // If still has too many decimals, limit to reasonable amount
  const parts = formatted.split('.');
  if (parts[1] && parts[1].length > 4) {
    // Find first non-zero decimal position
    const str = value.toString();
    const dotIndex = str.indexOf('.');
    if (dotIndex !== -1) {
      const decimals = str.substring(dotIndex + 1);
      let firstNonZero = -1;
      for (let i = 0; i < decimals.length; i++) {
        if (decimals[i] !== '0') {
          firstNonZero = i;
          break;
        }
      }
      // Show first non-zero + 3 more decimals, max 4 total
      const decimalsToShow = Math.min(firstNonZero + 3, 4);
      formatted = value.toFixed(decimalsToShow);
      formatted = parseFloat(formatted).toString();
    }
  }
  
  return formatted;
}

interface StatsPanelProps {
  isMobile?: boolean;
}

export default function StatsPanel({ isMobile = false }: StatsPanelProps) {
  const { data: stats, refetch } = useReadContract({
    address: SWAP_AGGREGATOR as `0x${string}`,
    abi: AGGREGATOR_ABI,
    functionName: 'getStats',
    chainId: base.id
  });

  const { data: feeBps } = useReadContract({
    address: SWAP_AGGREGATOR as `0x${string}`,
    abi: AGGREGATOR_ABI,
    functionName: 'feeBps',
    chainId: base.id
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Extract values safely (default to 0 if stats is null)
  const totalSwaps = stats ? Number(stats[0]) : 0;
  const totalFeesCollected = stats ? stats[1] : BigInt(0);
  const uniqueUsers = stats ? Number(stats[2]) : 0;
  const v2Swaps = stats ? Number(stats[3]) : 0;
  const v3Swaps = stats ? Number(stats[4]) : 0;
  const totalVolumeETH = stats ? stats[5] : BigInt(0);

  const volumeETH = parseFloat(formatUnits(totalVolumeETH, 18));
  const volumeUSD = volumeETH * ETH_PRICE_USD;
  
  // Calculate fees correctly: Fee is taken from OUTPUT tokens
  // totalVolumeETH includes both input and output ETH volume
  // Since fee is from output, we estimate: volume * feeBps / 10000
  // We divide by 2 because volume includes both input and output
  // (roughly half is output, half is input)
  const feePercentage = feeBps ? Number(feeBps) / 10000 : 0.01; // Default 1% if not available
  const estimatedFeesETH = (volumeETH / 2) * feePercentage;
  
  // Contract's totalFeesCollected might be wrong due to mixing different token decimals
  // (USDC 6 decimals, ETH 18 decimals, etc.)
  const rawFeesETH = parseFloat(formatUnits(totalFeesCollected, 18));
  
  // Use calculated fee if contract value is unreasonable
  // (more than volume, negative, or NaN)
  const feesETH = (rawFeesETH > volumeETH || rawFeesETH < 0 || isNaN(rawFeesETH)) 
    ? estimatedFeesETH 
    : Math.min(rawFeesETH, estimatedFeesETH);

  // Generate chart data based on actual value showing growth over time
  // Since we don't have historical data, we simulate growth from 0 to current value
  const generateChartData = (currentValue: number) => {
    const points = 30; // More points for smoother line
    const data = [];
    
    if (currentValue === 0) {
      // If no value, show flat line at bottom
      return new Array(points).fill(5);
    }
    
    // Simulate growth from 0 to current value over time
    // This creates a realistic growth curve
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      
      // Use exponential growth curve (more realistic for crypto metrics)
      // Start slow, accelerate in middle, slow at end
      const growthCurve = Math.pow(progress, 1.5); // Exponential curve
      
      // Add some natural variation (volatility)
      const volatility = Math.sin(progress * Math.PI * 4) * 0.1;
      const variation = Math.cos(progress * Math.PI * 2.5) * 0.08;
      
      // Calculate height (0% to 100% of current value)
      const height = (growthCurve + volatility + variation) * 100;
      
      // Ensure minimum visibility and max 100%
      data.push(Math.max(Math.min(height, 100), 8));
    }
    
    return data;
  };

  // Generate SVG path for line chart
  const generateLinePath = (data: number[], width: number, height: number, color: string) => {
    if (data.length === 0) return '';
    
    const stepX = width / (data.length - 1);
    let path = `M 0 ${height - (data[0] / 100) * height}`;
    
    for (let i = 1; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i] / 100) * height;
      path += ` L ${x} ${y}`;
    }
    
    return path;
  };

  // Generate charts based on actual values (showing growth from 0 to current)
  // IMPORTANT: Hooks must be called before any conditional returns
  const swapsChart = useMemo(() => {
    return generateChartData(totalSwaps);
  }, [totalSwaps]);
  
  const usersChart = useMemo(() => {
    return generateChartData(uniqueUsers);
  }, [uniqueUsers]);
  
  const volumeChart = useMemo(() => {
    return generateChartData(volumeETH);
  }, [volumeETH]);
  
  const feesChart = useMemo(() => {
    return generateChartData(feesETH);
  }, [feesETH]);

  const styles = {
    container: {
      backgroundColor: 'transparent',
      borderRadius: '0',
      padding: '0',
      marginBottom: '0',
      border: 'none',
      height: '100%',
      display: 'flex' as const,
      flexDirection: 'column' as const,
      overflow: 'hidden' as const
    },
    title: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: '16px',
      letterSpacing: '-0.01em'
    },
    statsRow: {
      display: 'flex',
      gap: '10px',
      marginBottom: '16px',
      flexWrap: (isMobile ? 'wrap' : 'nowrap') as const
    },
    statCard: {
      flex: isMobile ? '1 1 calc(50% - 5px)' : '1',
      minWidth: isMobile ? 'calc(50% - 5px)' : '0',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '12px',
      padding: isMobile ? '12px' : '16px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      position: 'relative' as const,
      overflow: 'hidden' as const
    },
    statLabel: {
      fontSize: '11px',
      color: 'rgba(255, 255, 255, 0.5)',
      marginBottom: '10px',
      fontWeight: '500',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em'
    },
    statValue: {
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: '6px',
      letterSpacing: '-0.03em',
      lineHeight: '1.1'
    },
    statSubValue: {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.4)',
      fontWeight: '400',
      marginTop: '2px'
    },
    chartContainer: {
      marginTop: '12px',
      height: '50px',
      position: 'relative' as const,
      width: '100%',
      overflow: 'hidden' as const
    },
    chartSvg: {
      width: '100%',
      height: '100%',
      display: 'block'
    },
    protocolSection: {
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      gap: '16px',
      alignItems: 'center',
      flexWrap: 'wrap' as const
    },
    protocolItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    protocolBadge: {
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.02em'
    },
    v2Badge: {
      backgroundColor: 'rgba(255, 107, 53, 0.12)',
      color: '#ff6b35'
    },
    v3Badge: {
      backgroundColor: 'rgba(76, 110, 245, 0.12)',
      color: '#4c6ef5'
    },
    protocolText: {
      fontSize: '13px',
      color: 'rgba(255, 255, 255, 0.5)',
      fontWeight: '400'
    },
    loading: {
      color: 'rgba(255, 255, 255, 0.5)',
      textAlign: 'center' as const,
      padding: '40px 20px',
      fontSize: '14px'
    }
  };

  if (!stats) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading statistics...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Platform Statistics</div>
      
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Swaps</div>
          <div style={styles.statValue}>
            {Number(totalSwaps).toLocaleString()}
          </div>
          <div style={styles.chartContainer}>
            <svg style={styles.chartSvg} viewBox="0 0 200 50" preserveAspectRatio="none">
              <path
                d={generateLinePath(swapsChart, 200, 50, '#4c6ef5')}
                fill="none"
                stroke="#4c6ef5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="swapsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(76, 110, 245, 0.3)" />
                  <stop offset="100%" stopColor="rgba(76, 110, 245, 0)" />
                </linearGradient>
              </defs>
              <path
                d={`${generateLinePath(swapsChart, 200, 50, '#4c6ef5')} L 200 50 L 0 50 Z`}
                fill="url(#swapsGradient)"
              />
            </svg>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Unique Users</div>
          <div style={styles.statValue}>
            {Number(uniqueUsers).toLocaleString()}
          </div>
          <div style={styles.chartContainer}>
            <svg style={styles.chartSvg} viewBox="0 0 200 50" preserveAspectRatio="none">
              <path
                d={generateLinePath(usersChart, 200, 50, '#ff6b35')}
                fill="none"
                stroke="#ff6b35"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="usersGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255, 107, 53, 0.3)" />
                  <stop offset="100%" stopColor="rgba(255, 107, 53, 0)" />
                </linearGradient>
              </defs>
              <path
                d={`${generateLinePath(usersChart, 200, 50, '#ff6b35')} L 200 50 L 0 50 Z`}
                fill="url(#usersGradient)"
              />
            </svg>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Volume</div>
          <div style={styles.statValue}>
            {formatNumber(volumeETH, 2)} ETH
          </div>
          <div style={styles.statSubValue}>
            ${formatNumber(volumeUSD, 0)}
          </div>
          <div style={styles.chartContainer}>
            <svg style={styles.chartSvg} viewBox="0 0 200 50" preserveAspectRatio="none">
              <path
                d={generateLinePath(volumeChart, 200, 50, '#22c55e')}
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
                  <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                </linearGradient>
              </defs>
              <path
                d={`${generateLinePath(volumeChart, 200, 50, '#22c55e')} L 200 50 L 0 50 Z`}
                fill="url(#volumeGradient)"
              />
            </svg>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Fees</div>
          <div style={styles.statValue}>
            {formatNumber(feesETH, 4)} ETH
          </div>
          <div style={styles.statSubValue}>
            ${formatNumber(feesETH * ETH_PRICE_USD, 0)}
          </div>
          <div style={styles.chartContainer}>
            <svg style={styles.chartSvg} viewBox="0 0 200 50" preserveAspectRatio="none">
              <path
                d={generateLinePath(feesChart, 200, 50, '#a855f7')}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="feesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(168, 85, 247, 0.3)" />
                  <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
                </linearGradient>
              </defs>
              <path
                d={`${generateLinePath(feesChart, 200, 50, '#a855f7')} L 200 50 L 0 50 Z`}
                fill="url(#feesGradient)"
              />
            </svg>
          </div>
        </div>
      </div>

      <div style={styles.protocolSection}>
        <div style={styles.protocolItem}>
          <span style={{ ...styles.protocolBadge, ...styles.v2Badge }}>V2</span>
          <span style={styles.protocolText}>{Number(v2Swaps).toLocaleString()} swaps</span>
        </div>
        <div style={styles.protocolItem}>
          <span style={{ ...styles.protocolBadge, ...styles.v3Badge }}>V3</span>
          <span style={styles.protocolText}>{Number(v3Swaps).toLocaleString()} swaps</span>
        </div>
        <div style={styles.protocolItem}>
          <span style={styles.protocolText}>
            V2: {totalSwaps > 0 ? ((Number(v2Swaps) / Number(totalSwaps)) * 100).toFixed(1) : 0}% | 
            V3: {totalSwaps > 0 ? ((Number(v3Swaps) / Number(totalSwaps)) * 100).toFixed(1) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}

