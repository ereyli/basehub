import { uploadFileViaProxy } from './pinata';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload file to Pinata via server proxy (no client keys)
 */
async function uploadToPinata(fileBlob, fileName) {
  const imageBase64 = await blobToBase64(fileBlob);
  const { ipfsHash } = await uploadFileViaProxy(
    imageBase64,
    fileName,
    fileBlob.type || 'application/octet-stream'
  );
  return ipfsHash;
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64Data) {
  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Upload collection metadata to Pinata IPFS (via proxy)
 */
export async function uploadCollectionMetadata(collectionInfo, imageBase64) {
  try {
    console.log('📦 Uploading collection metadata to Pinata...');
    const imageBlob = base64ToBlob(imageBase64);
    const fileExtension = imageBase64.includes('image/jpeg') ? 'jpg' : 'png';
    const imageCid = await uploadToPinata(imageBlob, `collection-image.${fileExtension}`);
    const imageUri = `ipfs://${imageCid}`;

    const metadata = {
      name: collectionInfo.name,
      description: collectionInfo.description,
      image: imageUri,
      external_link: collectionInfo.externalLink || '',
      seller_fee_basis_points: collectionInfo.sellerFeeBasisPoints || 500,
      fee_recipient: collectionInfo.feeRecipient || '',
    };

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
 * Upload token metadata to Pinata IPFS (via proxy)
 */
export async function uploadTokenMetadata(imageBase64, tokenInfo) {
  try {
    console.log('🖼️ Uploading token metadata to Pinata...');
    const imageBlob = base64ToBlob(imageBase64);
    const fileExtension = imageBase64.includes('image/jpeg') ? 'jpg' : 'png';
    const imageCid = await uploadToPinata(imageBlob, `token-image.${fileExtension}`);
    const imageUri = `ipfs://${imageCid}`;

    const metadata = {
      name: tokenInfo.name,
      description: tokenInfo.description,
      image: imageUri,
      attributes: tokenInfo.attributes || [],
    };

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

export function getIPFSGatewayUrl(ipfsUri) {
  if (!ipfsUri) return '';
  const cid = ipfsUri.replace('ipfs://', '');
  return `https://nftstorage.link/ipfs/${cid}`;
}

export default {
  uploadCollectionMetadata,
  uploadTokenMetadata,
  getIPFSGatewayUrl,
};
