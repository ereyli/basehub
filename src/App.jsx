import React from 'react'
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
import Leaderboard from './pages/Leaderboard'
import DeployToken from './pages/DeployToken'
import DeployNFT from './pages/DeployNFT'
import DeployERC721 from './pages/DeployERC721'
import DeployERC1155 from './pages/DeployERC1155'
import './styles/index.css'

const queryClient = new QueryClient()

// AppContent component for Farcaster users only
function FarcasterAppContent() {
  const { isInitialized, isReady } = useFarcaster()
  
  // Network interceptor - checks network on every render
  useNetworkInterceptor()

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
        <SkeletonLoader />
        <p style={{ marginTop: '20px', opacity: 0.8 }}>
          {!isInitialized ? 'Initializing Farcaster...' : 'Loading Mini App...'}
        </p>
      </div>
    )
  }

  // Farcaster app
  return (
    <Router>
      <div className="App farcaster-app">
        <FarcasterXPDisplay />
        <main className="container farcaster-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/gm" element={<GMGame />} />
            <Route path="/gn" element={<GNGame />} />
            <Route path="/flip" element={<FlipGame />} />
            <Route path="/lucky" element={<LuckyNumberGame />} />
            <Route path="/dice" element={<DiceRollGame />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/deploy" element={<DeployToken />} />
            <Route path="/deploy-nft" element={<DeployNFT />} />
            <Route path="/deploy-erc721" element={<DeployERC721 />} />
            <Route path="/deploy-erc1155" element={<DeployERC1155 />} />
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
    <Router>
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
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/deploy" element={<DeployToken />} />
            <Route path="/deploy-nft" element={<DeployNFT />} />
            <Route path="/deploy-erc721" element={<DeployERC721 />} />
            <Route path="/deploy-erc1155" element={<DeployERC1155 />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

// Main App component with providers
function App() {
  const isWeb = shouldUseRainbowKit()
  
  if (isWeb) {
    // Web users get RainbowKit
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