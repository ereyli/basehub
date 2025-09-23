import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

// Wagmi config with multiple wallet support
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    // Farcaster Mini App connector
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