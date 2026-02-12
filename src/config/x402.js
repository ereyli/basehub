/**
 * x402 API base URL. Use absolute URL so payments work from both:
 * - Farcaster (same-origin with API)
 * - Web (different origin, e.g. basehub.fun or localhost)
 */
export const getX402ApiBase = () =>
  import.meta.env.VITE_API_URL || 'https://basehub-alpha.vercel.app'
