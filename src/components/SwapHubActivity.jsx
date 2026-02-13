import React from 'react';
import { TrendingUp, Zap, ArrowRightLeft } from 'lucide-react';
import { useSwapHubActivity, getTimeAgo } from '../hooks/useSwapHubActivity';

export default function SwapHubActivity({ isMobile = false }) {
  const { activity, loading, error, MILESTONE_LABELS } = useSwapHubActivity(25);

  const shortAddress = (addr) => {
    if (!addr || addr.length < 12) return addr || '…';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getXpLabel = (gameType) => {
    const lab = MILESTONE_LABELS[gameType];
    return lab?.short || gameType?.replace('SWAP_MILESTONE_', '$') || 'XP';
  };

  const panelStyle = isMobile
    ? {
        marginTop: '16px',
        padding: '14px',
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        maxHeight: '320px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.25)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        maxHeight: '420px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      };

  return (
    <div style={panelStyle}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        flexShrink: 0
      }}>
        <TrendingUp size={isMobile ? 18 : 20} color="#60a5fa" />
        <h3 style={{
          color: '#e2e8f0',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: '600',
          margin: 0
        }}>
          Live Activity
        </h3>
        <span style={{
          fontSize: '10px',
          color: '#64748b',
          background: 'rgba(34, 197, 94, 0.2)',
          color: '#22c55e',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: '600'
        }}>
          LIVE
        </span>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px' }}>{error}</div>
      )}

      {loading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#64748b',
          fontSize: '13px'
        }}>
          Loading activity...
        </div>
      ) : activity.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#64748b',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          <ArrowRightLeft size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <div style={{ fontWeight: '600', marginBottom: '4px', color: '#94a3b8' }}>No activity yet</div>
          <div style={{ fontSize: '12px' }}>Swaps and XP rewards will appear here</div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }}>
          {activity.map((item) => {
            const shortAddr = shortAddress(item.wallet_address);
            const timeAgo = getTimeAgo(new Date(item.created_at));
            if (item.type === 'swap') {
              const amount = Number(item.amount_usd);
              const amountStr = amount >= 1000 ? `$${(amount / 1000).toFixed(1)}k` : `$${amount.toFixed(2)}`;
              return (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(59, 130, 246, 0.06)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ArrowRightLeft size={14} color="#60a5fa" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#e2e8f0',
                      fontSize: '12px',
                      fontWeight: '600',
                      fontFamily: 'ui-monospace, monospace',
                      marginBottom: '2px'
                    }}>
                      {shortAddr}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                      swapped {amountStr} · {timeAgo}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#60a5fa'
                  }}>
                    {amountStr}
                  </span>
                </div>
              );
            }
            const xp = Number(item.xp_earned) || 0;
            const xpStr = xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp;
            const milestoneShort = getXpLabel(item.game_type);
            return (
              <div
                key={item.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(251, 191, 36, 0.06)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                  border: '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(251, 191, 36, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(251, 191, 36, 0.06)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'rgba(251, 191, 36, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Zap size={14} color="#fbbf24" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: '600',
                    fontFamily: 'ui-monospace, monospace',
                    marginBottom: '2px'
                  }}>
                    {shortAddr}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                    reached {milestoneShort} · {timeAgo}
                  </div>
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#fbbf24'
                }}>
                  +{xpStr} XP
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
