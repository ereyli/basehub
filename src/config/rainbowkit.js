import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'

// RainbowKit configuration for web users only
export const rainbowkitConfig = getDefaultConfig({
  appName: 'BaseHub',
  projectId: '21fef48091f12692cad574a6f7753643', // Temporary project ID - replace with your own
  chains: [base], // Only Base network
  ssr: false, // Client-side rendering
})

// Helper function to check if we're in Farcaster
export const isInFarcaster = () => {
  return typeof window !== 'undefined' && 
         window.location !== window.parent.location &&
         window.parent !== window
}

// Helper function to check if we should use RainbowKit
export const shouldUseRainbowKit = () => {
  return typeof window !== 'undefined' && !isInFarcaster()
}
