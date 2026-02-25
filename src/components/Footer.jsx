import React from 'react'
import { Link } from 'react-router-dom'
import { Twitter, ExternalLink, Smartphone } from 'lucide-react'
import { useOpenInApp } from '../contexts/OpenInAppContext'

const BASE_APP_URL = 'https://base.app/app/www.basehub.fun'
const FARCASTER_URL = 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'

const Footer = () => {
  const { openModal: openOpenInAppModal } = useOpenInApp()
  // Check if we're in Farcaster environment (safe check without hook)
  const isInFarcaster = typeof window !== 'undefined' && 
    (window.location !== window.parent.location ||
     window.location.href.includes('farcaster.xyz') ||
     window.location.href.includes('warpcast.com'))
  
  const currentYear = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Logo and Slogan */}
          <div className="footer-brand">
            <div className="footer-logo">
              <img src="/icon.png" alt="BaseHub" className="footer-logo-img" />
            </div>
            <p className="footer-slogan">
              Gamified smart contracts on the Base network. Play, earn, and build the future of Web3.
            </p>
          </div>

          {/* Links */}
          <div className="footer-links">
            <div className="footer-link-group">
              <h4 className="footer-link-title">Platform</h4>
              <Link to="/" className="footer-link">Home</Link>
              <Link to="/leaderboard" className="footer-link">Leaderboard</Link>
              <a 
                href="https://x.com/BaseHubb" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                Follow on X
              </a>
            </div>
            <div className="footer-link-group">
              <h4 className="footer-link-title">Use in app</h4>
              <a 
                href={BASE_APP_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                Base App
              </a>
              <a 
                href={FARCASTER_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                Farcaster
              </a>
              <button type="button" className="footer-link footer-link-button" onClick={openOpenInAppModal}>
                <Smartphone size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Show QR
              </button>
            </div>
            <div className="footer-link-group">
              <h4 className="footer-link-title">Legal</h4>
              <Link to="/privacy" className="footer-link">Privacy Policy</Link>
              <Link to="/terms" className="footer-link">Terms of Service</Link>
            </div>
            {isInFarcaster && (
              <div className="footer-link-group">
                <h4 className="footer-link-title">Resources</h4>
                <a 
                  href="https://basehub.fun" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  Visit Website
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <div className="footer-copyright">
            <p>
              © {currentYear} BaseHub. All rights reserved.
            </p>
            <p className="footer-tagline">
              Built on Base • Miniapp on Farcaster & Base App • Gamified for Everyone
            </p>
          </div>
          <div className="footer-social">
            <a 
              href="https://x.com/BaseHubb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-social-link"
              title="Follow us on X"
            >
              <Twitter size={16} />
            </a>
            {isInFarcaster && (
              <a 
                href="https://basehub.fun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-social-link"
                title="Visit our website"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

