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

// Supported networks for allowance scanning
// Each network has its own block explorer API endpoint
const SUPPORTED_NETWORKS = {
  'base': { 
    chainId: 8453, 
    name: 'Base Mainnet', 
    currency: 'ETH', 
    rpc: 'https://base.llamarpc.com',
    apiUrl: 'https://api.basescan.org/api'
  },
  'ethereum': { 
    chainId: 1, 
    name: 'Ethereum Mainnet', 
    currency: 'ETH', 
    rpc: 'https://eth.llamarpc.com',
    apiUrl: 'https://api.etherscan.io/api'
  },
  'polygon': { 
    chainId: 137, 
    name: 'Polygon Mainnet', 
    currency: 'MATIC', 
    rpc: 'https://polygon-rpc.com',
    apiUrl: 'https://api.polygonscan.com/api'
  },
  'arbitrum': { 
    chainId: 42161, 
    name: 'Arbitrum One', 
    currency: 'ETH', 
    rpc: 'https://arb1.arbitrum.io/rpc',
    apiUrl: 'https://api.arbiscan.io/api'
  },
  'optimism': { 
    chainId: 10, 
    name: 'Optimism', 
    currency: 'ETH', 
    rpc: 'https://mainnet.optimism.io',
    apiUrl: 'https://api-optimistic.etherscan.io/api'
  },
  'bsc': { 
    chainId: 56, 
    name: 'BNB Chain', 
    currency: 'BNB', 
    rpc: 'https://bsc-dataseed.binance.org',
    apiUrl: 'https://api.bscscan.com/api'
  },
  'avalanche': { 
    chainId: 43114, 
    name: 'Avalanche', 
    currency: 'AVAX', 
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    apiUrl: 'https://api.snowtrace.io/api'
  },
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

// Create public client function for different networks
function createNetworkClient(networkConfig) {
  // For Base, use the base chain from viem
  if (networkConfig.chainId === 8453) {
    return createPublicClient({
      chain: base,
      transport: http(networkConfig.rpc)
    })
  }
  
  // For other networks, create a custom chain config
  return createPublicClient({
    chain: {
      id: networkConfig.chainId,
      name: networkConfig.name,
      nativeCurrency: { name: networkConfig.currency, symbol: networkConfig.currency, decimals: 18 },
      rpcUrls: { default: { http: [networkConfig.rpc] } }
    },
    transport: http(networkConfig.rpc)
  })
}

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
    // RevokeCash approach: Use Etherscan-compatible API first (more reliable for large ranges)
    // RPC eth_getLogs can timeout for very large ranges, so we use API as primary method
    // Approval event signature: 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
    const approvalEventSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
    
    // Format owner address as topic (32 bytes, padded)
    const ownerTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase()
    
    let logs = []
    
    // Use each network's own API endpoint (not Etherscan V2)
    // Each network has its own block explorer with its own API
    try {
      const apiUrl = network.apiUrl || 'https://api.etherscan.io/api'
      console.log(`📡 Fetching Approval events from ${network.name}'s block explorer API...`)
      console.log(`📅 Scanning from genesis block (0) to latest - covering all historical approvals`)
      console.log(`🌐 API endpoint: ${apiUrl}`)
      
      // Use network-specific API endpoint
      const logsUrl = `${apiUrl}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${approvalEventSignature}&topic1=${ownerTopic}&apikey=${BASESCAN_API_KEY}`
      
      console.log(`🔗 API URL: ${logsUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN')}`)
      
      const logsResponse = await fetch(logsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-AllowanceCleaner/1.0',
        },
      })
      
      console.log(`📡 API Response status: ${logsResponse.status} ${logsResponse.statusText}`)
      
      if (logsResponse.ok) {
        const logsData = await logsResponse.json()
        console.log(`📊 API Response data:`, {
          status: logsData.status,
          message: logsData.message,
          result: logsData.result, // Log full result to see actual error
          resultCount: logsData.result && Array.isArray(logsData.result) ? logsData.result.length : 'not an array',
          resultType: typeof logsData.result
        })
        
        if (logsData.status === '1' && Array.isArray(logsData.result)) {
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
          console.log(`✅ API returned ${logs.length} Approval events`)
        } else if (logsData.status === '0') {
          // API returned error status
          const errorMsg = logsData.message || 'Unknown API error'
          console.log(`⚠️ API returned error status: ${errorMsg}`)
          
          // Check if it's a "no records found" case
          if (errorMsg.includes('No records found') || errorMsg.includes('No logs found') || errorMsg.includes('No transactions found')) {
            console.log('ℹ️ No Approval events found for this wallet on this network')
            return []
          }
          
          // For other errors, log but don't throw yet - will try RPC fallback
          console.warn(`⚠️ API error but will try RPC fallback: ${errorMsg}`)
        } else {
          console.log(`⚠️ API returned unexpected status: ${logsData.status}, message: ${logsData.message || 'No message'}`)
          // Don't throw, will try RPC fallback
        }
      } else {
        const errorText = await logsResponse.text().catch(() => 'Could not read error')
        console.error(`❌ API HTTP error: ${logsResponse.status}`, errorText.substring(0, 500))
        // Don't throw here, will try RPC fallback
      }
    } catch (apiError) {
      console.error(`❌ API failed:`, apiError.message)
      console.error(`❌ Full error:`, apiError)
      // Don't throw here, try RPC fallback first
      // The error will be thrown if RPC also fails
    }
    
    // If API returned no results or failed, try RPC as fallback (for smaller ranges)
    // But use raw eth_getLogs call instead of viem's getLogs to avoid format issues
    if (logs.length === 0) {
      try {
        console.log(`⚠️ API returned no results, trying RPC eth_getLogs as fallback...`)
        // Try to get all historical logs (from genesis)
        // If RPC doesn't support full history, try last 1 year of blocks
        console.log(`📡 RPC: Fetching logs from genesis block (0) to latest for full history...`)
        
        // Use raw RPC call to avoid viem format issues
        // Try from genesis first
        const rpcResponse = await fetch(network.rpc, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [{
              topics: [
                approvalEventSignature,
                ownerTopic,
                null // spender can be any
              ],
              fromBlock: '0x0', // Start from genesis
              toBlock: 'latest'
            }],
            id: 1
          })
        })
        
        if (rpcResponse.ok) {
          const rpcData = await rpcResponse.json()
          if (rpcData.result && Array.isArray(rpcData.result)) {
            logs = rpcData.result.map(log => ({
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
            console.log(`✅ RPC eth_getLogs returned ${logs.length} Approval events (from block ${fromBlock})`)
          } else {
            console.log(`⚠️ RPC returned no results`)
          }
        } else {
          const errorText = await rpcResponse.text().catch(() => 'Could not read error')
          console.error(`❌ RPC HTTP error: ${rpcResponse.status}`, errorText.substring(0, 500))
          throw new Error(`RPC failed: ${rpcResponse.status} - ${errorText.substring(0, 200)}`)
        }
      } catch (rpcError) {
        console.error(`❌ RPC eth_getLogs also failed:`, rpcError.message)
        console.error(`❌ RPC error details:`, rpcError)
        // If both API and RPC failed, throw error
        const rpcErrorMessage = rpcError.message || 'Unknown RPC error'
        throw new Error(`Failed to fetch Approval events. API and RPC both failed. Error: ${rpcErrorMessage}. Please try again later or check if the network is supported.`)
      }
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
            console.log(`  🔍 Checking allowance: ${tokenInfo.symbol} -> ${spenderAddress.substring(0, 10)}...`)
            
            // Check current allowance (might have been revoked)
            let currentAllowance = 0n
            try {
              currentAllowance = await publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [walletAddress, spenderAddress]
              })
            } catch (allowanceError) {
              console.error(`  ❌ Error reading allowance: ${allowanceError.message}`)
              // If we can't read allowance, still show it but mark as unknown
              currentAllowance = -1n // Use -1 to indicate unknown
            }
            
            console.log(`  📊 Current allowance for ${tokenInfo.symbol}: ${currentAllowance.toString() === '-1' ? 'UNKNOWN (error reading)' : currentAllowance.toString()}`)
            
            // Include ALL approvals found, even if current allowance is 0
            // User wants to see all historical approvals, not just active ones
            const spenderName = await getContractName(spenderAddress).catch(() => null)
            
            // Determine risk level and reason
            let riskLevel = 'low'
            let reason = 'Approval found'
            
            if (currentAllowance > 0n) {
              console.log(`  ✅ Active allowance found: ${tokenInfo.symbol} -> ${spenderAddress}`)
              const riskAnalysis = analyzeRisk(
                currentAllowance.toString(),
                spenderAddress,
                balance.toString()
              )
              riskLevel = riskAnalysis.riskLevel
              reason = riskAnalysis.reason
            } else if (currentAllowance === 0n) {
              console.log(`  ⚠️ Allowance is 0 (revoked): ${tokenInfo.symbol} -> ${spenderAddress}`)
              riskLevel = 'low'
              reason = 'Approval was revoked (allowance is 0)'
            } else {
              console.log(`  ⚠️ Allowance status unknown (showing anyway): ${tokenInfo.symbol} -> ${spenderAddress}`)
              riskLevel = 'medium'
              reason = 'Could not verify current allowance status'
            }
            
            // Format amount for display (like RevokeCash does)
            const maxUint256Value = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
            const isUnlimited = currentAllowance >= maxUint256Value && currentAllowance !== -1n
            const amountFormatted = isUnlimited 
              ? 'Unlimited' 
              : currentAllowance === -1n
              ? 'Unknown (check failed)'
              : currentAllowance === 0n
              ? '0 (Revoked)'
              : formatUnits(currentAllowance, tokenInfo.decimals)
            
            allowances.push({
              tokenAddress,
              tokenSymbol: tokenInfo.symbol,
              tokenName: tokenInfo.name,
              decimals: tokenInfo.decimals,
              spenderAddress,
              spenderName: spenderName || null,
              amount: currentAllowance === -1n ? '0' : currentAllowance.toString(),
              amountFormatted,
              isUnlimited: isUnlimited,
              isActive: currentAllowance > 0n,
              isUnknown: currentAllowance === -1n,
              isRevoked: currentAllowance === 0n,
              riskLevel,
              reason
            })
          } catch (error) {
            console.error(`  ❌ Error checking allowance for ${tokenInfo.symbol} -> ${spenderAddress}:`, error.message)
            // Continue with other spenders even if one fails
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
    console.error('❌ Error scanning allowances:', error)
    console.error('❌ Error stack:', error.stack)
    console.error('❌ Error name:', error.name)
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    // Return a more user-friendly error message
    let errorMessage = error.message || 'Failed to scan allowances'
    
    // Provide more specific error messages
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      errorMessage = 'Request timed out. The network may be slow. Please try again.'
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('rate limit')) {
      errorMessage = 'API rate limit exceeded. Please wait a moment and try again.'
    } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
      errorMessage = `Network error: ${errorMessage}. Please check your connection and try again.`
    }
    
    throw new Error(errorMessage)
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

