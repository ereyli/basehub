import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { defineChain } from 'viem'
import { injected, metaMask } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { NETWORKS } from './networks'

// InkChain chain definition
const inkChain = defineChain({
  id: NETWORKS.INKCHAIN.chainId,
  name: NETWORKS.INKCHAIN.chainName,
  nativeCurrency: NETWORKS.INKCHAIN.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.INKCHAIN.rpcUrls[0], // Use first RPC URL
    },
  },
  blockExplorers: {
    default: {
      name: 'InkChain Explorer',
      url: NETWORKS.INKCHAIN.blockExplorerUrls[0],
    },
  },
})

// Wagmi config with multiple wallet support
export const config = createConfig({
  chains: [base, inkChain],
  transports: {
    [base.id]: http(),
    [inkChain.id]: http(),
  },
  connectors: [
    // Farcaster Mini App connector (only works on Base)
    farcasterMiniApp(),
    // Other wallet connectors for web
    injected(),
    metaMask(),
  ],
})

// Helper function to get preferred connector
export const getPreferredConnector = (connectors) => {
  // Check if we're in Farcaster
  if (isInFarcaster()) {
    return connectors.find(connector => connector.id === 'farcasterMiniApp')
  }
  
  // For web, prefer MetaMask
  return connectors.find(connector => connector.id === 'metaMask') || connectors[0]
}

// Helper function to check if we're in Farcaster
export const isInFarcaster = () => {
  return typeof window !== 'undefined' && 
         window.location !== window.parent.location &&
         window.parent !== window
}

console.log('✅ Wagmi configured with multiple wallet support')