// Allowance Cleaner Endpoint for BaseHub
// Scans wallet for token approvals and identifies risky ones
// Payment: 0.01 USDC on Base (to be added)

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createPublicClient, http, formatUnits } from 'viem'
import { base, mainnet, polygon, arbitrum, optimism, bsc, avalanche } from 'viem/chains'

const app = new Hono()

console.log('🚀 Allowance Cleaner API loaded')

// Configuration
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Supported networks
const SUPPORTED_NETWORKS = {
  'base': { 
    chainId: 8453, 
    name: 'Base Mainnet', 
    rpc: 'https://base.llamarpc.com',
    apiUrl: 'https://api.basescan.org/api',
    viemChain: base
  },
  'ethereum': { 
    chainId: 1, 
    name: 'Ethereum Mainnet', 
    rpc: 'https://eth.llamarpc.com',
    apiUrl: 'https://api.etherscan.io/api',
    viemChain: mainnet
  },
  'polygon': { 
    chainId: 137, 
    name: 'Polygon Mainnet', 
    rpc: 'https://polygon-rpc.com',
    apiUrl: 'https://api.polygonscan.com/api',
    viemChain: polygon
  },
  'arbitrum': { 
    chainId: 42161, 
    name: 'Arbitrum One', 
    rpc: 'https://arb1.arbitrum.io/rpc',
    apiUrl: 'https://api.arbiscan.io/api',
    viemChain: arbitrum
  },
  'optimism': { 
    chainId: 10, 
    name: 'Optimism', 
    rpc: 'https://mainnet.optimism.io',
    apiUrl: 'https://api-optimistic.etherscan.io/api',
    viemChain: optimism
  },
  'bsc': { 
    chainId: 56, 
    name: 'BNB Chain', 
    rpc: 'https://bsc-dataseed.binance.org',
    apiUrl: 'https://api.bscscan.com/api',
    viemChain: bsc
  },
  'avalanche': { 
    chainId: 43114, 
    name: 'Avalanche', 
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    apiUrl: 'https://api.snowtrace.io/api',
    viemChain: avalanche
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

// Main scan function
async function scanAllowances(walletAddress, selectedNetwork = 'base') {
  console.log(`🔍 Scanning: ${walletAddress} on ${selectedNetwork}`)
  
  const allowances = []
  const network = SUPPORTED_NETWORKS[selectedNetwork] || SUPPORTED_NETWORKS['base']
  const publicClient = createNetworkClient(network)
  
  // Get tokens with pagination (up to 10,000 records)
  console.log(`📦 Fetching tokens with pagination...`)
  const uniqueTokens = new Set()
  
  try {
    // Fetch multiple pages to get more tokens
    for (let page = 1; page <= 10; page++) {
      const url = `${network.apiUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=latest&page=${page}&offset=1000&sort=desc&apikey=${BASESCAN_API_KEY}`
      console.log(`  📄 Fetching page ${page}...`)
      
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-AllowanceCleaner/1.0',
        },
      })
      
      const data = await res.json()
      
      if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
        data.result.forEach(tx => {
          if (tx.contractAddress) uniqueTokens.add(tx.contractAddress.toLowerCase())
        })
        console.log(`  ✅ Page ${page}: ${data.result.length} transactions, total ${uniqueTokens.size} unique tokens`)
        
        // If less than 1000 results, we've reached the end
        if (data.result.length < 1000) {
          console.log(`  ⏹️ Last page reached`)
          break
        }
        
        // Rate limiting: wait 350ms between requests (free tier: 3 calls/sec)
        await new Promise(resolve => setTimeout(resolve, 350))
      } else {
        console.log(`  ⏹️ No more data on page ${page}`)
        break
      }
    }
    
    console.log(`✅ Total found: ${uniqueTokens.size} unique tokens`)
  } catch (err) {
    console.error(`❌ Token fetch error:`, err.message)
  }
  
  // Check allowances
  console.log(`✅ Checking allowances...`)
  
  for (const tokenAddress of uniqueTokens) {
    try {
      const tokenInfo = await getTokenInfo(tokenAddress, publicClient)
      
      let balance = 0n
      try {
        balance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress]
        })
      } catch (e) {}
      
      for (const spender of COMMON_SPENDERS) {
        try {
          const allowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress, spender]
          })
          
          if (allowance > 0n) {
            const { riskLevel, reason } = analyzeRisk(allowance.toString(), spender, balance.toString())
            const maxUint = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
            const isUnlimited = allowance >= maxUint
            
            allowances.push({
              tokenAddress,
              tokenSymbol: tokenInfo.symbol,
              tokenName: tokenInfo.name,
              decimals: tokenInfo.decimals,
              spenderAddress: spender,
              spenderName: null,
              amount: allowance.toString(),
              amountFormatted: isUnlimited ? 'Unlimited' : formatUnits(allowance, tokenInfo.decimals),
              isUnlimited,
              riskLevel,
              reason
            })
          }
        } catch (e) {}
      }
    } catch (err) {}
  }
  
  allowances.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 }
    return order[b.riskLevel] - order[a.riskLevel]
  })
  
  console.log(`✅ Found ${allowances.length} allowances`)
  return allowances
}

// Endpoint
app.post('/', async (c) => {
  try {
    const { walletAddress, network } = await c.req.json()
    
    if (!walletAddress) {
      return c.json({ success: false, error: 'Wallet address required' }, 400)
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ success: false, error: 'Invalid address' }, 400)
    }
    
    const selectedNetwork = network || 'base'
    
    if (!SUPPORTED_NETWORKS[selectedNetwork]) {
      return c.json({ 
        success: false, 
        error: 'Unsupported network',
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS)
      }, 400)
    }
    
    const allowances = await scanAllowances(walletAddress, selectedNetwork)
    
    return c.json({
      success: true,
      allowances,
      scannedAt: new Date().toISOString(),
      totalFound: allowances.length,
      riskyCount: allowances.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium').length
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Vercel handler
export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host']
    const fullUrl = `${protocol}://${host}/`

    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
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
