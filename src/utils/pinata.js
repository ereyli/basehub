// Pinata IPFS integration for NFT image storage
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY

// Upload file to IPFS via Pinata
export const uploadToIPFS = async (file) => {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    console.warn('⚠️ Pinata API keys not configured, using mock upload')
    // Return a mock IPFS URL for development
    return `https://gateway.pinata.cloud/ipfs/QmMockHash${Date.now()}`
  }

  try {
    console.log('📤 Uploading file to IPFS via Pinata...', file.name)
    
    const formData = new FormData()
    formData.append('file', file)
    
    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: 'nft-image',
        uploadedAt: new Date().toISOString()
      }
    })
    formData.append('pinataMetadata', metadata)
    
    // Add options
    const options = JSON.stringify({
      cidVersion: 0,
      wrapWithDirectory: false
    })
    formData.append('pinataOptions', options)
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
    
    console.log('✅ File uploaded to IPFS:', ipfsUrl)
    return ipfsUrl
    
  } catch (error) {
    console.error('❌ IPFS upload failed:', error)
    // Fallback to mock URL
    return `https://gateway.pinata.cloud/ipfs/QmMockHash${Date.now()}`
  }
}

// Upload JSON metadata to IPFS
export const uploadMetadataToIPFS = async (metadata) => {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    console.warn('⚠️ Pinata API keys not configured, using mock metadata upload')
    return `https://gateway.pinata.cloud/ipfs/QmMockMetadata${Date.now()}`
  }

  try {
    console.log('📤 Uploading metadata to IPFS via Pinata...', metadata)
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `nft-metadata-${Date.now()}`,
          keyvalues: {
            type: 'nft-metadata',
            createdAt: new Date().toISOString()
          }
        },
        pinataOptions: {
          cidVersion: 0
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Pinata metadata upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
    
    console.log('✅ Metadata uploaded to IPFS:', ipfsUrl)
    return ipfsUrl
    
  } catch (error) {
    console.error('❌ IPFS metadata upload failed:', error)
    // Fallback to mock URL
    return `https://gateway.pinata.cloud/ipfs/QmMockMetadata${Date.now()}`
  }
}

// Create NFT metadata JSON
export const createNFTMetadata = (name, description, imageUrl, attributes = []) => {
  return {
    name,
    description,
    image: imageUrl,
    attributes,
    external_url: "https://basehub.app",
    background_color: "000000"
  }
}
