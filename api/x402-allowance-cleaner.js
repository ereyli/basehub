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

// Scan allowances using HYBRID approach (RevokeCash method)
// 1. Fetch token transfers (tokentx) to find all tokens user has interacted with
// 2. Fetch Approval events (getLogs) to find known spenders
// 3. For each token, check on-chain allowance for all spenders found
async function scanAllowances(walletAddress, selectedNetwork = 'base') {
  try {
    console.log(`🔍 Scanning allowances for: ${walletAddress} on ${selectedNetwork}`)
    console.log(`📋 Using HYBRID approach: Token transfers + Approval events + On-chain checks`)
    
    const allowances = []
    
    // Get network config
    const network = SUPPORTED_NETWORKS[selectedNetwork] || SUPPORTED_NETWORKS['base']
    const chainId = network.chainId
    const apiUrl = network.apiUrl
    
    console.log(`🌐 Using network: ${network.name} (chainId: ${chainId})`)
    console.log(`🔗 API URL: ${apiUrl}`)
    
    // Create public client for on-chain reads
    const publicClient = createNetworkClient(network)
    
    // ========================================
    // STEP 1: Get all ERC20 token transfers
    // This helps identify which tokens the user has interacted with
    // ========================================
    console.log(`\n📦 STEP 1: Fetching token transfers...`)
    
    const uniqueTokens = new Set()
    
    try {
      const tokentxUrl = `${apiUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=latest&page=1&offset=1000&sort=desc&apikey=${BASESCAN_API_KEY}`
      
      console.log(`🔗 TokenTX URL: ${tokentxUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN')}`)
      
      const tokentxResponse = await fetch(tokentxUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-AllowanceCleaner/1.0',
        },
      })
      
      if (tokentxResponse.ok) {
        const tokentxData = await tokentxResponse.json()
        console.log(`📊 TokenTX Response:`, {
          status: tokentxData.status,
          message: tokentxData.message,
          resultCount: Array.isArray(tokentxData.result) ? tokentxData.result.length : 'not an array',
        })
        
        if (tokentxData.status === '1' && Array.isArray(tokentxData.result)) {
          tokentxData.result.forEach(tx => {
            if (tx.contractAddress) {
              uniqueTokens.add(tx.contractAddress.toLowerCase())
            }
          })
          console.log(`✅ Found ${uniqueTokens.size} unique tokens from transfer history`)
        } else {
          console.log(`⚠️ No token transfers found: ${tokentxData.message || 'Unknown'}`)
        }
      } else {
        console.error(`❌ TokenTX API error: ${tokentxResponse.status}`)
      }
    } catch (tokentxError) {
      console.error(`❌ TokenTX failed:`, tokentxError.message)
      // Continue even if tokentx fails
    }
    
    // ========================================
    // STEP 2: Fetch Approval events
    // This helps identify spenders for each token
    // ========================================
    console.log(`\n🔐 STEP 2: Fetching Approval events...`)
    
    const approvalEventSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
    const ownerTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase()
    
    const tokenSpenderMap = new Map() // Map<tokenAddress, Set<spenderAddress>>
    
    // Initialize map with tokens from transfers
    uniqueTokens.forEach(tokenAddress => {
      tokenSpenderMap.set(tokenAddress, new Set())
    })
    
    try {
      // Pagination loop (max 1000 records per request)
      let page = 1
      let hasMore = true
      let totalApprovals = 0
      
      while (hasMore && page <= 10) { // Max 10 pages (10,000 records)
        const logsUrl = `${apiUrl}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${approvalEventSignature}&topic1=${ownerTopic}&page=${page}&offset=1000&apikey=${BASESCAN_API_KEY}`
        
        console.log(`🔗 Approval Events URL (page ${page}): ${logsUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN')}`)
        
        const logsResponse = await fetch(logsUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'BaseHub-AllowanceCleaner/1.0',
          },
        })
        
        if (logsResponse.ok) {
          const logsData = await logsResponse.json()
          console.log(`📊 Approval Events Response (page ${page}):`, {
            status: logsData.status,
            message: logsData.message,
            resultCount: Array.isArray(logsData.result) ? logsData.result.length : 'not an array',
          })
          
          if (logsData.status === '1' && Array.isArray(logsData.result)) {
            const pageLogs = logsData.result
            
            // Parse logs and collect token-spender pairs
            pageLogs.forEach(log => {
              try {
                const tokenAddress = log.address.toLowerCase()
                const ownerFromLog = '0x' + log.topics[1].slice(26).toLowerCase()
                const spenderAddress = '0x' + log.topics[2].slice(26).toLowerCase()
                
                // Only process if owner matches wallet being scanned
                if (ownerFromLog === walletAddress.toLowerCase()) {
                  if (!tokenSpenderMap.has(tokenAddress)) {
                    tokenSpenderMap.set(tokenAddress, new Set())
                  }
                  tokenSpenderMap.get(tokenAddress).add(spenderAddress)
                }
              } catch (parseError) {
                console.error('Error parsing Approval log:', parseError)
              }
            })
            
            totalApprovals += pageLogs.length
            console.log(`✅ Page ${page}: ${pageLogs.length} events (total: ${totalApprovals})`)
            
            if (pageLogs.length < 1000) {
              hasMore = false
            } else {
              page++
              // Rate limiting: 350ms delay for free tier (3 calls/second)
              await new Promise(resolve => setTimeout(resolve, 350))
            }
          } else {
            console.log(`⚠️ API returned error on page ${page}: ${logsData.message || 'Unknown'}`)
            hasMore = false
          }
        } else {
          console.error(`❌ Approval Events API error on page ${page}: ${logsResponse.status}`)
          hasMore = false
        }
      }
      
      console.log(`✅ Total Approval events found: ${totalApprovals}`)
    } catch (approvalError) {
      console.error(`❌ Approval events fetch failed:`, approvalError.message)
      // Continue even if approval fetch fails
    }
    
    console.log(`\n📊 Found ${tokenSpenderMap.size} unique tokens with ${Array.from(tokenSpenderMap.values()).reduce((sum, set) => sum + set.size, 0)} total spender addresses`)
    
    // ========================================
    // STEP 3: Check on-chain allowances
    // For each token-spender pair, check current allowance
    // ========================================
    console.log(`\n✅ STEP 3: Checking on-chain allowances...`)
    
    for (const [tokenAddress, spenders] of tokenSpenderMap) {
      // Skip if no spenders found for this token
      if (spenders.size === 0) {
        console.log(`⏭️ Skipping ${tokenAddress} (no spenders found)`)
        continue
      }
      
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
        } catch (balanceError) {
          console.error(`  ⚠️ Error getting balance: ${balanceError.message}`)
        }
        
        // Check each spender
        for (const spenderAddress of spenders) {
          try {
            console.log(`  🔍 Checking: ${tokenInfo.symbol} -> ${spenderAddress.substring(0, 10)}...`)
            
            // Check current on-chain allowance
            const currentAllowance = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [walletAddress, spenderAddress]
            })
            
            console.log(`  📊 Allowance: ${currentAllowance.toString()}`)
            
            // Only include active allowances (> 0)
            if (currentAllowance > 0n) {
              console.log(`  ✅ Active allowance found!`)
              
              const spenderName = await getContractName(spenderAddress).catch(() => null)
              const { riskLevel, reason } = analyzeRisk(
                currentAllowance.toString(),
                spenderAddress,
                balance.toString()
              )
              
              // Format amount
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
            } else {
              console.log(`  ⚠️ Allowance is 0 (revoked or never set)`)
            }
          } catch (allowanceError) {
            console.error(`  ❌ Error checking allowance: ${allowanceError.message}`)
          }
        }
      } catch (tokenError) {
        console.error(`❌ Error processing token ${tokenAddress}:`, tokenError.message)
      }
    }
    
    // Sort by risk level (high first)
    allowances.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 }
      return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
    })
    
    console.log(`\n✅ Scan completed: Found ${allowances.length} active allowances`)
    return allowances
    
  } catch (error) {
    console.error('❌ Error in scanAllowances:', error)
    console.error('❌ Stack:', error.stack)
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
