import React, { useState, useRef, useEffect } from 'react'
import { Twitter, Copy, Check, ChevronDown } from 'lucide-react'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { getFarcasterUniversalLink } from '../config/farcaster'

const TwitterShareButton = ({ 
  title = "BaseHub",
  description = "Your all-in-one Web3 hub on Base & InkChain. Play games, launch tokens, earn XP.",
  hashtags = ["BaseHub", "Base", "InkChain", "Web3Gaming", "DEX", "XP"],
  style = {} 
}) => {
  const [isCopied, setIsCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)
  
  // Only show for web users
  const isWeb = shouldUseRainbowKit()
  
  if (!isWeb) {
    return null // Don't show for Farcaster users
  }

  const generateTwitterContent = () => {
    const tweetText = `🚀 ${title} – ${description}\n\n✨ Launch tokens with PumpHub (fair launch, no presale)\n🎮 Play on-chain games & spin the NFT Wheel\n💱 Swap with DEX aggregator on Base\n🔍 Analyze wallets & contract security\n🎯 Earn XP on everything – level up & unlock rewards\n🌐 Base, InkChain, Soneium, Katana\n\n#${hashtags.join(' #')}\n\n`
    return tweetText
  }

  const generateTwitterUrl = () => {
    const tweetText = generateTwitterContent()
    const webUrl = 'https://basehub.fun/'
    const farcasterUrl = getFarcasterUniversalLink('/')
    const fullText = `${tweetText}🌐 Web: ${webUrl}\n🎭 Farcaster: ${farcasterUrl}`
    
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showDropdown])

  const handleTwitterShare = (e) => {
    e.stopPropagation()
    const twitterUrl = generateTwitterUrl()
    window.open(twitterUrl, '_blank')
    setShowDropdown(false)
  }

  const handleCopyTweet = async (e) => {
    e.stopPropagation()
    const tweetText = generateTwitterContent()
    const webUrl = 'https://basehub.fun/'
    const farcasterUrl = getFarcasterUniversalLink('/')
    const fullText = `${tweetText}🌐 Web: ${webUrl}\n🎭 Farcaster: ${farcasterUrl}`
    
    try {
      await navigator.clipboard.writeText(fullText)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 3000)
      setShowDropdown(false)
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
      setShowDropdown(false)
    }
  }

  const handleDropdownToggle = (e) => {
    e.stopPropagation()
    setShowDropdown(!showDropdown)
  }

  return (
    <div className="twitter-share-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex', ...style }}>
      <button
        onClick={handleTwitterShare}
        className="twitter-share-button"
        style={{
          background: '#000000',
          color: 'white',
          border: '1px solid #333333',
          borderTopLeftRadius: '12px',
          borderBottomLeftRadius: '12px',
          borderTopRightRadius: showDropdown ? '0' : '12px',
          borderBottomRightRadius: showDropdown ? '0' : '12px',
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          borderRight: 'none',
          zIndex: 1
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#1a1a1a'
          e.target.style.transform = 'translateY(-2px)'
          e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#000000'
          e.target.style.transform = 'translateY(0)'
          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        <Twitter size={16} />
        <span>Share on X</span>
      </button>

      {/* Dropdown toggle button */}
      <button
        onClick={handleDropdownToggle}
        style={{
          background: '#000000',
          color: 'white',
          border: '1px solid #333333',
          borderTopRightRadius: '12px',
          borderBottomRightRadius: '12px',
          borderLeft: '1px solid #444444',
          padding: '12px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#1a1a1a'
          e.target.style.transform = 'translateY(-2px)'
          e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#000000'
          e.target.style.transform = 'translateY(0)'
          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        <ChevronDown 
          size={16} 
          style={{ 
            transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }} 
        />
      </button>

      {/* Share options dropdown */}
      {showDropdown && (
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
            zIndex: 1000,
            animation: 'slideDown 0.2s ease-out'
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
              e.target.style.background = 'rgba(0, 0, 0, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
            }}
          >
            {isCopied ? <Check size={16} /> : <Copy size={16} />}
            <span>{isCopied ? 'Copied!' : 'Copy Tweet'}</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default TwitterShareButton
