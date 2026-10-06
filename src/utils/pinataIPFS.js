import { AI_NFT_CONFIG } from '../config/aiNFT';
import { uploadFileViaProxy, uploadMetadataViaProxy } from './nftUpload';
import { compressImageForUpload } from './imageUpload';

/**
 * Upload image to NFT storage via server proxy (no client keys)
 */
export async function uploadImageToIPFS(imageBlob, fileName = 'ai-generated-image.png') {
  const imageBase64 = await compressImageForUpload(imageBlob);
  const { url } = await uploadFileViaProxy(imageBase64, fileName, imageBlob.type || 'image/png');
  return url;
}

/**
 * Upload NFT metadata to storage via server proxy
 */
export async function uploadMetadataToIPFS(metadata) {
  const { url } = await uploadMetadataViaProxy(metadata);
  return url;
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
