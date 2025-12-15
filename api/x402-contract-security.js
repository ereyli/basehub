// x402 Contract Security Analysis Endpoint for BaseHub using Hono
// Accepts 0.5 USDC payments using Coinbase x402 on Base network
// Provides on-chain contract security analysis using Etherscan API

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
const PRICE = '$0.50' // 0.50 USDC
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || 'SI8ECAC19FPN92K9MCNQENMGY6Z6MRM14Q'

// Supported networks for contract analysis (same as wallet analysis)
const SUPPORTED_NETWORKS = {
  'base': { chainId: 8453, name: 'Base Mainnet', currency: 'ETH' },
  'katana': { chainId: 747474, name: 'Katana Mainnet', currency: 'KATANA' },
  'opbnb': { chainId: 204, name: 'opBNB Mainnet', currency: 'BNB' },
  'polygon': { chainId: 137, name: 'Polygon Mainnet', currency: 'MATIC' },
  'sei': { chainId: 1329, name: 'Sei Mainnet', currency: 'SEI' },
  'stable': { chainId: 988, name: 'Stable Mainnet', currency: 'STABLE' },
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

// Log API key status
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
    service: 'Contract Security Analysis',
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
          description: 'BaseHub Contract Security Analysis - Pay 0.50 USDC on Base',
          mimeType: 'application/json',
          maxTimeoutSeconds: 600,
        },
      },
    },
    facilitatorConfig
  )
)

// ==========================================
// Contract Security Analysis Function
// ==========================================

async function analyzeContractSecurity(contractAddress, selectedNetwork = 'ethereum') {
  // Validate network selection
  if (!SUPPORTED_NETWORKS[selectedNetwork]) {
    console.error(`❌ Invalid network: ${selectedNetwork}. Defaulting to Ethereum.`)
    selectedNetwork = 'ethereum'
  }
  
  const network = SUPPORTED_NETWORKS[selectedNetwork]
  const chainId = network.chainId
  
  console.log(`🔍 Starting contract security analysis for: ${contractAddress} on ${network.name} (chainId: ${chainId})`)
  
  const analysis = {
    contractAddress,
    network: network.name,
    chainId: chainId,
    isVerified: false,
    securityScore: 0,
    riskLevel: 'Unknown',
    risks: [],
    warnings: [],
    safeFeatures: [],
    contractName: null,
    compilerVersion: null,
    optimizationEnabled: false,
    sourceCode: null,
    abi: null,
  }

  try {
    // 1. Get contract source code (if verified)
    console.log(`🔍 Fetching contract source code from Etherscan API V2 (${network.name})...`)
    try {
      const sourceCodeUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${contractAddress}&apikey=${BASESCAN_API_KEY}`
      console.log(`🌐 Source code API URL (${network.name}):`, sourceCodeUrl.replace(BASESCAN_API_KEY, 'API_KEY_HIDDEN'))
      
      const sourceCodeResponse = await fetch(sourceCodeUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-ContractSecurity/1.0',
        },
      })
      
      console.log('📡 Source code API HTTP status:', sourceCodeResponse.status, sourceCodeResponse.statusText)
      
      if (sourceCodeResponse.ok) {
        const sourceCodeData = await sourceCodeResponse.json()
        console.log('📊 Source code API response:', {
          status: sourceCodeData.status,
          message: sourceCodeData.message,
          resultLength: sourceCodeData.result && Array.isArray(sourceCodeData.result) ? sourceCodeData.result.length : 0,
        })

        if (sourceCodeData.status === '1' && sourceCodeData.result && Array.isArray(sourceCodeData.result) && sourceCodeData.result.length > 0) {
          const contractInfo = sourceCodeData.result[0]
          
          analysis.isVerified = contractInfo.SourceCode && contractInfo.SourceCode !== ''
          analysis.contractName = contractInfo.ContractName || 'Unknown'
          analysis.compilerVersion = contractInfo.CompilerVersion || null
          analysis.optimizationEnabled = contractInfo.OptimizationUsed === '1'
          
          if (analysis.isVerified) {
            analysis.sourceCode = contractInfo.SourceCode
            console.log('✅ Contract is verified, source code available')
            
            // Analyze source code for risks
            analyzeSourceCode(analysis, contractInfo.SourceCode)
          } else {
            console.log('⚠️ Contract is not verified, limited analysis possible')
            analysis.warnings.push('Contract source code is not verified. Full security analysis cannot be performed.')
          }
        } else {
          console.log('⚠️ No contract information found')
          analysis.warnings.push('Contract information not found on blockchain explorer.')
        }
      } else {
        console.error('❌ Source code API HTTP error:', sourceCodeResponse.status)
        analysis.warnings.push('Failed to fetch contract information from blockchain explorer.')
      }
    } catch (sourceCodeError) {
      console.error('❌ Error fetching source code:', sourceCodeError)
      analysis.warnings.push('Error fetching contract source code.')
    }

    // 2. Get contract ABI
    console.log(`🔍 Fetching contract ABI from Etherscan API V2 (${network.name})...`)
    try {
      const abiUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${contractAddress}&apikey=${BASESCAN_API_KEY}`
      const abiResponse = await fetch(abiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BaseHub-ContractSecurity/1.0',
        },
      })
      
      if (abiResponse.ok) {
        const abiData = await abiResponse.json()
        if (abiData.status === '1' && abiData.result && abiData.result !== 'Contract source code not verified') {
          try {
            analysis.abi = JSON.parse(abiData.result)
            console.log('✅ Contract ABI retrieved')
          } catch (parseError) {
            console.log('⚠️ ABI parse error:', parseError)
          }
        }
      }
    } catch (abiError) {
      console.error('❌ Error fetching ABI:', abiError)
    }

    // 3. Calculate Security Score
    calculateSecurityScore(analysis)

  } catch (error) {
    console.error('❌ Contract security analysis error:', error)
    console.error('Error stack:', error.stack)
    
    if (analysis.risks.length === 0 && analysis.warnings.length === 0) {
      throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`)
    }
  }

  return analysis
}

// Analyze source code for security risks
function analyzeSourceCode(analysis, sourceCode) {
  const code = sourceCode.toLowerCase()
  
  // Honeypot detection patterns
  const honeypotPatterns = [
    /require\s*\(\s*whitelist\s*\[/i,
    /require\s*\(\s*!isblacklisted\s*\[/i,
    /require\s*\(\s*balanceof\s*\[from\]\s*>=\s*amount/i,
    /require\s*\(\s*allowed\s*\[from\]\s*\[msg\.sender\]\s*>=\s*amount/i,
    /transfer\s*\(\s*from\s*,\s*to\s*,\s*amount\s*\)\s*\{[^}]*require\s*\(/i,
  ]
  
  honeypotPatterns.forEach((pattern, index) => {
    if (pattern.test(sourceCode)) {
      analysis.risks.push({
        type: 'Honeypot',
        severity: 'High',
        description: 'Potential honeypot detected: Transfer restrictions found in contract code',
        details: 'This contract may prevent users from selling tokens after purchase.',
      })
    }
  })
  
  // Mint function analysis
  const mintPattern = /function\s+mint/i
  if (mintPattern.test(sourceCode)) {
    const onlyOwnerPattern = /function\s+mint[^{]*onlyowner/i
    const publicMintPattern = /function\s+mint[^{]*public/i
    
    if (onlyOwnerPattern.test(sourceCode)) {
      analysis.safeFeatures.push({
        type: 'Mint Control',
        description: 'Mint function is owner-only (safe)',
      })
    } else if (publicMintPattern.test(sourceCode)) {
      analysis.risks.push({
        type: 'Unlimited Mint',
        severity: 'High',
        description: 'Public mint function detected - unlimited token supply possible',
        details: 'Anyone can mint new tokens, which can devalue existing holdings.',
      })
    } else {
      analysis.warnings.push({
        type: 'Mint Function',
        description: 'Mint function exists but access control unclear',
      })
    }
  }
  
  // Burn function detection
  const burnPattern = /function\s+burn/i
  if (burnPattern.test(sourceCode)) {
    analysis.safeFeatures.push({
      type: 'Burn Function',
      description: 'Burn function available - tokens can be permanently removed',
    })
  }
  
  // Owner privileges analysis
  const ownerPattern = /onlyowner|only\s+owner/i
  const ownerFunctions = []
  const ownerFunctionPattern = /function\s+(\w+)[^{]*onlyowner/gi
  let match
  while ((match = ownerFunctionPattern.exec(sourceCode)) !== null) {
    ownerFunctions.push(match[1])
  }
  
  if (ownerFunctions.length > 5) {
    analysis.risks.push({
      type: 'Excessive Owner Powers',
      severity: 'Medium',
      description: `Contract has ${ownerFunctions.length} owner-only functions`,
      details: 'Owner has significant control over the contract, including potential to pause, blacklist, or modify token behavior.',
    })
  } else if (ownerFunctions.length > 0) {
    analysis.warnings.push({
      type: 'Owner Functions',
      description: `Contract has ${ownerFunctions.length} owner-only function(s)`,
    })
  }
  
  // Pause mechanism
  const pausePattern = /function\s+pause|paused\s*=\s*true/i
  if (pausePattern.test(sourceCode)) {
    analysis.risks.push({
      type: 'Pause Mechanism',
      severity: 'Medium',
      description: 'Contract can be paused by owner',
      details: 'Owner can pause all transfers, potentially locking user funds.',
    })
  }
  
  // Blacklist mechanism
  const blacklistPattern = /blacklist|isblacklisted/i
  if (blacklistPattern.test(sourceCode)) {
    analysis.risks.push({
      type: 'Blacklist Function',
      severity: 'High',
      description: 'Blacklist mechanism detected',
      details: 'Owner can blacklist addresses, preventing them from trading tokens.',
    })
  }
  
  // Transfer restrictions
  const transferRestrictionPattern = /transfer\s*\([^)]*\)\s*\{[^}]*require\s*\([^)]*\)/i
  if (transferRestrictionPattern.test(sourceCode) && !code.includes('standard erc20')) {
    analysis.warnings.push({
      type: 'Transfer Restrictions',
      description: 'Non-standard transfer restrictions detected',
    })
  }
  
  // Reentrancy protection
  const reentrancyPattern = /reentrancyguard|nonreentrant/i
  if (reentrancyPattern.test(sourceCode)) {
    analysis.safeFeatures.push({
      type: 'Reentrancy Protection',
      description: 'Reentrancy guard implemented (safe)',
    })
  } else {
    analysis.warnings.push({
      type: 'Reentrancy Risk',
      description: 'No reentrancy protection detected',
    })
  }
}

// Calculate security score (0-100)
function calculateSecurityScore(analysis) {
  let score = 100
  
  // Deduct points for risks
  analysis.risks.forEach(risk => {
    if (risk.severity === 'High') {
      score -= 20
    } else if (risk.severity === 'Medium') {
      score -= 10
    } else {
      score -= 5
    }
  })
  
  // Deduct points for warnings
  analysis.warnings.forEach(() => {
    score -= 3
  })
  
  // Bonus for safe features
  analysis.safeFeatures.forEach(() => {
    score += 5
  })
  
  // Bonus for verified contract
  if (analysis.isVerified) {
    score += 10
  } else {
    score -= 15 // Unverified contracts are risky
  }
  
  // Ensure score is between 0 and 100
  analysis.securityScore = Math.max(0, Math.min(100, score))
  
  // Determine risk level
  if (analysis.securityScore >= 80) {
    analysis.riskLevel = 'Low Risk ✅'
  } else if (analysis.securityScore >= 60) {
    analysis.riskLevel = 'Medium Risk ⚠️'
  } else if (analysis.securityScore >= 40) {
    analysis.riskLevel = 'High Risk 🔴'
  } else {
    analysis.riskLevel = 'Critical Risk 🚨'
  }
}

// ==========================================
// Contract Security Analysis endpoint
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
    
    const { contractAddress, network } = body
    
    if (!contractAddress) {
      return c.json({ error: 'Contract address is required' }, 400)
    }
    
    // Validate network selection
    const selectedNetwork = network || 'ethereum'
    if (!SUPPORTED_NETWORKS[selectedNetwork]) {
      return c.json({ 
        error: 'Invalid network selection', 
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS) 
      }, 400)
    }
    
    console.log(`🔍 Extracted contractAddress: ${contractAddress}, network: ${selectedNetwork}`)

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      console.error('❌ Invalid contract address format:', contractAddress)
      return c.json({ error: 'Invalid contract address format' }, 400)
    }

    // Perform contract security analysis
    const analysisPromise = analyzeContractSecurity(contractAddress, selectedNetwork)
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

    console.log('✅ Contract security analysis completed:', {
      contractAddress,
      network: selectedNetwork,
      score: analysis.securityScore,
      riskLevel: analysis.riskLevel,
    })

    return c.json({
      success: true,
      contractAddress,
      network: selectedNetwork,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Contract security analysis endpoint error:', error)
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
    console.log('🔍 Contract Security Analysis handler called:', {
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

