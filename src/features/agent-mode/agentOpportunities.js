import { createPublicClient, fallback, http } from 'viem'
import { base } from 'viem/chains'
import { supabase } from '../../config/supabase.js'
import { AGENT_RPC_URL, AGENT_SWAPHUB_TOKENS, ERC20_BALANCE_ABI } from './agentConstants.js'

const BASE_CHAIN_ID = 8453
const MAX_DISCOVERY_SCAN = 320
const DEFAULT_ROTATION_SIZE = 24
const MIN_DISCOVERY_VARIETY = 10

function getAgentReadClient() {
  return createPublicClient({
    chain: base,
    transport: fallback([http(AGENT_RPC_URL, { timeout: 12000, retryCount: 1, retryDelay: 800 })], {
      rank: false,
      retryCount: 1,
      retryDelay: 800,
    }),
  })
}

function uniqueAddresses(items = []) {
  const seen = new Set()
  return items
    .map((item) => String(item || '').trim())
    .filter((item) => /^0x[a-fA-F0-9]{40}$/.test(item))
    .filter((item) => {
      const normalized = item.toLowerCase()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

function getItemKey(item) {
  return String(item?.address || item?.contract_address || item?.contractAddress || '').toLowerCase()
}

function shuffle(items = []) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }
  return copy
}

function getRotationSize(limit = DEFAULT_ROTATION_SIZE) {
  const numeric = Number(limit || DEFAULT_ROTATION_SIZE)
  if (!Number.isFinite(numeric)) return DEFAULT_ROTATION_SIZE
  return Math.max(MIN_DISCOVERY_VARIETY, Math.min(DEFAULT_ROTATION_SIZE, Math.floor(numeric)))
}

function getRecentTargetSet(logs = [], targetIds) {
  const allowedIds = new Set(Array.isArray(targetIds) ? targetIds : [targetIds])
  return new Set(
    (logs || [])
      .filter((entry) => allowedIds.has(entry?.targetId))
      .slice(0, 40)
      .map((entry) => String(entry?.payload?.pumpHubTokenAddress || entry?.payload?.contractAddress || '').toLowerCase())
      .filter(Boolean)
  )
}

function pickLeastRecent(items = [], recentSet) {
  const fresh = items.filter((item) => !recentSet.has(getItemKey(item)))
  const pool = fresh.length ? fresh : items
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

function pickManyLeastRecent(items = [], recentSet, limit = DEFAULT_ROTATION_SIZE) {
  const fresh = items.filter((item) => !recentSet.has(getItemKey(item)))
  const pool = fresh.length ? fresh : items
  return shuffle(pool).slice(0, getRotationSize(limit))
}

export async function resolvePumpHubOpportunities({ settings = {}, logs = [], limit = 6 }) {
  const recent = getRecentTargetSet(logs, ['pumphub-buy', 'pumphub-sell'])
  const desiredRotationSize = Math.max(MIN_DISCOVERY_VARIETY, Math.min(Number(settings?.dailyTxTarget || 24), DEFAULT_ROTATION_SIZE))

  if (!supabase?.from) return null
  const { data, error } = await supabase
    .from('pumphub_tokens')
    .select('token_address,name,symbol,graduated,created_at')
    .eq('graduated', false)
    .order('created_at', { ascending: false })
    .limit(MAX_DISCOVERY_SCAN)

  if (error) throw new Error(error.message || 'PumpHub opportunities could not be loaded.')
  return pickManyLeastRecent(
    (data || []).map((item) => ({ address: item.token_address, name: item.name, symbol: item.symbol, source: 'latest' })),
    recent,
    Math.max(limit, desiredRotationSize, MIN_DISCOVERY_VARIETY)
  )
}

export async function resolvePumpHubSellableOpportunities({ settings = {}, logs = [], walletAddress = '', limit = 6 }) {
  const holderAddress = String(walletAddress || settings?.walletAddress || '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(holderAddress)) return []

  const buyCandidates = await resolvePumpHubOpportunities({ settings, logs, limit }).catch(() => [])
  if (!buyCandidates.length) return []

  const client = getAgentReadClient()
  const checked = await Promise.all(
    buyCandidates.slice(0, Math.max(limit, MIN_DISCOVERY_VARIETY)).map(async (item) => {
      try {
        const balance = await client.readContract({
          address: item.address,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [holderAddress],
        })
        return balance > 0n ? item : null
      } catch {
        return null
      }
    })
  )

  return checked.filter(Boolean)
}

export async function resolvePumpHubOpportunity({ settings = {}, logs = [] }) {
  const opportunities = await resolvePumpHubOpportunities({ settings, logs, limit: 6 }).catch(() => [])
  const picked = pickLeastRecent(opportunities, new Set())
  return picked ? { address: picked.address, name: picked.name, symbol: picked.symbol, source: picked.source || 'latest' } : null
}

export async function resolveFreeMintOpportunities({ logs = [], limit = 6 }) {
  if (!supabase?.from) return null
  const recent = getRecentTargetSet(logs, 'free-nft-mint')
  const { data, error } = await supabase
    .from('nft_launchpad_collections')
    .select('contract_address,name,symbol,slug,mint_price,total_minted,supply,is_active,created_at,chain_id')
    .eq('is_active', true)
    .or(`chain_id.eq.${BASE_CHAIN_ID},chain_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(MAX_DISCOVERY_SCAN)

  if (error) throw new Error(error.message || 'Free NFT opportunities could not be loaded.')
  const freeCollections = (data || []).filter((item) => {
    const mintPrice = Number(item.mint_price || 0)
    const totalMinted = Number(item.total_minted || 0)
    const supply = Number(item.supply || 0)
    return mintPrice === 0 && item.contract_address && (supply === 0 || totalMinted < supply)
  })
  return pickManyLeastRecent(freeCollections, recent, Math.max(limit, DEFAULT_ROTATION_SIZE, MIN_DISCOVERY_VARIETY)).map((picked) => ({
    contractAddress: picked.contract_address,
    name: picked.name,
    symbol: picked.symbol,
    slug: picked.slug,
    source: 'launchpad-free',
  }))
}

export async function resolveFreeMintOpportunity({ logs = [] }) {
  const opportunities = await resolveFreeMintOpportunities({ logs, limit: 6 }).catch(() => [])
  const picked = pickLeastRecent(
    opportunities.map((item) => ({ contract_address: item.contractAddress, ...item })),
    new Set()
  )
  if (!picked) return null
  return {
    contractAddress: picked.contractAddress,
    name: picked.name,
    symbol: picked.symbol,
    slug: picked.slug,
    source: picked.source || 'launchpad-free',
  }
}

export async function resolveSwapHubOpportunities({ logs = [], limit = 12 }) {
  const recent = getRecentTargetSet(logs, 'swaphub-swap')
  const candidates = AGENT_SWAPHUB_TOKENS.filter((token) => token.address && token.address !== '0x0000000000000000000000000000000000000000')
  return pickManyLeastRecent(
    candidates.map((item) => ({
      address: item.address,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals,
      source: 'swaphub-defaults',
    })),
    recent,
    Math.max(limit, MIN_DISCOVERY_VARIETY)
  )
}

export async function resolveSwapHubOpportunity({ logs = [] }) {
  const opportunities = await resolveSwapHubOpportunities({ logs, limit: MIN_DISCOVERY_VARIETY }).catch(() => [])
  const picked = pickLeastRecent(opportunities, new Set())
  return picked
    ? {
        address: picked.address,
        symbol: picked.symbol,
        name: picked.name,
        decimals: picked.decimals,
        source: picked.source || 'swaphub-defaults',
      }
    : null
}
