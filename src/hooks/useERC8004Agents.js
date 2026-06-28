import { useCallback, useEffect, useState } from 'react'

const DEFAULT_LIMIT = 30
const AGENTS_API_PATH = '/api/erc8004-agents'
const VIEWS_API_PATH = '/api/erc8004-agent-views'

function getApiBases() {
  if (typeof window === 'undefined') return ''
  const currentBase = window.location.origin.replace(/\/$/, '')
  const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
  const envBase = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/$/, '')
  const bases = isLocalhost
    ? [currentBase, envBase]
    : [currentBase, envBase, 'https://www.basehub.fun']
  return Array.from(new Set(bases.filter(Boolean)))
}

function buildApiUrl(base, path, params = {}) {
  const url = new URL(path, `${base || window.location.origin}/`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  return url
}

async function fetchJsonWithFallback(path, options = {}) {
  const { params, ...fetchOptions } = options
  const bases = getApiBases()
  let lastError = null

  for (const base of bases) {
    try {
      const response = await fetch(buildApiUrl(base, path, params).toString(), fetchOptions)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${response.status}`)
      }
      return data
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('API request failed')
}

export async function recordERC8004AgentView(agent) {
  if (typeof window === 'undefined' || !agent?.agentId) return null

  return fetchJsonWithFallback(VIEWS_API_PATH, {
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
      const data = await fetchJsonWithFallback(AGENTS_API_PATH, {
        params: {
          limit,
          page,
          sort,
          category: category && category !== 'All' ? category : '',
          q: query.trim(),
          sync: sync ? '1' : '',
        },
        headers: { Accept: 'application/json' },
      })

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
