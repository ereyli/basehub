import React, { useState } from 'react'
import { Twitter, Share2, Copy, Check } from 'lucide-react'
import { shouldUseRainbowKit } from '../config/rainbowkit'

const TwitterShareButton = ({ 
  title = "BaseHub",
  description = "Play games and earn XP on Base network!",
  hashtags = ["BaseHub", "BaseNetwork", "Web3", "Gaming", "XP"],
  style = {} 
}) => {
  const [isCopied, setIsCopied] = useState(false)
  
  // Only show for web users
  const isWeb = shouldUseRainbowKit()
  
  if (!isWeb) {
    return null // Don't show for Farcaster users
  }

  const generateTwitterContent = () => {
    const tweetText = `🚀 ${title} - ${description}\n\n🎮 Play games and earn XP on Base network\n🏆 Join the leaderboard and compete with friends\n💎 Deploy your own tokens and NFTs\n\n#${hashtags.join(' #')}\n\n`
    return tweetText
  }

  const generateTwitterUrl = () => {
    const tweetText = generateTwitterContent()
    const webUrl = 'https://www.basehub.fun/'
    const farcasterUrl = 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'
    const fullText = `${tweetText}🌐 Web: ${webUrl}\n🎭 Farcaster: ${farcasterUrl}`
    
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`
  }

  const handleTwitterShare = () => {
    const twitterUrl = generateTwitterUrl()
    window.open(twitterUrl, '_blank', 'width=550,height=420')
  }

  const handleCopyTweet = async () => {
    const tweetText = generateTwitterContent()
    const webUrl = 'https://www.basehub.fun/'
    const farcasterUrl = 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'
    const fullText = `${tweetText}🌐 Web: ${webUrl}\n🎭 Farcaster: ${farcasterUrl}`
    
    try {
      await navigator.clipboard.writeText(fullText)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 3000)
    } catch (error) {
      console.error('Failed to copy tweet:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = fullText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 3000)
    }
  }

  const handleWebShare = async () => {
    const tweetText = generateTwitterContent()
    const webUrl = 'https://www.basehub.fun/'
    const farcasterUrl = 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'
    const fullText = `${tweetText}🌐 Web: ${webUrl}\n🎭 Farcaster: ${farcasterUrl}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: fullText,
          url: webUrl
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error)
          handleCopyTweet()
        }
      }
    } else {
      handleCopyTweet()
    }
  }

  return (
    <div className="twitter-share-container" style={{ position: 'relative', ...style }}>
      <button
        onClick={handleTwitterShare}
        className="twitter-share-button"
        style={{
          background: '#000000',
          color: 'white',
          border: '1px solid #333333',
          borderRadius: '12px',
          padding: '12px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          minWidth: '140px',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#1a1a1a'
          e.target.style.transform = 'translateY(-2px)'
          e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
          e.target.style.borderColor = '#555555'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#000000'
          e.target.style.transform = 'translateY(0)'
          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
          e.target.style.borderColor = '#333333'
        }}
      >
        {isCopied ? (
          <>
            <Check size={16} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Twitter size={16} />
            <span>Share on X</span>
          </>
        )}
      </button>

      {/* Share options dropdown */}
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
          display: 'none',
          zIndex: 1000
        }}
        onMouseEnter={(e) => {
          e.target.style.display = 'block'
        }}
        onMouseLeave={(e) => {
          e.target.style.display = 'none'
        }}
      >
        <button
          onClick={handleCopyTweet}
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
            e.target.style.background = 'rgba(29, 161, 242, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent'
          }}
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
          <span>{isCopied ? 'Copied!' : 'Copy Tweet'}</span>
        </button>
        
        <button
          onClick={handleWebShare}
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
          <Share2 size={16} />
          <span>Share Anywhere</span>
        </button>
      </div>

      {/* Hover trigger for dropdown */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
        onMouseEnter={(e) => {
          const dropdown = e.target.parentNode.querySelector('.share-options')
          if (dropdown) {
            dropdown.style.display = 'block'
          }
        }}
        onMouseLeave={(e) => {
          const dropdown = e.target.parentNode.querySelector('.share-options')
          if (dropdown) {
            dropdown.style.display = 'none'
          }
        }}
      />
    </div>
  )
}

export default TwitterShareButton
