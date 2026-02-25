import React from 'react'
import { X, ExternalLink, Smartphone } from 'lucide-react'

const BASE_APP_URL = 'https://base.app/app/www.basehub.fun'
const FARCASTER_URL = 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'

const OpenInAppModal = ({ open, onClose }) => {
  if (!open) return null

  return (
    <div className="open-in-app-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="open-basehub-title">
      <div className="open-in-app-modal" onClick={e => e.stopPropagation()}>
        <div className="open-in-app-header">
          <h2 id="open-basehub-title" className="open-in-app-title">
            <Smartphone size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Open BaseHub
          </h2>
          <button type="button" className="open-in-app-close" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>
        <div className="open-in-app-qr-wrap">
          <img src="/miniapp.jpg" alt="QR code to open BaseHub in Base App" className="open-in-app-qr" />
        </div>
        <p className="open-in-app-instruction">
          Scan the QR code to open BaseHub in the Base App.
        </p>
        <div className="open-in-app-links">
          <a
            href={BASE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="open-in-app-link open-in-app-link-base"
          >
            <ExternalLink size={16} />
            <span>Open in Base App</span>
          </a>
          <a
            href={FARCASTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="open-in-app-link open-in-app-link-farcaster"
          >
            <ExternalLink size={16} />
            <span>Open in Farcaster</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default OpenInAppModal
