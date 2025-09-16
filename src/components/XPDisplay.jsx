import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Star, Coins, Gift, Zap, Trophy } from 'lucide-react'
import { getXP, calculateTokens } from '../utils/xpUtils'

const XPDisplay = () => {
  const { isConnected, address } = useAccount()
  const [totalXP, setTotalXP] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)

  // Load XP from Supabase and refresh every 3 seconds
  useEffect(() => {
    const loadXP = async () => {
      if (isConnected && address) {
        try {
          const xp = await getXP(address)
          setTotalXP(xp)
        } catch (error) {
          console.error('Error loading XP:', error)
          // Fallback to localStorage
          const xpKey = `xp_${address}`
          const savedXP = localStorage.getItem(xpKey)
          setTotalXP(savedXP ? parseInt(savedXP) : 0)
        }
      } else {
        setTotalXP(0)
      }
    }

    loadXP()
    const interval = setInterval(loadXP, 3000) // Refresh every 3 seconds
    
    return () => clearInterval(interval)
  }, [isConnected, address])

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      setIsScrolled(scrollTop > 100) // Header ile aynı threshold
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])


  if (!isConnected) {
    return null
  }

  return (
    <div className={`modern-xp-display ${isScrolled ? 'hidden' : ''}`}>
      <div className="xp-container">
        {/* XP Section */}
        <div className="xp-badge">
          <div className="xp-icon">
            <Star size={18} />
          </div>
          <div className="xp-content">
            <span className="xp-value">{totalXP.toLocaleString()}</span>
            <span className="xp-label">XP</span>
          </div>
        </div>

        {/* BHUP Section */}
        <div className="token-badge">
          <div className="token-icon">
            <Coins size={18} />
          </div>
          <div className="token-content">
            <span className="token-value">{calculateTokens(totalXP).toLocaleString()}</span>
            <span className="token-label">BHUP</span>
          </div>
        </div>

        {/* Claim Button */}
        <button className="claim-button" disabled={true}>
          <Gift size={16} />
          <span>Claim BHUP</span>
          <span className="coming-soon">Coming Soon</span>
        </button>
      </div>
    </div>
  )
}

export default XPDisplay

// Modern XP Display Styles
const xpDisplayStyles = `
  .modern-xp-display {
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: fit-content;
    max-width: 90vw;
    transition: all 0.3s ease;
  }

  .modern-xp-display.hidden {
    transform: translateX(-50%) translateY(-120%);
    opacity: 0;
  }

  .modern-xp-display:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  .modern-xp-display.hidden:hover {
    transform: translateX(-50%) translateY(-120%);
    opacity: 0;
  }

  .xp-container {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .xp-badge, .token-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 12px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .xp-badge {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    box-shadow: 0 4px 16px rgba(251, 191, 36, 0.3);
  }

  .token-badge {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
  }

  .xp-badge:hover, .token-badge:hover {
    transform: translateY(-2px) scale(1.02);
  }

  .xp-badge:hover {
    box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4);
  }

  .token-badge:hover {
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
  }

  .xp-icon, .token-icon {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    backdrop-filter: blur(10px);
  }

  .xp-content, .token-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .xp-value, .token-value {
    font-size: 18px;
    font-weight: 800;
    color: white;
    line-height: 1;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  }

  .xp-label, .token-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .claim-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 14px;
    cursor: not-allowed;
    opacity: 0.7;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .claim-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .claim-button:hover::before {
    left: 100%;
  }

  .coming-soon {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .modern-xp-display {
      top: 90px;
      padding: 12px 16px;
    }

    .xp-container {
      gap: 12px;
    }

    .xp-badge, .token-badge {
      padding: 10px 12px;
      gap: 8px;
    }

    .xp-icon, .token-icon {
      width: 32px;
      height: 32px;
    }

    .xp-value, .token-value {
      font-size: 16px;
    }

    .claim-button {
      padding: 10px 12px;
      font-size: 13px;
    }
  }

  @media (max-width: 480px) {
    .modern-xp-display {
      top: 85px;
      padding: 10px 12px;
    }

    .xp-container {
      flex-direction: column;
      gap: 8px;
    }

    .xp-badge, .token-badge {
      width: 100%;
      justify-content: center;
    }

    .coming-soon {
      display: none;
    }
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = xpDisplayStyles
  document.head.appendChild(styleSheet)
}
