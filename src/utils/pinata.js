// Compatibility exports for older imports; all new uploads use Supabase.
export { compressImageForUpload } from './imageUpload'
export {
  createNFTMetadata,
  uploadFileViaProxy,
  uploadMetadataViaProxy,
  uploadToIPFS,
  uploadMetadataToIPFS,
} from './nftUpload'
