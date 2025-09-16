import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { HelmetProvider } from 'react-helmet-async'
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext'
import { config } from './config/wagmi'
import FarcasterXPDisplay from './components/FarcasterXPDisplay'
import SkeletonLoader from './components/SkeletonLoader'
import Home from './pages/Home'
import GMGame from './pages/GMGame'
import GNGame from './pages/GNGame'
import FlipGame from './pages/FlipGame'
import LuckyNumberGame from './pages/LuckyNumberGame'
import DiceRollGame from './pages/DiceRollGame'
import Leaderboard from './pages/Leaderboard'
import DeployToken from './pages/DeployToken'
import './styles/index.css'

const queryClient = new QueryClient()

// AppContent component - Farcaster Only
function AppContent() {
  const { isInitialized, isReady } = useFarcaster()

  // Show loading while initializing or not ready
  if (!isInitialized || !isReady) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          </Routes>
        </main>
      </div>
    </Router>
  )
}

// Main App component with providers
function App() {
  return (
    <HelmetProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <FarcasterProvider>
            <AppContent />
          </FarcasterProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HelmetProvider>
  )
}

export default App