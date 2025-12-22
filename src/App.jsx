import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { HelmetProvider } from 'react-helmet-async'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext'
import { config } from './config/wagmi'
import { rainbowkitConfig, shouldUseRainbowKit } from './config/rainbowkit'
import FarcasterXPDisplay from './components/FarcasterXPDisplay'
import Header from './components/Header'
import WebHeader from './components/WebHeader'
import WebXPDisplay from './components/WebXPDisplay'
import SkeletonLoader from './components/SkeletonLoader'
import { useNetworkInterceptor } from './hooks/useNetworkInterceptor'
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
import SharePage from './pages/SharePage'
import WalletAnalysis from './pages/WalletAnalysis'
import ContractSecurity from './pages/ContractSecurity'
import './styles/index.css'

const queryClient = new QueryClient()

// AppContent component for Farcaster users only
function FarcasterAppContent() {
  const { isInitialized, isReady } = useFarcaster()
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Initializing BaseHub...')
  
  // Network interceptor - checks network on every render
  useNetworkInterceptor()

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

  // Show loading while initializing
  if (!isInitialized || !isReady) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        {/* Logo with animation */}
        <div style={{
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '30px',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: 'white'
          }}>
            🎮
          </div>
        </div>

        {/* App Title */}
        <h1 style={{ 
          fontSize: '28px', 
          marginBottom: '10px', 
          fontWeight: '700',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          BaseHub
        </h1>

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
    )
  }

  // Farcaster app
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App farcaster-app">
        <Header />
        <FarcasterXPDisplay />
        <main className="container farcaster-main">
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
            <Route path="/share" element={<SharePage />} />
            <Route path="/wallet-analysis" element={<WalletAnalysis />} />
            <Route path="/contract-security" element={<ContractSecurity />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

// AppContent component for Web users only
function WebAppContent() {
  // Network interceptor - checks network on every render
  useNetworkInterceptor()

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App web-app">
        <WebHeader />
        <WebXPDisplay />
        <main className="container">
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
            <Route path="/share" element={<SharePage />} />
            <Route path="/wallet-analysis" element={<WalletAnalysis />} />
            <Route path="/contract-security" element={<ContractSecurity />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

// Main App component with providers
function App() {
  // Check if we're in Farcaster environment first
  const isFarcaster = typeof window !== 'undefined' && 
    (window.location !== window.parent.location ||
     window.parent !== window ||
     window.location.href.includes('farcaster.xyz') ||
     window.location.href.includes('warpcast.com'))
  
  const isWeb = shouldUseRainbowKit() && !isFarcaster
  
  console.log('🔍 App Environment Check:', { isFarcaster, isWeb })
  
  if (isWeb) {
    // Web users get RainbowKit
    console.log('🌐 Using RainbowKit for web users')
    return (
      <HelmetProvider>
        <WagmiProvider config={rainbowkitConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <WebAppContent />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </HelmetProvider>
    )
  }
  
  // Farcaster users get the original setup
  console.log('🎭 Using Farcaster setup')
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