import React from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Coins, ExternalLink, FileText, Lock, Shield, Wallet, Zap } from 'lucide-react'
import BackButton from '../components/BackButton'
import { CONTRACT_ADDRESSES, NETWORKS, getAddressExplorerUrl, getMainnetNetworks } from '../config/networks'

const PLATFORM_FEE_WALLET = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

function getConfigKey(chainId) {
  return Object.entries(NETWORKS).find(([, network]) => Number(network.chainId) === Number(chainId))?.[0]
}

function shortAddress(value) {
  if (!value) return ''
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export default function TrustCenter() {
  const mainnets = getMainnetNetworks()

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '20px 16px 64px' }}>
      <BackButton />
      <section style={hero}>
        <div style={{ width: 58, height: 58, borderRadius: 16, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', marginBottom: 18 }}>
          <Shield size={30} />
        </div>
        <h1 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: 'clamp(30px, 5vw, 52px)', lineHeight: 1 }}>
          BaseHub Trust Center
        </h1>
        <p style={{ maxWidth: 760, color: '#cbd5e1', fontSize: 16, lineHeight: 1.65, margin: 0 }}>
          Supported networks, fee destination, explorer links, and contract surfaces in one place so users can verify what they are signing before they play, deploy, or mint.
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { icon: BadgeCheck, label: 'Mainnet XP', value: 'Enabled on supported mainnets' },
          { icon: Wallet, label: 'Platform fee wallet', value: shortAddress(PLATFORM_FEE_WALLET), href: getAddressExplorerUrl(NETWORKS.BASE.chainId, PLATFORM_FEE_WALLET) },
          { icon: Lock, label: 'Private keys', value: 'Never stored or requested' },
          { icon: Zap, label: 'Premium payments', value: 'x402 and on-chain fees shown in flow' },
        ].map((item) => {
          const Icon = item.icon
          const content = (
            <>
              <Icon size={20} style={{ color: '#60a5fa' }} />
              <div>
                <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>{item.label}</div>
                <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 800 }}>{item.value}</div>
              </div>
            </>
          )
          return item.href ? (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" style={statCard}>
              {content}
            </a>
          ) : (
            <div key={item.label} style={statCard}>{content}</div>
          )
        })}
      </div>

      <section style={panel}>
        <h2 style={sectionTitle}><Coins size={20} /> Supported networks</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {mainnets.map((network) => {
            const configKey = getConfigKey(network.chainId)
            const contractCount = Object.values(CONTRACT_ADDRESSES[configKey] || {}).filter((value) => String(value || '').startsWith('0x')).length
            const landingPath = ['arbitrum', 'optimism', 'monad'].includes(network.networkKey) ? `/${network.networkKey}` : null
            return (
              <div key={network.chainId} style={networkCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#020617', border: '1px solid rgba(148,163,184,0.18)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {network.iconUrls?.[0] ? <img src={network.iconUrls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Shield size={16} style={{ color: '#60a5fa' }} />}
                  </div>
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: 900 }}>{network.chainName}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>Chain ID {network.chainId}</div>
                  </div>
                </div>
                <div style={miniRows}>
                  <span>Native fee</span>
                  <strong>{network.nativeCurrency?.symbol || 'ETH'}</strong>
                </div>
                <div style={miniRows}>
                  <span>Contracts</span>
                  <strong>{contractCount}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <a href={network.blockExplorerUrls?.[0]} target="_blank" rel="noopener noreferrer" style={smallButton}>
                    Explorer <ExternalLink size={12} />
                  </a>
                  {landingPath && <Link to={landingPath} style={smallButton}>Landing</Link>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section style={panel}>
        <h2 style={sectionTitle}><FileText size={20} /> User-facing guarantees</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {[
            ['Fee clarity', 'Deploy and mint flows should show the native currency before the wallet opens, including MON on Monad and ETH on EVM L2s.'],
            ['Explorer verification', 'Every successful transaction should link to the correct chain explorer, not a Base-only fallback.'],
            ['XP transparency', 'Testnets do not count toward XP; supported mainnets use the same reward rules unless a product states otherwise.'],
            ['Wallet safety', 'BaseHub never asks users to paste seed phrases, private keys, or deployer keys into the app.'],
          ].map(([title, text]) => (
            <div key={title} style={guaranteeCard}>
              <div style={{ color: '#e5e7eb', fontWeight: 900, marginBottom: 6 }}>{title}</div>
              <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.55 }}>{text}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const hero = {
  borderRadius: 22,
  border: '1px solid rgba(148,163,184,0.14)',
  background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.82)), radial-gradient(circle at 20% 0%, rgba(34,197,94,0.18), transparent 34%)',
  padding: '34px 24px',
  marginBottom: 18,
}

const statCard = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(15,23,42,0.78)',
  textDecoration: 'none',
}

const panel = {
  borderRadius: 20,
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(15,23,42,0.78)',
  padding: 18,
  marginBottom: 18,
}

const sectionTitle = {
  margin: '0 0 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#f8fafc',
  fontSize: 20,
}

const networkCard = {
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(2,6,23,0.36)',
  padding: 14,
}

const miniRows = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  color: '#94a3b8',
  fontSize: 13,
  padding: '6px 0',
  borderTop: '1px solid rgba(148,163,184,0.08)',
}

const smallButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid rgba(96,165,250,0.24)',
  background: 'rgba(96,165,250,0.1)',
  color: '#93c5fd',
  borderRadius: 10,
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none',
}

const guaranteeCard = {
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.1)',
  background: 'rgba(2,6,23,0.34)',
  padding: 14,
}
