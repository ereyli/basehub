import React from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Activity, ArrowRight, BadgeCheck, Coins, ExternalLink, Gamepad2, Image, Package, Shield, Sparkles, Zap } from 'lucide-react'
import BackButton from '../components/BackButton'
import { CONTRACT_ADDRESSES, NETWORKS, getAddressExplorerUrl } from '../config/networks'

const LANDING_COPY = {
  arbitrum: {
    title: 'Arbitrum on BaseHub',
    eyebrow: 'Low-cost Ethereum L2',
    summary: 'Deploy tokens, launch NFTs, play XP games, and grow your on-chain footprint on Arbitrum One.',
    accent: '#28a0f0',
    logo: '/arbitrum-logo.svg',
  },
  optimism: {
    title: 'Optimism on BaseHub',
    eyebrow: 'ETH-native Superchain access',
    summary: 'Use BaseHub deploy, gaming, and NFT flows on Optimism with the same XP rules as other mainnet networks.',
    accent: '#ff0420',
    logo: '/optimism-logo.svg',
  },
  monad: {
    title: 'Monad on BaseHub',
    eyebrow: 'High-performance EVM',
    summary: 'Play, deploy, and launch NFTs on Monad with MON-native fees shown clearly in every supported flow.',
    accent: '#836ef9',
    logo: '/monad-logo.svg',
  },
}

function findNetwork(networkKey) {
  const entry = Object.entries(NETWORKS).find(([, value]) => value.networkKey === networkKey)
  if (!entry) return null
  return { configKey: entry[0], ...entry[1] }
}

function shortAddress(value) {
  if (!value) return ''
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export default function NetworkLanding({ networkKey }) {
  const copy = LANDING_COPY[networkKey]
  const network = findNetwork(networkKey)
  if (!copy || !network) return <Navigate to="/" replace />

  const contracts = CONTRACT_ADDRESSES[network.configKey] || {}
  const supportedContracts = Object.entries(contracts).filter(([, value]) => value && String(value).startsWith('0x'))
  const nativeSymbol = network.nativeCurrency?.symbol || 'ETH'
  const featureCards = [
    { icon: Gamepad2, label: 'XP games', value: 'GM, GN, flip, dice, slots and lucky number', path: '/' },
    { icon: Package, label: 'Token deploys', value: `ERC20/721/1155 fees paid in ${nativeSymbol}`, path: '/deploy' },
    { icon: Image, label: 'NFT Launchpad', value: `Creator collections and mint pages on ${network.chainName}`, path: '/nft-launchpad' },
    { icon: BadgeCheck, label: 'Mainnet XP', value: 'Rewards count toward BaseHub leaderboard and seasons', path: '/leaderboard' },
  ]

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 16px 64px' }}>
      <BackButton />
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 22,
          border: '1px solid rgba(148,163,184,0.14)',
          background: `linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.84)), radial-gradient(circle at 20% 0%, ${copy.accent}30, transparent 34%)`,
          padding: '34px 24px',
          marginBottom: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <img
            src={copy.logo}
            alt={network.chainName}
            style={{ width: 62, height: 62, borderRadius: '50%', background: '#020617', border: '1px solid rgba(255,255,255,0.16)' }}
          />
          <div>
            <div style={{ color: copy.accent, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {copy.eyebrow}
            </div>
            <h1 style={{ margin: '4px 0 0', color: '#f8fafc', fontSize: 'clamp(30px, 5vw, 52px)', lineHeight: 1 }}>
              {copy.title}
            </h1>
          </div>
        </div>
        <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.6, maxWidth: 760, margin: '0 0 22px' }}>
          {copy.summary}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/nft-launchpad" style={primaryButton(copy.accent)}>
            Launch NFT <ArrowRight size={16} />
          </Link>
          <Link to="/deploy" style={secondaryButton}>
            Deploy token
          </Link>
          <Link to="/trust" style={secondaryButton}>
            View trust center
          </Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { icon: Activity, label: 'Chain ID', value: network.chainId },
          { icon: Coins, label: 'Native fee token', value: nativeSymbol },
          { icon: Shield, label: 'Explorer', value: network.blockExplorerUrls?.[0]?.replace(/^https?:\/\//, '') },
          { icon: Zap, label: 'XP status', value: network.isTestnet ? 'Testnet only' : 'Mainnet rewards live' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} style={statCard}>
              <Icon size={18} style={{ color: copy.accent }} />
              <div>
                <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>{stat.label}</div>
                <div style={{ color: '#e5e7eb', fontSize: 15, fontWeight: 800, wordBreak: 'break-word' }}>{stat.value}</div>
              </div>
            </div>
          )
        })}
      </div>

      <section style={panel}>
        <h2 style={sectionTitle}><Sparkles size={20} /> What you can do</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {featureCards.map((feature) => {
            const Icon = feature.icon
            return (
              <Link key={feature.label} to={feature.path} style={featureCard(copy.accent)}>
                <Icon size={22} style={{ color: copy.accent }} />
                <div>
                  <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 800 }}>{feature.label}</div>
                  <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>{feature.value}</div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section style={panel}>
        <h2 style={sectionTitle}><Shield size={20} /> Live contracts</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {supportedContracts.slice(0, 12).map(([name, address]) => (
            <a
              key={name}
              href={getAddressExplorerUrl(network.chainId, address)}
              target="_blank"
              rel="noopener noreferrer"
              style={contractRow}
            >
              <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{name.replaceAll('_', ' ')}</span>
              <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {shortAddress(address)} <ExternalLink size={13} />
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

const primaryButton = (accent) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 12,
  background: accent,
  color: '#020617',
  fontWeight: 900,
  textDecoration: 'none',
})

const secondaryButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.22)',
  background: 'rgba(15,23,42,0.72)',
  color: '#e5e7eb',
  fontWeight: 800,
  textDecoration: 'none',
}

const statCard = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(15,23,42,0.78)',
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

const featureCard = (accent) => ({
  display: 'flex',
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: `1px solid ${accent}30`,
  background: 'rgba(2,6,23,0.42)',
  textDecoration: 'none',
})

const contractRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '11px 12px',
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.1)',
  background: 'rgba(2,6,23,0.36)',
  textDecoration: 'none',
}
