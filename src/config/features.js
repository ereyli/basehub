/**
 * Feature flags (Vite: only VITE_* is exposed to the client).
 * Agent Mode: keep disabled in production until you explicitly enable.
 */
export function isAgentModeEnabled() {
  return import.meta.env.VITE_AGENT_MODE_ENABLED === 'true'
}

/**
 * Geçici: Agent x402 USDC ödemesini UI’da gizler; test / entegrasyon için.
 * Production’da false bırak — gerçek erişim ücreti için kapalı tutma.
 */
export function isAgentX402PurchaseSkipped() {
  return import.meta.env.VITE_AGENT_SKIP_X402_PURCHASE === 'true'
}
