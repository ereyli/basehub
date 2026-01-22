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
      http: NETWORKS.INKCHAIN.rpcUrls[0], // Use first (primary) RPC URL
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
      http: NETWORKS.SONEIUM.rpcUrls[0], // Use first (primary) RPC URL
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
      http: NETWORKS.KATANA.rpcUrls[0], // Use first (primary) RPC URL
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

// RainbowKit configuration for web users only
export const rainbowkitConfig = getDefaultConfig({
  appName: 'BaseHub',
  projectId: '21fef48091f12692cad574a6f7753643', // Temporary project ID - replace with your own
  chains: [base, inkChain, soneium, katana], // Base, InkChain, Soneium, and Katana
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
