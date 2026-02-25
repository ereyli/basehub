import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'
import { defineChain } from 'viem'
import { NETWORKS } from './networks'

// InkChain chain definition for RainbowKit
const inkChain = defineChain({
  id: NETWORKS.INKCHAIN.chainId,
  name: NETWORKS.INKCHAIN.chainName,
  nativeCurrency: NETWORKS.INKCHAIN.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.INKCHAIN.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'InkChain Explorer',
      url: NETWORKS.INKCHAIN.blockExplorerUrls[0],
    },
  },
  iconUrl: '/ink-logo.jpg',
  iconBackground: '#ffffff',
})

// Soneium chain definition for RainbowKit
const soneium = defineChain({
  id: NETWORKS.SONEIUM.chainId,
  name: NETWORKS.SONEIUM.chainName,
  nativeCurrency: NETWORKS.SONEIUM.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.SONEIUM.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Soneium Explorer',
      url: NETWORKS.SONEIUM.blockExplorerUrls[0],
    },
  },
  iconUrl: '/soneium-logo.jpg',
  iconBackground: '#ffffff',
})

// Katana chain definition for RainbowKit
const katana = defineChain({
  id: NETWORKS.KATANA.chainId,
  name: NETWORKS.KATANA.chainName,
  nativeCurrency: NETWORKS.KATANA.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.KATANA.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Katana Explorer',
      url: NETWORKS.KATANA.blockExplorerUrls[0],
    },
  },
  iconUrl: '/katana-logo.jpg',
  iconBackground: '#ffffff',
})

// MegaETH mainnet for RainbowKit
const megaeth = defineChain({
  id: NETWORKS.MEGAETH.chainId,
  name: NETWORKS.MEGAETH.chainName,
  nativeCurrency: NETWORKS.MEGAETH.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.MEGAETH.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'MegaETH Explorer',
      url: NETWORKS.MEGAETH.blockExplorerUrls[0],
    },
  },
  iconBackground: '#3b82f6',
})

// Arc Testnet for RainbowKit
const arcRestnet = defineChain({
  id: NETWORKS.ARC_RESTNET.chainId,
  name: NETWORKS.ARC_RESTNET.chainName,
  nativeCurrency: NETWORKS.ARC_RESTNET.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.ARC_RESTNET.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Scan',
      url: NETWORKS.ARC_RESTNET.blockExplorerUrls[0],
    },
  },
  iconUrl: '/arc-testnet-logo.jpg',
  iconBackground: '#ffffff',
})

// Robinhood Chain Testnet for RainbowKit
const robinhoodTestnet = defineChain({
  id: NETWORKS.ROBINHOOD_TESTNET.chainId,
  name: NETWORKS.ROBINHOOD_TESTNET.chainName,
  nativeCurrency: NETWORKS.ROBINHOOD_TESTNET.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.ROBINHOOD_TESTNET.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: NETWORKS.ROBINHOOD_TESTNET.blockExplorerUrls[0],
    },
  },
  iconUrl: '/robinhood-testnet-logo.png',
  iconBackground: '#C2FF00',
})

// RainbowKit configuration for web users only
export const rainbowkitConfig = getDefaultConfig({
  appName: 'BaseHub',
  projectId: '21fef48091f12692cad574a6f7753643', // Temporary project ID - replace with your own
  chains: [base, inkChain, soneium, katana, megaeth, arcRestnet, robinhoodTestnet],
  ssr: false, // Client-side rendering
})

// Helper function to check if we're in Farcaster
export const isInFarcaster = () => {
  if (typeof window === 'undefined') return false
  
  return window.location !== window.parent.location ||
         window.parent !== window ||
         window.location.href.includes('farcaster.xyz') ||
         window.location.href.includes('warpcast.com') ||
         window.location.href.includes('basehub-alpha.vercel.app')
}

// Helper function to check if we should use RainbowKit (web only)
export const shouldUseRainbowKit = () => {
  if (typeof window === 'undefined') return false
  
  // Only use RainbowKit on web, not in Farcaster
  return !isInFarcaster() && 
         !window.location.href.includes('farcaster.xyz') &&
         !window.location.href.includes('warpcast.com')
}
