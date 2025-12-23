import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useTransactions } from '../hooks/useTransactions'
import { Sun, Moon, Coins, RotateCcw, Dice1, Gift, Image, Layers, Package, Factory, Shield, TrendingUp, Gamepad2, Rocket } from 'lucide-react'

const FarcasterBottomNav = () => {
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()
  const { sendGMTransaction, sendGNTransaction, isLoading: transactionLoading } = useTransactions()
  const [activeTab, setActiveTab] = useState(null) // null = hidden, 'gmgn' | 'gaming' | 'nft' | 'analysis' | 'deploy'
  const [isLoadingGM, setIsLoadingGM] = useState(false)
  const [isLoadingGN, setIsLoadingGN] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

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
      setSuccessMessage('🎉 GM sent! +30 XP')
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
      setSuccessMessage('🌙 GN sent! +30 XP')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('GN transaction failed:', error)
      setSuccessMessage('❌ GN failed')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setIsLoadingGN(false)
    }
  }

  const gamingGames = [
    { id: 'flip', title: 'Coinflip', icon: <Coins size={20} />, path: '/flip', color: '#f59e0b' },
    { id: 'dice', title: 'Dice Roll', icon: <Dice1 size={20} />, path: '/dice', color: '#10b981' },
    { id: 'slot', title: 'Slots', icon: <Gift size={20} />, path: '/slot', color: '#dc2626' },
    { id: 'lucky', title: 'Lucky Number', icon: <RotateCcw size={20} />, path: '/lucky', color: '#3b82f6' },
  ]

  const nftTools = [
    { id: 'deploy-nft', title: 'Deploy NFT', icon: <Image size={20} />, path: '/deploy-nft', color: '#8b5cf6' },
    { id: 'ai-nft', title: 'AI NFT', icon: <Layers size={20} />, path: '/ai-nft', color: '#ec4899' },
    { id: 'erc721', title: 'ERC721', icon: <Package size={20} />, path: '/deploy-erc721', color: '#06b6d4' },
    { id: 'erc1155', title: 'ERC1155', icon: <Factory size={20} />, path: '/deploy-erc1155', color: '#f97316' },
  ]

  const analysisTools = [
    { id: 'wallet-analysis', title: 'Wallet Analysis', icon: <TrendingUp size={20} />, path: '/wallet-analysis', color: '#3b82f6' },
    { id: 'contract-security', title: 'Contract Security', icon: <Shield size={20} />, path: '/contract-security', color: '#10b981' },
  ]

  const deployTools = [
    { id: 'deploy', title: 'Deploy Token', icon: <Coins size={20} />, path: '/deploy', color: '#f59e0b' },
    { id: 'deploy-nft', title: 'Deploy NFT', icon: <Image size={20} />, path: '/deploy-nft', color: '#8b5cf6' },
    { id: 'erc721', title: 'ERC721', icon: <Package size={20} />, path: '/deploy-erc721', color: '#06b6d4' },
    { id: 'erc1155', title: 'ERC1155', icon: <Factory size={20} />, path: '/deploy-erc1155', color: '#f97316' },
    { id: 'ai-nft', title: 'AI NFT', icon: <Layers size={20} />, path: '/ai-nft', color: '#ec4899' },
  ]

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'rgba(30, 41, 59, 0.98)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 9999,
        padding: '12px 8px',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: '4px'
      }}>
        {/* GM/GN Tab */}
        <button
          onClick={() => handleTabClick('gmgn')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'gmgn' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
            color: activeTab === 'gmgn' ? 'white' : '#10b981',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            minHeight: '64px',
            justifyContent: 'center',
            boxShadow: activeTab === 'gmgn' 
              ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
              : '0 2px 4px rgba(16, 185, 129, 0.1)'
          }}
        >
          <div style={{ display: 'flex', gap: '4px' }}>
            <Sun size={18} />
            <Moon size={18} />
          </div>
          <span>GM/GN</span>
        </button>

        {/* GAMING Tab */}
        <button
          onClick={() => handleTabClick('gaming')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'gaming' 
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
            color: activeTab === 'gaming' ? 'white' : '#f59e0b',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            minHeight: '64px',
            justifyContent: 'center',
            boxShadow: activeTab === 'gaming' 
              ? '0 4px 12px rgba(245, 158, 11, 0.3)' 
              : '0 2px 4px rgba(245, 158, 11, 0.1)'
          }}
        >
          <Gamepad2 size={18} />
          <span>GAMING</span>
        </button>

        {/* NFT Tab */}
        <button
          onClick={() => handleTabClick('nft')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'nft' 
              ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
            color: activeTab === 'nft' ? 'white' : '#8b5cf6',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            minHeight: '64px',
            justifyContent: 'center',
            boxShadow: activeTab === 'nft' 
              ? '0 4px 12px rgba(139, 92, 246, 0.3)' 
              : '0 2px 4px rgba(139, 92, 246, 0.1)'
          }}
        >
          <Image size={18} />
          <span>NFT</span>
        </button>

        {/* ANALYSIS Tab */}
        <button
          onClick={() => handleTabClick('analysis')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'analysis' 
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(29, 78, 216, 0.15) 100%)',
            color: activeTab === 'analysis' ? 'white' : '#3b82f6',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            minHeight: '64px',
            justifyContent: 'center',
            boxShadow: activeTab === 'analysis' 
              ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
              : '0 2px 4px rgba(59, 130, 246, 0.1)'
          }}
        >
          <TrendingUp size={18} />
          <span>ANALYSIS</span>
        </button>

        {/* DEPLOY Tab */}
        <button
          onClick={() => handleTabClick('deploy')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'deploy' 
              ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' 
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(219, 39, 119, 0.15) 100%)',
            color: activeTab === 'deploy' ? 'white' : '#ec4899',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            minHeight: '64px',
            justifyContent: 'center',
            boxShadow: activeTab === 'deploy' 
              ? '0 4px 12px rgba(236, 72, 153, 0.3)' 
              : '0 2px 4px rgba(236, 72, 153, 0.1)'
          }}
        >
          <Rocket size={18} />
          <span>DEPLOY</span>
        </button>
      </div>

      {/* Content Panel - Slides up from bottom */}
      {activeTab && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setActiveTab(null)}
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              background: 'rgba(0, 0, 0, 0.3)',
              zIndex: 9998,
              animation: 'fadeIn 0.2s ease'
            }}
          />
          
          {/* Content Panel */}
          <div style={{
            position: 'fixed',
            bottom: '64px',
            left: '0',
            right: '0',
            background: 'rgba(30, 41, 59, 0.98)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 9999,
            padding: '16px',
            maxHeight: '60vh',
            overflowY: 'auto',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
            animation: 'slideUp 0.3s ease',
            borderRadius: '16px 16px 0 0'
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
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
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
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
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
                      {game.icon}
                      <span>{game.title}</span>
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
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
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
                      {tool.icon}
                      <span>{tool.title}</span>
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
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
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
                      {tool.icon}
                      <span>{tool.title}</span>
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
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
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
                      {tool.icon}
                      <span>{tool.title}</span>
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
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
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

export default FarcasterBottomNav

