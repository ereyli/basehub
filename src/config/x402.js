/**
 * x402 API base URL. Prefer same origin to avoid CORS and redirect-on-preflight issues:
 * - On basehub.fun / www.basehub.fun / Vercel: use current origin (no cross-origin, no redirect)
 * - Else: use VITE_API_URL or fallback (e.g. for localhost calling deployed API)
 */
export const getX402ApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    if (origin === 'https://basehub.fun' || origin === 'https://www.basehub.fun') return origin
    if (origin.includes('vercel.app') || origin.includes('basehub')) return origin
  }
  return 'https://basehub-alpha.vercel.app'
}
