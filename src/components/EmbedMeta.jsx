import React from 'react'
import { Helmet } from 'react-helmet-async'
import { getFarcasterUniversalLink } from '../config/farcaster'

// Web (X, etc.) share image: basehub.fun + cache-bust. Farcaster embed keeps relative/current domain.
const WEB_OG_IMAGE = 'https://basehub.fun/image2.jpeg?v=4'

const EmbedMeta = ({ 
  title, 
  description, 
  image = "/image2.jpeg", 
  url, 
  buttonText = "Play BaseHub",
  gameType = "game"
}) => {
  const fullUrl = url || getFarcasterUniversalLink('/')
  const fullTitle = title ? `${title} - BaseHub` : "BaseHub - Web3 Tools & Interactions"
  const fullDescription = description || "Multi-chain Web3 platform. Deploy smart contracts, swap tokens, analyze wallets, and interact with blockchain to earn XP across multiple EVM networks. Available on Base and InkChain!"
  // Farcaster: image as-is. Web: always basehub.fun for og/twitter.
  const webOgImage = !image
    ? WEB_OG_IMAGE
    : (image.startsWith('http') ? image : `https://basehub.fun${image.startsWith('/') ? image : '/' + image}?v=1`)

  const embedContent = {
    version: "1",
    imageUrl: image,
    button: {
      title: buttonText,
      action: {
        type: "launch_miniapp",
        name: "BaseHub",
        url: fullUrl,
        splashImageUrl: "/basehub-icon.png",
        splashBackgroundColor: "#4A90E2"
      }
    }
  }

  // Backward compatibility embed content
  const frameEmbedContent = {
    ...embedContent,
    button: {
      ...embedContent.button,
      action: {
        ...embedContent.button.action,
        type: "launch_frame"
      }
    }
  }

  return (
    <Helmet>
      {/* Farcaster Mini App Embed Meta Tags */}
      <meta name="fc:miniapp" content={JSON.stringify(embedContent)} />
      {/* For backward compatibility */}
      <meta name="fc:frame" content={JSON.stringify(frameEmbedContent)} />
      
      {/* Open Graph Meta Tags for Social Sharing */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={webOgImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content="website" />
      
      {/* Twitter Card (web: basehub.fun) */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={webOgImage} />
      
      {/* Page Title */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
    </Helmet>
  )
}

export default EmbedMeta
