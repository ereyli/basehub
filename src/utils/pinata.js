// Pinata IPFS – browser uses /api/pinata-upload proxy (no client keys). Server env: PINATA_API_KEY, PINATA_SECRET_KEY or PINATA_JWT

const PROXY_URL = typeof window !== 'undefined' ? `${window.location.origin}/api/pinata-upload` : ''

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadFileViaProxy(imageBase64, fileName = 'image.png', mimeType = 'image/png') {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'file', imageBase64, fileName, mimeType }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.details || 'Pinata upload failed')
  }
  const data = await res.json()
  return { url: data.url, ipfsHash: data.ipfsHash }
}

async function uploadMetadataViaProxy(metadata) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metadata', metadata }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.details || 'Pinata metadata upload failed')
  }
  const data = await res.json()
  return { url: data.url, ipfsHash: data.ipfsHash }
}

export { uploadFileViaProxy, uploadMetadataViaProxy }

export const uploadToIPFS = async (file) => {
  if (typeof window !== 'undefined' && PROXY_URL) {
    try {
      const imageBase64 = await fileToBase64(file)
      const { url } = await uploadFileViaProxy(imageBase64, file.name || 'image.png', file.type || 'image/png')
      return url
    } catch (e) {
      console.error('IPFS upload failed:', e)
      throw e
    }
  }
  console.warn('Pinata upload only supported in browser via /api/pinata-upload proxy')
  throw new Error('Upload not configured (set Pinata env on server)')
}

export const uploadMetadataToIPFS = async (metadata) => {
  if (typeof window !== 'undefined' && PROXY_URL) {
    try {
      const { url } = await uploadMetadataViaProxy(metadata)
      return url
    } catch (e) {
      console.error('IPFS metadata upload failed:', e)
      throw e
    }
  }
  console.warn('Pinata metadata upload only supported in browser via proxy')
  throw new Error('Upload not configured (set Pinata env on server)')
}

export const createNFTMetadata = (name, description, imageUrl, attributes = []) => {
  return {
    name,
    description,
    image: imageUrl,
    attributes,
    external_url: 'https://basehub.app',
    background_color: '000000',
  }
}
