// x402 Wallet Analysis Endpoint for BaseHub using Hono
// Accepts 0.3 USDC payments using Coinbase x402
// Provides fun and useful wallet analysis

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'

const app = new Hono()

// Your receiving wallet address
const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

// Payment configuration
const PRICE = '$0.01' // 0.01 USDC
const NETWORK = process.env.X402_NETWORK || 'base'

// BaseScan API Key
// Vercel environment variables are automatically available via process.env
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || process.env.VITE_BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Log API key status (first 10 chars only for security)
if (BASESCAN_API_KEY && BASESCAN_API_KEY !== 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q') {
  console.log('✅ BaseScan API Key loaded from environment:', `${BASESCAN_API_KEY.substring(0, 10)}...`)
} else if (BASESCAN_API_KEY === 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q') {
  console.log('⚠️ Using hardcoded API key (fallback)')
} else {
  console.error('❌ BaseScan API Key NOT FOUND! Please set BASESCAN_API_KEY in Vercel environment variables')
}

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = facilitator
  console.log('✅ Using CDP facilitator for Base mainnet')
} else {
  facilitatorConfig = { url: 'https://x402.org/facilitator' }
  console.log('⚠️  WARNING: No CDP API keys found!')
}

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['X-PAYMENT-RESPONSE'],
  maxAge: 86400,
}))

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Wallet Analysis',
    price: PRICE,
    network: NETWORK,
  })
})

// Apply x402 payment middleware
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: PRICE,
        network: NETWORK,
        config: {
          description: 'BaseHub Wallet Analysis - Pay 0.01 USDC',
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  )
)

// ERC20 ABI for token balance
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
]

// Helper function to format ETH values
function formatEtherValue(value) {
  if (!value || value === '0') return '0.0000'
  try {
    // Convert from wei to ETH (18 decimals)
    const wei = BigInt(value)
    const eth = Number(wei) / 1e18
    return eth.toFixed(6)
  } catch (error) {
    return '0.0000'
  }
}

// Helper function to format token values
function formatTokenValue(value, decimals = 18) {
  if (!value || value === '0') return '0.0000'
  try {
    const amount = BigInt(value)
    const divisor = BigInt(10 ** decimals)
    const result = Number(amount) / Number(divisor)
    return result.toFixed(4)
  } catch (error) {
    return '0.0000'
  }
}

// Fun wallet analysis function - using BaseScan API only (no viem to avoid Vercel issues)
async function performWalletAnalysis(walletAddress) {
  // Note: We're using BaseScan API only to avoid viem/Vercel compatibility issues
  // Native balance will be fetched from BaseScan API instead of RPC

  const analysis = {
    walletAddress,
    // Basic Info
    nativeBalance: '0',
    // Fun Metrics
    walletScore: 0,
    activityLevel: 'Unknown',
    tokenDiversity: 0,
    nftCount: 0,
    // Stats
    totalTransactions: 0,
    totalValueMoved: '0',
    firstTransactionDate: null,
    daysActive: 0,
    favoriteToken: null,
    mostActiveDay: null,
    // Holdings
    topTokens: [],
    // Fun Facts
    funFacts: [],
  }

  try {
    // 1. Get native ETH balance from BaseScan API
    console.log('🔍 Fetching native balance from BaseScan...')
    console.log('🔑 API Key check:', BASESCAN_API_KEY ? `Set (${BASESCAN_API_KEY.substring(0, 10)}...)` : 'NOT SET')
    try {
      // BaseScan API: Use V1 format with chainid parameter (V2 may not be fully available yet)
      // Format: /api?module=account&action=balance&address=...&chainid=8453
      const balanceUrl = `https://api.basescan.org/api?module=account&action=balance&address=${walletAddress}&tag=latest&chainid=8453&apikey=${BASESCAN_API_KEY}`
      console.log('🌐 Balance API V2 URL:', balanceUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
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
          console.log('✅ Balance fetched successfully:', analysis.nativeBalance, 'ETH')
        } else if (balanceData.status === '0') {
          console.error('❌ BaseScan API error for balance:', balanceData.message, balanceData.result)
          // Check for common API errors
          if (balanceData.result && typeof balanceData.result === 'string') {
            if (balanceData.result.includes('Invalid API Key') || balanceData.result.includes('invalid api key')) {
              console.error('❌ INVALID API KEY! Please check BASESCAN_API_KEY in Vercel environment variables')
            } else if (balanceData.result.includes('rate limit') || balanceData.result.includes('Rate limit')) {
              console.error('❌ RATE LIMIT EXCEEDED! Please wait before making more requests')
            }
          }
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
      console.error('❌ Balance error details:', {
        message: balanceError.message,
        stack: balanceError.stack,
      })
      analysis.nativeBalance = '0.0000'
    }

    // 2. Get transactions from BaseScan API V2
    // BaseScan API V2 format: /v2/api?chainid=8453&module=account&action=txlist&address=...
    console.log('🔍 Fetching transactions from BaseScan API V2...')
    try {
      const txUrl = `https://api.basescan.org/v2/api?chainid=8453&module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${BASESCAN_API_KEY}`
      console.log('🌐 Transaction API V2 URL:', txUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
      const txResponse = await fetch(txUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-WalletAnalysis/1.0',
        },
      })
      
      console.log('📡 Transaction API HTTP status:', txResponse.status, txResponse.statusText)
      
      if (!txResponse.ok) {
        console.error('❌ Transaction API error:', txResponse.status, txResponse.statusText)
        throw new Error(`BaseScan API error: ${txResponse.status}`)
      }
      
      const txData = await txResponse.json()
      console.log('📊 Transaction API response:', {
        status: txData.status,
        message: txData.message,
        hasResult: !!txData.result,
        resultType: txData.result ? (Array.isArray(txData.result) ? 'array' : typeof txData.result) : 'none',
        resultLength: txData.result && Array.isArray(txData.result) ? txData.result.length : 0,
      })

      // BaseScan API V1 returns { status: '1', result: [...] } format
      let transactions = []
      if (txData.status === '1' && txData.result && Array.isArray(txData.result)) {
        transactions = txData.result
      }
      
      if (transactions.length === 0) {
        console.log('ℹ️ No transactions found for this wallet')
      } else {
        analysis.totalTransactions = transactions.length

        // Calculate total value moved
        let totalValue = BigInt(0)
        transactions.forEach(tx => {
          // BaseScan API V1 format: value is in wei as string
          const value = tx.value || '0'
          totalValue += BigInt(value)
        })
        analysis.totalValueMoved = formatEtherValue(totalValue.toString())

        // First and last transaction dates
        if (transactions.length > 0) {
          // BaseScan API V1: timeStamp is unix timestamp in seconds
          const firstTx = transactions[transactions.length - 1]
          const lastTx = transactions[0]
          
          const firstTimestamp = firstTx.timeStamp || firstTx.timestamp || firstTx.blockTimestamp
          const lastTimestamp = lastTx.timeStamp || lastTx.timestamp || lastTx.blockTimestamp
          
          const firstDate = firstTimestamp ? new Date(parseInt(firstTimestamp) * 1000) : new Date()
          const lastDate = lastTimestamp ? new Date(parseInt(lastTimestamp) * 1000) : new Date()
          
          analysis.firstTransactionDate = firstDate.toLocaleDateString()
          analysis.daysActive = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)))
        }

        // Most active day
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
      // Continue with other data even if transactions fail
    }

    // 3. Get token transfers from BaseScan API V2
    // BaseScan API V2 format: /v2/api?chainid=8453&module=account&action=tokentx&address=...
    console.log('🔍 Fetching token transfers from BaseScan API V2...')
    try {
      const tokenTxUrl = `https://api.basescan.org/v2/api?chainid=8453&module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${BASESCAN_API_KEY}`
      console.log('🌐 Token transfer API V2 URL:', tokenTxUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
      const tokenTxResponse = await fetch(tokenTxUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-WalletAnalysis/1.0',
        },
      })
      
      console.log('📡 Token transfer API HTTP status:', tokenTxResponse.status, tokenTxResponse.statusText)
      
      if (!tokenTxResponse.ok) {
        console.error('❌ Token transfer API error:', tokenTxResponse.status)
        throw new Error(`BaseScan API error: ${tokenTxResponse.status}`)
      }
      
      const tokenTxData = await tokenTxResponse.json()
      console.log('📊 Token transfer API response:', {
        status: tokenTxData.status,
        message: tokenTxData.message,
        hasResult: !!tokenTxData.result,
        resultType: tokenTxData.result ? (Array.isArray(tokenTxData.result) ? 'array' : typeof tokenTxData.result) : 'none',
        resultLength: tokenTxData.result && Array.isArray(tokenTxData.result) ? tokenTxData.result.length : 0,
      })

      // BaseScan API returns { status: '1', result: [...] } format
      let tokenTransfers = []
      if (tokenTxData.status === '1' && tokenTxData.result && Array.isArray(tokenTxData.result)) {
        tokenTransfers = tokenTxData.result
      }
      
      if (tokenTransfers.length === 0) {
        console.log('ℹ️ No token transfers found for this wallet')
      } else {
        // Get unique tokens
        const tokenMap = new Map()
        tokenTransfers.forEach(tx => {
          // API V2 format: contractAddress or tokenAddress
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

        // Get balances for top tokens (limit to 10)
        const tokenArray = Array.from(tokenMap.values())
          .sort((a, b) => b.transfers - a.transfers)
          .slice(0, 10)

        // Get token balances from BaseScan API (more reliable than RPC in Vercel)
        const tokensToCheck = tokenArray.slice(0, 10) // Check top 10 tokens
        
        for (const token of tokensToCheck) {
          try {
            // Get token balance from BaseScan API V2
            // BaseScan API V2 format: /v2/api?chainid=8453&module=account&action=tokenbalance&contractaddress=...&address=...
            const tokenBalanceUrl = `https://api.basescan.org/v2/api?chainid=8453&module=account&action=tokenbalance&contractaddress=${token.address}&address=${walletAddress}&tag=latest&apikey=${BASESCAN_API_KEY}`
            const tokenBalanceResponse = await fetch(tokenBalanceUrl, {
              headers: { 
                'Accept': 'application/json',
                'User-Agent': 'BaseHub-WalletAnalysis/1.0',
              },
            })
            
            if (tokenBalanceResponse.ok) {
              const tokenBalanceData = await tokenBalanceResponse.json()
              // BaseScan API V1 returns { status: '1', result: '...' } format
              let balance = null
              if (tokenBalanceData.status === '1' && tokenBalanceData.result) {
                balance = tokenBalanceData.result
              } else if (tokenBalanceData.balance) {
                balance = tokenBalanceData.balance
              } else if (tokenBalanceData.items && tokenBalanceData.items.length > 0) {
                balance = tokenBalanceData.items[0].balance || tokenBalanceData.items[0].value
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
            // Token balance fetch failed, skip it
            console.log(`⚠️ Skipping token ${token.symbol}:`, err.message)
          }
        }

        // Favorite token (most transfers)
        if (tokenArray.length > 0) {
          analysis.favoriteToken = tokenArray[0].symbol
        }
      }
    } catch (tokenError) {
      console.error('❌ Error fetching token transfers:', tokenError)
      // Continue with other data even if token transfers fail
    }

    // NFT transfers removed as per user request
    analysis.nftCount = 0

    // 5. Calculate Wallet Score (0-100)
    let score = 0
    
    // Activity score (0-30 points)
    if (analysis.totalTransactions > 100) score += 30
    else if (analysis.totalTransactions > 50) score += 20
    else if (analysis.totalTransactions > 10) score += 10
    else if (analysis.totalTransactions > 0) score += 5

    // Diversity score (0-25 points)
    if (analysis.tokenDiversity > 10) score += 25
    else if (analysis.tokenDiversity > 5) score += 15
    else if (analysis.tokenDiversity > 2) score += 10
    else if (analysis.tokenDiversity > 0) score += 5

    // NFT collector score (0-20 points)
    if (analysis.nftCount > 20) score += 20
    else if (analysis.nftCount > 10) score += 15
    else if (analysis.nftCount > 5) score += 10
    else if (analysis.nftCount > 0) score += 5

    // Value score (0-15 points)
    const valueMoved = parseFloat(analysis.totalValueMoved)
    if (valueMoved > 10) score += 15
    else if (valueMoved > 1) score += 10
    else if (valueMoved > 0.1) score += 5

    // Longevity score (0-10 points)
    if (analysis.daysActive > 365) score += 10
    else if (analysis.daysActive > 180) score += 7
    else if (analysis.daysActive > 90) score += 5
    else if (analysis.daysActive > 30) score += 3

    analysis.walletScore = Math.min(100, score)

    // 6. Activity Level
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

    // 7. Fun Facts
    analysis.funFacts = []
    
    if (analysis.totalTransactions === 0) {
      analysis.funFacts.push('This wallet is brand new! 🎉')
    } else {
      analysis.funFacts.push(`Made ${analysis.totalTransactions} transactions on Base`)
    }

    if (analysis.daysActive > 0) {
      analysis.funFacts.push(`Active for ${analysis.daysActive} days`)
    }

    if (analysis.tokenDiversity > 0) {
      analysis.funFacts.push(`Holds ${analysis.tokenDiversity} different tokens`)
    }

    // NFT fun fact removed (NFT data no longer fetched)

    if (analysis.favoriteToken) {
      analysis.funFacts.push(`Favorite token: ${analysis.favoriteToken}`)
    }

    if (parseFloat(analysis.nativeBalance) > 0.1) {
      analysis.funFacts.push(`Has ${analysis.nativeBalance} ETH`)
    }

  } catch (error) {
    console.error('❌ Wallet analysis error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    
    // Return partial analysis if possible
    if (analysis.nativeBalance !== '0' || analysis.totalTransactions > 0) {
      console.log('⚠️ Returning partial analysis due to error')
      return analysis
    }
    
    // If we have no data at all, throw the error
    throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`)
  }

  return analysis
}

// Wallet Analysis endpoint - protected by middleware
app.post('/', async (c) => {
  console.log('✅ POST / endpoint called - payment verified by middleware')
  
  // Safely get headers - Hono uses Headers object which may not have entries() in all versions
  let headers = {}
  try {
    if (c.req.headers && typeof c.req.headers.forEach === 'function') {
      c.req.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (c.req.headers && typeof c.req.headers.entries === 'function') {
      headers = Object.fromEntries(c.req.headers.entries())
    } else {
      // Fallback: headers might be a plain object
      headers = c.req.headers || {}
    }
  } catch (e) {
    console.error('⚠️ Error reading headers:', e)
    headers = {}
  }
  
  console.log('📋 Request details:', {
    method: c.req.method,
    url: c.req.url,
    hasHeaders: !!c.req.headers,
  })
  
  try {
    let body
    try {
      body = await c.req.json()
      console.log('📦 Request body received:', body)
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError)
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const { walletAddress } = body || {}
    console.log('🔍 Extracted walletAddress:', walletAddress)

    if (!walletAddress) {
      console.error('❌ No wallet address provided')
      return c.json({ error: 'Wallet address required' }, 400)
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      console.error('❌ Invalid wallet address format:', walletAddress)
      return c.json({ error: 'Invalid wallet address format' }, 400)
    }

    console.log('🔍 Starting wallet analysis for:', walletAddress)

    // Perform analysis with timeout
    const analysisPromise = performWalletAnalysis(walletAddress)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout after 30 seconds')), 30000)
    )

    let analysis
    try {
      analysis = await Promise.race([analysisPromise, timeoutPromise])
    } catch (analysisError) {
      console.error('❌ Analysis error:', analysisError)
      console.error('Error stack:', analysisError.stack)
      
      // Return error with more details
      return c.json({
        error: 'Analysis failed',
        message: analysisError.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? analysisError.stack : undefined,
      }, 500)
    }

    console.log('✅ Wallet analysis completed:', {
      walletAddress,
      score: analysis.walletScore,
      transactions: analysis.totalTransactions,
    })

    return c.json({
      success: true,
      walletAddress,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Wallet analysis endpoint error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    
    return c.json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500)
  }
})

// Export for Vercel (serverless function)
export default async function handler(req, res) {
  try {
    console.log('🔍 Wallet Analysis handler called:', {
      method: req.method,
      url: req.url,
    })

    const urlParts = (req.url || '/').split('?')
    const path = urlParts[0] || '/'
    const queryString = urlParts[1] || ''
    const normalizedPath = '/'

    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
    const fullUrl = `${protocol}://${host}${normalizedPath}${queryString ? `?${queryString}` : ''}`

    let body = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        console.log('📦 Request body prepared:', body.substring(0, 200))
      } else {
        console.log('⚠️ No request body found')
      }
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body: body,
    })
    
    console.log('📤 Created Request object:', {
      method: request.method,
      url: request.url,
      hasBody: !!body,
      bodyLength: body ? body.length : 0,
    })

    console.log('📞 Calling Hono app.fetch with request:', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    })

    const response = await app.fetch(request)

    console.log('📥 Hono app response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })

    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const responseBody = await response.text()
    console.log('📦 Response body length:', responseBody.length)
    console.log('📦 Response body preview:', responseBody.substring(0, 200))
    
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

