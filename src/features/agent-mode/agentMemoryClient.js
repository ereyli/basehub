function getApiBase() {
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
}

export async function fetchAgentMemory(walletAddress) {
  if (!walletAddress) {
    return { profile: null, memories: [], runs: [], reflections: [], available: false, setupError: null }
  }

  const res = await fetch(`${getApiBase()}/api/agent-memory?walletAddress=${encodeURIComponent(walletAddress)}`)
  if (!res.ok) return { profile: null, memories: [], runs: [], reflections: [], available: false, setupError: 'Memory API unavailable.' }
  return res.json()
}

export async function writeAgentMemoryEvent(payload) {
  const res = await fetch(`${getApiBase()}/api/agent-memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.ok
}
