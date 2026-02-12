// Allowance Cleaner Endpoint for BaseHub
// Scans wallet for token approvals and identifies risky ones
// Payment: 0.1 USDC on Base via x402

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'
import { createPublicClient, http, formatUnits } from 'viem'
import { base, mainnet, polygon, arbitrum, optimism, bsc, avalanche } from 'viem/chains'

const app = new Hono()

console.log('🚀 Allowance Cleaner API loaded')

// ==========================================
// x402 Payment Configuration
// ==========================================
const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.10' // 0.10 USDC

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = facilitator
  console.log('✅ Using CDP facilitator for Base mainnet')
} else {
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
  console.log('⚠️  WARNING: No CDP API keys found!')
}

// ==========================================
// CORS middleware
// ==========================================
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['X-PAYMENT-RESPONSE'],
  maxAge: 86400,
}))

// ==========================================
// Health check endpoint
// ==========================================
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Allowance Cleaner',
    price: PRICE,
    paymentNetwork: NETWORK,
    supportedNetworks: ['base', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche'],
  })
})

// ==========================================
// Apply x402 payment middleware (Base network)
// ==========================================
// Path must match client request URL for x402 verify (web + Farcaster)
const ALLOWANCE_CLEANER_PATH = '/api/x402-allowance-cleaner'
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': { price: PRICE, network: NETWORK, config: { description: 'BaseHub Allowance Cleaner - Pay 0.10 USDC on Base', mimeType: 'application/json', maxTimeoutSeconds: 600 } },
      [`POST ${ALLOWANCE_CLEANER_PATH}`]: { price: PRICE, network: NETWORK, config: { description: 'BaseHub Allowance Cleaner - Pay 0.10 USDC on Base', mimeType: 'application/json', maxTimeoutSeconds: 600 } },
    },
    facilitatorConfig
  )
)

// ==========================================
// API Configuration
// ==========================================

// Configuration - Etherscan API V2 (one key for all chains!)
// Reference: https://docs.etherscan.io/v2-migration
// "Contract verification using Hardhat/Remix/Foundry also support using a single Etherscan API key for all chains"
const API_KEYS = {
  ALCHEMY: process.env.ALCHEMY_API_KEY || 'e_3LRKM0RipM2jfrPRn-CemN5EgByDgA',
  // Etherscan API V2 - Single key works for ALL Etherscan family chains
  // (Ethereum, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche, etc.)
  ETHERSCAN: process.env.ETHERSCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q',
}

// Rate limits per API (calls per second)
// Etherscan V2 uses same rate limit for all chains
const RATE_LIMITS = {
  etherscan: 5,    // 5 calls/sec on free tier (all chains use this)
}

// Event signatures for all approval types
const EVENT_SIGNATURES = {
  // ERC20 Approval: event Approval(address indexed owner, address indexed spender, uint256 value)
  ERC20_APPROVAL: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
  
  // ERC721 Approval: event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)
  ERC721_APPROVAL: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
  
  // ERC721 ApprovalForAll: event ApprovalForAll(address indexed owner, address indexed operator, bool approved)
  ERC721_APPROVAL_FOR_ALL: '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',
  
  // ERC1155 ApprovalForAll: event ApprovalForAll(address indexed account, address indexed operator, bool approved)
  ERC1155_APPROVAL_FOR_ALL: '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',
}

console.log('🔑 API Keys Configuration:')
console.log(`  - ALCHEMY: ${API_KEYS.ALCHEMY ? `${API_KEYS.ALCHEMY.substring(0, 10)}... (${API_KEYS.ALCHEMY.length} chars)` : '❌ NOT SET'}`)
console.log(`  - ETHERSCAN (V2 - works for ALL chains): ${API_KEYS.ETHERSCAN ? `${API_KEYS.ETHERSCAN.substring(0, 10)}... (${API_KEYS.ETHERSCAN.length} chars)` : '❌ NOT SET'}`)

// Warn about missing keys
const missingKeys = []
if (!API_KEYS.ALCHEMY || API_KEYS.ALCHEMY === '') missingKeys.push('ALCHEMY')
if (!API_KEYS.ETHERSCAN || API_KEYS.ETHERSCAN === '') missingKeys.push('ETHERSCAN')

if (missingKeys.length > 0) {
  console.warn('⚠️ WARNING: Missing API keys:', missingKeys.join(', '))
  console.warn('⚠️ The API will work with limited functionality (common spenders only)')
  console.warn('⚠️ Get your API keys from:')
  console.warn('   - Alchemy: https://alchemy.com')
  console.warn('   - Etherscan V2 (works for ALL chains): https://etherscan.io/myapikey')
}

// Supported networks - Etherscan API V2 configuration
// Reference: https://docs.etherscan.io/v2-migration
// V2 uses: https://api.etherscan.io/v2/api?chainid=X&module=...&apikey=YOUR_KEY
// One Etherscan API key works for ALL chains!
const SUPPORTED_NETWORKS = {
  'base': { 
    chainId: 8453, 
    name: 'Base Mainnet',
    slug: 'base',
    rpc: `https://base-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
    // V2 API: Use Etherscan V2 endpoint with chainid parameter
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN, // Single key for all chains!
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: base,
    nativeToken: 'ETH',
    explorerUrl: 'https://basescan.org'
  },
  'ethereum': { 
    chainId: 1, 
    name: 'Ethereum Mainnet',
    slug: 'ethereum',
    rpc: `https://eth-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN,
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: mainnet,
    nativeToken: 'ETH',
    explorerUrl: 'https://etherscan.io'
  },
  'polygon': { 
    chainId: 137, 
    name: 'Polygon Mainnet',
    slug: 'polygon',
    rpc: `https://polygon-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN,
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: polygon,
    nativeToken: 'MATIC',
    explorerUrl: 'https://polygonscan.com'
  },
  'arbitrum': { 
    chainId: 42161, 
    name: 'Arbitrum One',
    slug: 'arbitrum',
    rpc: `https://arb-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN,
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: arbitrum,
    nativeToken: 'ETH',
    explorerUrl: 'https://arbiscan.io'
  },
  'optimism': { 
    chainId: 10, 
    name: 'Optimism',
    slug: 'optimism',
    rpc: `https://opt-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN,
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: optimism,
    nativeToken: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io'
  },
  'bsc': { 
    chainId: 56, 
    name: 'BNB Chain',
    slug: 'bsc',
    rpc: 'https://bsc-dataseed.binance.org',
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN,
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: bsc,
    nativeToken: 'BNB',
    explorerUrl: 'https://bscscan.com'
  },
  'avalanche': { 
    chainId: 43114, 
    name: 'Avalanche',
    slug: 'avalanche',
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKey: API_KEYS.ETHERSCAN,
    apiRateLimit: RATE_LIMITS.etherscan,
    viemChain: avalanche,
    nativeToken: 'AVAX',
    explorerUrl: 'https://snowtrace.io'
  },
}

// ERC20 ABI
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }, { name: '_spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  }
]

// Common spenders
const COMMON_SPENDERS = [
  '0x4200000000000000000000000000000000000006',
  '0x2626664c2603336E57B271c5C0b26F421741e481',
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2',
  '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb',
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
  '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
  '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
  '0x1111111254EEB25477B68fb85Ed929f73A960582',
  '0x11111112542D85B3EF69AE05771c2dCCff4fAa26',
  '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
  '0x216B4B4Ba9F3e719726886d34a177484278Bfcae',
  '0x3328F7f4A1D1C57c35df56bBf0c9dCAFCA309C49',
  '0xB4B0ea46Fe0E9e8EAB4aFb765b527739F2718671',
]

// CORS
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Helpers
function createNetworkClient(network) {
  return createPublicClient({
    chain: network.viemChain,
    transport: http(network.rpc)
  })
}

async function getTokenInfo(tokenAddress, publicClient) {
  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => 'UNKNOWN'),
      publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'name' }).catch(() => 'Unknown Token'),
      publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18)
    ])
    return { symbol, name, decimals }
  } catch (error) {
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 }
  }
}

// Rate limiter helper - more conservative to avoid hitting limits
async function rateLimitedDelay(network) {
  // Use 250ms delay (4 calls/sec max) to stay safely under 5 calls/sec limit
  // This accounts for concurrent requests and timing variations
  const delayMs = 250 // Conservative: 4 calls/sec instead of 5
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

// Fetch with retry logic
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-AllowanceCleaner/1.0',
          ...options.headers,
        },
      })
      
      if (!response.ok && i < maxRetries - 1) {
        console.warn(`  ⚠️ HTTP ${response.status}, retrying... (${i + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        continue
      }
      
      return response
    } catch (error) {
      if (i === maxRetries - 1) throw error
      console.warn(`  ⚠️ Fetch error: ${error.message}, retrying... (${i + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

// Get all tokens interacted with by address - using multiple Etherscan endpoints
async function getAllTokensForAddress(walletAddress, network) {
  console.log(`📦 STEP 1: Fetching all tokens for address...`)
  
  const uniqueTokens = new Set()
  const tokenMetadata = new Map() // Store token info
  
  try {
    // 1. Get ERC20 tokens via tokentx (token transfers)
    console.log(`  📄 Fetching ERC20 token transfers...`)
    await fetchTokenTransfers(walletAddress, network, uniqueTokens, tokenMetadata, 'ERC20')
    
    // 2. Get ERC721 tokens via tokennfttx  
    console.log(`  📄 Fetching ERC721 token transfers...`)
    await fetchTokenTransfers(walletAddress, network, uniqueTokens, tokenMetadata, 'ERC721')
    
    // 3. Get ERC1155 tokens via token1155tx
    console.log(`  📄 Fetching ERC1155 token transfers...`)
    await fetchTokenTransfers(walletAddress, network, uniqueTokens, tokenMetadata, 'ERC1155')
    
    console.log(`✅ Total found: ${uniqueTokens.size} unique tokens across all standards`)
    
    // If no tokens found, add popular tokens as fallback
    if (uniqueTokens.size === 0) {
      console.log(`  ⚠️ No tokens found via API, adding popular tokens for ${network.name}`)
      addPopularTokens(network.slug, uniqueTokens)
    }
    
  } catch (err) {
    console.error(`❌ Token fetch error:`, err.message)
    addPopularTokens(network.slug, uniqueTokens)
  }
  
  return { uniqueTokens, tokenMetadata }
}

// Fetch token transfers for specific token standard
async function fetchTokenTransfers(walletAddress, network, uniqueTokens, tokenMetadata, standard = 'ERC20') {
  const actions = {
    'ERC20': 'tokentx',
    'ERC721': 'tokennfttx', 
    'ERC1155': 'token1155tx'
  }
  
  const action = actions[standard]
  if (!action) return
  
  try {
    // Check if API key is valid
    if (!network.apiKey || network.apiKey === '') {
      console.log(`    ⚠️ No API key for ${network.name}, skipping ${standard} transfers`)
      return
    }
    
    // Fetch with pagination - up to 10 pages (10,000 records)
    for (let page = 1; page <= 10; page++) {
      // Etherscan API V2 format: add chainid parameter
      const url = `${network.apiUrl}?chainid=${network.chainId}&module=account&action=${action}&address=${walletAddress}&startblock=0&endblock=99999999&page=${page}&offset=1000&sort=desc&apikey=${network.apiKey}`
      
      // Debug: Log the request (hide API key)
      const debugUrl = url.replace(network.apiKey, '***HIDDEN***')
      console.log(`    🌐 Request: ${debugUrl}`)
      
      const res = await fetchWithRetry(url)
      if (!res.ok) {
        console.log(`    ⚠️ HTTP ${res.status} on page ${page}, stopping ${standard} fetch`)
        break
      }
      
      const data = await res.json()
      
      // Debug: Log full response for first page
      if (page === 1) {
        console.log(`    📊 Raw API Response:`, JSON.stringify(data).substring(0, 200))
      }
      
      // Check for API errors
      if (data.status === '0') {
        // Common error messages
        if (data.message === 'No transactions found') {
          if (page === 1) console.log(`    ℹ️ ${standard}: No transactions found`)
        } else if (data.message === 'NOTOK') {
          if (page === 1) {
            console.log(`    ⚠️ ${standard}: API returned NOTOK`)
            console.log(`    ℹ️ Full error:`, data.result || data.message)
            console.log(`    ℹ️ This usually means:`)
            console.log(`       - Invalid API key`)
            console.log(`       - API key not activated`)
            console.log(`       - Rate limit exceeded`)
          }
        } else if (data.message && data.message.includes('rate limit')) {
          console.log(`    ⚠️ ${standard}: Rate limit hit - ${data.result}`)
          console.log(`    ⏳ Waiting 2 seconds before continuing...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          if (page === 1) console.log(`    ℹ️ ${standard}: ${data.message}`)
        }
        break
      }
      
      if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
        data.result.forEach(tx => {
          if (tx.contractAddress) {
            const addr = tx.contractAddress.toLowerCase()
            uniqueTokens.add(addr)
            
            // Store metadata if available
            if (tx.tokenSymbol || tx.tokenName) {
              tokenMetadata.set(addr, {
                symbol: tx.tokenSymbol || 'UNKNOWN',
                name: tx.tokenName || 'Unknown Token',
                decimals: tx.tokenDecimal ? parseInt(tx.tokenDecimal) : 18,
                type: standard
              })
            }
          }
        })
        
        console.log(`    ✅ Page ${page}: ${data.result.length} ${standard} transactions, total ${uniqueTokens.size} tokens`)
        
        // If less than 1000 results, we've reached the end
        if (data.result.length < 1000) break
        
        // Rate limiting
        await rateLimitedDelay(network)
      } else {
        // Empty result or unexpected format
        break
      }
    }
  } catch (error) {
    console.error(`    ❌ Error fetching ${standard} transfers:`, error.message)
  }
}

// Add popular tokens for network
function addPopularTokens(networkSlug, uniqueTokens) {
  const popularTokens = {
    'base': [
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      '0x4200000000000000000000000000000000000006', // WETH
      '0x50c5725949A68F4B1E3295a3Fd0E88C1C4d3F3C9', // DAI
    ],
    'ethereum': [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    ],
    'polygon': [
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    ],
    'arbitrum': [
      '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
    ],
    'optimism': [
      '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC
      '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
      '0x4200000000000000000000000000000000000006', // WETH
    ],
    'bsc': [
      '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
      '0x55d398326f99059fF775485246999027B3197955', // USDT
      '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // WETH
    ],
    'avalanche': [
      '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC
      '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', // USDT
      '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', // WETH
    ]
  }
  
  const tokens = popularTokens[networkSlug] || popularTokens['base']
  tokens.forEach(token => uniqueTokens.add(token.toLowerCase()))
  console.log(`  ✅ Added ${tokens.length} popular tokens`)
}

// Fetch approval events using Etherscan getLogs API
async function fetchApprovalEvents(walletAddress, network, uniqueTokens) {
  console.log(`\n🔐 STEP 2: Fetching ALL approval events via Etherscan API...`)
  
  const tokenSpenderPairs = new Map() // Map<tokenAddress, Set<spenderAddress>>
  
  // Initialize with tokens we found
  uniqueTokens.forEach(token => {
    tokenSpenderPairs.set(token, new Set())
  })
  
  // Check if API key is valid
  if (!network.apiKey || network.apiKey === '') {
    console.log(`  ⚠️ No API key configured for ${network.name}`)
    console.log(`  ℹ️ Skipping Etherscan API, will rely on common spenders only`)
    return tokenSpenderPairs
  }
  
  try {
    const ownerTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase()
    
    // Event signatures for all approval types
    const approvalTypes = [
      { 
        name: 'ERC20/ERC721 Approval', 
        // event Approval(address indexed owner, address indexed spender, uint256 value)
        topic: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      },
      { 
        name: 'ERC721/ERC1155 ApprovalForAll', 
        // event ApprovalForAll(address indexed owner, address indexed operator, bool approved)
        topic: '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31'
      },
    ]
    
    let apiWorked = false
    
    for (const approvalType of approvalTypes) {
      console.log(`\n  📋 Fetching ${approvalType.name} events...`)
      
      // Try Etherscan API getLogs endpoint (supports full history)
      // V2 format: add chainid parameter
      const logsUrl = `${network.apiUrl}?chainid=${network.chainId}&module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${approvalType.topic}&topic1=${ownerTopic}&apikey=${network.apiKey}`
      
      // Debug: Log the request (hide API key)
      const debugUrl = logsUrl.replace(network.apiKey, '***HIDDEN***')
      console.log(`  🌐 Request URL: ${debugUrl.substring(0, 150)}...`)
      console.log(`  🌐 Scanning ${network.name} (chainid=${network.chainId}) from block 0 to latest`)
      
      const logsResponse = await fetchWithRetry(logsUrl)
      
      if (!logsResponse.ok) {
        console.error(`  ❌ API HTTP error: ${logsResponse.status}`)
        continue
      }
      
      const logsData = await logsResponse.json()
      
      // Debug: Log full response
      console.log(`  📊 Full API Response:`, JSON.stringify(logsData).substring(0, 300))
      
      console.log(`  📊 API Response:`, {
        status: logsData.status,
        message: logsData.message,
        resultLength: Array.isArray(logsData.result) ? logsData.result.length : 0
      })
      
      // Check for API errors
      if (logsData.status === '0') {
        if (logsData.message === 'No records found') {
          console.log(`  ℹ️ ${approvalType.name}: No approval events found`)
        } else if (logsData.message === 'NOTOK') {
          console.log(`  ⚠️ ${approvalType.name}: API returned NOTOK`)
          if (logsData.result) {
            console.log(`  ℹ️ API details:`, logsData.result)
          }
        } else if (logsData.message && logsData.message.includes('rate limit')) {
          console.log(`  ⚠️ ${approvalType.name}: Rate limit hit - ${logsData.result}`)
          console.log(`  ⏳ Waiting 2 seconds before continuing...`)
          await new Promise(resolve => setTimeout(resolve, 2000)) // Extra delay on rate limit
        } else {
          console.log(`  ⚠️ ${approvalType.name}: ${logsData.message}`)
        }
        await rateLimitedDelay(network)
        continue
      }
      
      // If API works (status '1'), use it
      if (logsData.status === '1' && Array.isArray(logsData.result)) {
        console.log(`  ✅ Found ${logsData.result.length} ${approvalType.name} events via API`)
        apiWorked = true
        
        // Parse logs to extract token-spender pairs
        logsData.result.forEach(log => {
          try {
            const tokenAddress = log.address.toLowerCase()
            
            // topic[0] = event signature
            // topic[1] = owner (indexed)
            // topic[2] = spender/operator (indexed)
            if (log.topics && log.topics[2]) {
              const spenderAddress = '0x' + log.topics[2].slice(26).toLowerCase()
              
              if (!tokenSpenderPairs.has(tokenAddress)) {
                tokenSpenderPairs.set(tokenAddress, new Set())
                uniqueTokens.add(tokenAddress) // Add to uniqueTokens for on-chain checks
              }
              tokenSpenderPairs.get(tokenAddress).add(spenderAddress)
            }
          } catch (e) {
            console.warn('  ⚠️ Error parsing log:', e.message)
          }
        })
        
        console.log(`  ✅ Extracted spenders from ${approvalType.name} events`)
      }
      
      // Rate limiting
      await rateLimitedDelay(network)
    }
    
    // If API didn't work, log warning but continue (will use common spenders)
    if (!apiWorked) {
      console.log(`\n  ⚠️ Etherscan API didn't provide approval events`)
      console.log(`  ℹ️ Will check common spenders only (limited but functional scan)`)
      // RPC fallback removed - causing 400 errors and not necessary
    }
    
  } catch (err) {
    console.error(`  ❌ Approval events fetch error:`, err.message)
  }
  
  return tokenSpenderPairs
}

// Risk analysis
function analyzeRisk(allowanceAmount, spenderAddress, tokenBalance) {
  const allowance = BigInt(allowanceAmount)
  const balance = BigInt(tokenBalance)
  const maxUint256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
  
  if (allowance >= maxUint256) {
    return { riskLevel: 'high', reason: 'Unlimited allowance' }
  }
  if (allowance > balance * 10n) {
    return { riskLevel: 'high', reason: 'Allowance >> balance' }
  }
  if (allowance > balance * 2n) {
    return { riskLevel: 'medium', reason: 'Allowance > 2x balance' }
  }
  if (allowance > balance && balance > 0n) {
    return { riskLevel: 'medium', reason: 'Allowance > balance' }
  }
  return { riskLevel: 'low', reason: 'Reasonable allowance' }
}
// Main scan function - RevokeCash inspired approach
async function scanAllowances(walletAddress, selectedNetwork = 'base') {
  console.log(`🔍 Scanning: ${walletAddress} on ${selectedNetwork}`)
  
  const allowances = []
  const network = SUPPORTED_NETWORKS[selectedNetwork] || SUPPORTED_NETWORKS['base']
  const publicClient = createNetworkClient(network)
  
  // STEP 1: Get all tokens (ERC20, ERC721, ERC1155)
  const { uniqueTokens, tokenMetadata } = await getAllTokensForAddress(walletAddress, network)
  
  // STEP 2: Fetch approval events
  const tokenSpenderPairs = await fetchApprovalEvents(walletAddress, network, uniqueTokens)
  
  // STEP 3: Add common spenders to all tokens
  console.log(`\n🎯 STEP 3: Adding common spenders...`)
  uniqueTokens.forEach(token => {
    if (!tokenSpenderPairs.has(token)) {
      tokenSpenderPairs.set(token, new Set())
    }
    COMMON_SPENDERS.forEach(spender => {
      tokenSpenderPairs.get(token).add(spender.toLowerCase())
    })
  })
  
  const totalSpenderPairs = Array.from(tokenSpenderPairs.values()).reduce((sum, spenders) => sum + spenders.size, 0)
  console.log(`✅ Will check ${totalSpenderPairs} token-spender pairs`)
  
  // STEP 4: Check on-chain allowances
  console.log(`\n✅ STEP 4: Checking on-chain allowances...`)
  
  let checkedCount = 0
  let foundCount = 0
  let totalSpenderChecks = 0
  
  for (const [tokenAddress, spenders] of tokenSpenderPairs) {
    if (spenders.size === 0) continue
    
    try {
      // Try to get token info from metadata first, otherwise fetch on-chain
      let tokenInfo = tokenMetadata.get(tokenAddress)
      if (!tokenInfo) {
        tokenInfo = await getTokenInfo(tokenAddress, publicClient)
      }
      
      checkedCount++
      console.log(`\n📊 [${checkedCount}/${tokenSpenderPairs.size}] Checking ${tokenInfo.symbol} (${tokenAddress})`)
      console.log(`   Will check ${spenders.size} spenders for this token`)
      
      let balance = 0n
      try {
        balance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress]
        })
        console.log(`   Balance: ${balance > 0n ? formatUnits(balance, tokenInfo.decimals) : '0'} ${tokenInfo.symbol}`)
      } catch (e) {
        console.log(`   ⚠️ Could not fetch balance (might be NFT or non-standard token)`)
      }
      
      let spenderCheckCount = 0
      for (const spender of spenders) {
        spenderCheckCount++
        totalSpenderChecks++
        
        try {
          const allowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress, spender]
          })
          
          // Log ALL spender checks (first 3 + all non-zero)
          if (spenderCheckCount <= 3 || allowance > 0n) {
            console.log(`   [${spenderCheckCount}/${spenders.size}] Spender ${spender.substring(0, 10)}... allowance: ${allowance > 0n ? allowance.toString() : '0'}`)
          }
          
          if (allowance > 0n) {
            foundCount++
            const { riskLevel, reason } = analyzeRisk(allowance.toString(), spender, balance.toString())
            const maxUint = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
            const isUnlimited = allowance >= maxUint
            
            // Format amount for display
            let displayAmount = 'Unlimited'
            if (!isUnlimited) {
              const formatted = formatUnits(allowance, tokenInfo.decimals)
              const num = parseFloat(formatted)
              
              // Format based on size
              if (num >= 1e9) {
                displayAmount = `${(num / 1e9).toFixed(2)}B ${tokenInfo.symbol}`
              } else if (num >= 1e6) {
                displayAmount = `${(num / 1e6).toFixed(2)}M ${tokenInfo.symbol}`
              } else if (num >= 1e3) {
                displayAmount = `${(num / 1e3).toFixed(2)}K ${tokenInfo.symbol}`
              } else if (num >= 1) {
                displayAmount = `${num.toFixed(4)} ${tokenInfo.symbol}`
              } else if (num > 0) {
                displayAmount = `${num.toExponential(2)} ${tokenInfo.symbol}`
              } else {
                displayAmount = `0 ${tokenInfo.symbol}`
              }
            }
            
            allowances.push({
              tokenAddress,
              tokenSymbol: tokenInfo.symbol,
              tokenName: tokenInfo.name,
              tokenType: tokenInfo.type || 'ERC20',
              decimals: tokenInfo.decimals,
              spenderAddress: spender,
              spenderName: null,
              amount: allowance.toString(),
              amountFormatted: displayAmount,
              amountRaw: formatUnits(allowance, tokenInfo.decimals),
              balance: balance.toString(),
              balanceFormatted: balance > 0n ? formatUnits(balance, tokenInfo.decimals) : '0',
              isUnlimited,
              riskLevel,
              reason,
              network: selectedNetwork, // Add network info for frontend
              chainId: network.chainId
            })
            
            console.log(`   ✅ Found approval: ${tokenInfo.symbol} -> ${spender.substring(0, 10)}... (${isUnlimited ? 'Unlimited' : allowance.toString()})`)
          }
        } catch (e) {
          // Allowance check failed, log error
          if (spenderCheckCount <= 3) {
            console.log(`   [${spenderCheckCount}/${spenders.size}] Spender ${spender.substring(0, 10)}... allowance check failed: ${e.message}`)
          }
        }
      }
      
      console.log(`   ✅ Completed checking ${spenderCheckCount} spenders for ${tokenInfo.symbol}`)
      
    } catch (err) {
      // Token info failed, skip
      console.log(`   ⚠️ Failed to get token info for ${tokenAddress}: ${err.message}`)
    }
  }
  
  // Sort by risk level
  allowances.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 }
    return order[b.riskLevel] - order[a.riskLevel]
  })
  
  console.log(`\n📊 Scan Summary:`)
  console.log(`   - Tokens checked: ${checkedCount}`)
  console.log(`   - Total spender checks: ${totalSpenderChecks}`)
  console.log(`   - Active allowances found: ${foundCount}`)
  console.log(`\n✅ Scan completed: Found ${allowances.length} active allowances`)
  console.log(`   - High risk: ${allowances.filter(a => a.riskLevel === 'high').length}`)
  console.log(`   - Medium risk: ${allowances.filter(a => a.riskLevel === 'medium').length}`)
  console.log(`   - Low risk: ${allowances.filter(a => a.riskLevel === 'low').length}`)
  
  if (allowances.length === 0 && checkedCount > 0) {
    console.log(`\n   ℹ️ All checked allowances are 0 (already revoked or never approved)`)
  }
  
  return allowances
}

// Handler for POST (shared for both route paths)
async function handleAllowanceScanPost(c) {
  try {
    let walletAddress, network
    const bodyHeader = c.req.header('X-Body')
    if (bodyHeader) {
      try {
        const parsed = JSON.parse(bodyHeader)
        walletAddress = parsed.walletAddress
        network = parsed.network
      } catch (e) {
        return c.json({ success: false, error: 'Invalid X-Body JSON' }, 400)
      }
    } else {
      try {
        const body = await c.req.json()
        walletAddress = body.walletAddress
        network = body.network
      } catch (e) {
        return c.json({ success: false, error: 'Invalid or missing request body', details: e.message }, 400)
      }
    }

    if (!walletAddress) {
      return c.json({ success: false, error: 'Wallet address required' }, 400)
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ success: false, error: 'Invalid Ethereum address format' }, 400)
    }
    
    const selectedNetwork = network || 'base'
    
    if (!SUPPORTED_NETWORKS[selectedNetwork]) {
      return c.json({ 
        success: false, 
        error: 'Unsupported network',
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS)
      }, 400)
    }
    
    console.log(`\n🚀 Starting allowance scan for ${walletAddress} on ${selectedNetwork}...`)
    const startTime = Date.now()
    
    const allowances = await scanAllowances(walletAddress, selectedNetwork)
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    console.log(`\n✅ Scan completed in ${duration}s`)
    
    return c.json({
      success: true,
      network: {
        name: SUPPORTED_NETWORKS[selectedNetwork].name,
        chainId: SUPPORTED_NETWORKS[selectedNetwork].chainId,
        slug: selectedNetwork
      },
      allowances,
      stats: {
        totalFound: allowances.length,
        highRisk: allowances.filter(a => a.riskLevel === 'high').length,
        mediumRisk: allowances.filter(a => a.riskLevel === 'medium').length,
        lowRisk: allowances.filter(a => a.riskLevel === 'low').length,
        unlimitedApprovals: allowances.filter(a => a.isUnlimited).length
      },
      scannedAt: new Date().toISOString(),
      scanDuration: `${duration}s`
    })
    
  } catch (error) {
    console.error('❌ Allowance scan error:', error)
    return c.json({
      success: false,
      error: error.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, 500)
  }
}
app.post('/', handleAllowanceScanPost)
app.post(ALLOWANCE_CLEANER_PATH, handleAllowanceScanPost)

// Vercel handler - URL must match client request URL for x402 payment verification
export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || ''
    const path = (req.url && req.url.startsWith('/api')) ? req.url.split('?')[0] : ALLOWANCE_CLEANER_PATH
    const fullUrl = `${protocol}://${host}${path}${(req.url && req.url.includes('?')) ? '?' + req.url.split('?')[1] : ''}`

    let body = undefined
    const bodyString = req.method !== 'GET' && req.method !== 'HEAD' && req.body
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      : undefined

    const headers = new Headers(req.headers || {})
    if (bodyString) {
      headers.set('X-Body', bodyString)
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers,
      body: bodyString,
    })

    const response = await app.fetch(request)

    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const responseBody = await response.text()
    res.status(response.status)

    if (responseBody) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        res.json(JSON.parse(responseBody))
      } else {
        res.send(responseBody)
      }
    } else {
      res.end()
    }
  } catch (error) {
    console.error('❌ Handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', message: error.message })
    }
  }
}
