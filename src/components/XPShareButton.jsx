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
  if (!shouldUseRainbowKit()) {
    try {
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    } catch (error) {
      isInFarcaster = false
    }
  }

  // Generate dynamic XP sharing content
  const generateXPContent = () => {
    const gameEmojis = {
      'gm': '🌅',
      'gn': '🌙',
      'flip': '🪙',
      'lucky': '🍀',
      'dice': '🎲',
      'deploy': '🚀'
    }

    const gameNames = {
      'gm': 'GM Game',
      'gn': 'GN Game', 
      'flip': 'Flip Game',
      'lucky': 'Lucky Number',
      'dice': 'Dice Roll',
      'deploy': 'Deploy'
    }

    const emoji = gameEmojis[gameType] || '🎮'
    const gameName = gameNames[gameType] || 'BaseHub Game'
    
    let shareText = `${emoji} Just earned ${xpEarned} XP playing ${gameName} on BaseHub!`
    
    if (gameResult) {
      if (gameType === 'flip') {
        shareText += ` ${gameResult.won ? '🎉 Won!' : '😅 Lost, but still got XP!'}`
      } else if (gameType === 'lucky') {
        shareText += ` ${gameResult.won ? '🎯 Lucky number hit!' : '🎲 Close, but no luck!'}`
      } else if (gameType === 'dice') {
        shareText += ` 🎲 Rolled ${gameResult.dice1} & ${gameResult.dice2}`
      }
    }
    
    shareText += `\n\nTotal XP: ${totalXP} (${Math.floor(totalXP / 50)} BHUP tokens)\n\nPlay on BaseHub and earn XP on Base network! 🚀`
    
    return shareText
  }

  const generateShareUrl = () => {
    if (isInFarcaster) {
      // Use Farcaster Universal Link for Farcaster users
      return 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'
    } else {
      // Use regular URL for web users
      const baseUrl = window.location.origin
      const gamePath = gameType === 'deploy' ? '/deploy' : `/${gameType}`
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

  const handleFarcasterXPShare = () => {
    if (isInFarcaster) {
      // In Farcaster, we'll create a dynamic embed for XP sharing
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

  return (
    <div className="xp-share-container" style={{ position: 'relative', ...style }}>
      <button
        onClick={handleXPShare}
        className="xp-share-button"
        style={{
          background: isInFarcaster 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
          boxShadow: isInFarcaster 
            ? '0 4px 12px rgba(16, 185, 129, 0.3)'
            : '0 4px 12px rgba(245, 158, 11, 0.3)',
          minWidth: '140px',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)'
          if (isInFarcaster) {
            e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)'
          } else {
            e.target.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)'
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)'
          if (isInFarcaster) {
            e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
          } else {
            e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)'
          }
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
            <span>Share {xpEarned} XP!</span>
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
