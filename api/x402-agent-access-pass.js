import { createAgentAccessPaymentApp, runHonoApp } from './_agentAccessPaymentApp.js'

const app = createAgentAccessPaymentApp({ discounted: true })

export default async function handler(req, res) {
  try {
    await runHonoApp(app, req, res)
  } catch (error) {
    console.error('[x402-agent-access-pass] error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Discounted Agent access payment failed.' })
    }
  }
}
