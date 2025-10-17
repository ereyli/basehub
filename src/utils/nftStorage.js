// Import Pinata configuration from config file
import { AI_NFT_CONFIG } from '../config/aiNFT';

// Pinata API configuration
const PINATA_API_KEY = AI_NFT_CONFIG.PINATA_API_KEY || import.meta.env.VITE_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = AI_NFT_CONFIG.PINATA_SECRET_KEY || import.meta.env.VITE_PINATA_SECRET_KEY || '';
const PINATA_JWT = AI_NFT_CONFIG.PINATA_JWT || import.meta.env.VITE_PINATA_JWT || '';

/**
 * Upload collection metadata to Pinata IPFS
 * @param {Object} collectionInfo - Collection information
 * @param {string} collectionInfo.name - Collection name
 * @param {string} collectionInfo.description - Collection description
 * @param {string} collectionInfo.externalLink - External link
 * @param {number} collectionInfo.sellerFeeBasisPoints - Royalty fee (e.g., 500 = 5%)
 * @param {string} collectionInfo.feeRecipient - Fee recipient address
 * @param {string} imageBase64 - Base64 encoded collection image
 * @returns {Promise<string>} IPFS URI (ipfs://...)
 */
export async function uploadCollectionMetadata(collectionInfo, imageBase64) {
  try {
    console.log('📦 Uploading collection metadata to Pinata...');
    
    if (!PINATA_JWT && !PINATA_API_KEY) {
      throw new Error('Pinata API key not found. Please set VITE_PINATA_JWT or VITE_PINATA_API_KEY in .env');
    }
    
    // Convert base64 to blob
    const imageBlob = base64ToBlob(imageBase64);
    console.log('📊 Image blob size:', imageBlob.size, 'bytes');
    console.log('📊 Image blob type:', imageBlob.type);
    
    // Upload image first
    console.log('📸 Uploading collection image...');
    const fileExtension = imageBase64.includes('image/jpeg') ? 'jpg' : 'png';
    const imageCid = await uploadToPinata(imageBlob, `collection-image.${fileExtension}`);
    const imageUri = `ipfs://${imageCid}`;
    
    console.log('✅ Collection image uploaded:', imageUri);
    
    // Create collection metadata JSON
    const metadata = {
      name: collectionInfo.name,
      description: collectionInfo.description,
      image: imageUri,
      external_link: collectionInfo.externalLink || '',
      seller_fee_basis_points: collectionInfo.sellerFeeBasisPoints || 500,
      fee_recipient: collectionInfo.feeRecipient || ''
    };
    
    // Upload metadata JSON
    console.log('📄 Uploading collection metadata...');
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const metadataCid = await uploadToPinata(metadataBlob, 'collection-metadata.json');
    const metadataUri = `ipfs://${metadataCid}`;
    
    console.log('✅ Collection metadata uploaded:', metadataUri);
    
    return metadataUri;
  } catch (error) {
    console.error('❌ Error uploading collection metadata:', error);
    throw error;
  }
}

/**
 * Upload token metadata to Pinata IPFS
 * @param {string} imageBase64 - Base64 encoded image
 * @param {Object} tokenInfo - Token information
 * @param {string} tokenInfo.name - Token name
 * @param {string} tokenInfo.description - Token description
 * @param {Array} tokenInfo.attributes - Token attributes
 * @returns {Promise<string>} IPFS URI (ipfs://...)
 */
export async function uploadTokenMetadata(imageBase64, tokenInfo) {
  try {
    console.log('🖼️ Uploading token metadata to Pinata...');
    
    if (!PINATA_JWT && !PINATA_API_KEY) {
      throw new Error('Pinata API key not found. Please set VITE_PINATA_JWT or VITE_PINATA_API_KEY in .env');
    }
    
    // Convert base64 to blob
    const imageBlob = base64ToBlob(imageBase64);
    console.log('📊 Token image blob size:', imageBlob.size, 'bytes');
    console.log('📊 Token image blob type:', imageBlob.type);
    
    // Upload image first
    console.log('📸 Uploading token image...');
    const fileExtension = imageBase64.includes('image/jpeg') ? 'jpg' : 'png';
    const imageCid = await uploadToPinata(imageBlob, `token-image.${fileExtension}`);
    const imageUri = `ipfs://${imageCid}`;
    
    console.log('✅ Token image uploaded:', imageUri);
    
    // Create token metadata JSON
    const metadata = {
      name: tokenInfo.name,
      description: tokenInfo.description,
      image: imageUri,
      attributes: tokenInfo.attributes || []
    };
    
    // Upload metadata JSON
    console.log('📄 Uploading token metadata...');
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const metadataCid = await uploadToPinata(metadataBlob, 'token-metadata.json');
    const metadataUri = `ipfs://${metadataCid}`;
    
    console.log('✅ Token metadata uploaded:', metadataUri);
    
    return metadataUri;
  } catch (error) {
    console.error('❌ Error uploading token metadata:', error);
    throw error;
  }
}

/**
 * Upload file to Pinata IPFS
 * @param {Blob} fileBlob - File blob
 * @param {string} fileName - File name
 * @returns {Promise<string>} IPFS CID
 */
async function uploadToPinata(fileBlob, fileName) {
  const formData = new FormData();
  formData.append('file', fileBlob, fileName);
  
  const metadata = JSON.stringify({
    name: fileName,
  });
  formData.append('pinataMetadata', metadata);
  
  const options = JSON.stringify({
    cidVersion: 0,
  });
  formData.append('pinataOptions', options);
  
  const headers = PINATA_JWT 
    ? { 'Authorization': `Bearer ${PINATA_JWT}` }
    : {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      };
  
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: headers,
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Pinata upload error:', error);
    console.error('❌ Response status:', response.status);
    console.error('❌ Response headers:', response.headers);
    throw new Error(`Pinata upload failed (${response.status}): ${error}`);
  }
  
  const result = await response.json();
  return result.IpfsHash;
}

/**
 * Convert base64 string to Blob
 * @param {string} base64Data - Base64 encoded data
 * @returns {Blob} - Blob object
 */
function base64ToBlob(base64Data) {
  // Extract MIME type from data URI
  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  // Remove data URI prefix if present
  const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
  
  // Decode base64
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Get IPFS gateway URL from IPFS URI
 * @param {string} ipfsUri - IPFS URI (ipfs://...)
 * @returns {string} - HTTP gateway URL
 */
export function getIPFSGatewayUrl(ipfsUri) {
  if (!ipfsUri) return '';
  
  // Use nft.storage gateway
  const cid = ipfsUri.replace('ipfs://', '');
  return `https://nftstorage.link/ipfs/${cid}`;
}

export default {
  uploadCollectionMetadata,
  uploadTokenMetadata,
  getIPFSGatewayUrl
};

