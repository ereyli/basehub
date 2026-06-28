import React, { useState } from 'react'
import { Coins, Database, ExternalLink, Lock, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import BackButton from '../components/BackButton'
import EmbedMeta from '../components/EmbedMeta'
import { B20_DEPLOY_FEE_ETH, B20_XP_REWARD } from '../config/b20'

const B20_LOGO_SRC = '/crypto-logos/basahub logo/B20.svg'
const B20_SHARE_URL = 'https://basehub.fun/deploy-b20'
const B20_SHARE_TEXT = `B20 Launchpad - BaseHub
Base-native B20 launches are coming to BaseHub.
${B20_SHARE_URL}`

const styles = {
  shell: {
    maxWidth: '1040px',
    margin: '0 auto',
    padding: '24px 16px 72px',
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(96, 165, 250, 0.18)',
    borderRadius: '18px',
    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(17, 24, 39, 0.96) 52%, rgba(30, 41, 59, 0.96) 100%)',
    boxShadow: '0 24px 80px rgba(2, 6, 23, 0.38)',
    padding: '26px',
    marginTop: '18px',
  },
  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: '22px',
  },
  mark: {
    width: '58px',
    height: '58px',
    borderRadius: '16px',
    background: 'rgba(37, 99, 235, 0.18)',
    border: '1px solid rgba(96, 165, 250, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#93c5fd',
    flexShrink: 0,
  },
  logoImage: {
    width: '42px',
    height: '42px',
    display: 'block',
  },
  titleWrap: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
    minWidth: 0,
  },
  eyebrow: {
    color: '#93c5fd',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  title: {
    color: '#f8fafc',
    fontSize: 'clamp(30px, 5vw, 54px)',
    lineHeight: 1,
    margin: 0,
    fontWeight: 900,
  },
  copy: {
    color: '#b6c3d6',
    fontSize: '15px',
    lineHeight: 1.7,
    maxWidth: '690px',
    margin: '16px 0 0',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '36px',
    padding: '0 13px',
    borderRadius: '999px',
    background: 'rgba(37, 99, 235, 0.14)',
    border: '1px solid rgba(96, 165, 250, 0.28)',
    color: '#bfdbfe',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  xShareButton: {
    minHeight: '38px',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: '999px',
    background: 'rgba(2, 6, 23, 0.48)',
    color: '#e5e7eb',
    padding: '0 14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '10px',
    margin: '24px 0',
  },
  metric: {
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(15, 23, 42, 0.62)',
    borderRadius: '12px',
    padding: '14px',
    minHeight: '86px',
  },
  metricLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: '20px',
    fontWeight: 900,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
    gap: '18px',
    alignItems: 'start',
  },
  panel: {
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(2, 6, 23, 0.26)',
    borderRadius: '14px',
    padding: '18px',
  },
  panelTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#e5e7eb',
    fontSize: '16px',
    fontWeight: 800,
    margin: '0 0 14px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 700,
  },
  control: {
    width: '100%',
    minHeight: '46px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#e5e7eb',
    padding: '0 13px',
    fontSize: '14px',
    boxSizing: 'border-box',
    opacity: 0.78,
  },
  optionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  option: active => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    minHeight: '52px',
    borderRadius: '12px',
    padding: '0 14px',
    border: active ? '1px solid rgba(96, 165, 250, 0.48)' : '1px solid rgba(148, 163, 184, 0.14)',
    background: active ? 'rgba(37, 99, 235, 0.16)' : 'rgba(15, 23, 42, 0.48)',
    color: active ? '#dbeafe' : '#94a3b8',
    fontSize: '13px',
    fontWeight: 800,
  }),
  list: {
    display: 'grid',
    gap: '10px',
    marginTop: '12px',
  },
  listItem: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    color: '#cbd5e1',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '20px',
  },
  soonButton: {
    minHeight: '50px',
    minWidth: '190px',
    border: '1px solid rgba(96, 165, 250, 0.24)',
    borderRadius: '12px',
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#bfdbfe',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'not-allowed',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '9px',
  },
}

const compactCss = `
@media (max-width: 820px) {
  .b20-content-grid { grid-template-columns: 1fr !important; }
  .b20-field-grid { grid-template-columns: 1fr !important; }
  .b20-option-row { grid-template-columns: 1fr !important; }
}
`

export default function DeployB20() {
  const [variant, setVariant] = useState('asset')

  const openXShare = () => {
    const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(B20_SHARE_TEXT)}`
    window.open(intentUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="deploy-token-page">
      <style>{compactCss}</style>
      <EmbedMeta
        title="B20 Launchpad - BaseHub"
        description="Base-native B20 token launches are coming to BaseHub."
        buttonText="B20 Coming Soon"
        image="/image2.jpeg"
      />

      <div style={styles.shell}>
        <BackButton />

        <section style={styles.hero}>
          <div style={styles.heroTop}>
            <div style={styles.titleWrap}>
              <div style={styles.mark}>
                <img src={B20_LOGO_SRC} alt="B20" style={styles.logoImage} />
              </div>
              <div>
                <div style={styles.eyebrow}>Base Mainnet</div>
                <h1 style={styles.title}>B20 Launchpad</h1>
              </div>
            </div>
            <div style={styles.heroActions}>
              <button type="button" onClick={openXShare} style={styles.xShareButton}>
                X Share
                <ExternalLink size={14} />
              </button>
              <div style={styles.pill}>
                <Lock size={15} />
                Coming Soon
              </div>
            </div>
          </div>

          <p style={styles.copy}>
            A polished launch surface for Base-native B20 assets and stablecoins. BaseHub will open creation after Base mainnet activation and the fee wrapper is deployed.
          </p>

          <div style={styles.metrics}>
            <div style={styles.metric}>
              <div style={styles.metricLabel}><Coins size={15} /> Network</div>
              <div style={styles.metricValue}>Base</div>
            </div>
            <div style={styles.metric}>
              <div style={styles.metricLabel}><Zap size={15} /> Launch Fee</div>
              <div style={styles.metricValue}>{B20_DEPLOY_FEE_ETH} ETH</div>
            </div>
            <div style={styles.metric}>
              <div style={styles.metricLabel}><Sparkles size={15} /> Reward</div>
              <div style={styles.metricValue}>{B20_XP_REWARD.toLocaleString()} XP</div>
            </div>
          </div>

          <div className="b20-content-grid" style={styles.contentGrid}>
            <div style={styles.panel}>
              <h2 style={styles.panelTitle}>
                <Database size={18} />
                Launch Setup
              </h2>

              <div className="b20-option-row" style={styles.optionRow}>
                <button type="button" onClick={() => setVariant('asset')} style={styles.option(variant === 'asset')}>
                  Asset
                  {variant === 'asset' && <ShieldCheck size={16} />}
                </button>
                <button type="button" onClick={() => setVariant('stablecoin')} style={styles.option(variant === 'stablecoin')}>
                  Stablecoin
                  {variant === 'stablecoin' && <ShieldCheck size={16} />}
                </button>
              </div>

              <div className="b20-field-grid" style={{ ...styles.fieldGrid, marginTop: '16px' }}>
                <div style={styles.field}>
                  <label style={styles.label}>Token Name</label>
                  <input style={styles.control} value="BaseHub Token" disabled readOnly />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Symbol</label>
                  <input style={styles.control} value="BHT" disabled readOnly />
                </div>
                {variant === 'asset' ? (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Decimals</label>
                      <input style={styles.control} value="18" disabled readOnly />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Supply Cap</label>
                      <input style={styles.control} value="1,000,000" disabled readOnly />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Currency</label>
                      <input style={styles.control} value="USD" disabled readOnly />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Decimals</label>
                      <input style={styles.control} value="6" disabled readOnly />
                    </div>
                  </>
                )}
              </div>

              <div style={styles.actionBar}>
                <button type="button" style={styles.soonButton} disabled>
                  <Lock size={17} />
                  Coming Soon
                </button>
              </div>
            </div>

            <aside style={styles.panel}>
              <h2 style={styles.panelTitle}>
                <ShieldCheck size={18} />
                Mainnet Ready
              </h2>
              <div style={styles.list}>
                <div style={styles.listItem}><ShieldCheck size={16} color="#60a5fa" /> Atomic BaseHub fee wrapper prepared.</div>
                <div style={styles.listItem}><ShieldCheck size={16} color="#60a5fa" /> Asset and stablecoin creation paths wired.</div>
                <div style={styles.listItem}><ShieldCheck size={16} color="#60a5fa" /> Supabase deploy record and 5,000 XP reward path ready.</div>
                <div style={styles.listItem}><ShieldCheck size={16} color="#60a5fa" /> Existing ERC20 deploy flow remains separate.</div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  )
}
