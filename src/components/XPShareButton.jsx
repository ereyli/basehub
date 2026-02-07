import React, { useState } from 'react'
import { Share2, Star, Trophy, Zap, Copy, Check } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'

const XPShareButton = ({ 
  gameType,
  xpEarned,
  totalXP,
  transactionHash,
  gameResult,
  style = {} 
}) => {
  const [isCopied, setIsCopied] = useState(false)
  
  // Safely get Farcaster context - only if not in web environment
  let isInFarcaster = false
  let farcasterContext = null
  if (!shouldUseRainbowKit()) {
    try {
      farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      isInFarcaster = false
    }
  }

  // Generate dynamic XP sharing content
  const generateXPContent = () => {
    const gameNames = {
      'gm': 'GM Game',
      'gn': 'GN Game', 
      'flip': 'Flip Game',
      'lucky': 'Lucky Number',
      'dice': 'Dice Roll',
      'deploy': 'Deploy',
      'swap': 'SwapHub DEX'
    }

    const gameName = gameNames[gameType] || 'BaseHub Game'
    
    let shareText = `Just earned ${xpEarned} XP playing ${gameName} on BaseHub!`
    
    if (gameResult) {
      if (gameType === 'flip') {
        shareText += ` ${gameResult.won ? 'Won!' : 'Lost, but still got XP!'}`
      } else if (gameType === 'lucky') {
        shareText += ` ${gameResult.won ? 'Lucky number hit!' : 'Close, but no luck!'}`
      } else if (gameType === 'dice') {
        shareText += ` Rolled ${gameResult.dice1} & ${gameResult.dice2}`
      } else if (gameType === 'swap' && gameResult.amountIn) {
        shareText = `Just swapped ${gameResult.amountIn} ${gameResult.tokenIn} → ${gameResult.tokenOut} on SwapHub DEX!\n\nBest rates across Uniswap V2 & V3\nEarned ${xpEarned} XP`
      }
    }
    
    if (gameType !== 'swap') {
      shareText += `\n\nTotal XP: ${totalXP} (${Math.floor(totalXP / 50)} BHUP tokens)\n\nPlay on BaseHub and earn XP on Base network!`
    } else {
      shareText += `\n\nPowered by BaseHub`
    }
    
    return shareText
  }

  const generateShareUrl = () => {
    if (isInFarcaster) {
      // Use Farcaster Universal Link for Farcaster users
      return 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'
    } else {
      // Use regular URL for web users
      const baseUrl = window.location.origin
      const gamePath = gameType === 'deploy' ? '/deploy' : gameType === 'swap' ? '/swap' : `/${gameType}`
      return `${baseUrl}${gamePath}`
    }
  }

  const handleCopyXPShare = async () => {
    const shareText = generateXPContent()
    const shareUrl = generateShareUrl()
    const fullShare = `${shareText}\n\n${shareUrl}`
    
    try {
      await navigator.clipboard.writeText(fullShare)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 3000)
    } catch (error) {
      console.error('Failed to copy XP share:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = fullShare
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 3000)
    }
  }

  const handleFarcasterXPShare = async () => {
    if (isInFarcaster && farcasterContext) {
      try {
        const { sdk } = farcasterContext
        
        console.log('🎮 Attempting to compose XP cast with SDK:', !!sdk)
        console.log('🎮 SDK actions available:', !!sdk?.actions)
        console.log('🎮 Compose cast available:', !!sdk?.actions?.composeCast)
        
        if (sdk && sdk.actions && sdk.actions.composeCast) {
          const shareText = generateXPContent()
          const shareUrl = generateShareUrl()
          const castText = `${shareText}\n\n🌐 Web: https://www.basehub.fun/\n🎭 Farcaster: https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub`
          
          console.log('🎮 Composing XP cast with text:', castText)
          await sdk.actions.composeCast({
            text: castText,
            embeds: [shareUrl]
          })
          console.log('✅ XP cast composed successfully!')
        } else {
          console.log('⚠️ SDK or composeCast not available for XP, falling back to copy')
          // Fallback to copy if SDK not available
          handleCopyXPShare()
        }
      } catch (error) {
        console.error('❌ Failed to compose XP cast:', error)
        // Fallback to copy on error
        handleCopyXPShare()
      }
    } else {
      console.log('⚠️ Not in Farcaster or context not available for XP, falling back to copy')
      handleCopyXPShare()
    }
  }

  const handleWebXPShare = async () => {
    const shareText = generateXPContent()
    const shareUrl = generateShareUrl()
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Earned ${xpEarned} XP on BaseHub!`,
          text: shareText,
          url: shareUrl
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing XP:', error)
          handleCopyXPShare()
        }
      }
    } else {
      handleCopyXPShare()
    }
  }

  const handleXPShare = () => {
    if (isInFarcaster) {
      handleFarcasterXPShare()
    } else {
      handleWebXPShare()
    }
  }

  // Don't show XP share button if no XP earned
  if (!xpEarned || xpEarned <= 0) {
    return null
  }

  // Blue gradient for swap, green for other games
  const getButtonStyle = () => {
    const isSwap = gameType === 'swap'
    if (isInFarcaster) {
      return {
        background: isSwap
          ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        boxShadow: isSwap
          ? '0 4px 12px rgba(59, 130, 246, 0.3)'
          : '0 4px 12px rgba(16, 185, 129, 0.3)'
      }
    } else {
      return {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
      }
    }
  }

  const buttonStyle = getButtonStyle()

  return (
    <div className="xp-share-container" style={{ position: 'relative', ...style }}>
      <button
        onClick={handleXPShare}
        className="xp-share-button"
        style={{
          background: buttonStyle.background,
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: buttonStyle.boxShadow,
          minWidth: '140px',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)'
          const isSwap = gameType === 'swap'
          if (isInFarcaster) {
            if (isSwap) {
              e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
            } else {
              e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)'
            }
          } else {
            e.target.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)'
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)'
          e.target.style.boxShadow = buttonStyle.boxShadow
        }}
      >
        {isCopied ? (
          <>
            <Check size={16} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Star size={16} />
            <span>{isInFarcaster ? `Compose ${xpEarned} XP Cast!` : `Share ${xpEarned} XP!`}</span>
          </>
        )}
      </button>

      {/* XP Details Tooltip */}
      <div 
        className="xp-details"
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          background: 'white',
          borderRadius: '8px',
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          fontSize: '12px',
          color: '#374151',
          whiteSpace: 'nowrap',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease',
          zIndex: 1000
        }}
        onMouseEnter={(e) => {
          e.target.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.target.style.opacity = '0'
        }}
      >
        Total: {totalXP} XP ({Math.floor(totalXP / 50)} BHUP)
      </div>
    </div>
  )
}

export default XPShareButton
