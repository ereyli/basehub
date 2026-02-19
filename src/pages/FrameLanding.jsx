import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getFarcasterUniversalLink } from '../config/farcaster'

const WEB_OG_IMAGE = 'https://www.basehub.fun/icon.png?v=2'

const FRAME_CONFIG = {
  'launch-token': {
    path: '/deploy',
    buttonText: 'Launch token',
    title: 'Launch token - BaseHub',
    description: 'Deploy your own token on Base with BaseHub.',
    imageUrl: WEB_OG_IMAGE,
  },
  'mint-nft': {
    path: '/nft-launchpad',
    buttonText: 'Mint NFT',
    title: 'Mint NFT - BaseHub',
    description: 'Discover and mint NFTs on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'pumphub': {
    path: '/pumphub',
    buttonText: 'Fair launch token',
    title: 'Fair launch token - BaseHub',
    description: 'Fair launch your token with PumpHub on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'swap': {
    path: '/swap',
    buttonText: 'Swap tokens',
    title: 'Swap - BaseHub',
    description: 'Swap tokens with DEX aggregator on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'nft-wheel': {
    path: '/nft-wheel',
    buttonText: 'Spin NFT Wheel',
    title: 'NFT Wheel - BaseHub',
    description: 'Spin the wheel and win NFTs on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'wallet-analysis': {
    path: '/wallet-analysis',
    buttonText: 'Analyze wallet',
    title: 'Wallet Analysis - BaseHub',
    description: 'Analyze any wallet on Base and EVM chains.',
    imageUrl: WEB_OG_IMAGE,
  },
  'contract-security': {
    path: '/contract-security',
    buttonText: 'Check contract',
    title: 'Contract Security - BaseHub',
    description: 'Audit contract security on Base and EVM.',
    imageUrl: WEB_OG_IMAGE,
  },
  'ai-nft': {
    path: '/ai-nft',
    buttonText: 'AI NFT Mint',
    title: 'AI NFT - BaseHub',
    description: 'Generate AI art and mint as NFT on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'early-access': {
    path: '/early-access',
    buttonText: 'Early Access NFT',
    title: 'Early Access NFT - BaseHub',
    description: 'Mint early access NFT on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'deploy-nft': {
    path: '/deploy-nft',
    buttonText: 'Deploy NFT collection',
    title: 'Deploy NFT - BaseHub',
    description: 'Deploy your own NFT collection on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'deploy-erc721': {
    path: '/deploy-erc721',
    buttonText: 'Deploy ERC721',
    title: 'Deploy ERC721 - BaseHub',
    description: 'Deploy ERC721 NFT contract on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'deploy-erc1155': {
    path: '/deploy-erc1155',
    buttonText: 'Deploy ERC1155',
    title: 'Deploy ERC1155 - BaseHub',
    description: 'Deploy ERC1155 multi-token contract on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'featured-profiles': {
    path: '/featured-profiles',
    buttonText: 'Featured profiles',
    title: 'Featured Profiles - BaseHub',
    description: 'Discover featured Farcaster profiles on Base.',
    imageUrl: WEB_OG_IMAGE,
  },
  'allowance-cleaner': {
    path: '/allowance-cleaner',
    buttonText: 'Clean allowances',
    title: 'Allowance Cleaner - BaseHub',
    description: 'Revoke token allowances on Base and EVM.',
    imageUrl: WEB_OG_IMAGE,
  },
}

export default function FrameLanding() {
  const { frameType } = useParams()
  const navigate = useNavigate()
  const config = FRAME_CONFIG[frameType]

  if (!config) {
    navigate('/', { replace: true })
    return null
  }

  const launchUrl = getFarcasterUniversalLink(config.path)
  const imageUrl = config.imageUrl || WEB_OG_IMAGE
  const embedContent = {
    version: '1',
    imageUrl,
    button: {
      title: config.buttonText,
      action: {
        type: 'launch_miniapp',
        name: 'BaseHub',
        url: launchUrl,
        splashImageUrl: imageUrl,
        splashBackgroundColor: '#4A90E2',
      },
    },
  }
  const frameEmbedContent = {
    ...embedContent,
    button: {
      ...embedContent.button,
      action: {
        ...embedContent.button.action,
        type: 'launch_frame',
      },
    },
  }

  return (
    <>
      <Helmet>
        <meta name="fc:miniapp" content={JSON.stringify(embedContent)} />
        <meta name="fc:frame" content={JSON.stringify(frameEmbedContent)} />
        <meta property="og:title" content={config.title} />
        <meta property="og:description" content={config.description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={launchUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={config.title} />
        <meta name="twitter:description" content={config.description} />
        <meta name="twitter:image" content={imageUrl} />
        <title>{config.title}</title>
      </Helmet>
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginBottom: '8px', fontSize: '1.5rem' }}>{config.title}</h1>
        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>{config.description}</p>
        <a
          href={launchUrl}
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#4A90E2',
            color: '#fff',
            borderRadius: '12px',
            fontWeight: '600',
            textDecoration: 'none',
          }}
        >
          {config.buttonText} →
        </a>
        <p style={{ marginTop: '24px', fontSize: '13px', color: '#64748b' }}>
          Share this link in a cast to show the frame. In Farcaster, the button opens BaseHub.
        </p>
      </div>
    </>
  )
}
