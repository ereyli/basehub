import React, { useState } from 'react'
import { Share2, Copy, Check, ExternalLink } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { getFarcasterUniversalLink } from '../config/farcaster'

const ShareButton = ({ 
  title, 
  description, 
  gameType = "game",
  customUrl,
  style = {},
  castData = null,
  isCastShare = false
}) => {
  const [isCopied, setIsCopied] = useState(false)
  const [showShareOptions, setShowShareOptions] = useState(false)
  
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

  const { awardQuestXP } = useQuestSystem()

  const currentUrl = isInFarcaster ? getFarcasterUniversalLink(typeof window !== 'undefined' ? (window.location.pathname || '/') : '/') : (customUrl || window.location.href)
  
  // Generate share text based on context
  const generateShareText = () => {
    if (isCastShare && castData) {
      return `Check out this cast from @${castData.author?.username || 'unknown'} on BaseHub! ${castData.text?.slice(0, 100)}${castData.text?.length > 100 ? '...' : ''}`
    }
    return `${title || 'BaseHub'} - ${description || 'Multi-chain Web3 platform. Deploy contracts, swap tokens, analyze wallets, and earn XP!'}`
  }
  
  const shareText = generateShareText()
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = currentUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleFarcasterShare = async () => {
    if (isInFarcaster && farcasterContext) {
      try {
        const { sdk } = farcasterContext
        
        console.log('🎭 Attempting to compose cast with SDK:', !!sdk)
        console.log('🎭 SDK actions available:', !!sdk?.actions)
        console.log('🎭 Compose cast available:', !!sdk?.actions?.composeCast)
        
        if (sdk && sdk.actions && sdk.actions.composeCast) {
          if (isCastShare && castData) {
            // For cast sharing, create a compose cast with the shared cast context (English + app link)
            const shareUrl = getFarcasterUniversalLink(`/share?castHash=${castData.hash}&castFid=${castData.author?.fid}`)
            const castText = `🎮 Check out this cast from @${castData.author?.username || 'unknown'} on BaseHub!\n\n${castData.text?.slice(0, 200)}${castData.text?.length > 200 ? '...' : ''}\n\nMulti-chain Web3 platform. Deploy contracts, swap tokens, analyze wallets, and earn XP! 🚀\n\n🌐 Web: https://basehub.fun/\n🎭 Farcaster: ${getFarcasterUniversalLink('/')}`
            
            console.log('🎭 Composing cast with text:', castText)
            await sdk.actions.composeCast({
              text: castText,
              embeds: [shareUrl]
            })
            console.log('✅ Cast composed successfully!')
            
            // Award XP for cast sharing
            await awardCastShareXP()
          } else {
            // Regular share with compose cast (English + app link)
            const composeText = `${shareText}\n\n🌐 Web: https://basehub.fun/\n🎭 Farcaster: ${getFarcasterUniversalLink('/')}`
            
            console.log('🎭 Composing regular cast with text:', composeText)
            await sdk.actions.composeCast({
              text: composeText,
              embeds: [currentUrl]
            })
            console.log('✅ Regular cast composed successfully!')
            
            // Award XP for cast sharing
            await awardCastShareXP()
          }
        } else {
          console.log('⚠️ SDK or composeCast not available, falling back to copy')
          // Fallback to copy if SDK not available
          handleCopyLink()
        }
      } catch (error) {
        console.error('❌ Failed to compose cast:', error)
        // Fallback to copy on error
        handleCopyLink()
      }
    } else {
      console.log('⚠️ Not in Farcaster or context not available, falling back to copy')
      handleCopyLink()
    }
  }

  const awardCastShareXP = async () => {
    // Award XP for cast sharing
    const castShareXP = 50 // Base XP for sharing
    const bonusXP = Math.floor(Math.random() * 25) + 25 // Random bonus 25-50 XP
    const totalXP = castShareXP + bonusXP
    
    // Award XP in Supabase
    await awardQuestXP(totalXP, 'cast_share')
    
    // Show XP notification
    showXPNotification(totalXP, 'Cast Shared!')
    
    console.log(`🎉 Awarded ${totalXP} XP for cast sharing!`)
  }

  // Quest progress now handled by useQuestSystem hook

  const showXPNotification = (xp, message) => {
    // Create XP notification
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>+${xp} XP</span>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  const handleTwitterShare = () => {
    // Create Twitter share URL with pre-filled text
    const twitterText = encodeURIComponent(shareText)
    const twitterUrl = encodeURIComponent(currentUrl)
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${twitterUrl}`
    
    // Open Twitter in new tab
    window.open(twitterShareUrl, '_blank', 'width=600,height=400')
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'BaseHub',
          text: shareText,
          url: currentUrl
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error)
          handleCopyLink()
        }
      }
    } else {
      handleCopyLink()
    }
  }

  const handleShare = () => {
    if (isInFarcaster) {
      handleFarcasterShare()
    } else {
      // For web users, directly open Twitter compose
      handleTwitterShare()
    }
  }

  // Always show share button

  return (
    <div className="share-button-container" style={{ position: 'relative', ...style }}>
      <button
        onClick={handleShare}
        className="share-button"
        style={{
          background: isInFarcaster 
            ? 'linear-gradient(135deg, #0052ff 0%, #0039cc 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
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
          boxShadow: '0 4px 12px rgba(0, 82, 255, 0.3)',
          minWidth: '120px',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)'
          e.target.style.boxShadow = '0 6px 16px rgba(0, 82, 255, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)'
          e.target.style.boxShadow = '0 4px 12px rgba(0, 82, 255, 0.3)'
        }}
      >
        {isCopied ? (
          <>
            <Check size={16} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Share2 size={16} />
            <span>{isInFarcaster ? 'Compose Cast' : 'Share on X'}</span>
          </>
        )}
      </button>

      {/* Share options dropdown removed - web users go directly to Twitter */}
      {false && (
        <div 
          className="share-options"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            padding: '12px',
            minWidth: '200px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            display: showShareOptions ? 'block' : 'none',
            zIndex: 1000
          }}
        >
          <button
            onClick={handleCopyLink}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#374151',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(0, 82, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
            }}
          >
            {isCopied ? <Check size={16} /> : <Copy size={16} />}
            <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
          </button>
          
          <button
            onClick={handleTwitterShare}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#374151',
              transition: 'background 0.2s ease',
              marginTop: '4px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(29, 161, 242, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Share on X (Twitter)</span>
          </button>
          
          <button
            onClick={() => window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(currentUrl)}`, '_blank')}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#374151',
              transition: 'background 0.2s ease',
              marginTop: '4px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(0, 82, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
            }}
          >
            <ExternalLink size={16} />
            <span>Share on Warpcast</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default ShareButton
