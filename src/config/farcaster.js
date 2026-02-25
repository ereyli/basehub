/**
 * Farcaster miniapp Universal Link format.
 * Sub-path is appended to homeUrl when opened in Farcaster/Base.
 * @see https://docs.farcaster.xyz/developers/guides/sharing#universal-links
 */

export const FARCASTER_MINIAPP_BASE = 'https://farcaster.xyz/miniapps/_9JX6QCRPZzq/basehub'

/** Build Farcaster Universal Link for a path (e.g. /mint/xyz, /pumphub) */
export function getFarcasterUniversalLink(path = '') {
  const p = typeof path === 'string' && path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${FARCASTER_MINIAPP_BASE}${p}`
}
