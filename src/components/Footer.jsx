import React from 'react'
import { Link } from 'react-router-dom'
import { Twitter, ExternalLink, Zap } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'

const Footer = () => {
  const { isInFarcaster } = useFarcaster()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Logo and Slogan */}
          <div className="footer-brand">
            <div className="footer-logo">
              <Zap size={20} style={{ color: '#3b82f6' }} />
              <span className="footer-brand-name">BaseHub</span>
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
                href="https://x.com/BaseHUBB" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                Follow on X
              </a>
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
              Built on Base • Powered by Farcaster • Gamified for Everyone
            </p>
          </div>
          <div className="footer-social">
            <a 
              href="https://x.com/BaseHUBB" 
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

