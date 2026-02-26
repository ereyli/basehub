import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { HelmetProvider } from 'react-helmet-async' 
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext'
import { config } from './config/wagmi'
import { rainbowkitConfig, shouldUseRainbowKit } from './config/rainbowkit'
import { isLikelyBaseApp } from './utils/xpUtils'
import FarcasterBottomNav from './components/FarcasterBottomNav'
import HomeScrollManager from './components/HomeScrollManager'
import ResponsiveHeader from './components/ResponsiveHeader'
import WalletConnect from './components/WalletConnect'
import WebBottomNav from './components/WebBottomNav'
import Footer from './components/Footer'
import { OpenInAppProvider } from './contexts/OpenInAppContext'
import SkeletonLoader from './components/SkeletonLoader'
import { useNetworkInterceptor } from './hooks/useNetworkInterceptor'
import { RainbowKitChainInterceptor } from './components/RainbowKitChainInterceptor'
import { FastDeployProvider } from './contexts/FastDeployContext'
import FastDeployModal from './components/FastDeployModal'
import Home from './pages/Home'
import GMGame from './pages/GMGame'
import GNGame from './pages/GNGame'
import FlipGame from './pages/FlipGame'
import LuckyNumberGame from './pages/LuckyNumberGame'
import DiceRollGame from './pages/DiceRollGame'
import SlotGame from './pages/SlotGame'
import Leaderboard from './pages/Leaderboard'
import DeployToken from './pages/DeployToken'
import DeployNFT from './pages/DeployNFT'
import DeployERC721 from './pages/DeployERC721'
import DeployERC1155 from './pages/DeployERC1155'
import AINFTLaunchpad from './pages/AINFTLaunchpad'
import NFTLaunchpad from './pages/NFTLaunchpad'
import NFTMintPage from './pages/NFTMintPage'
import SharePage from './pages/SharePage'
import WalletAnalysis from './pages/WalletAnalysis'
import ContractSecurity from './pages/ContractSecurity'
import AllowanceCleaner from './pages/AllowanceCleaner'
import FeaturedProfiles from './pages/FeaturedProfiles'
import SwapHub from './pages/SwapHub'
import Profile from './pages/Profile'
import EarlyAccessNFT from './pages/EarlyAccessNFT'
import NFTWheelGame from './pages/NFTWheelGame'
import PumpHub from './pages/PumpHub'
import FrameLanding from './pages/FrameLanding'
import PredictionArena from './pages/PredictionArena'
// Lazy load PrivacyPolicy and TermsOfService to avoid ad blocker issues
const PrivacyPolicy = lazy(() => 
  import('./pages/PrivacyPolicy').catch(() => ({
    default: () => (
      <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
        <h2>Privacy Policy</h2>
        <p>This page could not be loaded. Please disable ad blockers and try again.</p>
      </div>
    )
  }))
)

const TermsOfService = lazy(() => 
  import('./pages/TermsOfService').catch(() => ({
    default: () => (
      <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
        <h2>Terms of Service</h2>
        <p>This page could not be loaded. Please disable ad blockers and try again.</p>
      </div>
    )
  }))
)
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic refetching on window focus to reduce unnecessary requests
      refetchOnWindowFocus: false,
      // Disable automatic refetching on reconnect
      refetchOnReconnect: false,
      // Reduce retry attempts
      retry: 1,
      // Increase stale time to reduce refetching
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      // Reduce retry attempts for mutations
      retry: 1,
    },
  },
})

// Global error handler component
function GlobalErrorHandler() {
  useEffect(() => {
    // Suppress KeyRing locked errors (Coinbase Wallet extension)
    const originalError = console.error
    console.error = (...args) => {
      const errorMessage = args[0]?.toString() || ''
      const fullMessage = args.join(' ')
      const errorString = String(args[0] || '')
      
      // Ignore common wallet extension errors and 405 errors from basehub.fun/h
      if (errorMessage.includes('KeyRing is locked') || 
          errorMessage.includes('keyring') ||
          errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
          errorMessage.includes('405') ||
          errorMessage.includes('Method Not Allowed') ||
          fullMessage.includes('injectedScript.bundle.js') ||
          fullMessage.includes('KeyRing is locked') ||
          fullMessage.includes('basehub.fun/h') ||
          errorString.includes('KeyRing is locked') ||
          errorString.includes('injectedScript.bundle.js') ||
          errorString.includes('basehub.fun/h')) {
        // Silently ignore these common extension-related errors and 405 errors
        return
      }
      originalError.apply(console, args)
    }

    // Handle unhandled promise rejections
    const handleRejection = (event) => {
      const errorMessage = event.reason?.message || event.reason?.toString() || ''
      const errorStack = event.reason?.stack || ''
      const errorString = String(event.reason || '')
      
      // Ignore wallet extension errors and 405 errors from basehub.fun/h
      if (errorMessage.includes('KeyRing is locked') || 
          errorMessage.includes('keyring') ||
          errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
          errorMessage.includes('405') ||
          errorMessage.includes('Method Not Allowed') ||
          errorStack.includes('injectedScript.bundle.js') ||
          errorStack.includes('basehub.fun/h') ||
          errorString.includes('KeyRing is locked') ||
          errorString.includes('injectedScript.bundle.js') ||
          errorString.includes('basehub.fun/h')) {
        event.preventDefault() // Prevent error from showing in console
        return
      }
    }
    window.addEventListener('unhandledrejection', handleRejection)

    // Handle general errors
    const handleError = (event) => {
      const errorMessage = event.message || ''
      if (errorMessage.includes('KeyRing is locked') || 
          errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
          errorMessage.includes('injectedScript.bundle.js')) {
        event.preventDefault()
        return
      }
    }
    window.addEventListener('error', handleError)

    return () => {
      console.error = originalError
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])
  
  return null
}

// AppContent component for Farcaster users only
function FarcasterAppContent() {
  const { isInitialized, isReady } = useFarcaster()
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Initializing BaseHub...')
  
  // Network interceptor - checks network on every render
  useNetworkInterceptor()

  // Log current URL path for debugging Universal Links
  useEffect(() => {
    console.log('🔗 Current URL:', window.location.href)
    console.log('🔗 Current pathname:', window.location.pathname)
    console.log('🔗 Current search:', window.location.search)
    console.log('🔗 Current hash:', window.location.hash)
  }, [])

  // Progress bar animation and ready() call
  useEffect(() => {
    if (!isInitialized || !isReady) {
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval)
            return 100
          }
          
          // Update loading text based on progress
          if (prev < 20) {
            setLoadingText('Initializing BaseHub...')
          } else if (prev < 40) {
            setLoadingText('Connecting to Base network...')
          } else if (prev < 60) {
            setLoadingText('Loading games...')
          } else if (prev < 80) {
            setLoadingText('Preparing NFT tools...')
          } else if (prev < 95) {
            setLoadingText('Almost ready...')
          } else {
            setLoadingText('Welcome to BaseHub!')
          }
          
          return prev + Math.random() * 8 + 3 // Random increment between 3-11
        })
      }, 300)
      
      return () => clearInterval(progressInterval)
    }
  }, [isInitialized, isReady])

  // Farcaster app - always render Router, show loading overlay
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GlobalErrorHandler />
      <HomeScrollManager />
      <div className="App farcaster-app">
        {/* Loading overlay - show only, do not block Router */}
        {(!isInitialized || !isReady) && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
            color: 'white',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            padding: '20px'
          }}>
            {/* Logo */}
            <img 
              src="/icon.png" 
              alt="BaseHub" 
              style={{
                height: '280px',
                width: 'auto',
                objectFit: 'contain',
                marginBottom: '24px',
                animation: 'pulse 2s infinite'
              }}
            />

            {/* Loading Text */}
            <p style={{ 
              fontSize: '16px', 
              opacity: 0.9, 
              margin: '0 0 30px 0',
              fontWeight: '500'
            }}>
              {loadingText}
            </p>

            {/* Progress Bar Container */}
            <div style={{
              width: '280px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '15px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {/* Progress Bar Fill */}
              <div style={{
                width: `${loadingProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ffffff 0%, #e0e7ff 100%)',
                borderRadius: '10px',
                transition: 'width 0.3s ease',
                boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
                position: 'relative'
              }}>
                {/* Shimmer effect */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  animation: 'shimmer 2s infinite'
                }}></div>
              </div>
            </div>

            {/* Progress Percentage */}
            <p style={{ 
              fontSize: '14px', 
              opacity: 0.7, 
              margin: 0,
              fontWeight: '500'
            }}>
              {Math.round(loadingProgress)}%
            </p>
            <style>{`
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.05); opacity: 0.8; }
              }
              @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
              }
            `}</style>
          </div>
        )}
        
        <ResponsiveHeader forceMobile customWallet={<WalletConnect />} />
        <OpenInAppProvider>
        <main className="container farcaster-main" style={{ paddingBottom: '100px', paddingTop: '60px' }}>
          <Suspense fallback={<SkeletonLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gm" element={<GMGame />} />
              <Route path="/gn" element={<GNGame />} />
              <Route path="/flip" element={<FlipGame />} />
              <Route path="/lucky" element={<LuckyNumberGame />} />
              <Route path="/dice" element={<DiceRollGame />} />
              <Route path="/slot" element={<SlotGame />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/deploy" element={<DeployToken />} />
              <Route path="/deploy-nft" element={<DeployNFT />} />
              <Route path="/deploy-erc721" element={<DeployERC721 />} />
              <Route path="/deploy-erc1155" element={<DeployERC1155 />} />
              <Route path="/ai-nft" element={<AINFTLaunchpad />} />
              <Route path="/nft-launchpad" element={<NFTLaunchpad />} />
              <Route path="/mint/:slug" element={<NFTMintPage />} />
              <Route path="/share" element={<SharePage />} />
              <Route path="/wallet-analysis" element={<WalletAnalysis />} />
              <Route path="/contract-security" element={<ContractSecurity />} />
              <Route path="/allowance-cleaner" element={<AllowanceCleaner />} />
              <Route path="/featured-profiles" element={<FeaturedProfiles />} />
              <Route path="/swap" element={<SwapHub />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/early-access" element={<EarlyAccessNFT />} />
              <Route path="/nft-wheel" element={<NFTWheelGame />} />
              <Route path="/pumphub" element={<PumpHub />} />
              <Route path="/prediction-arena" element={<PredictionArena />} />
              <Route path="/frames/:frameType" element={<FrameLanding />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
            </Routes>
          </Suspense>
        </main>
        <FarcasterBottomNav />
        <Footer />
        </OpenInAppProvider>
      </div>
    </Router>
  )
}

// AppContent component for Web users only
function WebAppContent() {
  useNetworkInterceptor()
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const mainStyle = isMobile
    ? { paddingLeft: 0, paddingBottom: '100px', paddingTop: '60px' }
    : { paddingLeft: '80px', paddingBottom: '40px' }

  return (
    <>
      {/* RainbowKit chain interceptor - handles automatic network addition (only for web) */}
      <RainbowKitChainInterceptor />
      <FastDeployProvider>
        <FastDeployModal />
        <OpenInAppProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GlobalErrorHandler />
          <HomeScrollManager />
          <div className={`App web-app ${isMobile ? 'farcaster-app' : ''}`}>
            <ResponsiveHeader />
            <main className="container" style={mainStyle}>
          <Suspense fallback={<SkeletonLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gm" element={<GMGame />} />
              <Route path="/gn" element={<GNGame />} />
              <Route path="/flip" element={<FlipGame />} />
              <Route path="/lucky" element={<LuckyNumberGame />} />
              <Route path="/dice" element={<DiceRollGame />} />
              <Route path="/slot" element={<SlotGame />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/deploy" element={<DeployToken />} />
              <Route path="/deploy-nft" element={<DeployNFT />} />
              <Route path="/deploy-erc721" element={<DeployERC721 />} />
              <Route path="/deploy-erc1155" element={<DeployERC1155 />} />
              <Route path="/ai-nft" element={<AINFTLaunchpad />} />
              <Route path="/nft-launchpad" element={<NFTLaunchpad />} />
              <Route path="/mint/:slug" element={<NFTMintPage />} />
              <Route path="/share" element={<SharePage />} />
              <Route path="/wallet-analysis" element={<WalletAnalysis />} />
              <Route path="/contract-security" element={<ContractSecurity />} />
              <Route path="/allowance-cleaner" element={<AllowanceCleaner />} />
              <Route path="/featured-profiles" element={<FeaturedProfiles />} />
              <Route path="/swap" element={<SwapHub />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/early-access" element={<EarlyAccessNFT />} />
              <Route path="/nft-wheel" element={<NFTWheelGame />} />
<Route path="/pumphub" element={<PumpHub />} />
            <Route path="/prediction-arena" element={<PredictionArena />} />
            <Route path="/frames/:frameType" element={<FrameLanding />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
          </Routes>
          </Suspense>
        </main>
        {isMobile ? <FarcasterBottomNav /> : <WebBottomNav />}
        <Footer />
      </div>
    </Router>
        </OpenInAppProvider>
      </FastDeployProvider>
    </>
  )
}

// Miniapp layout = sadece Farcaster (iframe/URL) veya Base app (WebView). Mobil tarayıcı (Chrome/Safari) web layout alır.
function getUseMiniappLayout() {
  if (typeof window === 'undefined') return false
  const isIframeOrFarcasterUrl =
    window.location !== window.parent.location ||
    window.parent !== window ||
    window.location.href.includes('farcaster.xyz') ||
    window.location.href.includes('warpcast.com')
  if (isIframeOrFarcasterUrl) return true
  // Base app: basehub.fun WebView, iframe yok – UA ile tespit et (mobil tarayıcı bu koşula düşmez)
  return isLikelyBaseApp()
}

// Main App component with providers
function App() {
  const useMiniapp = getUseMiniappLayout()
  const isWeb = shouldUseRainbowKit() && !useMiniapp
  
  console.log('🔍 App Environment Check:', { useMiniappLayout: useMiniapp, isWeb })
  
  if (isWeb) {
    // Web (desktop) users get RainbowKit + FarcasterProvider for Featured Profiles
    console.log('🌐 Using RainbowKit for web users')
    return (
      <HelmetProvider>
        <WagmiProvider config={rainbowkitConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <FarcasterProvider>
              <WebAppContent />
              </FarcasterProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </HelmetProvider>
    )
  }
  
  // Miniapp (Farcaster + Base app) – same UI for both
  console.log('🎭 Using miniapp setup (Farcaster/Base)')
  return (
    <HelmetProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <FarcasterProvider>
            <FarcasterAppContent />
          </FarcasterProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HelmetProvider>
  )
}

export default App
