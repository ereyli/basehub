import React from 'react'
import { Helmet } from 'react-helmet-async'

const EmbedMeta = ({ 
  title, 
  description, 
  image = "/icon.png", 
  url, 
  buttonText = "Play BaseHub",
  gameType = "game"
}) => {
  const fullUrl = url || 'https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub'
  const fullTitle = title ? `${title} - BaseHub` : "BaseHub - Play Games and Earn XP"
  const fullDescription = description || "Play games and earn XP on Base network through Farcaster"

  const embedContent = {
    version: "1",
    imageUrl: image,
    button: {
      title: buttonText,
      action: {
        type: "launch_miniapp",
        name: "BaseHub",
        url: fullUrl,
        splashImageUrl: image,
        splashBackgroundColor: "#0052ff"
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
      <meta property="og:image" content={image} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content="website" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={image} />
      
      {/* Page Title */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
    </Helmet>
  )
}

export default EmbedMeta
