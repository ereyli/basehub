import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { isTestnetChainId } from '../config/networks'
import { Sun, Moon, Coins, RotateCcw, Dice1, Gift, Image, Layers, Package, Factory, Shield, TrendingUp, Gamepad2, Rocket, ChevronRight, ChevronLeft, Trash2, Star, Users, Repeat, Zap, ArrowLeftRight, Search, Sparkles } from 'lucide-react'
import { getNavItems } from '../config/products'

const LUCIDE_ICONS = { Sun, Moon, Coins, RotateCcw, Dice1, Gift, Image, Layers, Package, Factory, Shield, TrendingUp, Gamepad2, Rocket, Trash2, Star, Users, Repeat, Zap, ArrowLeftRight, Search, Sparkles }

const WebBottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { sendGMTransaction, sendGNTransaction, isLoading: transactionLoading } = useTransactions()
  const [activeTab, setActiveTab] = useState(null) // null = hidden, 'gmgn' | 'gaming' | 'nft' | 'analysis' | 'deploy' | 'social' | 'dex' | 'dex'
  const [isLoadingGM, setIsLoadingGM] = useState(false)
  const [isLoadingGN, setIsLoadingGN] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleTabClick = (tab) => {
    if (activeTab === tab) {
      setActiveTab(null) // Close if already open
    } else {
      setActiveTab(tab)
    }
  }

  const handleGMClick = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    
    setIsLoadingGM(true)
    setSuccessMessage('')
    
    try {
      await sendGMTransaction('GM from BaseHub! 🎮')
      setSuccessMessage(isTestnetChainId(chainId) ? '🎉 GM sent!' : '🎉 GM sent! +150 XP')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('GM transaction failed:', error)
      setSuccessMessage('❌ GM failed')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setIsLoadingGM(false)
    }
  }

  const handleGNClick = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    
    setIsLoadingGN(true)
    setSuccessMessage('')
    
    try {
      await sendGNTransaction('GN from BaseHub! 🌙')
      setSuccessMessage(isTestnetChainId(chainId) ? '🌙 GN sent!' : '🌙 GN sent! +150 XP')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('GN transaction failed:', error)
      setSuccessMessage('❌ GN failed')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setIsLoadingGN(false)
    }
  }

  const gamingGames = getNavItems('gaming')
  const nftTools = getNavItems('nft')
  const analysisTools = getNavItems('analysis')
  const deployTools = getNavItems('deploy')
  const socialTools = getNavItems('social')

  const renderNavIcon = (iconName) => {
    const Icon = LUCIDE_ICONS[iconName]
    return Icon ? <Icon size={20} /> : null
  }

  return (
    <>
      {/* Toggle Button for Mobile */}
      {isMobile && (
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: 'fixed',
            top: '96px',
            left: isSidebarOpen ? '80px' : '0',
            zIndex: 1001,
            width: '40px',
            height: '40px',
            background: 'rgba(30, 41, 59, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: isSidebarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: isSidebarOpen ? '0 8px 8px 0' : '0 8px 8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '2px 0 10px rgba(0, 0, 0, 0.2)'
          }}
        >
          {isSidebarOpen ? (
            <ChevronLeft size={20} style={{ color: '#e5e7eb' }} />
          ) : (
            <ChevronRight size={20} style={{ color: '#e5e7eb' }} />
          )}
        </button>
      )}

      {/* Left Sidebar Navigation */}
      <div style={{
        position: 'fixed',
        top: '96px',
        left: isMobile && !isSidebarOpen ? '-80px' : '0',
        bottom: '0',
        width: '80px',
        background: 'rgba(30, 41, 59, 0.98)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        padding: '20px 8px',
        boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: '12px',
        overflowY: 'auto',
        transition: 'left 0.3s ease'
      }}>
        {/* GM/GN Tab */}
        <button
          onClick={() => handleTabClick('gmgn')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'gmgn' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
            color: activeTab === 'gmgn' ? 'white' : '#10b981',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: activeTab === 'gmgn' 
              ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
              : '0 2px 4px rgba(16, 185, 129, 0.1)'
          }}
        >
          <div style={{ display: 'flex', gap: '2px' }}>
            <Sun size={20} />
            <Moon size={20} />
          </div>
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>GM/GN</span>
        </button>

        {/* Swaphub - direct link to swap */}
        <button
          onClick={() => navigate('/swap')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: location.pathname === '/swap'
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
            color: location.pathname === '/swap' ? 'white' : '#667eea',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: location.pathname === '/swap'
              ? '0 4px 12px rgba(102, 126, 234, 0.3)'
              : '0 2px 4px rgba(102, 126, 234, 0.1)'
          }}
        >
          <Repeat size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>Swaphub</span>
        </button>

        {/* Pumphub */}
        <button
          onClick={() => navigate('/pumphub')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: location.pathname === '/pumphub'
              ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
              : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 145, 178, 0.15) 100%)',
            color: location.pathname === '/pumphub' ? 'white' : '#06b6d4',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: location.pathname === '/pumphub'
              ? '0 4px 12px rgba(6, 182, 212, 0.3)'
              : '0 2px 4px rgba(6, 182, 212, 0.1)'
          }}
        >
          <Zap size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>Pumphub</span>
        </button>

        {/* GAMING Tab */}
        <button
          onClick={() => handleTabClick('gaming')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'gaming' 
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
            color: activeTab === 'gaming' ? 'white' : '#f59e0b',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: activeTab === 'gaming' 
              ? '0 4px 12px rgba(245, 158, 11, 0.3)' 
              : '0 2px 4px rgba(245, 158, 11, 0.1)'
          }}
        >
          <Gamepad2 size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>GAMING</span>
        </button>

        {/* ANALYSIS Tab */}
        <button
          onClick={() => handleTabClick('analysis')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'analysis' 
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(29, 78, 216, 0.15) 100%)',
            color: activeTab === 'analysis' ? 'white' : '#3b82f6',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: activeTab === 'analysis' 
              ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
              : '0 2px 4px rgba(59, 130, 246, 0.1)'
          }}
        >
          <TrendingUp size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>ANALYSIS</span>
        </button>

        {/* NFT Tab */}
        <button
          onClick={() => handleTabClick('nft')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'nft' 
              ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
            color: activeTab === 'nft' ? 'white' : '#8b5cf6',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: activeTab === 'nft' 
              ? '0 4px 12px rgba(139, 92, 246, 0.3)' 
              : '0 2px 4px rgba(139, 92, 246, 0.1)'
          }}
        >
          <Image size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>NFT</span>
        </button>

        {/* DEPLOY Tab */}
        <button
          onClick={() => handleTabClick('deploy')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'deploy' 
              ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' 
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(219, 39, 119, 0.15) 100%)',
            color: activeTab === 'deploy' ? 'white' : '#ec4899',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: activeTab === 'deploy' 
              ? '0 4px 12px rgba(236, 72, 153, 0.3)' 
              : '0 2px 4px rgba(236, 72, 153, 0.1)'
          }}
        >
          <Rocket size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>DEPLOY</span>
        </button>

        {/* SOCIAL Tab */}
        <button
          onClick={() => handleTabClick('social')}
          style={{
            width: '100%',
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'social' 
              ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' 
              : 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
            color: activeTab === 'social' ? 'white' : '#fbbf24',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minHeight: '70px',
            justifyContent: 'center',
            boxShadow: activeTab === 'social' 
              ? '0 4px 12px rgba(251, 191, 36, 0.3)' 
              : '0 2px 4px rgba(251, 191, 36, 0.1)'
          }}
        >
          <Users size={20} />
          <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>SOCIAL</span>
        </button>
      </div>

      {/* Content Panel - Slides up from bottom */}
      {activeTab && (
        <>
          {/* Overlay - Only covers main content, not sidebar */}
          <div
            onClick={() => setActiveTab(null)}
            style={{
              position: 'fixed',
              top: '96px',
              left: '80px',
              right: '0',
              bottom: '0',
              background: 'rgba(0, 0, 0, 0.3)',
              zIndex: 999,
              animation: 'fadeIn 0.2s ease'
            }}
          />
          
          {/* Content Panel */}
          <div style={{
            position: 'fixed',
            top: '96px',
            left: '80px',
            bottom: '0',
            background: 'rgba(30, 41, 59, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1000,
            padding: '24px',
            maxWidth: '400px',
            width: '400px',
            overflowY: 'auto',
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
            animation: 'slideInLeft 0.3s ease'
          }}>
            {/* Success Message */}
            {successMessage && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                zIndex: 10000,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                {successMessage}
              </div>
            )}

            {/* GM/GN Content */}
            {activeTab === 'gmgn' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                  GM / GN
                </h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleGMClick}
                    disabled={isLoadingGM || !isConnected}
                    style={{
                      flex: 1,
                      padding: '16px',
                      border: 'none',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: isLoadingGM || !isConnected ? 'not-allowed' : 'pointer',
                      opacity: isLoadingGM || !isConnected ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <Sun size={18} />
                    {isLoadingGM ? 'Sending...' : 'GM'}
                  </button>
                  <button
                    onClick={handleGNClick}
                    disabled={isLoadingGN || !isConnected}
                    style={{
                      flex: 1,
                      padding: '16px',
                      border: 'none',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: isLoadingGN || !isConnected ? 'not-allowed' : 'pointer',
                      opacity: isLoadingGN || !isConnected ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <Moon size={18} />
                    {isLoadingGN ? 'Sending...' : 'GN'}
                  </button>
                </div>
              </div>
            )}

            {/* GAMING Content */}
            {activeTab === 'gaming' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                  Gaming
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {gamingGames.map((game) => (
                    <button
                      key={game.id}
                      onClick={() => {
                        navigate(game.path)
                        setActiveTab(null)
                      }}
                      style={{
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${game.color} 0%, ${game.color}dd 100%)`,
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: `0 4px 12px ${game.color}40`
                      }}
                    >
                      {renderNavIcon(game.icon)}
                      <span>{game.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* NFT Content */}
            {activeTab === 'nft' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                  NFT Tools
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {nftTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        navigate(tool.path)
                        setActiveTab(null)
                      }}
                      style={{
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${tool.color} 0%, ${tool.color}dd 100%)`,
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: `0 4px 12px ${tool.color}40`
                      }}
                    >
                      {renderNavIcon(tool.icon)}
                      <span>{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ANALYSIS Content */}
            {activeTab === 'analysis' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                  Analysis Tools
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {analysisTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        navigate(tool.path)
                        setActiveTab(null)
                      }}
                      style={{
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${tool.color} 0%, ${tool.color}dd 100%)`,
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: `0 4px 12px ${tool.color}40`
                      }}
                    >
                      {renderNavIcon(tool.icon)}
                      <span>{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DEPLOY Content */}
            {activeTab === 'deploy' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                  Deploy Tools
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {deployTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        navigate(tool.path)
                        setActiveTab(null)
                      }}
                      style={{
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${tool.color} 0%, ${tool.color}dd 100%)`,
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: `0 4px 12px ${tool.color}40`
                      }}
                    >
                      {renderNavIcon(tool.icon)}
                      <span>{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SOCIAL Content */}
            {activeTab === 'social' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#e5e7eb' }}>
                  Social Tools
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {socialTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        navigate(tool.path)
                        setActiveTab(null)
                      }}
                      style={{
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${tool.color} 0%, ${tool.color}dd 100%)`,
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: `0 4px 12px ${tool.color}40`
                      }}
                    >
                      {renderNavIcon(tool.icon)}
                      <span>{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </>
      )}

      {/* Add animations */}
      <style>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  )
}

export default WebBottomNav

