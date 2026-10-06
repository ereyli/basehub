import { compressImageForUpload } from './imageUpload'

export function createNFTMetadata(name, description, imageUrl, attributes = []) {
  return { name, description, image: imageUrl, attributes, external_url: 'https://www.basehub.fun', background_color: '000000' }
}

async function upload(body) {
  const apiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(`${local && apiBase ? apiBase : window.location.origin}/api/nft-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({ error: 'NFT upload service is unavailable. Please try again.' }))
    if (!response.ok) throw new Error(result.error || 'NFT upload failed')
    if (typeof result.url !== 'string' || !result.url.startsWith('https://')) throw new Error('Invalid storage response')
    return result
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('NFT upload timed out. Please try again.')
    throw error
  } finally { clearTimeout(timeout) }
}

export function uploadFileViaProxy(imageBase64, fileName, mimeType) {
  return upload({ type: 'file', imageBase64, fileName, mimeType })
}

export function uploadMetadataViaProxy(metadata) {
  return upload({ type: 'metadata', metadata })
}

// Retain the existing hook API while storing new assets over HTTPS.
export async function uploadToIPFS(file) {
  const imageBase64 = await compressImageForUpload(file)
  return (await uploadFileViaProxy(imageBase64)).url
}

export async function uploadMetadataToIPFS(metadata) {
  return (await uploadMetadataViaProxy(metadata)).url
}
