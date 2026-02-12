// Canonical host for x402 so payment and verify always use the same URL (no www vs non-www mismatch).
const BASEHUB_CANONICAL_ORIGIN = 'https://www.basehub.fun'

/**
 * x402 API base URL. Use canonical origin on basehub.fun so 402 resource URL
 * and verify URL always match (avoids "Failed to verify payment: Bad Request").
 * VITE_API_URL is only used when app runs on other hosts (e.g. localhost).
 */
export const getX402ApiBase = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    if (origin === 'https://basehub.fun' || origin === 'https://www.basehub.fun') return BASEHUB_CANONICAL_ORIGIN
    if (origin.includes('vercel.app') || origin.includes('basehub')) return origin
  }
  return import.meta.env.VITE_API_URL || 'https://basehub-alpha.vercel.app'
}
