import { useCallback, useEffect, useState } from 'react'

const DEFAULT_LIMIT = 30
const AGENTS_API_PATH = '/api/erc8004-agents'
const VIEWS_API_PATH = '/api/erc8004-agent-views'

function getApiBase() {
  if (typeof window === 'undefined') return ''
  const currentBase = window.location.origin.replace(/\/$/, '')
  const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
  if (isLocalhost) return currentBase
  return (import.meta.env?.VITE_API_URL || currentBase).trim().replace(/\/$/, '')
}

export async function recordERC8004AgentView(agent) {
  if (typeof window === 'undefined' || !agent?.agentId) return null

  const response = await fetch(`${getApiBase()}${VIEWS_API_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      agentId: String(agent.agentId),
      owner: agent.owner,
      metadataUri: agent.agentURI,
      txHash: agent.txHash,
      referrer: window.location.href,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || `View record HTTP ${response.status}`)
  }
  return data
}

export function useERC8004Agents({ limit = DEFAULT_LIMIT, page = 1, sort = 'newest', category = 'All', query = '' } = {}) {
  const [agents, setAgents] = useState([])
  const [totalRegistered, setTotalRegistered] = useState(null)
  const [filteredCount, setFilteredCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [totalX402, setTotalX402] = useState(0)
  const [totalVerified, setTotalVerified] = useState(0)
  const [categories, setCategories] = useState(['All'])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refresh = useCallback(async ({ sync = false } = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = new URL(`${getApiBase()}${AGENTS_API_PATH}`)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('page', String(page))
      url.searchParams.set('sort', sort)
      if (category && category !== 'All') url.searchParams.set('category', category)
      if (query.trim()) url.searchParams.set('q', query.trim())
      if (sync) url.searchParams.set('sync', '1')

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || `Agent directory HTTP ${response.status}`)
      }

      setAgents(Array.isArray(data?.agents) ? data.agents : [])
      setTotalRegistered(Number(data?.totalRegistered || 0))
      setFilteredCount(Number(data?.filteredCount || 0))
      setPageCount(Number(data?.pageCount || 1))
      setTotalX402(Number(data?.totalX402 || 0))
      setTotalVerified(Number(data?.totalVerified || 0))
      setCategories(Array.isArray(data?.categories) && data.categories.length ? data.categories : ['All'])
      setLastUpdated(data?.lastUpdated || Date.now())
    } catch (loadError) {
      console.warn('Could not load ERC-8004 agents:', loadError)
      setError(loadError?.message || 'Could not load ERC-8004 agents')
    } finally {
      setIsLoading(false)
    }
  }, [category, limit, page, query, sort])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    agents,
    totalRegistered,
    filteredCount,
    pageCount,
    totalX402,
    totalVerified,
    categories,
    isLoading,
    error,
    lastUpdated,
    refresh,
  }
}
