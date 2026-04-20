import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  fallback,
  formatEther,
  http,
  maxUint256,
  parseAbiParameters,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { prepareSpendCallData } from '@base-org/account/spend-permission/node'
import {
  AGENT_BASE_CHAIN_ID,
  AGENT_RPC_URL,
  AGENT_TARGET_IDS,
  DICE_ROLL_ABI,
  ERC20_BALANCE_ABI,
  FLIP_PLAY_ABI,
  GM_SEND_ABI,
  GN_SEND_ABI,
  LUCKY_NUMBER_ABI,
  NFT_LAUNCH_MINT_ABI,
  PUMPHUB_FACTORY_ABI,
  SWAPHUB_AGGREGATOR_ABI,
  UNISWAP_V2_ROUTER_ABI,
} from '../src/features/agent-mode/agentConstants.js'
import { getAgentTargetById } from '../src/features/agent-mode/agentCatalog.js'
import {
  DEFAULT_DEPLOY_METADATA_BASE,
  ERC1155_DEPLOY_BYTECODE,
  ERC20_DEPLOY_BYTECODE,
  ERC721_DEPLOY_BYTECODE,
} from '../src/features/agent-mode/agentDeployArtifacts.js'
import { BASEHUB_DEPLOYER_ABI, DEPLOYER_FEE_ETH, encodeDeployerCall } from '../src/config/deployer.js'

const BASE = {
  id: AGENT_BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [AGENT_RPC_URL] } },
}

const BASE_ACCOUNT_EXECUTE_ABI = [
  {
    name: 'isOwnerAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
]

const UNISWAP_V2_ROUTER = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function normalizePrivateKey(value) {
  const key = String(value || '').trim()
  if (!key) return ''
  return key.startsWith('0x') ? key : `0x${key}`
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim())
}

function sanitizeDeployName(value, fallback) {
  const next = String(value || fallback || '').trim()
  return next.slice(0, 32) || fallback
}

function sanitizeDeploySymbol(value, fallback) {
  const next = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return next.slice(0, 10) || fallback
}

function getClients() {
  const account = privateKeyToAccount(normalizePrivateKey(process.env.CLOUD_AGENT_WORKER_PRIVATE_KEY))
  const transport = fallback([http(AGENT_RPC_URL, { timeout: 12000, retryCount: 1, retryDelay: 800 })], {
    rank: false,
    retryCount: 1,
    retryDelay: 800,
  })
  return {
    publicClient: createPublicClient({ chain: BASE, transport }),
    walletClient: createWalletClient({
      account,
      chain: base,
      transport,
    }),
    workerAccount: account,
  }
}

function getReadableError(error) {
  const parts = [
    error?.shortMessage,
    error?.message,
    error?.cause?.shortMessage,
    error?.cause?.message,
    error?.details,
    error?.metaMessages?.join(' '),
  ]
  return parts.find((part) => String(part || '').trim()) || 'Cloud Agent execution failed.'
}

async function assertCloudExecutorReady({ publicClient, ownerAddress, workerAddress, permission }) {
  const workerBalanceWei = await publicClient.getBalance({ address: workerAddress })
  if (workerBalanceWei <= 0n) {
    throw new Error(`Cloud worker has no ETH for gas. Fund worker ${workerAddress} with a small amount of ETH.`)
  }

  const spender = getPermissionSpender(permission)
  if (!isAddress(spender)) {
    throw new Error('Cloud Agent spend permission is missing. Re-run Set up cloud and approve the daily spend permission.')
  }
  if (spender.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error('Cloud Agent spend permission points to a different wallet. Re-run Set up cloud to grant permission to the delegated agent wallet.')
  }
}

function getSubAccountDeploymentData(subAccount = {}) {
  const factory = String(subAccount?.factory || '').trim()
  const factoryData = String(subAccount?.factoryData || '').trim()
  if (!isAddress(factory) || !factoryData.startsWith('0x')) return null
  return { factory, factoryData }
}

async function ensureDelegatedWalletDeployed({ publicClient, walletClient, ownerAddress, subAccount }) {
  const currentCode = await publicClient.getCode({ address: ownerAddress })
  if (currentCode && currentCode !== '0x') return null

  const deployment = getSubAccountDeploymentData(subAccount)
  if (!deployment) {
    throw new Error('Delegated agent wallet is not deployed yet and its deployment metadata is missing. Run Set up cloud again to refresh the delegated wallet permission.')
  }

  let hash
  try {
    hash = await walletClient.sendTransaction({
      to: deployment.factory,
      data: deployment.factoryData,
      value: 0n,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const deployedCode = await publicClient.getCode({ address: ownerAddress })
    if (!deployedCode || deployedCode === '0x') {
      throw new Error('Delegated agent wallet deployment transaction finished, but the wallet code is still missing.')
    }
    return { hash, receipt, value: 0n, deployment: true }
  } catch (deployError) {
    const deployedCode = await publicClient.getCode({ address: ownerAddress }).catch(() => null)
    if (deployedCode && deployedCode !== '0x') return null
    throw deployError
  }
}

async function assertWorkerOwnsDelegatedWallet({ publicClient, ownerAddress, workerAddress }) {
  const isWorkerOwner = await publicClient.readContract({
    address: ownerAddress,
    abi: BASE_ACCOUNT_EXECUTE_ABI,
    functionName: 'isOwnerAddress',
    args: [workerAddress],
  })
  if (!isWorkerOwner) {
    throw new Error('Cloud worker is not an owner of this delegated agent wallet. Re-run Set up cloud after confirming VITE_CLOUD_AGENT_SPENDER_ADDRESS matches the worker key address.')
  }
}

async function buildCloudCalls({ action, settings = {}, logs = [], ownerAddress, publicClient }) {
  const target = getAgentTargetById(action.targetId)
  if (!target) throw new Error('Unknown BaseHub target.')

  if (action.targetId === AGENT_TARGET_IDS.GM) {
    return [{
      to: target.contractAddress,
      value: target.estimatedSpendWei,
      data: encodeFunctionData({
        abi: GM_SEND_ABI,
        functionName: 'sendGM',
        args: [String(action.payload?.message || target.messagePlaceholder).slice(0, 100)],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.GN) {
    return [{
      to: target.contractAddress,
      value: target.estimatedSpendWei,
      data: encodeFunctionData({
        abi: GN_SEND_ABI,
        functionName: 'sendGN',
        args: [String(action.payload?.message || target.messagePlaceholder).slice(0, 100)],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.FLIP) {
    return [{
      to: target.contractAddress,
      value: target.estimatedSpendWei,
      data: encodeFunctionData({
        abi: FLIP_PLAY_ABI,
        functionName: 'playFlip',
        args: [action.payload?.flipSide === 'tails' ? 1 : 0],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.LUCKY) {
    const luckyGuess = Number(action.payload?.luckyGuess)
    return [{
      to: target.contractAddress,
      value: target.estimatedSpendWei,
      data: encodeFunctionData({
        abi: LUCKY_NUMBER_ABI,
        functionName: 'guessLuckyNumber',
        args: [Number.isInteger(luckyGuess) ? Math.min(10, Math.max(1, luckyGuess)) : 7],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.DICE) {
    const diceGuess = Number(action.payload?.diceGuess)
    return [{
      to: target.contractAddress,
      value: target.estimatedSpendWei,
      data: encodeFunctionData({
        abi: DICE_ROLL_ABI,
        functionName: 'rollDice',
        args: [Number.isInteger(diceGuess) ? Math.min(6, Math.max(1, diceGuess)) : 4],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.PUMPHUB_BUY) {
    const tokenAddress = String(action.payload?.pumpHubTokenAddress || '').trim()
    if (!isAddress(tokenAddress)) throw new Error('No PumpHub trade target is available right now.')
    const tradeValue = parseEther(String(action.payload?.pumpHubTradeAmountEth || settings?.pumpHubTradeAmountEth || '0.0001'))
    return [{
      to: target.contractAddress,
      value: tradeValue,
      data: encodeFunctionData({
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'buy',
        args: [tokenAddress, 1n],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.PUMPHUB_SELL) {
    const tokenAddress = String(action.payload?.pumpHubTokenAddress || '').trim()
    if (!isAddress(tokenAddress)) throw new Error('No PumpHub sell target is available right now.')
    const tokenBalance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [ownerAddress],
    })
    if (!tokenBalance || tokenBalance <= 0n) throw new Error('No PumpHub token balance to sell.')
    const sellBps = Math.min(9000, Math.max(500, Number(action.payload?.pumpHubSellBps || 2000)))
    const sellAmount = (tokenBalance * BigInt(sellBps)) / 10000n
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'allowance',
      args: [ownerAddress, target.contractAddress],
    })
    const calls = []
    if ((allowance || 0n) < sellAmount) {
      calls.push({
        to: tokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_BALANCE_ABI,
          functionName: 'approve',
          args: [target.contractAddress, maxUint256],
        }),
      })
    }
    calls.push({
      to: target.contractAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'sell',
        args: [tokenAddress, sellAmount, 1n],
      }),
    })
    return calls
  }

  if (action.targetId === AGENT_TARGET_IDS.FREE_NFT_MINT) {
    const contractAddress = String(action.payload?.contractAddress || '').trim()
    if (!isAddress(contractAddress)) throw new Error('No free NFT mint target is available right now.')
    return [{
      to: contractAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: NFT_LAUNCH_MINT_ABI,
        functionName: 'mint',
        args: [1n],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.SWAPHUB_SWAP) {
    const tokenOutAddress = String(action.payload?.tokenOutAddress || '').trim()
    if (!isAddress(tokenOutAddress)) throw new Error('No SwapHub token target is available right now.')
    const amountInWei = parseEther(String(action.payload?.swapAmountEth || settings?.swapHubTradeAmountEth || '0.00008'))
    const amounts = await publicClient.readContract({
      address: UNISWAP_V2_ROUTER,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [amountInWei, [WETH_ADDRESS, tokenOutAddress]],
    })
    if (!amounts || !Array.isArray(amounts) || BigInt(amounts[1] || 0) <= 0n) {
      throw new Error('No SwapHub route is available for the chosen token right now.')
    }
    const amountOutMinimum = (BigInt(amounts[1]) * 95n) / 100n
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10)
    return [{
      to: target.contractAddress,
      value: amountInWei,
      data: encodeFunctionData({
        abi: SWAPHUB_AGGREGATOR_ABI,
        functionName: 'swapV2',
        args: [ZERO_ADDRESS, tokenOutAddress, amountInWei, amountOutMinimum, deadline],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.DEPLOY_TOKEN) {
    const name = sanitizeDeployName(action.payload?.name, 'BaseHub Agent Token')
    const symbol = sanitizeDeploySymbol(action.payload?.symbol, 'BHAT')
    const initialSupply = BigInt(String(action.payload?.initialSupply || '1000000'))
    const constructorData = encodeAbiParameters(
      parseAbiParameters('string name, string symbol, uint256 initialSupply'),
      [name, symbol, initialSupply]
    )
    return [{
      to: target.contractAddress,
      value: parseEther(DEPLOYER_FEE_ETH),
      data: encodeFunctionData({
        abi: BASEHUB_DEPLOYER_ABI,
        functionName: 'deployERC20',
        args: [ERC20_DEPLOY_BYTECODE + constructorData.slice(2)],
      }),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.DEPLOY_ERC721) {
    const name = sanitizeDeployName(action.payload?.name, 'BaseHub Agent Collection')
    const symbol = sanitizeDeploySymbol(action.payload?.symbol, 'BHNFT')
    const baseTokenUri = String(action.payload?.uri || `${DEFAULT_DEPLOY_METADATA_BASE}/${name.toLowerCase().replace(/\s+/g, '-')}`).trim()
    const constructorData = encodeAbiParameters(
      parseAbiParameters('string name, string symbol, string baseTokenURI'),
      [name, symbol, baseTokenUri]
    )
    return [{
      to: target.contractAddress,
      value: parseEther(DEPLOYER_FEE_ETH),
      data: encodeDeployerCall('deployERC721', ERC721_DEPLOY_BYTECODE + constructorData.slice(2)),
    }]
  }

  if (action.targetId === AGENT_TARGET_IDS.DEPLOY_ERC1155) {
    const collectionName = sanitizeDeployName(action.payload?.name, 'BaseHub Agent Multi')
    const uri = String(action.payload?.uri || `${DEFAULT_DEPLOY_METADATA_BASE}/${collectionName.toLowerCase().replace(/\s+/g, '-')}/{id}.json`).trim()
    const constructorData = encodeAbiParameters(parseAbiParameters('string uri'), [uri])
    return [{
      to: target.contractAddress,
      value: parseEther(DEPLOYER_FEE_ETH),
      data: encodeDeployerCall('deployERC1155', ERC1155_DEPLOY_BYTECODE + constructorData.slice(2)),
    }]
  }

  throw new Error('Unsupported Cloud Agent action.')
}

function getPermissionSpender(permission) {
  return String(permission?.permission?.spender || permission?.spender || '').trim()
}

async function buildFundingCalls({ permission, ownerAddress, requiredWei, currentBalanceWei }) {
  if (!permission || requiredWei <= currentBalanceWei) return []
  const spender = getPermissionSpender(permission)
  if (!isAddress(spender) || spender.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error('Cloud Agent spend permission does not match the delegated agent wallet.')
  }
  const missingWei = requiredWei - currentBalanceWei
  return prepareSpendCallData(permission, missingWei, undefined, { rpcUrl: AGENT_RPC_URL })
}

export async function executeCloudAction({
  ownerAddress,
  subAccount = {},
  spendPermission = null,
  action = {},
  settings = {},
  logs = [],
}) {
  const workerKey = normalizePrivateKey(process.env.CLOUD_AGENT_WORKER_PRIVATE_KEY)
  if (!workerKey) throw new Error('Cloud Agent worker private key is not configured.')

  const normalizedOwner = String(ownerAddress || '').trim()
  if (!isAddress(normalizedOwner)) throw new Error('Connected Base Account address is required.')

  const { publicClient, walletClient, workerAccount } = getClients()
  await assertCloudExecutorReady({
    publicClient,
    ownerAddress: normalizedOwner,
    workerAddress: workerAccount.address,
    permission: spendPermission,
  })

  const deploymentReceipt = await ensureDelegatedWalletDeployed({
    publicClient,
    walletClient,
    ownerAddress: normalizedOwner,
    subAccount: subAccount || settings?.subAccount || {},
  })
  await assertWorkerOwnsDelegatedWallet({
    publicClient,
    ownerAddress: normalizedOwner,
    workerAddress: workerAccount.address,
  })

  const actionCalls = await buildCloudCalls({
    action,
    settings,
    logs,
    ownerAddress: normalizedOwner,
    publicClient,
  })
  const requiredValueWei = actionCalls.reduce((total, call) => total + BigInt(call.value || 0), 0n)
  const currentBalanceWei = await publicClient.getBalance({ address: normalizedOwner })
  const fundingCalls = await buildFundingCalls({
    permission: spendPermission,
    ownerAddress: normalizedOwner,
    requiredWei: requiredValueWei,
    currentBalanceWei,
  })
  const calls = [...fundingCalls, ...actionCalls]

  const receipts = deploymentReceipt ? [deploymentReceipt] : []
  for (const call of calls) {
    const hash = await walletClient.writeContract({
      address: normalizedOwner,
      abi: BASE_ACCOUNT_EXECUTE_ABI,
      functionName: 'execute',
      args: [call.to, BigInt(call.value || 0), call.data],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    receipts.push({ hash, receipt, value: BigInt(call.value || 0) })
  }

  const spentWei = receipts.reduce((total, item) => {
    const gas = (item.receipt.gasUsed || 0n) * (item.receipt.effectiveGasPrice || 0n)
    return total + gas + item.value
  }, 0n)

  const last = receipts[receipts.length - 1]
  return {
    ok: true,
    hash: last?.hash || null,
    spentWei: spentWei.toString(),
    spentEth: formatEther(spentWei),
    receipts: receipts.map((item) => ({ hash: item.hash })),
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed.' }))
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const result = await executeCloudAction({
      ownerAddress: body.ownerAddress,
      subAccount: body.subAccount || body.settings?.subAccount || {},
      spendPermission: body.spendPermission || null,
      action: body.action || {},
      settings: body.settings || {},
      logs: body.logs || [],
    })
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (error) {
    const message = getReadableError(error)
    console.error('[Cloud Agent Execute]', message)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      error: message,
      code: 'cloud_execution_failed',
    }))
  }
}
