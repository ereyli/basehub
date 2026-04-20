import { getAgentAccess, normalizeAddress } from './_agentAccess.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const walletAddress = normalizeAddress(req.query?.walletAddress)
    const access = await getAgentAccess(walletAddress)
    res.status(200).json({
      ok: true,
      ...access,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Agent access check failed.',
    })
  }
}
