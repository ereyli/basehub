// Farcaster Webhook Endpoint
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Log the webhook data
    console.log('Farcaster webhook received:', {
      timestamp: new Date().toISOString(),
      body: req.body,
      headers: req.headers
    })

    // Handle Farcaster Mini App events as per documentation
    const { type, data } = req.body

    switch (type) {
      case 'miniapp_added':
        console.log('Mini App added by user:', data)
        // Handle app installation
        break
      case 'miniapp_removed':
        console.log('Mini App removed by user:', data)
        // Handle app uninstallation
        break
      case 'notifications_enabled':
        console.log('Notifications enabled for user:', data)
        // Handle notification permission granted
        break
      case 'notifications_disabled':
        console.log('Notifications disabled for user:', data)
        // Handle notification permission revoked
        break
      default:
        console.log('Unknown webhook type:', type)
    }

    // Respond with success
    res.status(200).json({ 
      success: true, 
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    })
  }
}
