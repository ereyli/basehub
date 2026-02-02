// AI NFT Configuration
export const AI_NFT_CONFIG = {
  // Google Studio API Key (Gemini)
  GOOGLE_STUDIO_API_KEY: import.meta.env.VITE_GOOGLE_STUDIO_API_KEY || 'YOUR_GOOGLE_STUDIO_API_KEY',
  
  // MiniMax API Key (Image Generation - Recommended)
  MINIMAX_API_KEY: import.meta.env.VITE_MINIMAX_API_KEY || 'YOUR_MINIMAX_API_KEY',
  
  // AI Provider Selection: 'minimax' | 'gemini' | 'canvas'
  AI_PROVIDER: import.meta.env.VITE_AI_PROVIDER || 'minimax', // Default to MiniMax
  
  // Pinata IPFS Configuration
  PINATA_API_KEY: import.meta.env.VITE_PINATA_API_KEY || 'YOUR_PINATA_API_KEY',
  PINATA_SECRET_KEY: import.meta.env.VITE_PINATA_SECRET_KEY || 'YOUR_PINATA_SECRET_KEY',
  PINATA_JWT: import.meta.env.VITE_PINATA_JWT || 'YOUR_PINATA_JWT',
  
  // AI NFT Collection Contract Address (Base Mainnet)
  // V2 - Tiered Pricing Model (Fixed: tokenURI before mint)
  AI_NFT_CONTRACT_ADDRESS: '0xF8278421Df4312991616bd7F9D81EE9B52f1473c',
  
  // Minting Configuration (Quantity-Based Tiered Pricing)
  // Fee is paid ONCE regardless of quantity in that tier
  TIER_PRICING: {
    '0-1000': '0.001',      // 0.001 ETH
    '1001-2000': '0.002',   // 0.002 ETH
    '2001-4000': '0.004',   // 0.004 ETH
    '4001-8000': '0.008',   // 0.008 ETH
    '8001-10000': '0.01'    // 0.01 ETH (cap)
  },
  
  // Batch Minting Limits
  MAX_BATCH_MINT: 10000, // Maximum NFTs per transaction
  MIN_BATCH_MINT: 1,
  
  // Network Configuration
  NETWORK: 'Base Mainnet',
  CHAIN_ID: 8453,
  
  // IPFS Gateway URLs
  IPFS_GATEWAYS: [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
  ],
  
  // Image Generation Settings
  IMAGE_SIZE: {
    width: 512,
    height: 512
  },
  
  // Image Optimization Settings
  IMAGE_OPTIMIZATION: {
    quality: 0.8,        // JPEG quality (0.1 to 1.0)
    format: 'jpeg',      // Use JPEG for smaller file size
    enableCompression: true
  },
  
  // Metadata Configuration
  METADATA: {
    name: 'AI NFT',
    description: 'AI-generated NFT created on Base network',
    external_url: 'https://basehub.xyz',
    attributes: [
      {
        trait_type: 'AI Generated',
        value: 'Yes'
      },
      {
        trait_type: 'Network',
        value: 'Base'
      }
    ]
  }
};

// Helper functions
export const getIPFSGatewayUrl = (ipfsUrl) => {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl;
  }
  
  const hash = ipfsUrl.replace('ipfs://', '');
  return `${AI_NFT_CONFIG.IPFS_GATEWAYS[0]}${hash}`;
};

export const getContractAddress = () => {
  return AI_NFT_CONFIG.AI_NFT_CONTRACT_ADDRESS;
};

/**
 * Calculate mint fee based on quantity (V2 pricing model)
 * @param {number} quantity - Number of NFTs to mint
 * @returns {string} Fee in ETH
 */
export const calculateMintFee = (quantity) => {
  if (quantity <= 0 || quantity > 10000) {
    throw new Error('Quantity must be between 1 and 10000');
  }
  
  if (quantity <= 1000) return '0.001';
  if (quantity <= 2000) return '0.002';
  if (quantity <= 4000) return '0.004';
  if (quantity <= 8000) return '0.008';
  return '0.01'; // 8001-10000 (cap)
};

/**
 * Calculate mint fee in wei based on quantity
 * @param {number} quantity - Number of NFTs to mint
 * @returns {string} Fee in wei
 */
export const calculateMintFeeWei = (quantity) => {
  const feeInEth = calculateMintFee(quantity);
  return (parseFloat(feeInEth) * 1e18).toString();
};

/**
 * Get tier info for a given quantity
 * @param {number} quantity - Number of NFTs to mint
 * @returns {object} Tier information
 */
export const getTierInfo = (quantity) => {
  let tier, range, fee;
  
  if (quantity <= 1000) {
    tier = 1;
    range = '0-1000';
    fee = '0.001';
  } else if (quantity <= 2000) {
    tier = 2;
    range = '1001-2000';
    fee = '0.002';
  } else if (quantity <= 4000) {
    tier = 3;
    range = '2001-4000';
    fee = '0.004';
  } else if (quantity <= 8000) {
    tier = 4;
    range = '4001-8000';
    fee = '0.008';
  } else {
    tier = 5;
    range = '8001-10000';
    fee = '0.01';
  }
  
  return { tier, range, fee };
};
