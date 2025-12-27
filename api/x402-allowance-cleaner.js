// x402 Allowance Cleaner Endpoint for BaseHub using Hono
// Accepts 0.01 USDC payments using Coinbase x402 on Base network
// Scans wallet for token approvals and identifies risky ones

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'
import { createPublicClient, http, formatUnits, maxUint256 } from 'viem'
import { base } from 'viem/chains'

const app = new Hono()

// ==========================================
// Configuration
// ==========================================

const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.01' // 0.01 USDC
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Supported networks for allowance scanning (same as wallet analysis)
const SUPPORTED_NETWORKS = {
  'base': { chainId: 8453, name: 'Base Mainnet', currency: 'ETH', rpc: 'https://mainnet.base.org' },
  'ethereum': { chainId: 1, name: 'Ethereum Mainnet', currency: 'ETH', rpc: 'https://eth.llamarpc.com' },
  'polygon': { chainId: 137, name: 'Polygon Mainnet', currency: 'MATIC', rpc: 'https://polygon-rpc.com' },
  'arbitrum': { chainId: 42161, name: 'Arbitrum One', currency: 'ETH', rpc: 'https://arb1.arbitrum.io/rpc' },
  'optimism': { chainId: 10, name: 'Optimism', currency: 'ETH', rpc: 'https://mainnet.optimism.io' },
  'bsc': { chainId: 56, name: 'BNB Chain', currency: 'BNB', rpc: 'https://bsc-dataseed.binance.org' },
  'avalanche': { chainId: 43114, name: 'Avalanche', currency: 'AVAX', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
}

// Base network popular tokens to scan
const BASE_TOKENS = [
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  },
  {
    address: '0x4200000000000000000000000000000000000006', // WETH
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18
  },
  {
    address: '0x50c5725949A68F4B1E3295a3Fd0E88C1C4d3F3C9', // DAI
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18
  },
  {
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6
  }
]

// Known safe contracts (DEX routers, popular protocols)
const KNOWN_SAFE_CONTRACTS = [
  '0x2626664c2603336E57B271c5C0b26F421741e481', // Uniswap V3 Router
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // Uniswap V2 Router
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // Uniswap Universal Router
  '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Permit2
]

// ERC20 ABI
const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  }
]

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
    supportedTokens: BASE_TOKENS.length,
  })
})

// ==========================================
// Apply x402 payment middleware
// ==========================================
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: PRICE,
        network: NETWORK,
        config: {
          description: 'BaseHub Allowance Cleaner - Pay 0.01 USDC on Base',
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  )
)

// ==========================================
// Helper functions
// ==========================================

// Create public client for Base
const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
})

// Get contract name from Basescan API
async function getContractName(address) {
  try {
    const url = `https://api.basescan.org/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${BASESCAN_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === '1' && data.result && data.result.length > 0) {
      // Try to get contract name from verification
      const verifyUrl = `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${address}&apikey=${BASESCAN_API_KEY}`
      const verifyResponse = await fetch(verifyUrl)
      const verifyData = await verifyResponse.json()
      
      if (verifyData.status === '1' && verifyData.result && verifyData.result[0]) {
        const contractName = verifyData.result[0].ContractName
        if (contractName && contractName !== '') {
          return contractName
        }
      }
    }
  } catch (error) {
    console.error('Error fetching contract name:', error)
  }
  return null
}

// Analyze risk level (inspired by RevokeCash approach)
// RevokeCash considers:
// 1. Unlimited approvals (maxUint256) = HIGH RISK
// 2. Unknown contracts = MEDIUM/HIGH RISK
// 3. High amounts relative to balance = MEDIUM RISK
// 4. Known safe contracts (DEX routers, etc.) = LOW RISK
function analyzeRisk(allowanceAmount, spenderAddress, tokenBalance) {
  const maxUint256Value = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
  const amount = BigInt(allowanceAmount || '0')
  const balance = BigInt(tokenBalance || '0')
  
  // Check if unlimited approval (RevokeCash's primary concern)
  const isUnlimited = amount >= maxUint256Value || amount === maxUint256
  
  // Check if spender is a known safe contract
  const isKnownSafe = KNOWN_SAFE_CONTRACTS.some(
    safe => safe.toLowerCase() === spenderAddress.toLowerCase()
  )
  
  // Calculate if amount is significantly higher than balance
  // RevokeCash flags approvals that are much higher than current balance
  const isHighAmount = balance > 0n && amount > balance * BigInt(10) // 10x balance threshold (more conservative)
  const isVeryHighAmount = balance > 0n && amount > balance * BigInt(100) // 100x balance = very risky
  
  let riskLevel = 'low'
  let reason = null
  
  // Priority 1: Unlimited approvals are always HIGH RISK (RevokeCash's main focus)
  if (isUnlimited) {
    riskLevel = 'high'
    reason = '⚠️ UNLIMITED APPROVAL - Contract can drain ALL tokens of this type'
  } 
  // Priority 2: Unknown contracts with very high amounts
  else if (!isKnownSafe && isVeryHighAmount) {
    riskLevel = 'high'
    reason = 'High approval amount (100x+ balance) to unknown contract'
  }
  // Priority 3: Unknown contracts with high amounts
  else if (!isKnownSafe && isHighAmount) {
    riskLevel = 'high'
    reason = 'High approval amount (10x+ balance) to unknown contract'
  }
  // Priority 4: Any approval to unknown contract
  else if (!isKnownSafe && amount > 0n) {
    riskLevel = 'medium'
    reason = 'Approval to unknown contract - verify before keeping'
  }
  // Priority 5: Known safe contracts with high amounts
  else if (isHighAmount) {
    riskLevel = 'medium'
    reason = 'High approval amount - consider reducing if not needed'
  }
  // Priority 6: Known safe contracts with reasonable amounts
  else {
    riskLevel = 'low'
    reason = 'Approval to known safe contract'
  }
  
  return { riskLevel, reason }
}

// Get token info from contract or API
async function getTokenInfo(tokenAddress, publicClient) {
  // First try to read from contract (faster, no API call needed)
  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }).catch(() => null),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name'
      }).catch(() => null),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }).catch(() => null)
    ])
    
    if (symbol && name && decimals !== null) {
      return { 
        symbol: symbol || 'UNKNOWN', 
        name: name || 'Unknown Token', 
        decimals: typeof decimals === 'number' ? decimals : (typeof decimals === 'bigint' ? Number(decimals) : 18)
      }
    }
  } catch (error) {
    console.error(`Error reading token info from contract ${tokenAddress}:`, error)
  }
  
  // Fallback: Try Basescan/Etherscan API (only for Base)
  try {
    const url = `https://api.basescan.org/api?module=token&action=tokeninfo&contractaddress=${tokenAddress}&apikey=${BASESCAN_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === '1' && data.result) {
      return {
        symbol: data.result.symbol || 'UNKNOWN',
        name: data.result.name || 'Unknown Token',
        decimals: parseInt(data.result.decimals || '18')
      }
    }
  } catch (error) {
    console.error(`Error fetching token info from API for ${tokenAddress}:`, error)
  }
  
  // Final fallback
  return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 }
}

// Scan allowances for a wallet using RPC eth_getLogs (RevokeCash approach)
// This is more reliable than API-based approaches
async function scanAllowances(walletAddress, selectedNetwork = 'base') {
  console.log(`🔍 Scanning allowances for: ${walletAddress} on ${selectedNetwork}`)
  
  const allowances = []
  
  // Get network config
  const network = SUPPORTED_NETWORKS[selectedNetwork] || SUPPORTED_NETWORKS['base']
  const chainId = network.chainId
  
  console.log(`🌐 Using network: ${network.name} (chainId: ${chainId})`)
  
  // Create public client for the selected network
  const publicClient = createNetworkClient(network)
  
  try {
    // RevokeCash approach: Use RPC eth_getLogs to get Approval events
    // This is more reliable than API-based approaches
    // Approval event signature: 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
    const approvalEventSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
    
    // Format owner address as topic (32 bytes, padded)
    const ownerTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase()
    
    console.log(`📡 Fetching Approval events using RPC eth_getLogs...`)
    
    // Use RPC eth_getLogs (RevokeCash approach)
    // This is more reliable and doesn't depend on API rate limits
    let logs = []
    try {
      logs = await publicClient.getLogs({
        address: undefined, // Get logs from all addresses
        event: {
          type: 'event',
          name: 'Approval',
          inputs: [
            { indexed: true, name: 'owner', type: 'address' },
            { indexed: true, name: 'spender', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
          ]
        },
        args: {
          owner: walletAddress
        },
        fromBlock: 0n, // From genesis
        toBlock: 'latest'
      })
      console.log(`✅ RPC eth_getLogs returned ${logs.length} Approval events`)
    } catch (rpcError) {
      console.error(`❌ RPC eth_getLogs failed:`, rpcError.message)
      console.log(`⚠️ Falling back to Etherscan API V2...`)
      
      // Fallback to Etherscan API V2
      const logsUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${approvalEventSignature}&topic1=${ownerTopic}&apikey=${BASESCAN_API_KEY}`
      
      const logsResponse = await fetch(logsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-AllowanceCleaner/1.0',
        },
      })
      
      if (!logsResponse.ok) {
        throw new Error(`API fallback failed: ${logsResponse.status}`)
      }
      
      const logsData = await logsResponse.json()
      
      if (logsData.status !== '1' || !Array.isArray(logsData.result)) {
        console.log('⚠️ API returned no results')
        return []
      }
      
      // Convert API response to viem log format
      logs = logsData.result.map(log => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: BigInt(log.blockNumber || '0'),
        transactionHash: log.transactionHash,
        blockHash: log.blockHash,
        transactionIndex: parseInt(log.transactionIndex || '0'),
        logIndex: parseInt(log.logIndex || '0'),
        removed: false
      }))
      
      console.log(`✅ API fallback returned ${logs.length} Approval events`)
    }
    
    if (logs.length === 0) {
      console.log('ℹ️ No Approval events found for this wallet')
      return []
    }
    
    console.log(`✅ Found ${logs.length} Approval events`)
    
    // Group by token address and get unique spender addresses
    const tokenSpenderMap = new Map() // tokenAddress -> Set of spender addresses
    
    for (const log of logs) {
      try {
        // Validate log structure
        if (!log.address || !log.topics || !Array.isArray(log.topics) || log.topics.length < 3) {
          console.warn('⚠️ Invalid log structure:', log)
          continue
        }
        
        const tokenAddress = (log.address || '').toLowerCase()
        if (!tokenAddress) {
          console.warn('⚠️ Log missing address:', log)
          continue
        }
        
        // topics[0] = event signature
        // topics[1] = owner (indexed, padded to 32 bytes)
        // topics[2] = spender (indexed, padded to 32 bytes)
        const spenderTopic = log.topics && log.topics[2] ? log.topics[2] : null
        if (!spenderTopic || (typeof spenderTopic === 'string' && spenderTopic.length < 42)) {
          console.warn('⚠️ Invalid spender topic:', spenderTopic)
          continue
        }
        
        // Handle both string and hex format
        const spenderAddress = typeof spenderTopic === 'string' 
          ? '0x' + spenderTopic.slice(-40).toLowerCase()
          : '0x' + spenderTopic.slice(-40).toLowerCase()
        
        // Use a composite key to handle multiple approvals to same spender (they might have different amounts)
        // But we'll check current allowance anyway, so unique token-spender pairs are enough
        if (!tokenSpenderMap.has(tokenAddress)) {
          tokenSpenderMap.set(tokenAddress, new Set())
        }
        tokenSpenderMap.get(tokenAddress).add(spenderAddress)
      } catch (error) {
        console.error('Error parsing log:', error, 'Log:', log)
      }
    }
    
    console.log(`📊 Parsed ${tokenSpenderMap.size} unique tokens with ${Array.from(tokenSpenderMap.values()).reduce((sum, set) => sum + set.size, 0)} total spender addresses`)
    
    console.log(`📊 Found ${tokenSpenderMap.size} unique tokens with approvals`)
    
    // Check current allowance for each token-spender pair
    for (const [tokenAddress, spenders] of tokenSpenderMap) {
      try {
        // Get token info
        const tokenInfo = await getTokenInfo(tokenAddress, publicClient)
        console.log(`📊 Checking ${tokenInfo.symbol} (${tokenAddress})...`)
        
        // Get current balance
        let balance = 0n
        try {
          balance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress]
          })
        } catch (error) {
          console.error(`Error getting balance for ${tokenInfo.symbol}:`, error)
        }
        
        // Check each spender
        for (const spenderAddress of spenders) {
          try {
            // Check current allowance (might have been revoked)
            const currentAllowance = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [walletAddress, spenderAddress]
            })
            
            // Only include if allowance is still active
            if (currentAllowance > 0n) {
              const spenderName = await getContractName(spenderAddress).catch(() => null)
              const { riskLevel, reason } = analyzeRisk(
                currentAllowance.toString(),
                spenderAddress,
                balance.toString()
              )
              
              // Format amount for display (like RevokeCash does)
              const maxUint256Value = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
              const isUnlimited = currentAllowance >= maxUint256Value
              const amountFormatted = isUnlimited 
                ? 'Unlimited' 
                : formatUnits(currentAllowance, tokenInfo.decimals)
              
              allowances.push({
                tokenAddress,
                tokenSymbol: tokenInfo.symbol,
                tokenName: tokenInfo.name,
                decimals: tokenInfo.decimals,
                spenderAddress,
                spenderName: spenderName || null,
                amount: currentAllowance.toString(),
                amountFormatted,
                isUnlimited,
                riskLevel,
                reason
              })
            }
          } catch (error) {
            console.error(`Error checking allowance for ${tokenInfo.symbol} -> ${spenderAddress}:`, error)
          }
        }
      } catch (error) {
        console.error(`Error processing token ${tokenAddress}:`, error)
      }
    }
    
    // Sort by risk level (high first)
    allowances.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 }
      return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
    })
    
    console.log(`✅ Found ${allowances.length} active allowances`)
    return allowances
    
  } catch (error) {
    console.error('Error scanning allowances:', error)
    throw error
  }
}

// ==========================================
// Main endpoint
// ==========================================
app.post('/', async (c) => {
  try {
    const { walletAddress } = await c.req.json()
    
    if (!walletAddress) {
      return c.json({ success: false, error: 'Wallet address is required' }, 400)
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ success: false, error: 'Invalid wallet address format' }, 400)
    }
    
    console.log(`🔍 Starting allowance scan for: ${walletAddress}`)
    
    // Scan allowances
    const allowances = await scanAllowances(walletAddress)
    
    return c.json({
      success: true,
      allowances,
      scannedAt: new Date().toISOString(),
      totalFound: allowances.length,
      riskyCount: allowances.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium').length
    })
    
  } catch (error) {
    console.error('❌ Allowance scan error:', error)
    return c.json({
      success: false,
      error: error.message || 'Failed to scan allowances'
    }, 500)
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

