// x402 Allowance Cleaner Endpoint for BaseHub using Hono
// Accepts 0.01 USDC payments using Coinbase x402 on Base network
// Scans wallet for token approvals and identifies risky ones

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'
import { createPublicClient, http, formatUnits } from 'viem'
import { base, mainnet, polygon, arbitrum, optimism, bsc, avalanche } from 'viem/chains'

const app = new Hono()

// ==========================================
// Configuration
// ==========================================

const NETWORK = 'base'
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.01'
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  console.log('✅ CDP API keys loaded')
  facilitatorConfig = facilitator.facilitatorConfig({
    keyId: process.env.CDP_API_KEY_ID,
    keySecret: process.env.CDP_API_KEY_SECRET,
    network: NETWORK,
  })
} else {
  console.warn('⚠️ CDP API keys not found')
}

// Supported networks
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

// ERC20 ABI
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

// Common spenders on Base
const COMMON_SPENDERS = [
  '0x4200000000000000000000000000000000000006', // WETH
  '0x2626664c2603336E57B271c5C0b26F421741e481', // Uniswap V3 Router
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // Uniswap Universal Router
  '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Aerodrome Router
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2', // Aerodrome Router V2
  '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb', // BaseSwap Router
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // OpenSea Seaport
  '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC', // OpenSea Seaport 1.5
  '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5', // Kyberswap Aggregator
  '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch v5 Router
  '0x11111112542D85B3EF69AE05771c2dCCff4fAa26', // 1inch v4 Router
  '0xDef1C0ded9bec7F1a1670819833240f027b25EfF', // 0x Exchange Proxy
  '0x216B4B4Ba9F3e719726886d34a177484278Bfcae', // TokenPocket
  '0x3328F7f4A1D1C57c35df56bBf0c9dCAFCA309C49', // Stargate Bridge
  '0xB4B0ea46Fe0E9e8EAB4aFb765b527739F2718671', // Relay Bridge
]

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x402-facilitator-url', 'x402-accept-network', 'x402-accept-currency', 'x402-accept-amount', 'x402-accept-receiving-address'],
}))

// x402 Payment middleware
app.use('/*', paymentMiddleware({
  network: NETWORK,
  amount: PRICE,
  receivingAddress: RECEIVING_ADDRESS,
  currency: USDC_ADDRESS,
  facilitatorUrl: facilitatorConfig?.url,
  onPaymentSuccess: async (paymentDetails) => {
    console.log('✅ Payment successful:', paymentDetails)
  },
  onPaymentError: (error) => {
    console.error('❌ Payment error:', error)
  }
}))

// Helper: Create network client
function createNetworkClient(network) {
  return createPublicClient({
    chain: network.viemChain,
    transport: http(network.rpc)
  })
}

// Helper: Get token info
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
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 }
  }
}

// Helper: Get contract name
async function getContractName(contractAddress) {
  try {
    const url = `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${BASESCAN_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === '1' && data.result && data.result[0]) {
      return data.result[0].ContractName || null
    }
    return null
  } catch (error) {
    return null
  }
}

// Helper: Analyze risk
function analyzeRisk(allowanceAmount, spenderAddress, tokenBalance) {
  const allowance = BigInt(allowanceAmount)
  const balance = BigInt(tokenBalance)
  const maxUint256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
  
  if (allowance >= maxUint256) {
    return {
      riskLevel: 'high',
      reason: 'Unlimited allowance - spender can transfer all tokens'
    }
  }
  
  if (allowance > balance * 10n) {
    return {
      riskLevel: 'high',
      reason: 'Allowance significantly exceeds current balance'
    }
  }
  
  if (allowance > balance * 2n) {
    return {
      riskLevel: 'medium',
      reason: 'Allowance exceeds current balance'
    }
  }
  
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

// Main scan function
async function scanAllowances(walletAddress, selectedNetwork = 'base') {
  console.log(`🔍 Scanning: ${walletAddress} on ${selectedNetwork}`)
  
  const allowances = []
  const network = SUPPORTED_NETWORKS[selectedNetwork] || SUPPORTED_NETWORKS['base']
  const publicClient = createNetworkClient(network)
  const apiUrl = network.apiUrl
  
  // STEP 1: Get token transfers
  console.log(`📦 STEP 1: Fetching token transfers...`)
  const uniqueTokens = new Set()
  
  try {
    const tokentxUrl = `${apiUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=latest&page=1&offset=1000&sort=desc&apikey=${BASESCAN_API_KEY}`
    const tokentxResponse = await fetch(tokentxUrl)
    
    if (tokentxResponse.ok) {
      const tokentxData = await tokentxResponse.json()
      
      if (tokentxData.status === '1' && Array.isArray(tokentxData.result)) {
        tokentxData.result.forEach(tx => {
          if (tx.contractAddress) {
            uniqueTokens.add(tx.contractAddress.toLowerCase())
          }
        })
        console.log(`✅ Found ${uniqueTokens.size} unique tokens`)
      }
    }
  } catch (error) {
    console.error(`❌ TokenTX failed:`, error.message)
  }
  
  // STEP 2: Prepare token-spender pairs
  console.log(`\n🔐 STEP 2: Preparing common spenders...`)
  const tokenSpenderMap = new Map()
  
  uniqueTokens.forEach(tokenAddress => {
    tokenSpenderMap.set(tokenAddress, new Set())
    COMMON_SPENDERS.forEach(spender => {
      tokenSpenderMap.get(tokenAddress).add(spender.toLowerCase())
    })
  })
  
  console.log(`✅ Will check ${COMMON_SPENDERS.length} spenders for ${uniqueTokens.size} tokens`)
  
  // STEP 3: Check on-chain allowances
  console.log(`\n✅ STEP 3: Checking on-chain allowances...`)
  
  for (const [tokenAddress, spenders] of tokenSpenderMap) {
    if (spenders.size === 0) continue
    
    try {
      const tokenInfo = await getTokenInfo(tokenAddress, publicClient)
      console.log(`📊 Checking ${tokenInfo.symbol}...`)
      
      let balance = 0n
      try {
        balance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress]
        })
      } catch (error) {
        console.error(`  ⚠️ Error getting balance`)
      }
      
      for (const spenderAddress of spenders) {
        try {
          const currentAllowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress, spenderAddress]
          })
          
          if (currentAllowance > 0n) {
            console.log(`  ✅ Active allowance found!`)
            
            const spenderName = await getContractName(spenderAddress).catch(() => null)
            const { riskLevel, reason } = analyzeRisk(
              currentAllowance.toString(),
              spenderAddress,
              balance.toString()
            )
            
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
          // Silent fail for each spender check
        }
      }
    } catch (error) {
      console.error(`❌ Error processing token ${tokenAddress}`)
    }
  }
  
  // Sort by risk
  allowances.sort((a, b) => {
    const riskOrder = { high: 3, medium: 2, low: 1 }
    return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
  })
  
  console.log(`\n✅ Scan completed: Found ${allowances.length} active allowances`)
  return allowances
}

// Main endpoint
app.post('/', async (c) => {
  try {
    const { walletAddress, network } = await c.req.json()
    
    if (!walletAddress) {
      return c.json({ success: false, error: 'Wallet address is required' }, 400)
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ success: false, error: 'Invalid wallet address format' }, 400)
    }
    
    const selectedNetwork = network || 'base'
    
    if (!SUPPORTED_NETWORKS[selectedNetwork]) {
      return c.json({ 
        success: false, 
        error: 'Unsupported network',
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS)
      }, 400)
    }
    
    console.log(`🔍 Starting scan for: ${walletAddress} on ${selectedNetwork}`)
    
    const allowances = await scanAllowances(walletAddress, selectedNetwork)
    
    return c.json({
      success: true,
      allowances,
      scannedAt: new Date().toISOString(),
      totalFound: allowances.length,
      riskyCount: allowances.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium').length
    })
    
  } catch (error) {
    console.error('❌ Endpoint error:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'Failed to scan allowances' 
    }, 500)
  }
})

// Vercel handler
export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host']
    const fullUrl = `${protocol}://${host}/`

    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      }
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
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
