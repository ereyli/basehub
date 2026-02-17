// Pinata IPFS – browser uses /api/pinata-upload proxy (no client keys). Server env: PINATA_API_KEY, PINATA_SECRET_KEY or PINATA_JWT

const PROXY_URL = typeof window !== 'undefined' ? `${window.location.origin}/api/pinata-upload` : ''

const MAX_IMAGE_DIM = 1024
const JPEG_QUALITY = 0.82
const MAX_BASE64_BYTES = 2 * 1024 * 1024 // ~2MB base64 → under Vercel 4.5MB body, faster upload

/** Resize/compress image so upload fits within limits and finishes before timeout */
function compressImageForUpload(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width
      let h = img.height
      if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
        if (w >= h) {
          h = Math.round((h * MAX_IMAGE_DIM) / w)
          w = MAX_IMAGE_DIM
        } else {
          w = Math.round((w * MAX_IMAGE_DIM) / h)
          h = MAX_IMAGE_DIM
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      let quality = JPEG_QUALITY
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      while (dataUrl.length > MAX_BASE64_BYTES && quality > 0.3) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const PROXY_TIMEOUT_MS = 60000 // 60s (Vercel fn often 10–60s)

async function uploadFileViaProxy(imageBase64, fileName = 'image.png', mimeType = 'image/png') {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'file', imageBase64, fileName, mimeType }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || err.details || 'Pinata upload failed')
    }
    const data = await res.json()
    return { url: data.url, ipfsHash: data.ipfsHash }
  } catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') throw new Error('Image upload timed out. Try a smaller image or try again.')
    throw e
  }
}

async function uploadMetadataViaProxy(metadata) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metadata', metadata }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || err.details || 'Pinata metadata upload failed')
    }
    const data = await res.json()
    return { url: data.url, ipfsHash: data.ipfsHash }
  } catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') throw new Error('Metadata upload timed out.')
    throw e
  }
}

export { uploadFileViaProxy, uploadMetadataViaProxy }

export const uploadToIPFS = async (file) => {
  if (typeof window !== 'undefined' && PROXY_URL) {
    try {
      const imageBase64 = file.type?.startsWith('image/')
        ? await compressImageForUpload(file)
        : await fileToBase64(file)
      const name = (file.name || 'image.png').replace(/\.[^.]+$/, '') + '.jpg'
      const { url } = await uploadFileViaProxy(imageBase64, name, 'image/jpeg')
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
