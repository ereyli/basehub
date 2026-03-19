// Helper to call the BaseHub AI assistant via Supabase Edge Function.
// OpenAI API key lives ONLY in the Edge Function; the browser never sees it.
import { supabase } from '../config/supabase'

const EDGE_ASSISTANT_URL =
  (import.meta.env.VITE_SUPABASE_URL &&
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/basehub-assistant`) ||
  null

export async function callBasehubAssistant({ language, products, lastUserMessage, userStats, walletAddress }) {
  if (!EDGE_ASSISTANT_URL) {
    console.warn('VITE_SUPABASE_URL is missing. Basehub assistant Edge Function cannot be reached.')
    return null
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token || null
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    }
    const res = await fetch(EDGE_ASSISTANT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lastUserMessage: lastUserMessage && typeof lastUserMessage === 'string' ? lastUserMessage : null,
        walletAddress: walletAddress || null,
      }),
    })

    if (!res.ok) {
      console.error('BaseHub assistant Edge error:', res.status, await res.text())
      return null
    }

    const payload = await res.json()
    return payload
  } catch (err) {
    console.error('Error calling BaseHub assistant Edge Function:', err)
    return null
  }
}

export async function fetchBasehubAssistantHistory({ walletAddress, limit = 20 }) {
  if (!EDGE_ASSISTANT_URL) return []
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token || null
    const res = await fetch(EDGE_ASSISTANT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ action: 'history', walletAddress, limit }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.history) ? data.history : []
  } catch {
    return []
  }
}

