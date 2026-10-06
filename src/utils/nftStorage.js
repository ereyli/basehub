import { uploadFileViaProxy, uploadMetadataViaProxy } from './nftUpload';
import { compressImageForUpload } from './imageUpload';

/**
 * Upload image to Supabase via server proxy (no client keys)
 */
async function uploadImage(fileBlob, fileName) {
  const imageBase64 = await compressImageForUpload(fileBlob);
  const { url } = await uploadFileViaProxy(
    imageBase64,
    fileName,
    fileBlob.type || 'application/octet-stream'
  );
  return url;
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
 * Upload collection assets to Supabase Storage
 */
export async function uploadCollectionMetadata(collectionInfo, imageBase64) {
  try {
    console.log('Uploading collection assets to NFT storage');
    const imageBlob = base64ToBlob(imageBase64);
    const fileExtension = imageBase64.includes('image/jpeg') ? 'jpg' : 'png';
    const imageUri = await uploadImage(imageBlob, `collection-image.${fileExtension}`);

    const metadata = {
      name: collectionInfo.name,
      description: collectionInfo.description,
      image: imageUri,
      external_link: collectionInfo.externalLink || '',
      seller_fee_basis_points: collectionInfo.sellerFeeBasisPoints ?? 500,
      fee_recipient: collectionInfo.feeRecipient || '',
    };

    const { url: metadataUri } = await uploadMetadataViaProxy(metadata);
    console.log('✅ Collection metadata uploaded:', metadataUri);
    return metadataUri;
  } catch (error) {
    console.error('❌ Error uploading collection metadata:', error);
    throw error;
  }
}

/**
 * Upload token assets to Supabase Storage
 */
export async function uploadTokenMetadata(imageBase64, tokenInfo) {
  try {
    console.log('Uploading token assets to NFT storage');
    const imageBlob = base64ToBlob(imageBase64);
    const fileExtension = imageBase64.includes('image/jpeg') ? 'jpg' : 'png';
    const imageUri = await uploadImage(imageBlob, `token-image.${fileExtension}`);

    const metadata = {
      name: tokenInfo.name,
      description: tokenInfo.description,
      image: imageUri,
      attributes: tokenInfo.attributes || [],
    };

    const { url: metadataUri } = await uploadMetadataViaProxy(metadata);
    console.log('✅ Token metadata uploaded:', metadataUri);
    return metadataUri;
  } catch (error) {
    console.error('❌ Error uploading token metadata:', error);
    throw error;
  }
}

export function getIPFSGatewayUrl(ipfsUri) {
  if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return ipfsUri || '';
  const cid = ipfsUri.replace('ipfs://', '');
  return `https://nftstorage.link/ipfs/${cid}`;
}

export default {
  uploadCollectionMetadata,
  uploadTokenMetadata,
  getIPFSGatewayUrl,
};
