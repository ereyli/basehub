// x402 Wallet Analysis Endpoint for BaseHub using Hono
// Accepts 0.40 USDC payments, or 0.20 USDC for BaseHub Pass holders, using Coinbase x402 on Base network
// Provides fun and useful wallet analysis on multiple networks

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createX402PaymentMiddleware, createX402Route, getFacilitatorConfig } from './_x402BuilderCode.js'
import { ANALYSIS_PASS_DISCOUNT_PERCENT, enforceAnalysisPassDiscount, isPassDiscountRequest } from './_analysisPassDiscount.js'

const app = new Hono()

// ==========================================
// Configuration
// ==========================================

const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.40' // 0.40 USDC
const PASS_PRICE = '$0.20' // 50% BaseHub Pass discount
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC

function getConfiguredApiKey(...values) {
  const invalidMarkers = ['your_', 'replace_', 'placeholder', 'example', 'changeme']
  for (const value of values) {
    const key = String(value || '').trim()
    if (!key) continue
    const normalized = key.toLowerCase()
    if (invalidMarkers.some((marker) => normalized.includes(marker))) continue
    return key
  }
  return ''
}

// Use env only – no fallback in repo (best practice for secrets)
const API_KEYS = {
  // Etherscan API V2 uses one account key across supported chains.
  ETHERSCAN: getConfiguredApiKey(process.env.ETHERSCAN_API_KEY, process.env.BASESCAN_API_KEY),
  ALCHEMY: getConfiguredApiKey(process.env.ALCHEMY_API_KEY),
  MORALIS: getConfiguredApiKey(process.env.MORALIS_API_KEY),
  GOLDRUSH: getConfiguredApiKey(process.env.GOLDRUSH_API_KEY, process.env.COVALENT_API_KEY),
}

const ALCHEMY_BASE_RPC_URL = API_KEYS.ALCHEMY
  ? (process.env.ALCHEMY_BASE_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`)
  : ''
const BASE_NATIVE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const BASE_REPORT_CACHE_TTL_MS = 5 * 60 * 1000
const BASE_REPORT_CACHE = new Map()
const BASE_REPORT_IN_FLIGHT = new Map()
const BASE_DETAIL_PAGE_SIZE = 1000
const BASE_BLOCKSCOUT_API_URL = process.env.BASE_BLOCKSCOUT_API_URL || 'https://base.blockscout.com/api'
const GOLDRUSH_API_BASE_URL = process.env.GOLDRUSH_API_BASE_URL || 'https://api.covalenthq.com/v1'

// Supported networks for wallet analysis (all have free API access)
const SUPPORTED_NETWORKS = {
  'base': { chainId: 8453, name: 'Base Mainnet', currency: 'ETH' },
  'katana': { chainId: 747474, name: 'Katana Mainnet', currency: 'KATANA' },
  'opbnb': { chainId: 204, name: 'opBNB Mainnet', currency: 'BNB' },
  'polygon': { chainId: 137, name: 'Polygon Mainnet', currency: 'MATIC' },
  'sei': { chainId: 1329, name: 'Sei Mainnet', currency: 'SEI' },
  'stable': { chainId: 988, name: 'Stable Mainnet', currency: 'STABLE' },
  'ethereum': { chainId: 1, name: 'Ethereum Mainnet', currency: 'ETH' },
  'arbitrum': { chainId: 42161, name: 'Arbitrum One', currency: 'ETH' },
  'abstract': { chainId: 2741, name: 'Abstract Mainnet', currency: 'ETH' },
  'celo': { chainId: 42220, name: 'Celo Mainnet', currency: 'CELO' },
  'hyperevm': { chainId: 999, name: 'HyperEVM Mainnet', currency: 'ETH' },
  'linea': { chainId: 59144, name: 'Linea Mainnet', currency: 'ETH' },
  'monad': { chainId: 143, name: 'Monad Mainnet', currency: 'MONAD' },
  'sonic': { chainId: 146, name: 'Sonic Mainnet', currency: 'S' },
  'zksync': { chainId: 324, name: 'zkSync Mainnet', currency: 'ETH' },
}

// Log API key status (first 10 chars only for security)
if (API_KEYS.ETHERSCAN) {
  console.log('✅ Etherscan API V2 key loaded from environment:', `${API_KEYS.ETHERSCAN.substring(0, 10)}...`)
} else {
  console.warn('⚠️ ETHERSCAN_API_KEY/BASESCAN_API_KEY not set – non-Base wallet reports will be unavailable')
}

if (!API_KEYS.ALCHEMY) {
  console.warn('⚠️ ALCHEMY_API_KEY is required for Base wallet reports')
}

if (API_KEYS.GOLDRUSH) {
  console.log('✅ GoldRush API key loaded for exact Base wallet summaries')
} else {
  console.warn('⚠️ GOLDRUSH_API_KEY/COVALENT_API_KEY not set – exact Base tx count will use explorer fallbacks only')
}

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = getFacilitatorConfig()
  console.log('✅ Using CDP facilitator for Base mainnet')
} else {
  facilitatorConfig = getFacilitatorConfig()
  console.log('⚠️  WARNING: No CDP API keys found!')
}

// ==========================================
// CORS middleware
// ==========================================
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT', 'PAYMENT-SIGNATURE'],
  exposeHeaders: ['X-PAYMENT-RESPONSE', 'PAYMENT-RESPONSE', 'PAYMENT-REQUIRED'],
  maxAge: 86400,
}))

// ==========================================
// Health check endpoint
// ==========================================
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Wallet Analysis',
    price: PRICE,
    passPrice: PASS_PRICE,
    passDiscountPercent: ANALYSIS_PASS_DISCOUNT_PERCENT,
    paymentNetwork: NETWORK,
    supportedAnalysisNetworks: Object.keys(SUPPORTED_NETWORKS),
  })
})

// ==========================================
// Apply x402 payment middleware (Base network)
// ==========================================
app.use(
  createX402PaymentMiddleware(
    {
      'POST /': createX402Route({
        price: PRICE,
        network: NETWORK,
        payTo: RECEIVING_ADDRESS,
        description: 'BaseHub Wallet Analysis - Pay 0.40 USDC on Base',
        maxTimeoutSeconds: 600,
      }),
    },
    facilitatorConfig
  )
)

const passApp = new Hono()

passApp.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT', 'PAYMENT-SIGNATURE'],
  exposeHeaders: ['X-PAYMENT-RESPONSE', 'PAYMENT-RESPONSE', 'PAYMENT-REQUIRED'],
  maxAge: 86400,
}))

passApp.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Wallet Analysis',
    price: PASS_PRICE,
    standardPrice: PRICE,
    passDiscountPercent: ANALYSIS_PASS_DISCOUNT_PERCENT,
    paymentNetwork: NETWORK,
    supportedAnalysisNetworks: Object.keys(SUPPORTED_NETWORKS),
  })
})

passApp.use(async (c, next) => {
  if (c.req.method === 'POST') {
    const response = await enforceAnalysisPassDiscount(c)
    if (response) return response
  }
  return next()
})

passApp.use(
  createX402PaymentMiddleware(
    {
      'POST /': createX402Route({
        price: PASS_PRICE,
        network: NETWORK,
        payTo: RECEIVING_ADDRESS,
        description: 'BaseHub Wallet Analysis - BaseHub Pass holder price 0.20 USDC on Base',
        maxTimeoutSeconds: 600,
      }),
    },
    facilitatorConfig
  )
)

// ==========================================
// Helper functions
// ==========================================

function formatEtherValue(value) {
  if (!value || value === '0') return '0.0000'
  try {
    const wei = BigInt(value)
    const eth = Number(wei) / 1e18
    return eth.toFixed(6)
  } catch (error) {
    return '0.0000'
  }
}

function formatTokenValue(value, decimals = 18) {
  if (!value || value === '0') return '0.0000'
  try {
    const amount = BigInt(value)
    const divisor = 10n ** BigInt(Math.max(0, Math.min(36, decimals)))
    const result = Number(amount) / Number(divisor)
    return result.toFixed(4)
  } catch (error) {
    return '0.0000'
  }
}

function hideApiKeyInUrl(url, key) {
  if (!key) return url
  return url.replace(key, 'API_KEY_HIDDEN')
}

function isNoIndexedDataMessage(message = '') {
  const normalized = String(message).toLowerCase()
  return normalized.includes('no transactions found') ||
    normalized.includes('no records found') ||
    normalized.includes('no token transfer events found')
}

function isProviderFailureMessage(message = '') {
  const normalized = String(message).toLowerCase()
  return normalized.includes('invalid api key') ||
    normalized.includes('missing/invalid api key') ||
    normalized.includes('unsupported chain') ||
    normalized.includes('chainid') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('not configured') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('not supported')
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatTokenAmount(value, decimals = 18, maxDecimals = 6) {
  if (!value || value === '0' || value === '0x0') return '0'
  try {
    const raw = typeof value === 'string' && value.startsWith('0x') ? BigInt(value) : BigInt(String(value))
    const safeDecimals = Math.max(0, Math.min(36, Number(decimals) || 0))
    const divisor = 10n ** BigInt(safeDecimals)
    const whole = raw / divisor
    const fraction = raw % divisor
    if (fraction === 0n || maxDecimals === 0) return whole.toString()
    const padded = fraction.toString().padStart(safeDecimals, '0').slice(0, maxDecimals)
    const trimmed = padded.replace(/0+$/, '')
    return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString()
  } catch (error) {
    return '0'
  }
}

function formatCompactNumber(value, decimals = 1) {
  const number = safeNumber(value)
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(decimals)}M`
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(decimals)}K`
  if (Math.abs(number) >= 1) return number.toFixed(decimals)
  return number.toFixed(4)
}

function normalizeGoldRushGasValue(value, decimals = 18) {
  if (value === null || value === undefined || value === '') return null
  const asString = String(value)
  if (asString.includes('.')) {
    const parsed = Number(asString)
    return Number.isFinite(parsed) ? parsed : null
  }
  const formatted = formatTokenAmount(asString, decimals, 8)
  const parsed = Number(formatted)
  return Number.isFinite(parsed) ? parsed : null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryDelayMs(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 4000)
  }
  return Math.min(4000, (2 ** attempt) * 600 + Math.floor(Math.random() * 300))
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function getEventTimestamp(event) {
  return event?.timeStamp ? safeNumber(event.timeStamp, 0) : safeNumber(event?.timestamp || event?.blockTimestamp, 0)
}

function getLongestDailyStreak(dayKeys) {
  const sorted = [...new Set(dayKeys)].sort()
  let longest = 0
  let current = 0
  let previousTime = null

  sorted.forEach((day) => {
    const time = Date.parse(`${day}T00:00:00.000Z`)
    if (!Number.isFinite(time)) return
    current = previousTime !== null && time - previousTime === 24 * 60 * 60 * 1000 ? current + 1 : 1
    longest = Math.max(longest, current)
    previousTime = time
  })

  return longest
}

function compactAddress(address) {
  if (!address || String(address).length < 12) return address || ''
  const value = String(address)
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

async function fetchJsonWithRetry(url, options = {}, retryOptions = {}) {
  const maxAttempts = Math.max(1, retryOptions.maxAttempts || 3)
  const provider = retryOptions.provider || 'API'
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options)
      if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts - 1) {
        lastError = new Error(`${provider} HTTP ${response.status}`)
        await sleep(getRetryDelayMs(response, attempt))
        continue
      }
      if (!response.ok) throw new Error(`${provider} HTTP ${response.status}`)
      return response.json()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts - 1) {
        await sleep(getRetryDelayMs(null, attempt))
        continue
      }
    }
  }

  throw lastError || new Error(`${provider} request failed`)
}

async function rpcCall(method, params = [], options = {}) {
  const rpcUrl = options.rpcUrl || BASE_NATIVE_RPC_URL
  const maxAttempts = Math.max(1, options.maxAttempts || 1)
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    })

    if (response.status === 429 && attempt < maxAttempts - 1) {
      lastError = new Error(`RPC rate limited: ${response.status}`)
      await sleep(getRetryDelayMs(response, attempt))
      continue
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`RPC error: ${response.status}${errorText ? ` ${errorText.slice(0, 180)}` : ''}`)
    }

    const data = await response.json()
    if (data.error) {
      if (data.error.code === 429 && attempt < maxAttempts - 1) {
        lastError = new Error(data.error.message || 'RPC rate limited')
        await sleep(getRetryDelayMs(response, attempt))
        continue
      }
      throw new Error(data.error.message || 'RPC returned an error')
    }

    return data.result
  }

  throw lastError || new Error('RPC request failed')
}

async function alchemyRpcCall(method, params = []) {
  if (!ALCHEMY_BASE_RPC_URL) throw new Error('Base Alchemy provider is not configured')
  return rpcCall(method, params, {
    rpcUrl: ALCHEMY_BASE_RPC_URL,
    maxAttempts: 3,
  })
}

async function fetchBaseNativeBalance(walletAddress) {
  try {
    const balanceHex = await rpcCall('eth_getBalance', [walletAddress, 'latest'], {
      rpcUrl: BASE_NATIVE_RPC_URL,
      maxAttempts: 3,
    })
    return formatTokenAmount(balanceHex, 18, 6)
  } catch (error) {
    console.warn('⚠️ Base native balance fallback failed:', error.message)
    return '0.0000'
  }
}

async function fetchEtherscanAccountAction(chainId, action, params = {}) {
  if (!API_KEYS.ETHERSCAN) return null
  const query = new URLSearchParams({
    chainid: String(chainId),
    module: 'account',
    action,
    apikey: API_KEYS.ETHERSCAN,
    ...params,
  })
  const url = `https://api.etherscan.io/v2/api?${query.toString()}`
  const data = await fetchJsonWithRetry(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'BaseHub-WalletAnalysis/2.0',
    },
  }, { provider: 'Etherscan API' })
  if (data.status === '1' && Array.isArray(data.result)) return data.result
  if (data.status === '1') return data.result
  const message = `${data.message || 'NOTOK'} ${data.result || ''}`.trim()
  throw new Error(message || `Etherscan ${action} unavailable`)
}

async function fetchBaseScanAnchor(action, walletAddress, sort = 'asc') {
  const items = await fetchEtherscanAccountAction(8453, action, {
    address: walletAddress,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: '1',
    sort,
  })
  return normalizeExplorerEvent(Array.isArray(items) ? items[0] : null, 'BaseScan', action === 'tokentx' ? 'token' : 'native')
}

async function fetchBaseScanDetailedHistory(walletAddress) {
  if (!API_KEYS.ETHERSCAN) {
    return {
      normalTransactions: [],
      tokenTransfers: [],
      source: null,
      hasMore: false,
      errors: ['Etherscan API key is not configured'],
    }
  }

  const commonParams = {
    address: walletAddress,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: String(BASE_DETAIL_PAGE_SIZE),
    sort: 'desc',
  }

  const [txResult, tokenResult] = await Promise.allSettled([
    fetchEtherscanAccountAction(8453, 'txlist', commonParams),
    fetchEtherscanAccountAction(8453, 'tokentx', commonParams),
  ])

  const errors = []
  const normalTransactions = txResult.status === 'fulfilled' && Array.isArray(txResult.value)
    ? txResult.value.map((tx) => normalizeExplorerTransaction(tx, 'BaseScan'))
    : []
  const tokenTransfers = tokenResult.status === 'fulfilled' && Array.isArray(tokenResult.value)
    ? tokenResult.value.map((tx) => normalizeExplorerTokenTransfer(tx, 'BaseScan', 'erc20'))
    : []

  if (txResult.status === 'rejected') errors.push(`BaseScan txlist: ${txResult.reason?.message || 'request failed'}`)
  if (tokenResult.status === 'rejected') errors.push(`BaseScan tokentx: ${tokenResult.reason?.message || 'request failed'}`)

  return {
    normalTransactions,
    tokenTransfers,
    source: normalTransactions.length || tokenTransfers.length ? 'BaseScan' : null,
    hasMore: normalTransactions.length >= BASE_DETAIL_PAGE_SIZE || tokenTransfers.length >= BASE_DETAIL_PAGE_SIZE,
    errors,
  }
}

function normalizeExplorerEvent(tx, source, kind) {
  const timestamp = safeNumber(tx?.timeStamp || tx?.timestamp || tx?.blockTimestamp, 0)
  if (!timestamp || !tx?.hash) return null
  return {
    hash: tx.hash,
    timestamp,
    date: new Date(timestamp * 1000),
    source,
    kind,
  }
}

function normalizeExplorerTransaction(tx, source) {
  return {
    hash: tx?.hash || tx?.tx_hash || tx?.transaction_hash,
    timeStamp: tx?.timeStamp || tx?.timestamp || tx?.blockTimestamp || null,
    from: tx?.from || tx?.from_address || '',
    to: tx?.to || tx?.to_address || '',
    value: tx?.value || '0',
    gas: tx?.gas || tx?.gasLimit || '0',
    gasUsed: tx?.gasUsed || tx?.gas_used || tx?.gas_used_by_transaction || '0',
    gasPrice: tx?.gasPrice || tx?.gas_price || '0',
    category: 'external',
    contractAddress: tx?.contractAddress || '',
    tokenSymbol: '',
    tokenDecimal: '18',
    source,
  }
}

function normalizeExplorerTokenTransfer(tx, source, category = 'erc20') {
  const rawTokenValue = tx?.value || tx?.token?.value || '0'
  const decimals = tx?.tokenDecimal || tx?.tokenDecimals || tx?.token?.decimals || tx?.decimals || (category === 'erc20' ? '18' : '0')
  const symbol = tx?.tokenSymbol || tx?.token?.symbol || tx?.symbol || (category === 'erc20' ? 'TOKEN' : 'NFT')
  return {
    hash: tx?.hash || tx?.tx_hash || tx?.transaction_hash,
    timeStamp: tx?.timeStamp || tx?.timestamp || tx?.blockTimestamp || null,
    from: tx?.from || tx?.from_address || '',
    to: tx?.to || tx?.to_address || '',
    value: '0',
    category,
    contractAddress: tx?.contractAddress || tx?.tokenAddress || tx?.token?.address || '',
    tokenSymbol: symbol,
    tokenDecimal: String(decimals),
    tokenAmount: formatTokenAmount(rawTokenValue, safeNumber(decimals, category === 'erc20' ? 18 : 0), 6),
    source,
  }
}

function normalizeIsoEvent(item, source, kind) {
  const iso = item?.block_signed_at || item?.timestamp || item?.block_timestamp
  const hash = item?.tx_hash || item?.hash
  if (!iso || !hash) return null
  const date = new Date(iso)
  const timestamp = Math.floor(date.getTime() / 1000)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null
  return {
    hash,
    timestamp,
    date,
    source,
    kind,
  }
}

async function fetchGoldRushActivitySummary(walletAddress) {
  if (!API_KEYS.GOLDRUSH) {
    return {
      first: null,
      last: null,
      totalTransactions: null,
      source: null,
      errors: ['GoldRush API key is not configured'],
    }
  }

  const query = new URLSearchParams({
    'quote-currency': 'USD',
    'with-gas': 'true',
    key: API_KEYS.GOLDRUSH,
  })
  const url = `${GOLDRUSH_API_BASE_URL}/base-mainnet/address/${walletAddress}/transactions_summary/?${query.toString()}`
  const data = await fetchJsonWithRetry(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'BaseHub-WalletAnalysis/2.1',
    },
  }, { provider: 'GoldRush summary' })
  if (data.error) throw new Error(data.error_message || data.error_code || 'GoldRush summary unavailable')
  const item = data.data?.items?.[0]
  if (!item) return { first: null, last: null, totalTransactions: null, gasSpentEth: null, gasSpentUSD: null, source: 'GoldRush', errors: [] }

  const gasSummary = item.gas_summary || {}
  const gasDecimals = safeNumber(gasSummary.gas_metadata?.contract_decimals, 18)
  const gasSpentEth = normalizeGoldRushGasValue(gasSummary.total_fees_paid, gasDecimals)
  const gasSpentUSD = Number.isFinite(Number(gasSummary.total_gas_quote)) ? Number(gasSummary.total_gas_quote) : null

  return {
    first: normalizeIsoEvent(item.earliest_transaction, 'GoldRush', 'summary'),
    last: normalizeIsoEvent(item.latest_transaction, 'GoldRush', 'summary'),
    totalTransactions: Number.isFinite(Number(item.total_count)) ? Number(item.total_count) : null,
    transferCount: Number.isFinite(Number(item.transfer_count)) ? Number(item.transfer_count) : null,
    gasSpentEth,
    gasSpentUSD,
    source: 'GoldRush',
    errors: [],
  }
}

async function fetchBlockscoutAccountAction(action, walletAddress, sort = 'asc', offset = 1) {
  const query = new URLSearchParams({
    module: 'account',
    action,
    address: walletAddress,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: String(offset),
    sort,
  })
  const data = await fetchJsonWithRetry(`${BASE_BLOCKSCOUT_API_URL}?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'BaseHub-WalletAnalysis/2.1',
    },
  }, { provider: `Blockscout ${action}` })
  const message = `${data.message || ''} ${typeof data.result === 'string' ? data.result : ''}`.trim()
  if (data.status === '1' && Array.isArray(data.result)) return data.result
  if (isNoIndexedDataMessage(message)) return []
  if (data.message === 'OK' && Array.isArray(data.result)) return data.result
  throw new Error(message || `Blockscout ${action} unavailable`)
}

async function fetchBlockscoutDetailedHistory(walletAddress) {
  const [txResult, tokenResult] = await Promise.allSettled([
    fetchBlockscoutAccountAction('txlist', walletAddress, 'desc', BASE_DETAIL_PAGE_SIZE),
    fetchBlockscoutAccountAction('tokentx', walletAddress, 'desc', BASE_DETAIL_PAGE_SIZE),
  ])

  const errors = []
  const normalTransactions = txResult.status === 'fulfilled' && Array.isArray(txResult.value)
    ? txResult.value.map((tx) => normalizeExplorerTransaction(tx, 'Blockscout'))
    : []
  const tokenTransfers = tokenResult.status === 'fulfilled' && Array.isArray(tokenResult.value)
    ? tokenResult.value.map((tx) => normalizeExplorerTokenTransfer(tx, 'Blockscout', 'erc20'))
    : []

  if (txResult.status === 'rejected') errors.push(`Blockscout txlist: ${txResult.reason?.message || 'request failed'}`)
  if (tokenResult.status === 'rejected') errors.push(`Blockscout tokentx: ${tokenResult.reason?.message || 'request failed'}`)

  return {
    normalTransactions,
    tokenTransfers,
    source: normalTransactions.length || tokenTransfers.length ? 'Blockscout' : null,
    hasMore: normalTransactions.length >= BASE_DETAIL_PAGE_SIZE || tokenTransfers.length >= BASE_DETAIL_PAGE_SIZE,
    errors,
  }
}

async function fetchBaseVerifiedActivityAnchors(walletAddress) {
  const goldRushSettled = await Promise.allSettled([fetchGoldRushActivitySummary(walletAddress)])
  const goldRush = goldRushSettled[0].status === 'fulfilled' ? goldRushSettled[0].value : null
  const goldRushErrors = goldRushSettled[0].status === 'rejected'
    ? [goldRushSettled[0].reason?.message || 'GoldRush request failed']
    : (goldRush?.errors || [])

  const baseScanChecks = API_KEYS.ETHERSCAN ? [
    fetchBaseScanAnchor('txlist', walletAddress, 'asc'),
    fetchBaseScanAnchor('txlist', walletAddress, 'desc'),
    fetchBaseScanAnchor('tokentx', walletAddress, 'asc'),
    fetchBaseScanAnchor('tokentx', walletAddress, 'desc'),
  ] : []

  const blockscoutChecks = [
    fetchBlockscoutAccountAction('txlist', walletAddress, 'asc').then((items) => normalizeExplorerEvent(items[0], 'Blockscout', 'native')),
    fetchBlockscoutAccountAction('txlist', walletAddress, 'desc').then((items) => normalizeExplorerEvent(items[0], 'Blockscout', 'native')),
    fetchBlockscoutAccountAction('tokentx', walletAddress, 'asc').then((items) => normalizeExplorerEvent(items[0], 'Blockscout', 'token')),
    fetchBlockscoutAccountAction('tokentx', walletAddress, 'desc').then((items) => normalizeExplorerEvent(items[0], 'Blockscout', 'token')),
  ]

  const settled = await Promise.allSettled([...baseScanChecks, ...blockscoutChecks])
  const events = settled
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value)
  const errors = settled
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Blockscout request failed')
    .concat(goldRushErrors)

  if (goldRush?.first) events.push(goldRush.first)
  if (goldRush?.last) events.push(goldRush.last)

  const first = events.length
    ? events.reduce((oldest, event) => event.timestamp < oldest.timestamp ? event : oldest, events[0])
    : null
  const last = events.length
    ? events.reduce((newest, event) => event.timestamp > newest.timestamp ? event : newest, events[0])
    : null

  return {
    first,
    last,
    verified: Boolean(first || last),
    source: [
      goldRush?.source && (goldRush.first || goldRush.last || goldRush.totalTransactions !== null) ? goldRush.source : null,
      API_KEYS.ETHERSCAN ? 'BaseScan' : null,
      events.some((event) => event.source === 'Blockscout') ? 'Blockscout' : null,
    ].filter(Boolean).join(', ') || null,
    exactTransactionCount: goldRush?.totalTransactions ?? null,
    exactTransactionCountSource: goldRush?.totalTransactions !== null && goldRush?.totalTransactions !== undefined ? 'GoldRush' : null,
    transferCount: goldRush?.transferCount ?? null,
    gasSpentEth: goldRush?.gasSpentEth ?? null,
    gasSpentUSD: goldRush?.gasSpentUSD ?? null,
    gasSummarySource: goldRush?.gasSpentEth !== null && goldRush?.gasSpentEth !== undefined ? 'GoldRush' : null,
    errors,
  }
}

const BASE_PROTOCOLS = [
  { name: 'Uniswap', category: 'DEX', addresses: ['0x2626664c2603336e57b271c5c0b26f421741e481', '0x6ff5693b99212da76ad316178a184ab56d299b43'] },
  { name: 'Aerodrome', category: 'DEX', addresses: ['0xcf77a3ba9a5ca399b7c97c74d54e5b4ba85243e1'] },
  { name: 'Base Bridge', category: 'Bridge', addresses: ['0x4200000000000000000000000000000000000010'] },
  { name: 'Zora', category: 'NFT/Mint', addresses: ['0x777777c338d93e2c7adf08d102d45ca7cc4ed021'] },
  { name: 'BaseHub', category: 'BaseHub', addresses: [
    '0xc3ea6f7b014c6d9c4c421ba5bcea3bd25f97f623',
    '0xecd289ea7ab254bd53062a26f377f146a624f133',
    '0x9be475499498f0e07bc3d89a91d8de1b97a036b6',
    '0x48ff955604a44d5dbbfae6c0fd8924cb99d46ef0',
    '0xb8c1d2c73ec319b9484944c4e1ea7c1cc93ec2c2',
    '0xbdae561fcad053902402f3d000cabc9806a6f3c1',
    '0xdc7ee816aeb2879a7b15bb7950638840f8695917',
    '0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21',
  ] },
]

const BASE_PROTOCOL_LOOKUP = BASE_PROTOCOLS.reduce((acc, protocol) => {
  protocol.addresses.forEach((address) => {
    acc[address.toLowerCase()] = { name: protocol.name, category: protocol.category }
  })
  return acc
}, {})

const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDBC', 'DAI', 'USDT'])
const BLUECHIP_SYMBOLS = new Set(['WETH', 'ETH', 'CBETH', 'AERO', 'DEGEN', 'BRETT', 'MORPHO'])

function classifyInteraction({ to, contractAddress, tokenSymbol, category }) {
  const direct = to ? BASE_PROTOCOL_LOOKUP[to.toLowerCase()] : null
  if (direct) return direct

  const contract = contractAddress ? contractAddress.toLowerCase() : ''
  if (contract === USDC_ADDRESS.toLowerCase() || STABLECOIN_SYMBOLS.has(String(tokenSymbol || '').toUpperCase())) {
    return { name: 'Stablecoin Flow', category: 'Stablecoin' }
  }
  if (category === 'erc721' || category === 'erc1155') {
    return { name: 'NFT Activity', category: 'NFT/Mint' }
  }
  if (BLUECHIP_SYMBOLS.has(String(tokenSymbol || '').toUpperCase())) {
    return { name: `${String(tokenSymbol).toUpperCase()} Activity`, category: 'Token' }
  }
  return { name: 'Onchain Activity', category: 'General' }
}

async function fetchAlchemyTransfers(walletAddress) {
  if (!API_KEYS.ALCHEMY) return { transfers: [], source: null }
  const directions = [
    { key: 'fromAddress', value: walletAddress },
    { key: 'toAddress', value: walletAddress },
  ]
  const transfers = []
  const seen = new Set()
  let hasMore = false

  for (const direction of directions) {
    let pageKey = null
    for (let page = 0; page < 2; page++) {
      const params = {
        fromBlock: '0x0',
        toBlock: 'latest',
        category: ['external', 'erc20', 'erc721', 'erc1155'],
        withMetadata: true,
        excludeZeroValue: false,
        maxCount: '0x1f4',
        [direction.key]: direction.value,
      }
      if (pageKey) params.pageKey = pageKey

      const result = await alchemyRpcCall('alchemy_getAssetTransfers', [params])
      const batch = result?.transfers || []

      batch.forEach((transfer) => {
        const fingerprint = `${transfer.hash}-${transfer.category}-${transfer.from}-${transfer.to}-${transfer.rawContract?.address || ''}-${transfer.rawContract?.value || transfer.value || ''}`
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint)
          transfers.push(transfer)
        }
      })

      pageKey = result?.pageKey
      if (pageKey && page === 1) hasMore = true
      if (!pageKey) break
    }
  }

  return { transfers, source: 'Alchemy', hasMore }
}

async function fetchMoralisHistory(walletAddress) {
  if (!API_KEYS.MORALIS) return { transactions: [], source: null }
  const url = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/history?chain=base&limit=100&order=DESC`
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-API-Key': API_KEYS.MORALIS,
      'User-Agent': 'BaseHub-WalletAnalysis/2.0',
    },
  })
  if (!response.ok) throw new Error(`Moralis history error: ${response.status}`)
  const data = await response.json()
  return { transactions: data.result || [], source: 'Moralis' }
}

async function fetchAlchemyTokenBalances(walletAddress) {
  if (!API_KEYS.ALCHEMY) return []
  const balances = await alchemyRpcCall('alchemy_getTokenBalances', [walletAddress])
  const tokenBalances = (balances?.tokenBalances || [])
    .filter((token) => token.tokenBalance && token.tokenBalance !== '0x0')
    .slice(0, 12)

  return Promise.all(tokenBalances.map(async (token) => {
    try {
      const metadata = await alchemyRpcCall('alchemy_getTokenMetadata', [token.contractAddress])
      const decimals = safeNumber(metadata?.decimals, 18)
      return {
        address: token.contractAddress.toLowerCase(),
        symbol: metadata?.symbol || 'TOKEN',
        balance: formatTokenAmount(token.tokenBalance, decimals, 4),
        decimals,
      }
    } catch (error) {
      return {
        address: token.contractAddress.toLowerCase(),
        symbol: 'TOKEN',
        balance: '0',
        decimals: 18,
      }
    }
  }))
}

function normalizeAlchemyTransfer(transfer) {
  const timestamp = transfer.metadata?.blockTimestamp
    ? Math.floor(new Date(transfer.metadata.blockTimestamp).getTime() / 1000)
    : null
  const decimals = safeNumber(transfer.rawContract?.decimal, transfer.category === 'erc20' ? 18 : 0)
  const rawValue = transfer.rawContract?.value
  const tokenAmount = rawValue ? formatTokenAmount(rawValue, decimals, 6) : String(transfer.value || '0')

  return {
    hash: transfer.hash,
    timeStamp: timestamp ? String(timestamp) : null,
    from: transfer.from,
    to: transfer.to,
    value: transfer.category === 'external' && transfer.value ? String(Math.round(safeNumber(transfer.value) * 1e18)) : '0',
    category: transfer.category,
    contractAddress: transfer.rawContract?.address || '',
    tokenSymbol: transfer.asset || '',
    tokenDecimal: String(decimals),
    tokenAmount,
  }
}

function normalizeMoralisHistoryItem(item) {
  const timestamp = item.block_timestamp
    ? Math.floor(new Date(item.block_timestamp).getTime() / 1000)
    : safeNumber(item.block_timestamp, null)
  return {
    hash: item.hash || item.transaction_hash,
    timeStamp: timestamp ? String(timestamp) : null,
    from: item.from_address || item.from,
    to: item.to_address || item.to,
    value: item.value || '0',
    category: item.category || item.transaction_category || 'transaction',
    contractAddress: item.address || item.token_address || '',
    tokenSymbol: item.token_symbol || item.asset || '',
    tokenDecimal: String(item.token_decimals || 18),
    summary: item.summary || item.label || '',
  }
}

function mergeUniqueEvents(existingEvents, newEvents, fallbackSource = '') {
  const seen = new Set(existingEvents.map((event) => [
    event.hash || '',
    event.category || '',
    String(event.contractAddress || '').toLowerCase(),
    event.value || event.tokenAmount || '',
  ].join(':')))

  newEvents.forEach((event) => {
    if (!event?.hash) return
    const fingerprint = [
      event.hash || '',
      event.category || '',
      String(event.contractAddress || '').toLowerCase(),
      event.value || event.tokenAmount || '',
    ].join(':')
    if (seen.has(fingerprint)) return
    seen.add(fingerprint)
    existingEvents.push({
      ...event,
      source: event.source || fallbackSource,
    })
  })
}

function addUniqueSource(dataSources, source) {
  if (source && !dataSources.includes(source)) dataSources.push(source)
}

function buildBaseReport(walletAddress, nativeBalance, normalTransactions, tokenTransfers, tokenBalances, dataSources, options = {}) {
  const activityAnchors = options.activityAnchors || {}
  const coverage = options.coverage || {}
  const providerIssues = options.providerIssues || []
  const normalizedWallet = String(walletAddress || '').toLowerCase()
  const events = [...normalTransactions, ...tokenTransfers]
    .filter((event) => event && event.hash)
    .map((event) => ({
      ...event,
      from: event.from || event.from_address || '',
      to: event.to || event.to_address || '',
      timeStamp: event.timeStamp || event.timestamp || event.blockTimestamp || null,
      contractAddress: event.contractAddress || event.rawContract?.address || '',
      tokenSymbol: event.tokenSymbol || event.token?.symbol || event.asset || '',
    }))

  const hashSet = new Set(events.map((event) => event.hash).filter(Boolean))
  const indexedEventCount = Math.max(normalTransactions.length, hashSet.size)
  const exactTransactionCount = Number.isFinite(Number(activityAnchors.exactTransactionCount))
    ? Number(activityAnchors.exactTransactionCount)
    : null
  const totalTransactions = exactTransactionCount ?? indexedEventCount

  const datedEvents = events
    .map((event) => {
      const timestamp = getEventTimestamp(event)
      return timestamp ? { ...event, timestamp, date: new Date(timestamp * 1000) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)

  const dayCounts = {}
  const weekCounts = {}
  const monthCounts = {}
  const dayHashes = {}
  const weekHashes = {}
  const monthHashes = {}
  const recent30Hashes = new Set()
  const protocolCounts = {}
  const categoryCounts = {}
  const tokenMap = new Map()
  const contractMap = new Map()
  const methodCounts = {}
  let nativeMovedEth = 0
  let gasSpentEth = 0
  let gasSpentUSD = Number.isFinite(Number(activityAnchors.gasSpentUSD)) ? Number(activityAnchors.gasSpentUSD) : null
  let gasSpentAvailable = Number.isFinite(Number(activityAnchors.gasSpentEth))
  let stableVolumeUSD = 0
  let dexNativeVolumeEth = 0
  let nftEvents = 0
  let tokenTransferEvents = 0
  let nativeTransferEvents = 0

  const now = Date.now()
  let recent30Tx = 0

  datedEvents.forEach((event) => {
    const iso = event.date.toISOString()
    const day = iso.slice(0, 10)
    const month = iso.slice(0, 7)
    const weekSeed = new Date(Date.UTC(event.date.getUTCFullYear(), event.date.getUTCMonth(), event.date.getUTCDate()))
    weekSeed.setUTCDate(weekSeed.getUTCDate() - weekSeed.getUTCDay())
    const week = weekSeed.toISOString().slice(0, 10)

    const txKey = event.hash || `${event.timestamp}-${event.from}-${event.to}-${event.value}-${event.tokenSymbol}`
    dayHashes[day] = dayHashes[day] || new Set()
    weekHashes[week] = weekHashes[week] || new Set()
    monthHashes[month] = monthHashes[month] || new Set()
    dayHashes[day].add(txKey)
    weekHashes[week].add(txKey)
    monthHashes[month].add(txKey)
    dayCounts[day] = dayHashes[day].size
    weekCounts[week] = weekHashes[week].size
    monthCounts[month] = monthHashes[month].size
    if (now - event.date.getTime() <= 30 * 24 * 60 * 60 * 1000) {
      recent30Hashes.add(txKey)
      recent30Tx = recent30Hashes.size
    }

    const tokenSymbol = event.tokenSymbol || ''
    const contractAddress = String(event.contractAddress || '').toLowerCase()
    const targetAddress = String(contractAddress || event.to || '').toLowerCase()
    if (contractAddress || tokenSymbol) {
      const key = contractAddress || tokenSymbol.toUpperCase()
      if (!tokenMap.has(key)) {
        tokenMap.set(key, {
          address: contractAddress,
          symbol: tokenSymbol || 'TOKEN',
          transfers: 0,
          balance: '0',
        })
      }
      tokenMap.get(key).transfers++
      tokenTransferEvents++
    }

    const protocol = classifyInteraction({
      to: event.to,
      contractAddress,
      tokenSymbol,
      category: event.category,
    })
    protocolCounts[protocol.name] = (protocolCounts[protocol.name] || 0) + 1
    categoryCounts[protocol.category] = (categoryCounts[protocol.category] || 0) + 1

    if (targetAddress && targetAddress !== normalizedWallet && targetAddress !== '0x0000000000000000000000000000000000000000') {
      const existing = contractMap.get(targetAddress) || {
        address: targetAddress,
        label: BASE_PROTOCOL_LOOKUP[targetAddress]?.name || protocol.name || compactAddress(targetAddress),
        category: BASE_PROTOCOL_LOOKUP[targetAddress]?.category || protocol.category || 'Contract',
        interactions: 0,
        firstSeen: event.date.toISOString(),
        lastSeen: event.date.toISOString(),
      }
      existing.interactions += 1
      existing.firstSeen = event.date.toISOString() < existing.firstSeen ? event.date.toISOString() : existing.firstSeen
      existing.lastSeen = event.date.toISOString() > existing.lastSeen ? event.date.toISOString() : existing.lastSeen
      contractMap.set(targetAddress, existing)
    }

    const method = String(event.functionName || event.methodId || event.method || (event.category === 'external' ? 'native transfer' : event.category || 'transfer'))
      .split('(')[0]
      .slice(0, 44)
    methodCounts[method] = (methodCounts[method] || 0) + 1

    const valueWei = event.value || '0'
    const nativeAmount = safeNumber(formatTokenAmount(valueWei, 18, 8))
    nativeMovedEth += Math.abs(nativeAmount)
    if (nativeAmount > 0) nativeTransferEvents++
    if (protocol.category === 'DEX') dexNativeVolumeEth += Math.abs(nativeAmount)

    const gasUsed = event.gasUsed || event.gas || '0'
    const gasPrice = event.gasPrice || '0'
    try {
      if (gasUsed !== '0' && gasPrice !== '0') {
        gasSpentEth += safeNumber(formatTokenAmount((BigInt(gasUsed) * BigInt(gasPrice)).toString(), 18, 8))
        gasSpentAvailable = true
      }
    } catch (error) {
      // Some indexed providers omit gas fields.
    }

    if (STABLECOIN_SYMBOLS.has(String(tokenSymbol).toUpperCase())) {
      const amount = event.tokenAmount || formatTokenAmount(event.value || '0', safeNumber(event.tokenDecimal, 6), 6)
      stableVolumeUSD += Math.abs(safeNumber(amount))
    }

    if (event.category === 'erc721' || event.category === 'erc1155') nftEvents++
  })

  if (gasSpentEth === 0 && Number.isFinite(Number(activityAnchors.gasSpentEth))) {
    gasSpentEth = Number(activityAnchors.gasSpentEth)
  }

  tokenBalances.forEach((token) => {
    const key = token.address || token.symbol
    if (!tokenMap.has(key)) {
      tokenMap.set(key, { address: token.address, symbol: token.symbol, transfers: 0, balance: token.balance })
    } else {
      tokenMap.get(key).balance = token.balance
    }
  })

  const activeDays = Object.keys(dayCounts).length
  const activeWeeks = Object.keys(weekCounts).length
  const activeMonths = Object.keys(monthCounts).length
  const longestStreakDays = getLongestDailyStreak(Object.keys(dayCounts))
  const firstEvent = datedEvents[0]
  const lastEvent = datedEvents[datedEvents.length - 1]
  const verifiedFirstEvent = activityAnchors.first || null
  const verifiedLastEvent = activityAnchors.last || null
  const timelineFirstEvent = verifiedFirstEvent || firstEvent || null
  const timelineLastEvent = verifiedLastEvent || lastEvent || null
  const spanDays = firstEvent && lastEvent
    ? Math.max(1, Math.ceil((lastEvent.date - firstEvent.date) / (1000 * 60 * 60 * 24)))
    : 0
  const verifiedSpanDays = timelineFirstEvent && timelineLastEvent
    ? Math.max(1, Math.ceil((timelineLastEvent.date - timelineFirstEvent.date) / (1000 * 60 * 60 * 24)))
    : 0

  const protocolDiversity = Object.keys(protocolCounts).filter((name) => name !== 'Onchain Activity').length
  const categoryDiversity = Object.keys(categoryCounts).length
  const tokenDiversity = tokenMap.size
  const uniqueContracts = contractMap.size
  const volumeSignalAvailable = stableVolumeUSD > 0 || nativeMovedEth > 0
  const hasDatedEvents = datedEvents.length > 0
  const hasTimeline = Boolean(timelineFirstEvent || timelineLastEvent)
  const hasBalance = nativeBalance !== null && nativeBalance !== undefined && nativeBalance !== ''
  const detailDataAvailable = hasDatedEvents || tokenBalances.length > 0 || uniqueContracts > 0

  const availability = {
    transactions: exactTransactionCount !== null || totalTransactions > 0 || indexedEventCount > 0 || Boolean(activityAnchors.source),
    timeline: hasTimeline,
    walletAge: verifiedSpanDays > 0,
    activeDays: hasDatedEvents,
    activeWeeks: hasDatedEvents,
    activeMonths: hasDatedEvents,
    longestStreak: hasDatedEvents,
    recent30Tx: hasDatedEvents,
    protocols: protocolDiversity > 0 || categoryDiversity > 0,
    contracts: uniqueContracts > 0,
    tokens: tokenDiversity > 0,
    volume: volumeSignalAvailable,
    nativeMoved: nativeMovedEth > 0 || normalTransactions.length > 0,
    stableVolume: stableVolumeUSD > 0,
    fees: gasSpentAvailable,
    balance: hasBalance,
    nft: nftEvents > 0 || tokenTransferEvents > 0,
    methods: Object.keys(methodCounts).length > 0,
  }

  const txScore = Math.min(25, totalTransactions >= 250 ? 25 : totalTransactions >= 100 ? 21 : totalTransactions >= 50 ? 16 : totalTransactions >= 15 ? 10 : totalTransactions > 0 ? 5 : 0)
  const consistencyScore = availability.activeDays
    ? Math.min(25, (activeDays >= 60 ? 15 : activeDays >= 30 ? 12 : activeDays >= 10 ? 8 : activeDays > 0 ? 4 : 0) + (activeMonths >= 6 ? 6 : activeMonths >= 3 ? 4 : activeMonths >= 2 ? 3 : activeMonths > 0 ? 1 : 0) + (longestStreakDays >= 10 ? 4 : longestStreakDays >= 5 ? 3 : longestStreakDays >= 2 ? 1 : 0))
    : 0
  const diversityScore = availability.protocols || availability.tokens || availability.contracts
    ? Math.min(25, (uniqueContracts >= 30 ? 8 : uniqueContracts >= 15 ? 6 : uniqueContracts >= 6 ? 4 : uniqueContracts > 0 ? 2 : 0) + (protocolDiversity >= 8 ? 8 : protocolDiversity >= 5 ? 6 : protocolDiversity >= 3 ? 4 : protocolDiversity > 0 ? 2 : 0) + (tokenDiversity >= 20 ? 5 : tokenDiversity >= 10 ? 4 : tokenDiversity >= 5 ? 3 : tokenDiversity > 0 ? 1 : 0) + (categoryDiversity >= 5 ? 4 : categoryDiversity >= 3 ? 3 : categoryDiversity > 1 ? 1 : 0))
    : 0
  const volumeScore = availability.volume
    ? Math.min(15, (stableVolumeUSD >= 5000 ? 8 : stableVolumeUSD >= 1000 ? 6 : stableVolumeUSD >= 250 ? 4 : stableVolumeUSD > 0 ? 2 : 0) + (nativeMovedEth >= 5 ? 7 : nativeMovedEth >= 1 ? 5 : nativeMovedEth >= 0.1 ? 3 : nativeMovedEth > 0 ? 1 : 0))
    : 0
  const feesScore = availability.fees
    ? Math.min(10, gasSpentEth >= 0.1 ? 10 : gasSpentEth >= 0.03 ? 7 : gasSpentEth >= 0.01 ? 5 : gasSpentEth > 0 ? 2 : 0)
    : 0
  const recencyScore = availability.recent30Tx
    ? Math.min(10, recent30Tx >= 20 ? 10 : recent30Tx >= 10 ? 7 : recent30Tx >= 3 ? 5 : recent30Tx > 0 ? 3 : lastEvent ? 1 : 0)
    : 0
  const rawScore = txScore + consistencyScore + diversityScore + volumeScore + feesScore + recencyScore
  const score = Math.min(100, rawScore)

  const tier = score >= 85 ? 'Power User' : score >= 70 ? 'Airdrop Hunter' : score >= 50 ? 'Active Builder' : score >= 30 ? 'Growing Wallet' : totalTransactions > 0 ? 'Early Base User' : 'Fresh Wallet'
  const successfulSourceCount = dataSources.filter((source) => source && source !== 'Base RPC').length
  let confidence = successfulSourceCount >= 3 ? 'High' : successfulSourceCount >= 1 ? 'Medium' : 'Low'
  if (providerIssues.length && successfulSourceCount <= 1) confidence = hasTimeline ? 'Medium' : 'Low'

  const topProtocols = Object.entries(protocolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const topContracts = Array.from(contractMap.values())
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 10)
    .map((contract) => ({
      ...contract,
      shortAddress: compactAddress(contract.address),
    }))

  const topMethods = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  const topTokens = Array.from(tokenMap.values())
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 10)
    .map((token) => ({
      symbol: token.symbol || 'TOKEN',
      balance: token.balance || '0',
      address: token.address,
      transfers: token.transfers,
    }))

  const unavailableMetrics = Object.entries(availability)
    .filter(([, available]) => !available)
    .map(([key]) => key)
  const sourceCoverage = dataSources.map((source) => ({
    source,
    status: 'available',
  }))

  const strengths = []
  if (totalTransactions >= 100) strengths.push('Strong transaction footprint on Base')
  if (verifiedSpanDays >= 90) strengths.push('Wallet age is verified across multiple months')
  if (availability.activeDays && activeMonths >= 3) strengths.push('Activity is spread across multiple months')
  if (availability.contracts && uniqueContracts >= 10) strengths.push('Uses a broad set of apps and contracts')
  if (availability.protocols && protocolDiversity >= 4) strengths.push('Uses several protocol categories instead of one repeated action')
  if (availability.volume && (stableVolumeUSD > 0 || dexNativeVolumeEth > 0 || nativeMovedEth > 0)) strengths.push('Has measurable value movement on Base')
  if (availability.fees && gasSpentEth > 0) strengths.push('Fee spend confirms real onchain execution')
  if (availability.recent30Tx && recent30Tx >= 3) strengths.push('Recent onchain activity is visible')
  if (strengths.length === 0 && totalTransactions > 0) strengths.push('Wallet has started building Base history')

  const gaps = []
  if (totalTransactions < 50) gaps.push('Transaction count is still light for a serious activity profile')
  if (!availability.activeDays) gaps.push('Active day and streak data could not be calculated from available indexed events')
  if (availability.activeDays && activeDays < 14) gaps.push('Activity is not yet spread across enough different days')
  if (!availability.contracts) gaps.push('App and contract footprint could not be identified from available providers')
  if (availability.contracts && uniqueContracts < 6) gaps.push('App diversity can be improved')
  if (!availability.volume) gaps.push('Volume and native movement could not be estimated from available providers')
  if (availability.volume && stableVolumeUSD === 0 && dexNativeVolumeEth === 0 && nativeMovedEth === 0) gaps.push('No clear value movement detected from available data')
  if (availability.recent30Tx && recent30Tx === 0 && totalTransactions > 0) gaps.push('Wallet looks inactive in the last 30 days')
  if (providerIssues.length) gaps.push('Some data providers were unavailable, so the report is source-aware and conservative')

  const nextActions = []
  if (availability.activeDays && activeDays < 14) nextActions.push('Spread small real actions across more days instead of doing everything at once')
  if (availability.contracts && uniqueContracts < 10) nextActions.push('Use more real Base apps: swaps, minting, lending, bridge, and social interactions')
  if (availability.volume && stableVolumeUSD < 250 && nativeMovedEth < 0.1) nextActions.push('Build modest value movement with realistic transaction sizes')
  if (availability.recent30Tx && recent30Tx < 3) nextActions.push('Refresh activity with a few recent Base interactions')
  if (!availability.contracts || !availability.volume) nextActions.push('Re-run when explorer enrichment is healthy to review app footprint and value movement')
  nextActions.push('Keep gas spend natural and avoid repetitive spam patterns')

  const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
  const volumeLabel = stableVolumeUSD > 0 ? `$${formatCompactNumber(stableVolumeUSD)} stable` : `${formatCompactNumber(nativeMovedEth)} ETH`
  const coverageNote = coverage.isComplete
    ? 'Activity metrics are based on the indexed response available to this report.'
    : detailDataAvailable
      ? 'Activity metrics use sampled indexed pages; timeline and fee summaries are verified separately when providers expose them.'
      : 'Only limited verified data was available; unknown fields are marked as Data unavailable instead of showing fake zero values.'

  return {
    walletAddress,
    network: 'Base Mainnet',
    chainId: 8453,
    currency: 'ETH',
    nativeBalance,
    walletScore: score,
    activityLevel: tier,
    tokenDiversity,
    totalTransactions,
    totalValueMoved: nativeMovedEth.toFixed(6),
    firstTransactionDate: timelineFirstEvent ? timelineFirstEvent.date.toLocaleDateString() : null,
    daysActive: verifiedSpanDays,
    favoriteToken: topTokens[0]?.symbol || null,
    mostActiveDay: mostActiveDay ? `${mostActiveDay[0]} (${mostActiveDay[1]} transactions)` : null,
    topTokens,
    funFacts: [
      `Base readiness tier: ${tier}`,
      availability.activeDays ? `${activeDays} active days across ${activeMonths} months` : 'Active day data unavailable',
      availability.contracts ? `${uniqueContracts} apps/contracts touched` : 'App footprint unavailable',
      availability.recent30Tx ? `Recent 30d activity: ${recent30Tx} transactions` : 'Recent activity unavailable',
    ],
    reportType: 'base-airdrop-readiness',
    airdropReport: {
      score,
      tier,
      confidence,
      dataSources,
      summary: score >= 70
        ? 'This wallet has a credible Base footprint with meaningful activity breadth.'
        : score >= 40
          ? 'This wallet has a useful Base foundation, but consistency and diversity can still improve.'
          : totalTransactions > 0
            ? 'This wallet needs more sustained Base usage before it looks like a strong airdrop profile.'
            : 'No indexed Base activity was found for this wallet yet.',
      metrics: {
        totalTransactions,
        totalTransactionsExact: exactTransactionCount !== null,
        totalTransactionsSource: activityAnchors.exactTransactionCountSource || (coverage.isComplete ? dataSources.join(', ') : null),
        indexedEventCount,
        activeDays,
        activeWeeks,
        activeMonths,
        longestStreakDays,
        spanDays,
        walletAgeDays: verifiedSpanDays,
        firstActivityVerified: Boolean(verifiedFirstEvent),
        lastActivityVerified: Boolean(verifiedLastEvent),
        timelineSource: activityAnchors.source || (coverage.isComplete ? dataSources.join(', ') : null),
        recent30Tx,
        protocolDiversity,
        categoryDiversity,
        uniqueContracts,
        tokenDiversity,
        nativeMovedEth: nativeMovedEth.toFixed(6),
        dexNativeVolumeEth: dexNativeVolumeEth.toFixed(6),
        stableVolumeUSD: stableVolumeUSD.toFixed(2),
        volumeSignal: volumeLabel,
        volumeEstimated: stableVolumeUSD === 0,
        gasSpentEth: gasSpentEth.toFixed(6),
        gasSpentUSD: gasSpentUSD !== null ? gasSpentUSD.toFixed(2) : null,
        gasSpentAvailable,
        gasSpentSource: activityAnchors.gasSummarySource || (gasSpentAvailable ? dataSources.join(', ') : null),
        nftEvents,
        tokenTransferEvents,
        nativeTransferEvents,
      },
      scoreBreakdown: [
        { label: 'Transactions', value: txScore, max: 25, unavailable: !availability.transactions },
        { label: 'Consistency', value: consistencyScore, max: 25, unavailable: !availability.activeDays },
        { label: 'Apps', value: diversityScore, max: 25, unavailable: !(availability.protocols || availability.tokens || availability.contracts) },
        { label: 'Volume', value: volumeScore, max: 15, unavailable: !availability.volume },
        { label: 'Fees', value: feesScore, max: 10, unavailable: !availability.fees },
        { label: 'Recency', value: recencyScore, max: 10, unavailable: !availability.recent30Tx },
      ],
      topProtocols,
      topCategories,
      topContracts,
      topMethods,
      topTokens,
      strengths: strengths.slice(0, 5),
      gaps: gaps.slice(0, 5),
      nextActions: nextActions.slice(0, 5),
      timeline: {
        firstActivity: timelineFirstEvent ? timelineFirstEvent.date.toISOString() : null,
        lastActivity: timelineLastEvent ? timelineLastEvent.date.toISOString() : null,
        firstActivityHash: timelineFirstEvent?.hash || null,
        lastActivityHash: timelineLastEvent?.hash || null,
        firstActivityVerified: Boolean(verifiedFirstEvent),
        lastActivityVerified: Boolean(verifiedLastEvent),
        source: activityAnchors.source || (coverage.isComplete ? dataSources.join(', ') : null),
        mostActiveDay: mostActiveDay ? { day: mostActiveDay[0], count: mostActiveDay[1] } : null,
      },
      coverage: {
        isComplete: Boolean(coverage.isComplete),
        hasMore: Boolean(coverage.hasMore),
        sampled: !coverage.isComplete,
        detailDataAvailable,
        availability,
        unavailableMetrics,
        sourceCoverage,
        indexedRows: {
          normalTransactions: normalTransactions.length,
          tokenTransfers: tokenTransfers.length,
          tokenBalances: tokenBalances.length,
          uniqueTransactionHashes: hashSet.size,
        },
        providerIssues: providerIssues.slice(0, 6),
        note: coverageNote,
      },
      display: {
        stableVolume: `$${formatCompactNumber(stableVolumeUSD)}`,
        volumeSignal: volumeLabel,
        nativeMoved: `${formatCompactNumber(nativeMovedEth)} ETH`,
        gasSpent: `${formatCompactNumber(gasSpentEth)} ETH`,
        gasSpentUSD: gasSpentUSD !== null ? `$${formatCompactNumber(gasSpentUSD)}` : null,
      },
    },
  }
}

async function performBaseWalletReport(walletAddress) {
  const cacheKey = walletAddress.toLowerCase()
  const cached = BASE_REPORT_CACHE.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < BASE_REPORT_CACHE_TTL_MS) {
    console.log('✅ Base report served from short cache:', walletAddress)
    return cloneJson(cached.report)
  }

  if (BASE_REPORT_IN_FLIGHT.has(cacheKey)) {
    console.log('⏳ Joining in-flight Base report request:', walletAddress)
    return cloneJson(await BASE_REPORT_IN_FLIGHT.get(cacheKey))
  }

  const reportPromise = buildBaseWalletReportFromAlchemy(walletAddress)
    .then((report) => {
      BASE_REPORT_CACHE.set(cacheKey, {
        createdAt: Date.now(),
        report: cloneJson(report),
      })
      return report
    })
    .finally(() => {
      BASE_REPORT_IN_FLIGHT.delete(cacheKey)
    })

  BASE_REPORT_IN_FLIGHT.set(cacheKey, reportPromise)
  return cloneJson(await reportPromise)
}

async function buildBaseWalletReportFromAlchemy(walletAddress) {
  console.log(`🔵 Starting professional Base report for: ${walletAddress}`)
  const dataSources = []
  const providerIssues = []

  if (!API_KEYS.ALCHEMY) {
    providerIssues.push('Alchemy transfers: Base Alchemy provider is not configured')
  }

  const nativeBalance = await fetchBaseNativeBalance(walletAddress)
  let normalTransactions = []
  let tokenTransfers = []
  let transferCoverage = { isComplete: true, hasMore: false }
  let activityAnchors = { verified: false, source: null, first: null, last: null, errors: [] }

  try {
    const [alchemyResult, anchorsResult, baseScanDetailResult, blockscoutDetailResult] = await Promise.allSettled([
      API_KEYS.ALCHEMY ? fetchAlchemyTransfers(walletAddress) : Promise.resolve({ transfers: [], source: null, hasMore: false }),
      fetchBaseVerifiedActivityAnchors(walletAddress),
      fetchBaseScanDetailedHistory(walletAddress),
      fetchBlockscoutDetailedHistory(walletAddress),
    ])

    if (anchorsResult.status === 'fulfilled') {
      activityAnchors = anchorsResult.value
      String(activityAnchors.source || '')
        .split(',')
        .map((source) => source.trim())
        .filter(Boolean)
        .forEach((source) => {
          addUniqueSource(dataSources, source)
        })
      if (activityAnchors.errors?.length) {
        console.warn('⚠️ Base activity anchor partial errors:', activityAnchors.errors.slice(0, 2).join(' | '))
      }
    } else {
      providerIssues.push(`Blockscout anchors: ${anchorsResult.reason?.message || 'request failed'}`)
      console.warn('⚠️ Blockscout Base activity anchors unavailable:', anchorsResult.reason?.message)
    }

    const detailCandidates = []
    if (baseScanDetailResult.status === 'fulfilled' && baseScanDetailResult.value) {
      detailCandidates.push(baseScanDetailResult.value)
    } else if (baseScanDetailResult.status === 'rejected') {
      providerIssues.push(`BaseScan details: ${baseScanDetailResult.reason?.message || 'request failed'}`)
    }
    if (blockscoutDetailResult.status === 'fulfilled' && blockscoutDetailResult.value) {
      detailCandidates.push(blockscoutDetailResult.value)
    } else if (blockscoutDetailResult.status === 'rejected') {
      providerIssues.push(`Blockscout details: ${blockscoutDetailResult.reason?.message || 'request failed'}`)
    }

    detailCandidates.forEach((detail) => {
      if (detail.errors?.length) {
        detail.errors.slice(0, 2).forEach((issue) => providerIssues.push(issue))
      }
      if (!detail.source) return
      addUniqueSource(dataSources, detail.source)
      mergeUniqueEvents(normalTransactions, detail.normalTransactions || [], detail.source)
      mergeUniqueEvents(tokenTransfers, detail.tokenTransfers || [], detail.source)
      transferCoverage = {
        isComplete: transferCoverage.isComplete && !detail.hasMore,
        hasMore: Boolean(transferCoverage.hasMore || detail.hasMore),
      }
    })

    if (alchemyResult.status === 'rejected') {
      throw alchemyResult.reason
    }

    const { transfers, source, hasMore } = alchemyResult.value
    transferCoverage = {
      isComplete: transferCoverage.isComplete && !hasMore,
      hasMore: Boolean(transferCoverage.hasMore || hasMore),
    }
    addUniqueSource(dataSources, source)
    if (transfers.length) {
      const normalized = transfers.map(normalizeAlchemyTransfer)
      mergeUniqueEvents(tokenTransfers, normalized, source)
      console.log('✅ Base Alchemy transfers:', { transfers: transfers.length })
    }
  } catch (error) {
    providerIssues.push(`Alchemy transfers: ${error.message}`)
    console.warn('⚠️ Alchemy Base transfers unavailable:', error.message)
  }

  let tokenBalances = []
  if (API_KEYS.ALCHEMY) {
    try {
      tokenBalances = await fetchAlchemyTokenBalances(walletAddress)
      if (tokenBalances.length) addUniqueSource(dataSources, 'Alchemy Balances')
    } catch (error) {
      providerIssues.push(`Alchemy balances: ${error.message}`)
      console.warn('⚠️ Alchemy Base balances unavailable:', error.message)
    }
  }

  const hasIndexedSignals = normalTransactions.length > 0 || tokenTransfers.length > 0 || tokenBalances.length > 0
  const hasProviderFailure = providerIssues.some((issue) => isProviderFailureMessage(issue))
  const hasVerifiedSummary = Boolean(
    activityAnchors.first ||
    activityAnchors.last ||
    (activityAnchors.exactTransactionCount !== null && activityAnchors.exactTransactionCount !== undefined)
  )

  if (!hasIndexedSignals && hasProviderFailure && !hasVerifiedSummary) {
    const issueSummary = providerIssues.slice(0, 3).join(' | ')
    throw new Error(`Base report data provider unavailable: ${issueSummary}`)
  }

  if (dataSources.length === 0) dataSources.push('Base RPC')
  const report = buildBaseReport(walletAddress, nativeBalance, normalTransactions, tokenTransfers, tokenBalances, dataSources, {
    activityAnchors,
    coverage: transferCoverage,
    detailDataAvailable: hasIndexedSignals,
    providerIssues,
  })
  report.dataQuality = {
    status: hasIndexedSignals ? 'indexed' : 'limited',
    source: dataSources.join(', '),
    note: hasIndexedSignals
      ? 'Report generated from Base indexer/RPC data.'
      : providerIssues.length
        ? `Limited Base data. Provider notes: ${providerIssues.slice(0, 2).join(' | ')}`
        : 'No indexed Base activity was found for this wallet.',
  }
  return report
}

// ==========================================
// Wallet Analysis Function
// ==========================================

async function performWalletAnalysis(walletAddress, selectedNetwork = 'ethereum') {
  // Validate network selection
  if (!SUPPORTED_NETWORKS[selectedNetwork]) {
    console.error(`❌ Invalid network: ${selectedNetwork}. Defaulting to Ethereum.`)
    selectedNetwork = 'ethereum'
  }

  if (selectedNetwork === 'base') {
    return performBaseWalletReport(walletAddress)
  }
  
  const network = SUPPORTED_NETWORKS[selectedNetwork]
  const chainId = network.chainId
  
  console.log(`🔍 Starting wallet analysis for: ${walletAddress} on ${network.name} (chainId: ${chainId})`)
  
  const analysis = {
    walletAddress,
    network: network.name,
    chainId: chainId,
    currency: network.currency,
    nativeBalance: '0',
    walletScore: 0,
    activityLevel: 'Unknown',
    tokenDiversity: 0,
    totalTransactions: 0,
    totalValueMoved: '0',
    firstTransactionDate: null,
    daysActive: 0,
    favoriteToken: null,
    mostActiveDay: null,
    topTokens: [],
    funFacts: [],
  }

  console.log('🔑 API Key check:', API_KEYS.ETHERSCAN ? `Set (${API_KEYS.ETHERSCAN.substring(0, 10)}...)` : 'NOT SET')

  if (!API_KEYS.ETHERSCAN) {
    throw new Error('Etherscan API V2 key is not configured for non-Base wallet analysis')
  }

  const providerIssues = []

  try {
    // 1. Get native balance
    try {
      const balanceUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${walletAddress}&tag=latest&apikey=${API_KEYS.ETHERSCAN}`
      console.log(`🌐 Balance API URL (${network.name}):`, hideApiKeyInUrl(balanceUrl, API_KEYS.ETHERSCAN))
      
      const balanceResponse = await fetch(balanceUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-WalletAnalysis/1.0',
        },
      })
      
      console.log('📡 Balance API HTTP status:', balanceResponse.status, balanceResponse.statusText)
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        console.log('📊 Balance API response:', {
          status: balanceData.status,
          message: balanceData.message,
          result: balanceData.result,
        })
        
        if (balanceData.status === '1' && balanceData.result) {
          analysis.nativeBalance = formatEtherValue(balanceData.result)
          console.log('✅ Balance fetched successfully:', analysis.nativeBalance, network.currency)
        } else if (balanceData.status === '0') {
          const message = `${balanceData.message || ''} ${balanceData.result || ''}`.trim()
          if (isProviderFailureMessage(message)) providerIssues.push(`balance: ${message}`)
          console.error('❌ API error for balance:', balanceData.message, balanceData.result)
          analysis.nativeBalance = '0.0000'
        } else {
          console.warn('⚠️ Unexpected balance API response format')
          analysis.nativeBalance = '0.0000'
        }
      } else {
        console.error('❌ Balance API HTTP error:', balanceResponse.status, balanceResponse.statusText)
        const errorText = await balanceResponse.text().catch(() => 'Could not read error body')
        providerIssues.push(`balance: HTTP ${balanceResponse.status}`)
        console.error('❌ Balance API error body:', errorText.substring(0, 300))
        analysis.nativeBalance = '0.0000'
      }
    } catch (balanceError) {
      providerIssues.push(`balance: ${balanceError.message || 'request failed'}`)
      console.error('❌ Exception fetching balance:', balanceError)
      analysis.nativeBalance = '0.0000'
    }

    // 2. Get transactions
    console.log(`🔍 Fetching transactions from Etherscan API V2 (${network.name})...`)
    try {
      const txUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${API_KEYS.ETHERSCAN}`
      console.log(`🌐 Transaction API URL (${network.name}):`, hideApiKeyInUrl(txUrl, API_KEYS.ETHERSCAN))
      
      const txResponse = await fetch(txUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-WalletAnalysis/1.0',
        },
      })
      
      console.log('📡 Transaction API HTTP status:', txResponse.status, txResponse.statusText)
      
      if (!txResponse.ok) {
        console.error('❌ Transaction API error:', txResponse.status, txResponse.statusText)
        throw new Error(`API error: ${txResponse.status}`)
      }
      
      const txData = await txResponse.json()
      const txMessage = `${txData.message || ''} ${typeof txData.result === 'string' ? txData.result : ''}`.trim()
      console.log('📊 Transaction API response:', {
        status: txData.status,
        message: txData.message,
        resultLength: txData.result && Array.isArray(txData.result) ? txData.result.length : 0,
      })

      let transactions = []
      if (txData.status === '1' && txData.result && Array.isArray(txData.result)) {
        transactions = txData.result
      } else if (txData.status === '0' && !isNoIndexedDataMessage(txMessage)) {
        providerIssues.push(`transactions: ${txMessage || 'unavailable'}`)
      }
      
      if (transactions.length === 0) {
        console.log('ℹ️ No transactions found for this wallet')
      } else {
        analysis.totalTransactions = transactions.length

        let totalValue = BigInt(0)
        transactions.forEach(tx => {
          const value = tx.value || '0'
          totalValue += BigInt(value)
        })
        analysis.totalValueMoved = formatEtherValue(totalValue.toString())

        if (transactions.length > 0) {
          const firstTx = transactions[transactions.length - 1]
          const lastTx = transactions[0]
          
          const firstTimestamp = firstTx.timeStamp || firstTx.timestamp || firstTx.blockTimestamp
          const lastTimestamp = lastTx.timeStamp || lastTx.timestamp || lastTx.blockTimestamp
          
          const firstDate = firstTimestamp ? new Date(parseInt(firstTimestamp) * 1000) : new Date()
          const lastDate = lastTimestamp ? new Date(parseInt(lastTimestamp) * 1000) : new Date()
          
          analysis.firstTransactionDate = firstDate.toLocaleDateString()
          analysis.daysActive = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)))
        }

        const dayCounts = {}
        transactions.forEach(tx => {
          const timestamp = tx.timeStamp || tx.timestamp || tx.blockTimestamp
          if (timestamp) {
            const date = new Date(parseInt(timestamp) * 1000)
            const dateStr = date.toLocaleDateString()
            dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1
          }
        })
        const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
        if (mostActiveDay) {
          analysis.mostActiveDay = `${mostActiveDay[0]} (${mostActiveDay[1]} transactions)`
        }
      }
    } catch (txError) {
      providerIssues.push(`transactions: ${txError.message || 'request failed'}`)
      console.error('❌ Error fetching transactions:', txError)
    }

    // 3. Get token transfers
    console.log(`🔍 Fetching token transfers from Etherscan API V2 (${network.name})...`)
    try {
      const tokenTxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${API_KEYS.ETHERSCAN}`
      console.log(`🌐 Token transfer API URL (${network.name}):`, hideApiKeyInUrl(tokenTxUrl, API_KEYS.ETHERSCAN))
      
      const tokenTxResponse = await fetch(tokenTxUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-WalletAnalysis/1.0',
        },
      })
      
      console.log('📡 Token transfer API HTTP status:', tokenTxResponse.status, tokenTxResponse.statusText)
      
      if (!tokenTxResponse.ok) {
        console.error('❌ Token transfer API error:', tokenTxResponse.status)
        throw new Error(`API error: ${tokenTxResponse.status}`)
      }
      
      const tokenTxData = await tokenTxResponse.json()
      const tokenTxMessage = `${tokenTxData.message || ''} ${typeof tokenTxData.result === 'string' ? tokenTxData.result : ''}`.trim()
      console.log('📊 Token transfer API response:', {
        status: tokenTxData.status,
        message: tokenTxData.message,
        resultLength: tokenTxData.result && Array.isArray(tokenTxData.result) ? tokenTxData.result.length : 0,
      })

      let tokenTransfers = []
      if (tokenTxData.status === '1' && tokenTxData.result && Array.isArray(tokenTxData.result)) {
        tokenTransfers = tokenTxData.result
      } else if (tokenTxData.status === '0' && !isNoIndexedDataMessage(tokenTxMessage)) {
        providerIssues.push(`token transfers: ${tokenTxMessage || 'unavailable'}`)
      }
      
      if (tokenTransfers.length === 0) {
        console.log('ℹ️ No token transfers found for this wallet')
      } else {
        const tokenMap = new Map()
        tokenTransfers.forEach(tx => {
          const tokenAddress = (tx.contractAddress || tx.tokenAddress || tx.token?.address || '').toLowerCase()
          if (tokenAddress) {
            if (!tokenMap.has(tokenAddress)) {
              tokenMap.set(tokenAddress, {
                address: tokenAddress,
                symbol: tx.tokenSymbol || tx.token?.symbol || tx.symbol || 'UNKNOWN',
                decimals: parseInt(tx.tokenDecimals || tx.token?.decimals || tx.decimals || '18'),
                transfers: 0,
              })
            }
            tokenMap.get(tokenAddress).transfers++
          }
        })

        analysis.tokenDiversity = tokenMap.size

        const tokenArray = Array.from(tokenMap.values())
          .sort((a, b) => b.transfers - a.transfers)
          .slice(0, 10)

        for (const token of tokenArray) {
          try {
            const tokenBalanceUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokenbalance&contractaddress=${token.address}&address=${walletAddress}&tag=latest&apikey=${API_KEYS.ETHERSCAN}`
            const tokenBalanceResponse = await fetch(tokenBalanceUrl, {
              headers: { 
                'Accept': 'application/json',
                'User-Agent': 'BaseHub-WalletAnalysis/1.0',
              },
            })
            
            if (tokenBalanceResponse.ok) {
              const tokenBalanceData = await tokenBalanceResponse.json()
              let balance = null
              if (tokenBalanceData.status === '1' && tokenBalanceData.result) {
                balance = tokenBalanceData.result
              } else if (tokenBalanceData.balance) {
                balance = tokenBalanceData.balance
              }
              
              if (balance) {
                const formattedBalance = formatTokenValue(balance, token.decimals)
                if (parseFloat(formattedBalance) > 0) {
                  analysis.topTokens.push({
                    symbol: token.symbol,
                    balance: formattedBalance,
                    address: token.address,
                  })
                }
              }
            }
          } catch (err) {
            console.log(`⚠️ Skipping token ${token.symbol}:`, err.message)
          }
        }

        if (tokenArray.length > 0) {
          analysis.favoriteToken = tokenArray[0].symbol
        }
      }
    } catch (tokenError) {
      providerIssues.push(`token transfers: ${tokenError.message || 'request failed'}`)
      console.error('❌ Error fetching token transfers:', tokenError)
    }

    // 4. Calculate Wallet Score
    const transactionScore = analysis.totalTransactions > 100
      ? 30
      : analysis.totalTransactions > 50
        ? 20
        : analysis.totalTransactions > 10
          ? 10
          : analysis.totalTransactions > 0
            ? 5
            : 0

    const diversityScore = analysis.tokenDiversity > 10
      ? 30
      : analysis.tokenDiversity > 5
        ? 20
        : analysis.tokenDiversity > 0
          ? 10
          : 0

    const nativeBalance = parseFloat(analysis.nativeBalance || '0')
    const balanceScore = nativeBalance > 1
      ? 20
      : nativeBalance > 0.1
        ? 10
        : nativeBalance > 0
          ? 5
          : 0

    const activitySpanScore = analysis.daysActive > 365
      ? 20
      : analysis.daysActive > 180
        ? 15
        : analysis.daysActive > 30
          ? 10
          : analysis.daysActive > 0
            ? 5
            : 0

    let score = transactionScore + diversityScore + balanceScore + activitySpanScore

    analysis.walletScore = Math.min(100, Math.max(0, score))

    // 5. Activity Level
    if (analysis.totalTransactions === 0) {
      analysis.activityLevel = 'Dormant 💤'
    } else if (analysis.totalTransactions < 5) {
      analysis.activityLevel = 'Newbie 🌱'
    } else if (analysis.totalTransactions < 20) {
      analysis.activityLevel = 'Active 🚀'
    } else if (analysis.totalTransactions < 100) {
      analysis.activityLevel = 'Super Active ⚡'
    } else {
      analysis.activityLevel = 'Whale 🐋'
    }

    // 6. Fun Facts
    if (analysis.totalTransactions === 0) {
      analysis.funFacts.push('This wallet is brand new! 🎉')
    } else {
      analysis.funFacts.push(`Made ${analysis.totalTransactions} transactions on ${network.name}`)
    }

    if (analysis.daysActive > 0) {
      analysis.funFacts.push(`Active for ${analysis.daysActive} days`)
    }

    if (analysis.tokenDiversity > 0) {
      analysis.funFacts.push(`Holds ${analysis.tokenDiversity} different tokens`)
    }

    if (analysis.favoriteToken) {
      analysis.funFacts.push(`Favorite token: ${analysis.favoriteToken}`)
    }

    if (parseFloat(analysis.nativeBalance) > 0.1) {
      analysis.funFacts.push(`Has ${analysis.nativeBalance} ${network.currency}`)
    }

    analysis.reportType = 'network-wallet-report'
    analysis.display = {
      nativeBalance: `${parseFloat(analysis.nativeBalance || 0).toFixed(4)} ${network.currency}`,
      totalValueMoved: `${parseFloat(analysis.totalValueMoved || 0).toFixed(4)} ${network.currency}`,
    }
    analysis.scoreBreakdown = [
      { label: 'Transactions', value: transactionScore, max: 30 },
      { label: 'Token Diversity', value: diversityScore, max: 30 },
      { label: 'Balance Signal', value: balanceScore, max: 20 },
      { label: 'Activity Span', value: activitySpanScore, max: 20 },
    ]
    analysis.insights = [
      analysis.totalTransactions > 0
        ? `${analysis.totalTransactions.toLocaleString()} indexed transactions were found on ${network.name}.`
        : `No indexed transactions were found on ${network.name}.`,
      analysis.daysActive > 0
        ? `Activity spans roughly ${analysis.daysActive.toLocaleString()} day(s).`
        : 'No activity span could be calculated from available data.',
      analysis.tokenDiversity > 0
        ? `${analysis.tokenDiversity.toLocaleString()} token contract(s) appeared in transfer history.`
        : 'No token transfer diversity was detected.',
      parseFloat(analysis.totalValueMoved || 0) > 0
        ? `Native movement totals about ${analysis.display.totalValueMoved}.`
        : 'No native value movement was detected in indexed transactions.',
    ]
    analysis.recommendations = []
    if (analysis.totalTransactions < 10) {
      analysis.recommendations.push(`Build more real transaction history on ${network.name}; avoid repetitive spam patterns.`)
    }
    if (analysis.tokenDiversity < 3) {
      analysis.recommendations.push('Interact with a broader set of useful apps and token contracts.')
    }
    if (analysis.daysActive < 30) {
      analysis.recommendations.push('Improve consistency by spreading activity across more days.')
    }
    if (nativeBalance <= 0) {
      analysis.recommendations.push(`Keep a small ${network.currency} balance for future network activity and gas.`)
    }
    if (analysis.recommendations.length === 0) {
      analysis.recommendations.push('Maintain consistent organic usage and keep protocol interactions purposeful.')
    }

    const hasReportSignals = analysis.totalTransactions > 0 || nativeBalance > 0 || analysis.tokenDiversity > 0
    if (!hasReportSignals && providerIssues.length > 0) {
      throw new Error(`${network.name} report data provider unavailable: ${providerIssues.slice(0, 3).join(' | ')}`)
    }

    analysis.dataQuality = {
      status: hasReportSignals ? 'indexed' : 'limited',
      source: 'Etherscan API V2',
      note: hasReportSignals
        ? 'Report generated from available account, transaction, and token transfer endpoints.'
        : providerIssues.length
          ? `Limited data. Provider notes: ${providerIssues.slice(0, 2).join(' | ')}`
          : 'The selected network returned limited indexed activity for this wallet.',
    }

  } catch (error) {
    console.error('❌ Wallet analysis error:', error)
    console.error('Error stack:', error.stack)
    
    if (analysis.nativeBalance !== '0' || analysis.totalTransactions > 0) {
      console.log('⚠️ Returning partial analysis due to error')
      return analysis
    }
    
    throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`)
  }

  return analysis
}

// ==========================================
// Wallet Analysis endpoint - protected by middleware
// ==========================================
async function handleWalletAnalysisRequest(c) {
  console.log('✅ POST / endpoint called - payment verified by middleware')
  console.log('📋 Request details:', {
    method: c.req.method,
    url: c.req.url,
  })

  try {
    const body = await c.req.json()
    console.log('📦 Request body received:', body)
    
    const { walletAddress, network } = body
    
    if (!walletAddress) {
      return c.json({ error: 'Wallet address is required' }, 400)
    }
    
    // Validate network selection
    const selectedNetwork = network || 'ethereum' // Default to Ethereum
    if (!SUPPORTED_NETWORKS[selectedNetwork]) {
      return c.json({ 
        error: 'Invalid network selection', 
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS) 
      }, 400)
    }
    
    console.log(`🔍 Extracted walletAddress: ${walletAddress}, network: ${selectedNetwork}`)

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      console.error('❌ Invalid wallet address format:', walletAddress)
      return c.json({ error: 'Invalid wallet address format' }, 400)
    }

    // Perform wallet analysis with selected network
    const analysisPromise = performWalletAnalysis(walletAddress, selectedNetwork)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout after 30 seconds')), 30000)
    )

    let analysis
    try {
      analysis = await Promise.race([analysisPromise, timeoutPromise])
    } catch (analysisError) {
      console.error('❌ Analysis error:', analysisError)
      console.error('Error stack:', analysisError.stack)
      const message = analysisError.message || 'Unknown error occurred'
      const isProviderError = message.includes('data provider unavailable') ||
        message.includes('API V2 key is not configured') ||
        message.includes('Analysis timeout')
      
      return c.json({
        error: 'Analysis failed',
        code: isProviderError ? 'WALLET_ANALYSIS_PROVIDER_UNAVAILABLE' : 'WALLET_ANALYSIS_FAILED',
        message,
      }, isProviderError ? 503 : 500)
    }

    console.log('✅ Wallet analysis completed:', {
      walletAddress,
      network: selectedNetwork,
      score: analysis.walletScore,
      transactions: analysis.totalTransactions,
    })

    return c.json({
      success: true,
      walletAddress,
      network: selectedNetwork,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Wallet analysis endpoint error:', error)
    console.error('Error stack:', error.stack)
    
    return c.json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    }, 500)
  }
}

app.post('/', handleWalletAnalysisRequest)
passApp.post('/', handleWalletAnalysisRequest)

// ==========================================
// Export for Vercel (serverless function)
// ==========================================
export default async function handler(req, res) {
  try {
    console.log('🔍 Wallet Analysis handler called:', {
      method: req.method,
      url: req.url,
    })

    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
    const fullUrl = `${protocol}://${host}/`

    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        console.log('📦 Request body prepared:', body.substring(0, 200))
      }
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
    })

    const activeApp = isPassDiscountRequest(req) ? passApp : app
    const response = await activeApp.fetch(request)

    console.log('📥 Hono app response:', {
      status: response.status,
      statusText: response.statusText,
    })

    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const responseBody = await response.text()
    console.log('📦 Response body length:', responseBody.length)
    
    res.status(response.status)

    if (responseBody) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          const jsonData = JSON.parse(responseBody)
          res.json(jsonData)
        } catch (parseError) {
          res.send(responseBody)
        }
      } else {
        res.send(responseBody)
      }
    } else {
      res.end()
    }
  } catch (error) {
    console.error('❌ Handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      })
    }
  }
}
