// Canonical host for basehub.fun so 402 resource URL and verify URL always match.
const BASEHUB_CANONICAL_HOST = 'www.basehub.fun'

/**
 * Build the full request URL for x402 verify. Must match exactly what the client used.
 * - Use canonical host for basehub.fun (www) so payment and verify never disagree.
 * - Prefer x-forwarded-host when behind Vercel/proxy; support req.url as path or full URL.
 */
export function getRequestUrl(req, endpointPath) {
  const protocol = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'] || 'https'
  let host = req.headers['x-forwarded-host'] || req.headers.host || ''
  if (host === 'basehub.fun' || host === 'www.basehub.fun') host = BASEHUB_CANONICAL_HOST
  let path = endpointPath
  let query = ''
  if (req.url) {
    if (req.url.startsWith('http')) {
      try {
        const u = new URL(req.url)
        path = u.pathname
        query = u.search ? u.search.slice(1) : ''
      } catch (_) {}
    } else if (req.url.startsWith('/api')) {
      const parts = req.url.split('?')
      path = parts[0]
      query = parts[1] || ''
    }
  }
  const pathAndQuery = path + (query ? `?${query}` : '')
  return `${protocol}://${host}${pathAndQuery}`
}
