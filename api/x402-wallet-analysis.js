// x402 Wallet Analysis Endpoint for BaseHub using Hono
// Accepts 0.01 USDC payments using Coinbase x402 on Base network
// Provides fun and useful wallet analysis on multiple networks

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'

const app = new Hono()

// ==========================================
// Configuration
// ==========================================

const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.40' // 0.40 USDC
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Supported networks for wallet analysis (all have free API access)
const SUPPORTED_NETWORKS = {
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
if (BASESCAN_API_KEY && BASESCAN_API_KEY !== 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q') {
  console.log('✅ Etherscan API Key loaded from environment:', `${BASESCAN_API_KEY.substring(0, 10)}...`)
} else {
  console.log('⚠️ Using default API key (fallback)')
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
    service: 'Wallet Analysis',
    price: PRICE,
    paymentNetwork: NETWORK,
    supportedAnalysisNetworks: Object.keys(SUPPORTED_NETWORKS),
  })
})

// ==========================================
// Apply x402 payment middleware (Base network)
// ==========================================
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: PRICE,
        network: NETWORK,
        config: {
          description: 'BaseHub Wallet Analysis - Pay 0.40 USDC on Base',
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
    const divisor = BigInt(10 ** decimals)
    const result = Number(amount) / Number(divisor)
    return result.toFixed(4)
  } catch (error) {
    return '0.0000'
  }
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

  console.log('🔑 API Key check:', BASESCAN_API_KEY ? `Set (${BASESCAN_API_KEY.substring(0, 10)}...)` : 'NOT SET')

  try {
    // 1. Get native balance
    try {
      const balanceUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${walletAddress}&tag=latest&apikey=${BASESCAN_API_KEY}`
      console.log(`🌐 Balance API URL (${network.name}):`, balanceUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
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
      const txUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${BASESCAN_API_KEY}`
      console.log(`🌐 Transaction API URL (${network.name}):`, txUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
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
      const tokenTxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${BASESCAN_API_KEY}`
      console.log(`🌐 Token transfer API URL (${network.name}):`, tokenTxUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
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
            const tokenBalanceUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokenbalance&contractaddress=${token.address}&address=${walletAddress}&tag=latest&apikey=${BASESCAN_API_KEY}`
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
    let score = 0
    
    if (analysis.totalTransactions > 100) score += 30
    else if (analysis.totalTransactions > 50) score += 20
    else if (analysis.totalTransactions > 10) score += 10
    else if (analysis.totalTransactions > 0) score += 5

    if (analysis.tokenDiversity > 10) score += 30
    else if (analysis.tokenDiversity > 5) score += 20
    else if (analysis.tokenDiversity > 0) score += 10

    const ethBalance = parseFloat(analysis.nativeBalance)
    if (ethBalance > 1) score += 20
    else if (ethBalance > 0.1) score += 10
    else if (ethBalance > 0) score += 5

    if (analysis.daysActive > 365) score += 20
    else if (analysis.daysActive > 180) score += 15
    else if (analysis.daysActive > 30) score += 10
    else if (analysis.daysActive > 0) score += 5

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
app.post('/', async (c) => {
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
})

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
