/**
 * x402 API base URL. Always use same origin when on basehub.fun / www to avoid CORS
 * and "Redirect is not allowed for a preflight request" (www <-> non-www redirect).
 * VITE_API_URL is only used when app runs on other hosts (e.g. localhost).
 */
export const getX402ApiBase = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    if (origin === 'https://basehub.fun' || origin === 'https://www.basehub.fun') return origin
    if (origin.includes('vercel.app') || origin.includes('basehub')) return origin
  }
  return import.meta.env.VITE_API_URL || 'https://basehub-alpha.vercel.app'
}
