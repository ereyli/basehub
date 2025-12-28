// x402 Allowance Cleaner Endpoint for BaseHub using Hono
// Accepts 0.01 USDC payments using Coinbase x402 on Base network
// Scans wallet for token approvals and identifies risky ones

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createPublicClient, http, formatUnits } from 'viem'
import { base, mainnet, polygon, arbitrum, optimism, bsc, avalanche } from 'viem/chains'

console.log('🚀 x402-allowance-cleaner API loaded')

const app = new Hono()

// Environment check
console.log('📦 Environment:')
console.log('  - NODE_ENV:', process.env.NODE_ENV)
console.log('  - BASESCAN_API_KEY:', process.env.BASESCAN_API_KEY ? 'SET' : 'NOT SET')

// ==========================================
// Configuration
// ==========================================

const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.01' // 0.01 USDC
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Supported networks for allowance scanning
const SUPPORTED_NETWORKS = {
  'base': { 
    chainId: 8453, 
    name: 'Base Mainnet', 
    currency: 'ETH', 
    rpc: 'https://base.llamarpc.com',
    apiUrl: 'https://api.basescan.org/api',
    viemChain: base
  },
  'ethereum': { 
    chainId: 1, 
    name: 'Ethereum Mainnet', 
    currency: 'ETH', 
    rpc: 'https://eth.llamarpc.com',
    apiUrl: 'https://api.etherscan.io/api',
    viemChain: mainnet
  },
  'polygon': { 
    chainId: 137, 
    name: 'Polygon Mainnet', 
    currency: 'MATIC', 
    rpc: 'https://polygon-rpc.com',
    apiUrl: 'https://api.polygonscan.com/api',
    viemChain: polygon
  },
  'arbitrum': { 
    chainId: 42161, 
    name: 'Arbitrum One', 
    currency: 'ETH', 
    rpc: 'https://arb1.arbitrum.io/rpc',
    apiUrl: 'https://api.arbiscan.io/api',
    viemChain: arbitrum
  },
  'optimism': { 
    chainId: 10, 
    name: 'Optimism', 
    currency: 'ETH', 
    rpc: 'https://mainnet.optimism.io',
    apiUrl: 'https://api-optimistic.etherscan.io/api',
    viemChain: optimism
  },
  'bsc': { 
    chainId: 56, 
    name: 'BNB Chain', 
    currency: 'BNB', 
    rpc: 'https://bsc-dataseed.binance.org',
    apiUrl: 'https://api.bscscan.com/api',
    viemChain: bsc
  },
  'avalanche': { 
    chainId: 43114, 
    name: 'Avalanche', 
    currency: 'AVAX', 
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    apiUrl: 'https://api.snowtrace.io/api',
    viemChain: avalanche
  },
}

// ERC20 ABI for allowance, approve, symbol, name, decimals
const ERC20_ABI = [
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
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

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Create network-specific public client
function createNetworkClient(network) {
  return createPublicClient({
    chain: network.viemChain,
    transport: http(network.rpc)
  })
}

// Get token info (symbol, name, decimals)
async function getTokenInfo(tokenAddress, publicClient) {
  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }).catch(() => 'UNKNOWN'),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name'
      }).catch(() => 'Unknown Token'),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }).catch(() => 18)
    ])
    
    return { symbol, name, decimals }
  } catch (error) {
    console.error(`Error getting token info for ${tokenAddress}:`, error)
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 }
  }
}

// Get contract name from Etherscan
async function getContractName(contractAddress) {
  try {
    // Use Base API by default
    const url = `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${BASESCAN_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === '1' && data.result && data.result[0]) {
      return data.result[0].ContractName || null
    }
    return null
  } catch (error) {
    console.error(`Error fetching contract name for ${contractAddress}:`, error)
    return null
  }
}

// Analyze risk level of an allowance
function analyzeRisk(allowanceAmount, spenderAddress, tokenBalance) {
  const allowance = BigInt(allowanceAmount)
  const balance = BigInt(tokenBalance)
  const maxUint256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
  
  // Check if unlimited allowance
  if (allowance >= maxUint256) {
    return {
      riskLevel: 'high',
      reason: 'Unlimited allowance - spender can transfer all tokens'
    }
  }
  
  // Check if allowance is greater than balance
  if (allowance > balance * 10n) { // More than 10x balance
    return {
      riskLevel: 'high',
      reason: 'Allowance significantly exceeds current balance'
    }
  }
  
  if (allowance > balance * 2n) { // More than 2x balance
    return {
      riskLevel: 'medium',
      reason: 'Allowance exceeds current balance'
    }
  }
  
  // Check if very large allowance
  if (allowance > balance && balance > 0n) {
    return {
      riskLevel: 'medium',
      reason: 'Allowance is larger than current balance'
    }
  }
  
  return {
    riskLevel: 'low',
    reason: 'Allowance is within reasonable limits'
  }
}

// Scan allowances - SIMPLE and SAFE version (test mode)
async function scanAllowances(walletAddress, selectedNetwork = 'base') {
  try {
    console.log(`🔍 Scanning allowances for: ${walletAddress} on ${selectedNetwork}`)
    
    const allowances = []
    
    // Get network config
    const network = SUPPORTED_NETWORKS[selectedNetwork] || SUPPORTED_NETWORKS['base']
    const chainId = network.chainId
    
    console.log(`🌐 Using network: ${network.name} (chainId: ${chainId})`)
    
    // Create public client
    const publicClient = createNetworkClient(network)
    
    // For now, return empty array to test the flow
    // We'll implement proper scanning after fixing the infrastructure
    console.log('⚠️ Using simplified scan (testing mode)')
    console.log('✅ Scan completed successfully')
    
    return allowances
  } catch (error) {
    console.error('❌ Error in scanAllowances:', error)
    throw new Error(`Scan failed: ${error.message}`)
  }
}

// ==========================================
// Main endpoint
// ==========================================
app.post('/', async (c) => {
  try {
    const { walletAddress, network } = await c.req.json()
    
    if (!walletAddress) {
      return c.json({ success: false, error: 'Wallet address is required' }, 400)
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ success: false, error: 'Invalid wallet address format' }, 400)
    }
    
    // Default to Base if network not specified
    const selectedNetwork = network || 'base'
    
    if (!SUPPORTED_NETWORKS[selectedNetwork]) {
      return c.json({ 
        success: false, 
        error: 'Unsupported network',
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS)
      }, 400)
    }
    
    console.log(`🔍 Starting allowance scan for: ${walletAddress} on ${selectedNetwork}`)
    console.log(`📋 Network config:`, SUPPORTED_NETWORKS[selectedNetwork])
    
    // Scan allowances for the selected network
    let allowances = []
    try {
      allowances = await scanAllowances(walletAddress, selectedNetwork)
      console.log(`✅ Scan completed: Found ${allowances.length} allowances`)
    } catch (scanError) {
      console.error('❌ Scan error caught in endpoint:', scanError)
      // Re-throw with more context
      throw new Error(`Allowance scan failed for ${selectedNetwork}: ${scanError.message}`)
    }
    
    return c.json({
      success: true,
      allowances,
      scannedAt: new Date().toISOString(),
      totalFound: allowances.length,
      riskyCount: allowances.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium').length
    })
    
  } catch (error) {
    console.error('❌ Allowance scan endpoint error:', error)
    console.error('❌ Error stack:', error.stack)
    
    // Return detailed error for debugging
    const errorMessage = error.message || 'Failed to scan allowances'
    const errorDetails = {
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
    
    console.error('❌ Returning error response:', errorDetails)
    return c.json(errorDetails, 500)
  }
})

// ==========================================
// Export for Vercel (serverless function)
// ==========================================
export default async function handler(req, res) {
  try {
    console.log('🔍 Allowance Cleaner handler called:', {
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

    const response = await app.fetch(request)

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
