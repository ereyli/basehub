// x402 Contract Security Analysis Endpoint for BaseHub using Hono
// Accepts 0.5 USDC payments using Coinbase x402 on Base network
// Provides on-chain contract security analysis using Etherscan API

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createX402PaymentMiddleware, createX402Route, getFacilitatorConfig } from './_x402BuilderCode.js'

const app = new Hono()

// ==========================================
// Configuration
// ==========================================

const NETWORK = 'base' // Payment network (Base mainnet)
const RECEIVING_ADDRESS = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const PRICE = '$0.50' // 0.50 USDC
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
// Use env only – no fallback in repo (best practice for secrets)
const API_KEYS = {
  // Etherscan API V2 uses one account key across supported chains.
  ETHERSCAN: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || '',
}

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
if (API_KEYS.ETHERSCAN) {
  console.log('✅ Etherscan API V2 key loaded from environment:', `${API_KEYS.ETHERSCAN.substring(0, 10)}...`)
} else {
  console.warn('⚠️ ETHERSCAN_API_KEY/BASESCAN_API_KEY not set – contract analysis will return limited reports')
}

// Configure facilitator
let facilitatorConfig
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  facilitatorConfig = getFacilitatorConfig()
  console.log('✅ Using CDP facilitator for Base mainnet')
} else {
  facilitatorConfig = getFacilitatorConfig()
  console.log('⚠️  WARNING: No CDP API keys found!')
}

// ==========================================
// CORS middleware
// ==========================================
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT', 'PAYMENT-SIGNATURE'],
  exposeHeaders: ['X-PAYMENT-RESPONSE', 'PAYMENT-RESPONSE', 'PAYMENT-REQUIRED'],
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
  createX402PaymentMiddleware(
    {
      'POST /': createX402Route({
        price: PRICE,
        network: NETWORK,
        payTo: RECEIVING_ADDRESS,
        description: 'BaseHub Contract Security Analysis - Pay 0.50 USDC on Base',
        maxTimeoutSeconds: 600,
      }),
    },
    facilitatorConfig
  )
)

// ==========================================
// Contract Security Analysis Function
// ==========================================

function hideApiKeyInUrl(url, key) {
  if (!key) return url
  return url.replace(key, 'API_KEY_HIDDEN')
}

function addSecurityCheckOnce(analysis, check) {
  if (analysis.securityChecks.some(existing => existing.check === check.check)) return
  analysis.securityChecks.push(check)
}

function addLimitedDataChecks(analysis, reason) {
  analysis.dataQuality = 'Limited'
  analysis.warnings.push({
    type: 'Limited Data',
    description: reason,
  })
  addSecurityCheckOnce(analysis, {
    check: 'Explorer Data',
    passed: false,
    status: '⚠️ Limited explorer data',
    details: reason,
  })
  addSecurityCheckOnce(analysis, {
    check: 'Contract Verification',
    passed: false,
    status: '⚠️ Verification unknown',
    details: 'Source code could not be verified from available explorer data.',
  })
}

function finalizeContractAnalysis(analysis) {
  if (!analysis.isVerified) {
    addSecurityCheckOnce(analysis, {
      check: 'Contract Verification',
      passed: false,
      status: '❌ Not verified',
      details: 'Contract source code is not verified or could not be fetched. Treat this as a high-uncertainty result.',
    })
  }

  addSecurityCheckOnce(analysis, {
    check: 'ABI Availability',
    passed: Boolean(analysis.abi),
    status: analysis.abi ? '✅ ABI available' : '⚠️ ABI unavailable',
    details: analysis.abi
      ? 'Contract ABI was retrieved from the explorer.'
      : 'ABI is not available. Function-level checks are limited.',
  })

  calculateSecurityScore(analysis)
  return analysis
}

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
    securityChecks: [], // Detailed checks with pass/fail status
    contractName: null,
    compilerVersion: null,
    optimizationEnabled: false,
    sourceCode: null,
    abi: null,
    dataQuality: 'Full',
    dataSources: [],
  }

  if (!API_KEYS.ETHERSCAN) {
    addLimitedDataChecks(
      analysis,
      'Etherscan API V2 key is not configured. Set ETHERSCAN_API_KEY for full contract source and ABI analysis.'
    )
    return finalizeContractAnalysis(analysis)
  }

  try {
    // 1. Get contract source code (if verified)
    console.log(`🔍 Fetching contract source code from Etherscan API V2 (${network.name})...`)
    try {
      const sourceCodeUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${contractAddress}&apikey=${API_KEYS.ETHERSCAN}`
      console.log(`🌐 Source code API URL (${network.name}):`, hideApiKeyInUrl(sourceCodeUrl, API_KEYS.ETHERSCAN))
      
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
            analysis.dataSources.push('Etherscan V2 Source')
            console.log('✅ Contract is verified, source code available')
            
            // Analyze source code for risks
            analyzeSourceCode(analysis, contractInfo.SourceCode)
          } else {
            console.log('⚠️ Contract is not verified, limited analysis possible')
            analysis.warnings.push('Contract source code is not verified. Full security analysis cannot be performed.')
            analysis.dataQuality = 'Limited'
          }
        } else {
          console.log('⚠️ No contract information found')
          addLimitedDataChecks(analysis, sourceCodeData.result || 'Contract information not found on blockchain explorer.')
        }
      } else {
        console.error('❌ Source code API HTTP error:', sourceCodeResponse.status)
        addLimitedDataChecks(analysis, `Failed to fetch contract information from blockchain explorer. HTTP ${sourceCodeResponse.status}.`)
      }
    } catch (sourceCodeError) {
      console.error('❌ Error fetching source code:', sourceCodeError)
      addLimitedDataChecks(analysis, `Error fetching contract source code: ${sourceCodeError.message}`)
    }

    // 2. Get contract ABI
    console.log(`🔍 Fetching contract ABI from Etherscan API V2 (${network.name})...`)
    try {
      const abiUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${contractAddress}&apikey=${API_KEYS.ETHERSCAN}`
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
            analysis.dataSources.push('Etherscan V2 ABI')
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
    finalizeContractAnalysis(analysis)

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
  
  // ==========================================
  // 1. HONEYPOT DETECTION - Detailed Analysis
  // ==========================================
  let honeypotRisk = false
  const honeypotIndicators = []
  
  // Check for whitelist restrictions in transfer
  if (/whitelist\s*\[.*from.*\]|whitelist\s*\[.*msg\.sender.*\]/i.test(sourceCode)) {
    honeypotRisk = true
    honeypotIndicators.push('Whitelist check in transfer function')
  }
  
  // Check for blacklist restrictions
  if (/isblacklisted\s*\[.*from.*\]|blacklist\s*\[.*from.*\]|!isblacklisted/i.test(sourceCode)) {
    honeypotRisk = true
    honeypotIndicators.push('Blacklist check in transfer function')
  }
  
  // Check for balance restrictions (can't sell if balance too low)
  if (/require\s*\(\s*balanceof\s*\[.*from.*\]\s*>=\s*amount|balanceof\s*\[.*from.*\]\s*<\s*amount/i.test(sourceCode)) {
    honeypotRisk = true
    honeypotIndicators.push('Balance restriction in transfer')
  }
  
  // Check for approval restrictions
  if (/require\s*\(\s*allowed\s*\[.*from.*\]\s*\[.*msg\.sender.*\]\s*>=\s*amount/i.test(sourceCode)) {
    honeypotRisk = true
    honeypotIndicators.push('Approval restriction in transferFrom')
  }
  
  // Check for custom transfer restrictions
  if (/transfer\s*\([^)]*\)\s*\{[^}]*require\s*\([^}]*from[^}]*\)/i.test(sourceCode) && 
      !/standard\s*erc20|erc20\s*standard/i.test(sourceCode)) {
    honeypotRisk = true
    honeypotIndicators.push('Custom transfer restrictions detected')
  }
  
  // Check for sell restrictions (can't transfer to DEX/router)
  if (/uniswap|pancakeswap|router|dex/i.test(sourceCode) && 
      /require\s*\(\s*to\s*!=\s*.*router|require\s*\(\s*to\s*!=\s*.*dex/i.test(sourceCode)) {
    honeypotRisk = true
    honeypotIndicators.push('DEX/router transfer restrictions')
  }
  
  if (honeypotRisk) {
    analysis.risks.push({
      type: 'Honeypot Detected',
      severity: 'High',
      description: '⚠️ POTENTIAL HONEYPOT: Transfer restrictions found',
      details: `This contract may prevent users from selling tokens. Indicators: ${honeypotIndicators.join(', ')}. Users may be able to buy but not sell tokens.`,
      indicators: honeypotIndicators,
    })
    analysis.securityChecks.push({
      check: 'Honeypot Detection',
      passed: false,
      status: '❌ Honeypot detected',
      details: `Transfer restrictions found: ${honeypotIndicators.join(', ')}`,
    })
  } else {
    analysis.safeFeatures.push({
      type: 'No Honeypot',
      description: '✅ No honeypot indicators found - standard transfer function',
    })
    analysis.securityChecks.push({
      check: 'Honeypot Detection',
      passed: true,
      status: '✅ No honeypot detected',
      details: 'Standard transfer function - users can buy and sell tokens freely',
    })
  }
  
  // ==========================================
  // 2. MINT FUNCTION ANALYSIS - Detailed
  // ==========================================
  const mintPattern = /function\s+mint/i
  const hasMintFunction = mintPattern.test(sourceCode)
  
  if (hasMintFunction) {
    // Check if mint has max supply limit
    const maxSupplyPattern = /maxsupply|maximumsupply|totalsupply.*<=|supply.*limit/i
    const hasMaxSupply = maxSupplyPattern.test(sourceCode)
    
    // Check access control
    const onlyOwnerPattern = /function\s+mint[^{]*onlyowner|modifier\s+onlyowner[^}]*function\s+mint/i
    const publicMintPattern = /function\s+mint[^{]*public[^{]*\{/i
    const hasOwnerControl = onlyOwnerPattern.test(sourceCode)
    const isPublic = publicMintPattern.test(sourceCode)
    
    if (isPublic && !hasMaxSupply) {
      analysis.risks.push({
        type: 'Unlimited Public Mint',
        severity: 'Critical',
        description: '🚨 CRITICAL: Public mint function with NO supply limit',
        details: 'Anyone can mint unlimited tokens at any time. This will devalue existing tokens and can lead to infinite inflation.',
      })
    } else if (isPublic && hasMaxSupply) {
      analysis.risks.push({
        type: 'Public Mint (Limited)',
        severity: 'Medium',
        description: 'Public mint function detected (has supply limit)',
        details: 'Anyone can mint tokens, but there is a maximum supply limit. Still risky as it allows public token creation.',
      })
    } else if (hasOwnerControl && !hasMaxSupply) {
      analysis.risks.push({
        type: 'Owner-Controlled Unlimited Mint',
        severity: 'High',
        description: '⚠️ Owner can mint unlimited tokens',
        details: 'Owner has mint function without supply limit. Owner can create unlimited tokens, potentially devaluing existing holdings.',
      })
    } else if (hasOwnerControl && hasMaxSupply) {
      analysis.safeFeatures.push({
        type: 'Controlled Mint',
        description: '✅ Mint function is owner-only with supply limit (safe)',
      })
    } else {
      analysis.warnings.push({
        type: 'Mint Function Unclear',
        description: 'Mint function exists but access control and supply limits are unclear',
      })
      analysis.securityChecks.push({
        check: 'Mint Function Control',
        passed: false,
        status: '⚠️ Mint function unclear',
        details: 'Mint function exists but access control and supply limits are unclear',
      })
    }
  } else {
    analysis.safeFeatures.push({
      type: 'No Mint Function',
      description: '✅ No mint function - fixed supply token (safe)',
    })
    analysis.securityChecks.push({
      check: 'Mint Function',
      passed: true,
      status: '✅ No mint function',
      details: 'Fixed supply token - no new tokens can be created',
    })
  }
  
  // Add mint risk checks
  if (hasMintFunction) {
    const maxSupplyPattern = /maxsupply|maximumsupply|totalsupply.*<=|supply.*limit/i
    const hasMaxSupply = maxSupplyPattern.test(sourceCode)
    const onlyOwnerPattern = /function\s+mint[^{]*onlyowner|modifier\s+onlyowner[^}]*function\s+mint/i
    const publicMintPattern = /function\s+mint[^{]*public[^{]*\{/i
    const hasOwnerControl = onlyOwnerPattern.test(sourceCode)
    const isPublic = publicMintPattern.test(sourceCode)
    
    if (isPublic && !hasMaxSupply) {
      analysis.securityChecks.push({
        check: 'Unlimited Public Mint',
        passed: false,
        status: '❌ Public unlimited mint',
        details: 'Anyone can mint unlimited tokens - high inflation risk',
      })
    } else if (hasOwnerControl && !hasMaxSupply) {
      analysis.securityChecks.push({
        check: 'Owner Unlimited Mint',
        passed: false,
        status: '❌ Owner can mint unlimited',
        details: 'Owner can create unlimited tokens - supply can be inflated',
      })
    } else if (hasOwnerControl && hasMaxSupply) {
      analysis.securityChecks.push({
        check: 'Controlled Mint',
        passed: true,
        status: '✅ Owner-only mint with supply limit',
        details: 'Mint is controlled and has maximum supply limit',
      })
    }
  }
  
  // ==========================================
  // 3. BURN FUNCTION ANALYSIS
  // ==========================================
  const burnPattern = /function\s+burn/i
  const hasBurnFunction = burnPattern.test(sourceCode)
  if (hasBurnFunction) {
    const burnOwnerOnly = /function\s+burn[^{]*onlyowner/i
    if (burnOwnerOnly.test(sourceCode)) {
      analysis.warnings.push({
        type: 'Owner-Only Burn',
        description: 'Burn function is owner-only - users cannot burn their own tokens',
      })
      analysis.securityChecks.push({
        check: 'Burn Function',
        passed: false,
        status: '⚠️ Owner-only burn',
        details: 'Only owner can burn tokens - users cannot burn their own tokens',
      })
    } else {
      analysis.safeFeatures.push({
        type: 'Burn Function',
        description: '✅ Burn function available - users can permanently remove tokens',
      })
      analysis.securityChecks.push({
        check: 'Burn Function',
        passed: true,
        status: '✅ Burn function available',
        details: 'Users can permanently remove tokens from supply',
      })
    }
  } else {
    analysis.securityChecks.push({
      check: 'Burn Function',
      passed: true,
      status: '✅ No burn function',
      details: 'No burn function - standard ERC20 behavior',
    })
  }
  
  // ==========================================
  // 4. OWNER PRIVILEGES - Detailed Analysis
  // ==========================================
  const ownerFunctions = []
  const ownerFunctionPattern = /function\s+(\w+)[^{]*(onlyowner|onlyOwner|only\s+owner)/gi
  let match
  while ((match = ownerFunctionPattern.exec(sourceCode)) !== null) {
    ownerFunctions.push(match[1])
  }
  
  // Check for specific dangerous owner functions
  const dangerousFunctions = []
  if (/function\s+settax|function\s+setfee|function\s+changetax/i.test(sourceCode)) {
    dangerousFunctions.push('Set Tax/Fee')
  }
  if (/function\s+setmaxwallet|function\s+setmaxhold/i.test(sourceCode)) {
    dangerousFunctions.push('Set Max Wallet/Hold')
  }
  if (/function\s+exclude|function\s+include/i.test(sourceCode)) {
    dangerousFunctions.push('Exclude/Include from fees')
  }
  if (/function\s+renounceownership|renounce/i.test(sourceCode)) {
    analysis.safeFeatures.push({
      type: 'Renounce Ownership',
      description: '✅ Contract can renounce ownership (decentralized)',
    })
  }
  
  if (ownerFunctions.length > 10) {
    analysis.risks.push({
      type: 'Excessive Owner Powers',
      severity: 'High',
      description: `⚠️ Owner has ${ownerFunctions.length} owner-only functions`,
      details: `Owner has significant control: ${ownerFunctions.slice(0, 5).join(', ')}${ownerFunctions.length > 5 ? '...' : ''}. Dangerous functions: ${dangerousFunctions.join(', ') || 'None detected'}. Owner can modify contract behavior, pause transfers, change fees, or blacklist addresses.`,
      functionCount: ownerFunctions.length,
      dangerousFunctions: dangerousFunctions,
    })
    analysis.securityChecks.push({
      check: 'Owner Privileges',
      passed: false,
      status: `❌ ${ownerFunctions.length} owner functions`,
      details: `Excessive owner control: ${ownerFunctions.slice(0, 5).join(', ')}${ownerFunctions.length > 5 ? '...' : ''}. Dangerous: ${dangerousFunctions.join(', ') || 'None'}`,
    })
  } else if (ownerFunctions.length > 5) {
    analysis.risks.push({
      type: 'Moderate Owner Powers',
      severity: 'Medium',
      description: `Owner has ${ownerFunctions.length} owner-only functions`,
      details: `Owner functions: ${ownerFunctions.join(', ')}. ${dangerousFunctions.length > 0 ? `Dangerous: ${dangerousFunctions.join(', ')}.` : ''}`,
      functionCount: ownerFunctions.length,
      dangerousFunctions: dangerousFunctions,
    })
    analysis.securityChecks.push({
      check: 'Owner Privileges',
      passed: false,
      status: `⚠️ ${ownerFunctions.length} owner functions`,
      details: `Moderate owner control: ${ownerFunctions.join(', ')}`,
    })
  } else if (ownerFunctions.length > 0) {
    analysis.warnings.push({
      type: 'Owner Functions',
      description: `Contract has ${ownerFunctions.length} owner-only function(s): ${ownerFunctions.join(', ')}`,
      functionCount: ownerFunctions.length,
    })
    analysis.securityChecks.push({
      check: 'Owner Privileges',
      passed: false,
      status: `⚠️ ${ownerFunctions.length} owner function(s)`,
      details: `Owner functions: ${ownerFunctions.join(', ')}`,
    })
  } else {
    analysis.securityChecks.push({
      check: 'Owner Privileges',
      passed: true,
      status: '✅ No owner-only functions',
      details: 'No centralized owner control detected - more decentralized',
    })
  }
  
  // ==========================================
  // 5. PAUSE MECHANISM
  // ==========================================
  const pausePattern = /function\s+pause|paused\s*=\s*true|_paused/i
  const hasPauseFunction = pausePattern.test(sourceCode)
  if (hasPauseFunction) {
    const pauseOwnerOnly = /function\s+pause[^{]*onlyowner/i
    if (pauseOwnerOnly.test(sourceCode)) {
      analysis.risks.push({
        type: 'Pause Mechanism',
        severity: 'High',
        description: '⚠️ Owner can pause all transfers',
        details: 'Owner has the ability to pause all token transfers, effectively locking all user funds in the contract. This is a centralization risk.',
      })
      analysis.securityChecks.push({
        check: 'Pause Mechanism',
        passed: false,
        status: '❌ Owner can pause',
        details: 'Owner can pause all transfers - funds can be locked',
      })
    } else {
      analysis.risks.push({
        type: 'Pause Mechanism',
        severity: 'Critical',
        description: '🚨 CRITICAL: Pause function may be publicly accessible',
        details: 'Pause mechanism detected but access control is unclear. This could allow anyone to pause the contract.',
      })
      analysis.securityChecks.push({
        check: 'Pause Mechanism',
        passed: false,
        status: '❌ Pause may be public',
        details: 'Pause function exists but access control unclear',
      })
    }
  } else {
    analysis.securityChecks.push({
      check: 'Pause Mechanism',
      passed: true,
      status: '✅ No pause function',
      details: 'No pause mechanism - transfers cannot be stopped',
    })
  }
  
  // ==========================================
  // 6. BLACKLIST MECHANISM
  // ==========================================
  const blacklistPattern = /blacklist|isblacklisted|_blacklist/i
  const hasBlacklistFunction = blacklistPattern.test(sourceCode)
  if (hasBlacklistFunction) {
    const blacklistOwnerOnly = /function\s+(addblacklist|removeblacklist|setblacklist)[^{]*onlyowner/i
    if (blacklistOwnerOnly.test(sourceCode)) {
      analysis.risks.push({
        type: 'Blacklist Function',
        severity: 'High',
        description: '⚠️ Owner can blacklist addresses',
        details: 'Owner can add addresses to a blacklist, preventing them from buying or selling tokens. This is a centralization risk and can be used to censor users.',
      })
      analysis.securityChecks.push({
        check: 'Blacklist Function',
        passed: false,
        status: '❌ Owner can blacklist',
        details: 'Owner can blacklist addresses - users can be censored',
      })
    } else {
      analysis.risks.push({
        type: 'Blacklist Function',
        severity: 'Critical',
        description: '🚨 CRITICAL: Blacklist function may be publicly accessible',
        details: 'Blacklist mechanism detected but access control is unclear.',
      })
      analysis.securityChecks.push({
        check: 'Blacklist Function',
        passed: false,
        status: '❌ Blacklist may be public',
        details: 'Blacklist function exists but access control unclear',
      })
    }
  } else {
    analysis.securityChecks.push({
      check: 'Blacklist Function',
      passed: true,
      status: '✅ No blacklist function',
      details: 'No blacklist mechanism - addresses cannot be censored',
    })
  }
  
  // ==========================================
  // 7. TAX/FEE MECHANISM
  // ==========================================
  const taxPattern = /tax|fee|_tax|_fee|transfertax|buytax|selltax/i
  const hasTaxFunction = taxPattern.test(sourceCode)
  if (hasTaxFunction) {
    const taxOwnerOnly = /function\s+(settax|setfee|changetax|changefee)[^{]*onlyowner/i
    if (taxOwnerOnly.test(sourceCode)) {
      analysis.risks.push({
        type: 'Dynamic Tax/Fee',
        severity: 'Medium',
        description: 'Owner can change tax/fee rates',
        details: 'Owner can modify transaction taxes or fees at any time. This can make trading unprofitable or change token economics.',
      })
      analysis.securityChecks.push({
        check: 'Dynamic Tax/Fee',
        passed: false,
        status: '❌ Owner can change tax/fee',
        details: 'Owner can modify transaction taxes/fees at any time',
      })
    } else {
      analysis.securityChecks.push({
        check: 'Tax/Fee Control',
        passed: true,
        status: '✅ Fixed tax/fee',
        details: 'Tax/fee rates are fixed - owner cannot change them',
      })
    }
  } else {
    analysis.securityChecks.push({
      check: 'Tax/Fee Mechanism',
      passed: true,
      status: '✅ No tax/fee',
      details: 'No transaction taxes or fees',
    })
  }
  
  // ==========================================
  // 8. MAX WALLET/HOLD LIMITS
  // ==========================================
  const maxWalletPattern = /maxwallet|maxhold|maximumhold|_maxwallet/i
  const hasMaxWalletFunction = maxWalletPattern.test(sourceCode)
  if (hasMaxWalletFunction) {
    const maxWalletOwnerOnly = /function\s+(setmaxwallet|setmaxhold)[^{]*onlyowner/i
    if (maxWalletOwnerOnly.test(sourceCode)) {
      analysis.risks.push({
        type: 'Max Wallet Limit',
        severity: 'Medium',
        description: 'Owner can set maximum wallet/hold limits',
        details: 'Owner can limit how many tokens a single wallet can hold. This can prevent large purchases or force token distribution.',
      })
      analysis.securityChecks.push({
        check: 'Max Wallet Limit',
        passed: false,
        status: '❌ Owner can set max wallet',
        details: 'Owner can limit token holdings per wallet',
      })
    }
  } else {
    analysis.securityChecks.push({
      check: 'Max Wallet Limit',
      passed: true,
      status: '✅ No max wallet limit',
      details: 'No maximum wallet/hold restrictions',
    })
  }
  
  // ==========================================
  // 9. TRANSFER RESTRICTIONS
  // ==========================================
  const transferRestrictionPattern = /transfer\s*\([^)]*\)\s*\{[^}]*require\s*\([^}]*\)/i
  if (transferRestrictionPattern.test(sourceCode) && !/standard\s*erc20|erc20\s*standard/i.test(sourceCode)) {
    analysis.warnings.push({
      type: 'Non-Standard Transfer',
      description: 'Non-standard transfer restrictions detected - may affect DEX compatibility',
    })
  }
  
  // ==========================================
  // 10. REENTRANCY PROTECTION
  // ==========================================
  const reentrancyPattern = /reentrancyguard|nonreentrant|reentrancy/i
  const hasReentrancyProtection = reentrancyPattern.test(sourceCode)
  if (hasReentrancyProtection) {
    analysis.safeFeatures.push({
      type: 'Reentrancy Protection',
      description: '✅ Reentrancy guard implemented (safe)',
    })
    analysis.securityChecks.push({
      check: 'Reentrancy Protection',
      passed: true,
      status: '✅ Reentrancy guard implemented',
      details: 'Contract is protected against reentrancy attacks',
    })
  } else {
    analysis.warnings.push({
      type: 'Reentrancy Risk',
      description: 'No reentrancy protection detected - contract may be vulnerable to reentrancy attacks',
    })
    analysis.securityChecks.push({
      check: 'Reentrancy Protection',
      passed: false,
      status: '❌ No reentrancy protection',
      details: 'Contract may be vulnerable to reentrancy attacks',
    })
  }
  
  // ==========================================
  // 11. MULTI-SIG CHECK
  // ==========================================
  const multisigPattern = /multisig|gnosis|safe|require.*approval/i
  const hasMultisig = multisigPattern.test(sourceCode)
  if (hasMultisig) {
    analysis.safeFeatures.push({
      type: 'Multi-Sig Support',
      description: '✅ Multi-signature wallet support detected (more secure)',
    })
    analysis.securityChecks.push({
      check: 'Multi-Sig Support',
      passed: true,
      status: '✅ Multi-sig support',
      details: 'Multi-signature wallet support detected - more secure',
    })
  } else {
    analysis.securityChecks.push({
      check: 'Multi-Sig Support',
      passed: false,
      status: '⚠️ No multi-sig detected',
      details: 'No multi-signature wallet support detected',
    })
  }
  
  // ==========================================
  // 12. CONTRACT VERIFICATION CHECK
  // ==========================================
  analysis.securityChecks.push({
    check: 'Contract Verification',
    passed: analysis.isVerified,
    status: analysis.isVerified ? '✅ Verified' : '❌ Not verified',
    details: analysis.isVerified 
      ? 'Contract source code is verified on blockchain explorer'
      : 'Contract source code is not verified - cannot perform full security analysis',
  })
}

// Calculate security score (0-100)
function calculateSecurityScore(analysis) {
  let score = 100
  
  // Deduct points for risks (more severe = more points deducted)
  analysis.risks.forEach(risk => {
    if (risk.severity === 'Critical') {
      score -= 30 // Critical risks are very dangerous
    } else if (risk.severity === 'High') {
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
    score = Math.min(score, 55)
  }

  if (analysis.dataQuality === 'Limited') {
    score = Math.min(score, 45)
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
