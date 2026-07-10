import { useEffect, useState } from 'react'

const CACHE_KEY = 'basehub:eth-usd-price'
const CACHE_TTL_MS = 5 * 60 * 1000
export const DEFAULT_ETH_USD_PRICE = 3000

let cachedPrice = DEFAULT_ETH_USD_PRICE
let cachedAt = 0
let inFlight = null

function readStoredPrice() {
  if (typeof window === 'undefined') return
  try {
    const stored = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null')
    if (Number.isFinite(stored?.price) && stored.price > 0) {
      cachedPrice = stored.price
      cachedAt = Number(stored.updatedAt || 0)
    }
  } catch {
    /* use in-memory fallback */
  }
}

async function fetchEthUsdPrice() {
  if (Date.now() - cachedAt < CACHE_TTL_MS && cachedPrice > 0) return cachedPrice
  if (inFlight) return inFlight

  inFlight = fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`ETH price request failed (${response.status})`)
      return response.json()
    })
    .then((data) => {
      const price = Number(data?.ethereum?.usd)
      if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid ETH price response')
      cachedPrice = price
      cachedAt = Date.now()
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ price, updatedAt: cachedAt }))
      } catch {
        /* cache is optional */
      }
      return price
    })
    .finally(() => { inFlight = null })

  return inFlight
}

export function useEthUsdPrice() {
  const [price, setPrice] = useState(() => {
    readStoredPrice()
    return cachedPrice
  })
  const [isLive, setIsLive] = useState(Date.now() - cachedAt < CACHE_TTL_MS)

  useEffect(() => {
    let cancelled = false
    fetchEthUsdPrice()
      .then((nextPrice) => {
        if (!cancelled) {
          setPrice(nextPrice)
          setIsLive(true)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLive(false)
      })
    return () => { cancelled = true }
  }, [])

  return { price, isLive }
}

