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

// Analyze risk level
function analyzeRisk(allowanceAmount, spenderAddress, tokenBalance) {
  const maxUint256Value = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
  const amount = BigInt(allowanceAmount || '0')
  const balance = BigInt(tokenBalance || '0')
  
  const isUnlimited = amount >= maxUint256Value || amount === maxUint256
  
  const isKnownSafe = KNOWN_SAFE_CONTRACTS.some(
    safe => safe.toLowerCase() === spenderAddress.toLowerCase()
  )
  
  const isHighAmount = balance > 0n && amount > balance * BigInt(2) // More than 2x balance
  
  let riskLevel = 'low'
  let reason = null
  
  if (isUnlimited) {
    riskLevel = 'high'
    reason = 'Unlimited approval - contract can drain all tokens'
  } else if (!isKnownSafe && isHighAmount) {
    riskLevel = 'high'
    reason = 'High approval amount to unknown contract'
  } else if (!isKnownSafe && amount > 0n) {
    riskLevel = 'medium'
    reason = 'Approval to unknown contract'
  } else if (isHighAmount) {
    riskLevel = 'medium'
    reason = 'High approval amount'
  }
  
  return { riskLevel, reason }
}

// Scan allowances for a wallet
async function scanAllowances(walletAddress) {
  console.log(`🔍 Scanning allowances for: ${walletAddress}`)
  
  const allowances = []
  
  // Get Approval events from last 1000 blocks (approximately 1 day on Base)
  const currentBlock = await publicClient.getBlockNumber()
  const fromBlock = currentBlock - BigInt(1000)
  
  try {
    // Scan each token
    for (const token of BASE_TOKENS) {
      console.log(`📊 Scanning ${token.symbol}...`)
      
      try {
        // Get Approval events for this token using event signature
        // Approval(address indexed owner, address indexed spender, uint256 value)
        const approvalEventSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
        
        // Get logs with topic filter for owner address
        const ownerTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase()
        
        const logs = await publicClient.getLogs({
          address: token.address,
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
          fromBlock,
          toBlock: 'latest'
        }).catch(async (error) => {
          // Fallback: Get all Approval events and filter manually
          console.log(`⚠️ Direct event filter failed, using fallback method for ${token.symbol}`)
          try {
            const allLogs = await publicClient.getLogs({
              address: token.address,
              event: {
                type: 'event',
                name: 'Approval',
                inputs: [
                  { indexed: true, name: 'owner', type: 'address' },
                  { indexed: true, name: 'spender', type: 'address' },
                  { indexed: false, name: 'value', type: 'uint256' }
                ]
              },
              fromBlock,
              toBlock: 'latest'
            })
            
            // Filter by owner address
            return allLogs.filter(log => {
              const logOwner = '0x' + log.topics[1].slice(-40).toLowerCase()
              return logOwner === walletAddress.toLowerCase()
            })
          } catch (fallbackError) {
            console.error(`Error in fallback method for ${token.symbol}:`, fallbackError)
            return []
          }
        })
        
        // Get current balance
        const balance = await publicClient.readContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress]
        })
        
        // Process each approval event
        const uniqueSpenders = new Set()
        
        for (const log of logs) {
          try {
            // Parse event data - topics[2] is spender (indexed)
            const spenderAddress = '0x' + log.topics[2].slice(-40).toLowerCase()
            
            // Skip if we've already processed this spender
            if (uniqueSpenders.has(spenderAddress)) {
              continue
            }
            uniqueSpenders.add(spenderAddress)
            
            // Check current allowance (might have been revoked)
            const currentAllowance = await publicClient.readContract({
              address: token.address,
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
              
              allowances.push({
                tokenAddress: token.address,
                tokenSymbol: token.symbol,
                tokenName: token.name,
                decimals: token.decimals,
                spenderAddress,
                spenderName: spenderName || null,
                amount: currentAllowance.toString(),
                riskLevel,
                reason
              })
            }
          } catch (error) {
            console.error(`Error processing approval event for ${token.symbol}:`, error)
          }
        }
      } catch (error) {
        console.error(`Error scanning ${token.symbol}:`, error)
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

