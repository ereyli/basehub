import { AI_NFT_CONFIG } from '../config/aiNFT';
import { uploadFileViaProxy, uploadMetadataViaProxy } from './pinata';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload image to IPFS via server proxy (no client keys)
 */
export async function uploadImageToIPFS(imageBlob, fileName = 'ai-generated-image.png') {
  const imageBase64 = await blobToBase64(imageBlob);
  const { ipfsHash } = await uploadFileViaProxy(imageBase64, fileName, imageBlob.type || 'image/png');
  return `ipfs://${ipfsHash}`;
}

/**
 * Upload NFT metadata to IPFS via server proxy
 */
export async function uploadMetadataToIPFS(metadata) {
  const { url } = await uploadMetadataViaProxy(metadata);
  const hash = url.replace('https://gateway.pinata.cloud/ipfs/', '');
  return `ipfs://${hash}`;
}

/**
 * Create and upload complete NFT metadata with image
 */
export async function createAndUploadNFTMetadata(imageIPFSUrl, prompt, creatorAddress) {
  const metadata = {
    name: `AI NFT - ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
    description: `AI-generated NFT created from the prompt: "${prompt}". This unique digital artwork was generated using artificial intelligence and minted on the Base network.`,
    image: imageIPFSUrl,
    external_url: AI_NFT_CONFIG.METADATA.external_url,
    attributes: [
      { trait_type: 'AI Generated', value: 'Yes' },
      { trait_type: 'Prompt', value: prompt },
      { trait_type: 'Creator', value: creatorAddress },
      { trait_type: 'Network', value: 'Base' },
      { trait_type: 'Generation Date', value: new Date().toISOString() },
    ],
    properties: {
      category: 'image',
      files: [{ uri: imageIPFSUrl, type: 'image/png' }],
    },
  };
  return await uploadMetadataToIPFS(metadata);
}

export function getIPFSGatewayUrl(ipfsUrl) {
  if (!ipfsUrl || !ipfsUrl.startsWith('ipfs://')) return ipfsUrl || '';
  const hash = ipfsUrl.replace('ipfs://', '');
  return `${AI_NFT_CONFIG.IPFS_GATEWAYS[0]}${hash}`;
}
