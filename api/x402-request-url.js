/**
 * Build the full request URL for x402 verify. Must match exactly what the client used.
 * - Prefer x-forwarded-host (client's host when behind Vercel/proxy)
 * - Support req.url as path (/api/...) or full URL (https://...)
 */
export function getRequestUrl(req, endpointPath) {
  const protocol = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
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
