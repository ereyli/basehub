import { PinataSDK } from '@pinata/sdk';
import { AI_NFT_CONFIG } from '../config/aiNFT';

// Pinata configuration
const pinata = new PinataSDK({
  pinataApiKey: AI_NFT_CONFIG.PINATA_API_KEY,
  pinataSecretApiKey: AI_NFT_CONFIG.PINATA_SECRET_KEY,
});

/**
 * Upload image to IPFS via Pinata
 * @param {Blob} imageBlob - Image blob to upload
 * @param {string} fileName - Name for the file
 * @returns {Promise<string>} - IPFS hash/URL
 */
export async function uploadImageToIPFS(imageBlob, fileName = 'ai-generated-image.png') {
  try {
    console.log('📤 Uploading image to IPFS via Pinata...');
    
    const file = new File([imageBlob], fileName, { type: 'image/png' });
    
    const uploadResult = await pinata.upload.file(file, {
      pinataMetadata: {
        name: fileName,
        keyvalues: {
          type: 'ai-generated-image',
          timestamp: Date.now().toString()
        }
      },
      pinataOptions: {
        cidVersion: 0
      }
    });
    
    console.log('✅ Image uploaded to IPFS:', uploadResult.IpfsHash);
    return `ipfs://${uploadResult.IpfsHash}`;
    
  } catch (error) {
    console.error('❌ Error uploading image to IPFS:', error);
    throw new Error(`Failed to upload image to IPFS: ${error.message}`);
  }
}

/**
 * Upload NFT metadata to IPFS via Pinata
 * @param {Object} metadata - NFT metadata object
 * @returns {Promise<string>} - IPFS hash/URL for metadata
 */
export async function uploadMetadataToIPFS(metadata) {
  try {
    console.log('📤 Uploading metadata to IPFS via Pinata...');
    
    const metadataString = JSON.stringify(metadata, null, 2);
    const metadataBlob = new Blob([metadataString], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
    
    const uploadResult = await pinata.upload.file(metadataFile, {
      pinataMetadata: {
        name: 'nft-metadata.json',
        keyvalues: {
          type: 'nft-metadata',
          timestamp: Date.now().toString()
        }
      },
      pinataOptions: {
        cidVersion: 0
      }
    });
    
    console.log('✅ Metadata uploaded to IPFS:', uploadResult.IpfsHash);
    return `ipfs://${uploadResult.IpfsHash}`;
    
  } catch (error) {
    console.error('❌ Error uploading metadata to IPFS:', error);
    throw new Error(`Failed to upload metadata to IPFS: ${error.message}`);
  }
}

/**
 * Create and upload complete NFT metadata with image
 * @param {string} imageIPFSUrl - IPFS URL of the image
 * @param {string} prompt - Original prompt used for generation
 * @param {string} creatorAddress - Address of the creator
 * @returns {Promise<string>} - IPFS URL of the metadata
 */
export async function createAndUploadNFTMetadata(imageIPFSUrl, prompt, creatorAddress) {
  const metadata = {
    name: `AI NFT - ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
    description: `AI-generated NFT created from the prompt: "${prompt}". This unique digital artwork was generated using artificial intelligence and minted on the Base network.`,
    image: imageIPFSUrl,
    external_url: AI_NFT_CONFIG.METADATA.external_url,
    attributes: [
      {
        trait_type: 'AI Generated',
        value: 'Yes'
      },
      {
        trait_type: 'Prompt',
        value: prompt
      },
      {
        trait_type: 'Creator',
        value: creatorAddress
      },
      {
        trait_type: 'Network',
        value: 'Base'
      },
      {
        trait_type: 'Generation Date',
        value: new Date().toISOString()
      }
    ],
    properties: {
      category: 'image',
      files: [
        {
          uri: imageIPFSUrl,
          type: 'image/png'
        }
      ]
    }
  };
  
  return await uploadMetadataToIPFS(metadata);
}

/**
 * Get IPFS gateway URL for viewing content
 * @param {string} ipfsUrl - IPFS URL (ipfs://hash)
 * @returns {string} - HTTP gateway URL
 */
export function getIPFSGatewayUrl(ipfsUrl) {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl;
  }
  
  const hash = ipfsUrl.replace('ipfs://', '');
  return `${AI_NFT_CONFIG.IPFS_GATEWAYS[0]}${hash}`;
}
