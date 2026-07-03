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
// Use env only – no fallback in repo (best practice for secrets)
const API_KEYS = {
  // Etherscan API V2 uses one account key across supported chains.
  ETHERSCAN: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || '',
  ALCHEMY: process.env.ALCHEMY_API_KEY || '',
  MORALIS: process.env.MORALIS_API_KEY || '',
}

const BASE_RPC_URL = API_KEYS.ALCHEMY
  ? `https://base-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`
  : (process.env.BASE_RPC_URL || 'https://mainnet.base.org')

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
  console.warn('⚠️ ETHERSCAN_API_KEY/BASESCAN_API_KEY not set – Base report will rely on indexed/RPC fallbacks')
}

if (!API_KEYS.ALCHEMY && !API_KEYS.MORALIS) {
  console.warn('⚠️ ALCHEMY_API_KEY or MORALIS_API_KEY recommended for rich Base wallet reports')
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

async function rpcCall(method, params = []) {
  const response = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  if (!response.ok) throw new Error(`RPC error: ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'RPC returned an error')
  return data.result
}

async function fetchBaseNativeBalance(walletAddress) {
  try {
    const balanceHex = await rpcCall('eth_getBalance', [walletAddress, 'latest'])
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
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'BaseHub-WalletAnalysis/2.0',
    },
  })
  if (!response.ok) throw new Error(`Etherscan API error: ${response.status}`)
  const data = await response.json()
  if (data.status === '1' && Array.isArray(data.result)) return data.result
  if (data.status === '1') return data.result
  const message = `${data.message || 'NOTOK'} ${data.result || ''}`.trim()
  throw new Error(message || `Etherscan ${action} unavailable`)
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

  for (const direction of directions) {
    let pageKey = null
    for (let page = 0; page < 3; page++) {
      const params = {
        fromBlock: '0x0',
        toBlock: 'latest',
        category: ['external', 'erc20', 'erc721', 'erc1155'],
        withMetadata: true,
        excludeZeroValue: false,
        maxCount: '0x3e8',
        [direction.key]: direction.value,
      }
      if (pageKey) params.pageKey = pageKey

      const response = await fetch(BASE_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `basehub-transfers-${direction.key}-${page}`,
          method: 'alchemy_getAssetTransfers',
          params: [params],
        }),
      })
      if (!response.ok) throw new Error(`Alchemy transfers error: ${response.status}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error.message || 'Alchemy transfers failed')
      const batch = data.result?.transfers || []

      batch.forEach((transfer) => {
        const fingerprint = `${transfer.hash}-${transfer.category}-${transfer.from}-${transfer.to}-${transfer.rawContract?.address || ''}-${transfer.rawContract?.value || transfer.value || ''}`
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint)
          transfers.push(transfer)
        }
      })

      pageKey = data.result?.pageKey
      if (!pageKey) break
    }
  }

  return { transfers, source: 'Alchemy' }
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
  const balances = await rpcCall('alchemy_getTokenBalances', [walletAddress])
  const tokenBalances = (balances?.tokenBalances || [])
    .filter((token) => token.tokenBalance && token.tokenBalance !== '0x0')
    .slice(0, 12)

  return Promise.all(tokenBalances.map(async (token) => {
    try {
      const metadata = await rpcCall('alchemy_getTokenMetadata', [token.contractAddress])
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

function buildBaseReport(walletAddress, nativeBalance, normalTransactions, tokenTransfers, tokenBalances, dataSources) {
  const events = [...normalTransactions, ...tokenTransfers]
    .filter((event) => event && event.hash)
    .map((event) => ({
      ...event,
      from: event.from || event.from_address || '',
      to: event.to || event.to_address || '',
      timeStamp: event.timeStamp || event.timestamp || event.blockTimestamp || null,
    }))

  const hashSet = new Set(events.map((event) => event.hash).filter(Boolean))
  const totalTransactions = Math.max(normalTransactions.length, hashSet.size)

  const datedEvents = events
    .map((event) => {
      const timestamp = event.timeStamp ? safeNumber(event.timeStamp, 0) : 0
      return timestamp ? { ...event, timestamp, date: new Date(timestamp * 1000) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)

  const dayCounts = {}
  const weekCounts = {}
  const monthCounts = {}
  const protocolCounts = {}
  const categoryCounts = {}
  const tokenMap = new Map()
  let nativeMovedEth = 0
  let gasSpentEth = 0
  let stableVolumeUSD = 0
  let dexNativeVolumeEth = 0
  let nftEvents = 0

  const now = Date.now()
  let recent30Tx = 0

  datedEvents.forEach((event) => {
    const iso = event.date.toISOString()
    const day = iso.slice(0, 10)
    const month = iso.slice(0, 7)
    const weekSeed = new Date(Date.UTC(event.date.getUTCFullYear(), event.date.getUTCMonth(), event.date.getUTCDate()))
    weekSeed.setUTCDate(weekSeed.getUTCDate() - weekSeed.getUTCDay())
    const week = weekSeed.toISOString().slice(0, 10)

    dayCounts[day] = (dayCounts[day] || 0) + 1
    weekCounts[week] = (weekCounts[week] || 0) + 1
    monthCounts[month] = (monthCounts[month] || 0) + 1
    if (now - event.date.getTime() <= 30 * 24 * 60 * 60 * 1000) recent30Tx++

    const tokenSymbol = event.tokenSymbol || event.token?.symbol || event.asset || ''
    const contractAddress = (event.contractAddress || '').toLowerCase()
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
    }

    const protocol = classifyInteraction({
      to: event.to,
      contractAddress,
      tokenSymbol,
      category: event.category,
    })
    protocolCounts[protocol.name] = (protocolCounts[protocol.name] || 0) + 1
    categoryCounts[protocol.category] = (categoryCounts[protocol.category] || 0) + 1

    const valueWei = event.value || '0'
    nativeMovedEth += safeNumber(formatTokenAmount(valueWei, 18, 8))
    if (protocol.category === 'DEX') dexNativeVolumeEth += safeNumber(formatTokenAmount(valueWei, 18, 8))

    const gasUsed = event.gasUsed || event.gas || '0'
    const gasPrice = event.gasPrice || '0'
    try {
      if (gasUsed !== '0' && gasPrice !== '0') {
        gasSpentEth += safeNumber(formatTokenAmount((BigInt(gasUsed) * BigInt(gasPrice)).toString(), 18, 8))
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
  const firstEvent = datedEvents[0]
  const lastEvent = datedEvents[datedEvents.length - 1]
  const spanDays = firstEvent && lastEvent
    ? Math.max(1, Math.ceil((lastEvent.date - firstEvent.date) / (1000 * 60 * 60 * 24)))
    : 0

  const protocolDiversity = Object.keys(protocolCounts).filter((name) => name !== 'Onchain Activity').length
  const categoryDiversity = Object.keys(categoryCounts).length
  const tokenDiversity = tokenMap.size

  const txScore = Math.min(25, totalTransactions >= 250 ? 25 : totalTransactions >= 100 ? 21 : totalTransactions >= 50 ? 16 : totalTransactions >= 15 ? 10 : totalTransactions > 0 ? 5 : 0)
  const consistencyScore = Math.min(25, (activeDays >= 60 ? 16 : activeDays >= 30 ? 12 : activeDays >= 10 ? 8 : activeDays > 0 ? 4 : 0) + (activeMonths >= 6 ? 9 : activeMonths >= 3 ? 6 : activeMonths >= 2 ? 4 : activeMonths > 0 ? 2 : 0))
  const diversityScore = Math.min(25, (protocolDiversity >= 8 ? 12 : protocolDiversity >= 5 ? 9 : protocolDiversity >= 3 ? 6 : protocolDiversity > 0 ? 3 : 0) + (tokenDiversity >= 20 ? 8 : tokenDiversity >= 10 ? 6 : tokenDiversity >= 5 ? 4 : tokenDiversity > 0 ? 2 : 0) + (categoryDiversity >= 5 ? 5 : categoryDiversity >= 3 ? 3 : categoryDiversity > 1 ? 2 : 0))
  const volumeScore = Math.min(15, (stableVolumeUSD >= 5000 ? 8 : stableVolumeUSD >= 1000 ? 6 : stableVolumeUSD >= 250 ? 4 : stableVolumeUSD > 0 ? 2 : 0) + (nativeMovedEth >= 5 ? 7 : nativeMovedEth >= 1 ? 5 : nativeMovedEth >= 0.1 ? 3 : nativeMovedEth > 0 ? 1 : 0))
  const recencyScore = Math.min(10, recent30Tx >= 20 ? 10 : recent30Tx >= 10 ? 7 : recent30Tx >= 3 ? 5 : recent30Tx > 0 ? 3 : lastEvent ? 1 : 0)
  const score = Math.min(100, txScore + consistencyScore + diversityScore + volumeScore + recencyScore)

  const tier = score >= 85 ? 'Power User' : score >= 70 ? 'Airdrop Hunter' : score >= 50 ? 'Active Builder' : score >= 30 ? 'Growing Wallet' : totalTransactions > 0 ? 'Early Base User' : 'Fresh Wallet'
  const confidence = dataSources.includes('Etherscan V2') || dataSources.includes('Alchemy') || dataSources.includes('Moralis')
    ? (dataSources.length >= 2 ? 'High' : 'Medium')
    : 'Low'

  const topProtocols = Object.entries(protocolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }))

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
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

  const strengths = []
  if (totalTransactions >= 100) strengths.push('Strong transaction footprint on Base')
  if (activeMonths >= 3) strengths.push('Activity is spread across multiple months')
  if (protocolDiversity >= 4) strengths.push('Uses several protocol categories instead of one repeated action')
  if (stableVolumeUSD > 0 || dexNativeVolumeEth > 0) strengths.push('Has measurable swap or stablecoin movement')
  if (nftEvents > 0) strengths.push('Shows NFT or mint activity')
  if (recent30Tx >= 3) strengths.push('Recent onchain activity is visible')
  if (strengths.length === 0 && totalTransactions > 0) strengths.push('Wallet has started building Base history')

  const gaps = []
  if (totalTransactions < 50) gaps.push('Transaction count is still light for a serious activity profile')
  if (activeDays < 14) gaps.push('Activity is not yet spread across enough different days')
  if (protocolDiversity < 4) gaps.push('Protocol diversity can be improved')
  if (stableVolumeUSD === 0 && dexNativeVolumeEth === 0) gaps.push('No clear DEX or stablecoin volume detected from available data')
  if (recent30Tx === 0 && totalTransactions > 0) gaps.push('Wallet looks inactive in the last 30 days')
  if (dataSources.length < 2) gaps.push('Report confidence would improve with Alchemy/Moralis plus Etherscan data')

  const nextActions = []
  if (activeDays < 14) nextActions.push('Spread small real actions across more days instead of doing everything at once')
  if (protocolDiversity < 4) nextActions.push('Add variety: one DEX swap, one mint/NFT action, one DeFi or bridge-related action')
  if (stableVolumeUSD < 250) nextActions.push('Build modest stablecoin or swap volume with realistic transaction sizes')
  if (recent30Tx < 3) nextActions.push('Refresh activity with a few recent Base interactions')
  nextActions.push('Keep gas spend natural and avoid repetitive spam patterns')

  const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]

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
    firstTransactionDate: firstEvent ? firstEvent.date.toLocaleDateString() : null,
    daysActive: spanDays,
    favoriteToken: topTokens[0]?.symbol || null,
    mostActiveDay: mostActiveDay ? `${mostActiveDay[0]} (${mostActiveDay[1]} transactions)` : null,
    topTokens,
    funFacts: [
      `Base readiness tier: ${tier}`,
      `${activeDays} active days across ${activeMonths} months`,
      `${protocolDiversity} recognizable protocol groups detected`,
      `Recent 30d activity: ${recent30Tx} transactions`,
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
          : 'This wallet needs more sustained Base usage before it looks like a strong airdrop profile.',
      metrics: {
        totalTransactions,
        activeDays,
        activeWeeks,
        activeMonths,
        spanDays,
        recent30Tx,
        protocolDiversity,
        categoryDiversity,
        tokenDiversity,
        nativeMovedEth: nativeMovedEth.toFixed(6),
        dexNativeVolumeEth: dexNativeVolumeEth.toFixed(6),
        stableVolumeUSD: stableVolumeUSD.toFixed(2),
        gasSpentEth: gasSpentEth.toFixed(6),
        nftEvents,
      },
      scoreBreakdown: [
        { label: 'Transactions', value: txScore, max: 25 },
        { label: 'Consistency', value: consistencyScore, max: 25 },
        { label: 'Diversity', value: diversityScore, max: 25 },
        { label: 'Volume', value: volumeScore, max: 15 },
        { label: 'Recency', value: recencyScore, max: 10 },
      ],
      topProtocols,
      topCategories,
      strengths: strengths.slice(0, 5),
      gaps: gaps.slice(0, 5),
      nextActions: nextActions.slice(0, 5),
      timeline: {
        firstActivity: firstEvent ? firstEvent.date.toISOString() : null,
        lastActivity: lastEvent ? lastEvent.date.toISOString() : null,
        mostActiveDay: mostActiveDay ? { day: mostActiveDay[0], count: mostActiveDay[1] } : null,
      },
      display: {
        stableVolume: `$${formatCompactNumber(stableVolumeUSD)}`,
        nativeMoved: `${formatCompactNumber(nativeMovedEth)} ETH`,
        gasSpent: `${formatCompactNumber(gasSpentEth)} ETH`,
      },
    },
  }
}

async function performBaseWalletReport(walletAddress) {
  console.log(`🔵 Starting professional Base report for: ${walletAddress}`)
  const dataSources = []
  const nativeBalance = await fetchBaseNativeBalance(walletAddress)

  let normalTransactions = []
  let tokenTransfers = []

  try {
    const [txList, tokenTxList] = await Promise.all([
      fetchEtherscanAccountAction(8453, 'txlist', {
        address: walletAddress,
        startblock: '0',
        endblock: '99999999',
        sort: 'desc',
      }),
      fetchEtherscanAccountAction(8453, 'tokentx', {
        address: walletAddress,
        startblock: '0',
        endblock: '99999999',
        sort: 'desc',
      }),
    ])
    normalTransactions = Array.isArray(txList) ? txList : []
    tokenTransfers = Array.isArray(tokenTxList) ? tokenTxList : []
    if (normalTransactions.length || tokenTransfers.length) dataSources.push('Etherscan V2')
    console.log('✅ Base Etherscan data:', { tx: normalTransactions.length, tokenTx: tokenTransfers.length })
  } catch (error) {
    console.warn('⚠️ Base Etherscan V2 unavailable, using fallbacks:', error.message)
  }

  if (normalTransactions.length === 0 && tokenTransfers.length === 0) {
    try {
      const { transactions, source } = await fetchMoralisHistory(walletAddress)
      if (transactions.length) {
        normalTransactions = transactions.map(normalizeMoralisHistoryItem)
        if (source) dataSources.push(source)
        console.log('✅ Base Moralis data:', { tx: normalTransactions.length })
      }
    } catch (error) {
      console.warn('⚠️ Moralis Base history unavailable:', error.message)
    }
  }

  try {
    const { transfers, source } = await fetchAlchemyTransfers(walletAddress)
    if (transfers.length) {
      const normalized = transfers.map(normalizeAlchemyTransfer)
      tokenTransfers = [...tokenTransfers, ...normalized]
      if (source && !dataSources.includes(source)) dataSources.push(source)
      console.log('✅ Base Alchemy transfers:', { transfers: transfers.length })
    }
  } catch (error) {
    console.warn('⚠️ Alchemy Base transfers unavailable:', error.message)
  }

  let tokenBalances = []
  try {
    tokenBalances = await fetchAlchemyTokenBalances(walletAddress)
    if (tokenBalances.length && !dataSources.includes('Alchemy')) dataSources.push('Alchemy')
  } catch (error) {
    console.warn('⚠️ Alchemy token balances unavailable:', error.message)
  }

  if (dataSources.length === 0) dataSources.push('Base RPC')
  return buildBaseReport(walletAddress, nativeBalance, normalTransactions, tokenTransfers, tokenBalances, dataSources)
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
          console.error('❌ API error for balance:', balanceData.message, balanceData.result)
          analysis.nativeBalance = '0.0000'
        } else {
          console.warn('⚠️ Unexpected balance API response format')
          analysis.nativeBalance = '0.0000'
        }
      } else {
        console.error('❌ Balance API HTTP error:', balanceResponse.status, balanceResponse.statusText)
        const errorText = await balanceResponse.text().catch(() => 'Could not read error body')
        console.error('❌ Balance API error body:', errorText.substring(0, 300))
        analysis.nativeBalance = '0.0000'
      }
    } catch (balanceError) {
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
      console.log('📊 Transaction API response:', {
        status: txData.status,
        message: txData.message,
        resultLength: txData.result && Array.isArray(txData.result) ? txData.result.length : 0,
      })

      let transactions = []
      if (txData.status === '1' && txData.result && Array.isArray(txData.result)) {
        transactions = txData.result
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
      console.log('📊 Token transfer API response:', {
        status: tokenTxData.status,
        message: tokenTxData.message,
        resultLength: tokenTxData.result && Array.isArray(tokenTxData.result) ? tokenTxData.result.length : 0,
      })

      let tokenTransfers = []
      if (tokenTxData.status === '1' && tokenTxData.result && Array.isArray(tokenTxData.result)) {
        tokenTransfers = tokenTxData.result
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
    analysis.dataQuality = {
      status: analysis.totalTransactions > 0 || nativeBalance > 0 || analysis.tokenDiversity > 0 ? 'indexed' : 'limited',
      source: 'Etherscan API V2',
      note: analysis.totalTransactions > 0 || nativeBalance > 0 || analysis.tokenDiversity > 0
        ? 'Report generated from available account, transaction, and token transfer endpoints.'
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
      
      return c.json({
        error: 'Analysis failed',
        message: analysisError.message || 'Unknown error occurred',
      }, 500)
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
