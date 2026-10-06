const MAX_IMAGE_DIM = 1024
const MAX_BASE64_BYTES = 2 * 1024 * 1024

export function compressImageForUpload(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        let width = img.width
        let height = img.height
        if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
          const scale = MAX_IMAGE_DIM / Math.max(width, height)
          width = Math.max(1, Math.round(width * scale))
          height = Math.max(1, Math.round(height * scale))
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Image processing is unavailable'))
        ctx.drawImage(img, 0, 0, width, height)
        // Preserve transparent logos; use lossy compression only when needed.
        let dataUrl = canvas.toDataURL('image/png')
        let quality = 0.82
        while (dataUrl.length > MAX_BASE64_BYTES && quality >= 0.3) {
          dataUrl = canvas.toDataURL('image/webp', quality)
          quality -= 0.1
        }
        if (dataUrl.length > MAX_BASE64_BYTES) return reject(new Error('Image is too large. Please choose a smaller image.'))
        resolve(dataUrl)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}
