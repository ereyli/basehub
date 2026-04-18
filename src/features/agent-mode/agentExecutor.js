import { createPublicClient, encodeAbiParameters, fallback, formatEther, http, maxUint256, parseAbiParameters, parseEther } from 'viem'
import { base } from 'viem/chains'
import {
  AGENT_TARGET_IDS,
  AGENT_BASE_CHAIN_ID,
  AGENT_RPC_URL,
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
} from './agentConstants'
import { BASEHUB_DEPLOYER_ABI, DEPLOYER_FEE_ETH, encodeDeployerCall } from '../../config/deployer.js'
import { getAgentTargetById } from './agentCatalog'
import {
  DEFAULT_DEPLOY_METADATA_BASE,
  ERC1155_DEPLOY_BYTECODE,
  ERC20_DEPLOY_BYTECODE,
  ERC721_DEPLOY_BYTECODE,
} from './agentDeployArtifacts.js'
import { getBurnerClients } from './agentWallet'
import { resolveFreeMintOpportunity, resolvePumpHubOpportunity, resolveSwapHubOpportunity } from './agentOpportunities'

const BASE = {
  id: AGENT_BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [AGENT_RPC_URL] } },
}
const SWAPHUB_AGGREGATOR = '0xbf579e68ba69de03ccec14476eb8d765ec558257'
const UNISWAP_V2_ROUTER = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function getSwapQuoteClient() {
  return createPublicClient({
    chain: BASE,
    transport: fallback([http(AGENT_RPC_URL, { timeout: 12000, retryCount: 1, retryDelay: 800 })], {
      rank: false,
      retryCount: 1,
      retryDelay: 800,
    }),
  })
}

function sanitizeDeployName(value, fallback) {
  const next = String(value || fallback || '').trim()
  return next.slice(0, 32) || fallback
}

function sanitizeDeploySymbol(value, fallback) {
  const next = String(value || fallback || '')
    .trim()
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return next.slice(0, 10) || fallback
}

function extractDeployedAddress(receipt, deployerAddress) {
  if (!receipt?.logs?.length || !deployerAddress) return null
  const deployerLog = receipt.logs.find(
    (log) => log.address?.toLowerCase() === deployerAddress.toLowerCase() && log.topics?.length >= 2
  )
  return deployerLog?.topics?.[1] ? `0x${deployerLog.topics[1].slice(-40).toLowerCase()}` : null
}

function buildDeployReceiptResult({ receipt, target, deployedAddress }) {
  const gasCostWei = (receipt.gasUsed || 0n) * (receipt.effectiveGasPrice || 0n)
  const actionCostWei = target.estimatedSpendWei || parseEther(DEPLOYER_FEE_ETH)
  const totalSpentWei = actionCostWei + gasCostWei
  return {
    spentWei: totalSpentWei.toString(),
    spentEth: formatEther(totalSpentWei),
    deployedAddress,
  }
}

export async function executeAgentAction({ action, privateKey, settings = {}, logs = [] }) {
  const target = getAgentTargetById(action.targetId)
  if (!target) {
    throw new Error('Unknown BaseHub target.')
  }

  const { account, publicClient, walletClient } = getBurnerClients(privateKey)
  let hash

  if (action.targetId === AGENT_TARGET_IDS.GM) {
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: GM_SEND_ABI,
      functionName: 'sendGM',
      args: [String(action.payload?.message || target.messagePlaceholder).slice(0, 100)],
      value: target.estimatedSpendWei,
    })
  } else if (action.targetId === AGENT_TARGET_IDS.GN) {
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: GN_SEND_ABI,
      functionName: 'sendGN',
      args: [String(action.payload?.message || target.messagePlaceholder).slice(0, 100)],
      value: target.estimatedSpendWei,
    })
  } else if (action.targetId === AGENT_TARGET_IDS.FLIP) {
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: FLIP_PLAY_ABI,
      functionName: 'playFlip',
      args: [action.payload?.flipSide === 'tails' ? 1 : 0],
      value: target.estimatedSpendWei,
    })
  } else if (action.targetId === AGENT_TARGET_IDS.LUCKY) {
    const luckyGuess = Number(action.payload?.luckyGuess)
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: LUCKY_NUMBER_ABI,
      functionName: 'guessLuckyNumber',
      args: [Number.isInteger(luckyGuess) ? Math.min(10, Math.max(1, luckyGuess)) : 7],
      value: target.estimatedSpendWei,
    })
  } else if (action.targetId === AGENT_TARGET_IDS.DICE) {
    const diceGuess = Number(action.payload?.diceGuess)
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: DICE_ROLL_ABI,
      functionName: 'rollDice',
      args: [Number.isInteger(diceGuess) ? Math.min(6, Math.max(1, diceGuess)) : 4],
      value: target.estimatedSpendWei,
    })
  } else if (action.targetId === AGENT_TARGET_IDS.PUMPHUB_BUY) {
    const resolvedPumpHub =
      String(action.payload?.pumpHubTokenAddress || '').trim()
        ? null
        : await resolvePumpHubOpportunity({ settings, logs }).catch(() => null)
    const tokenAddress = String(
      action.payload?.pumpHubTokenAddress ||
      resolvedPumpHub?.address ||
      ''
    ).trim()
    if (!tokenAddress) {
      throw new Error('No PumpHub trade target is available right now.')
    }
    const tradeAmountEth = String(action.payload?.pumpHubTradeAmountEth || '0.0001')
    const tradeValue = parseEther(tradeAmountEth)
    // min=1n ensures at least 1 token unit is returned (basic frontrun protection).
    // For real slippage protection, an on-chain price quote would be needed.
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: PUMPHUB_FACTORY_ABI,
      functionName: 'buy',
      args: [tokenAddress, 1n],
      value: tradeValue,
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return {
      hash,
      spentWei: tradeValue.toString(),
      spentEth: formatEther(tradeValue),
    }
  } else if (action.targetId === AGENT_TARGET_IDS.PUMPHUB_SELL) {
    const resolvedPumpHub =
      String(action.payload?.pumpHubTokenAddress || '').trim()
        ? null
        : await resolvePumpHubOpportunity({ settings, logs }).catch(() => null)
    const tokenAddress = String(
      action.payload?.pumpHubTokenAddress ||
      resolvedPumpHub?.address ||
      ''
    ).trim()
    if (!tokenAddress) {
      throw new Error('No PumpHub trade target is available right now.')
    }
    const tokenBalance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    })
    if (!tokenBalance || tokenBalance <= 0n) {
      throw new Error('No PumpHub token balance to sell.')
    }
    const sellBps = Math.min(9000, Math.max(500, Number(action.payload?.pumpHubSellBps || 2000)))
    const sellAmount = (tokenBalance * BigInt(sellBps)) / 10000n
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'allowance',
      args: [account.address, target.contractAddress],
    })
    if ((allowance || 0n) < sellAmount) {
      const approveHash = await walletClient.writeContract({
        account,
        chain: base,
        address: tokenAddress,
        abi: ERC20_BALANCE_ABI,
        functionName: 'approve',
        args: [target.contractAddress, maxUint256],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
    }
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: PUMPHUB_FACTORY_ABI,
      functionName: 'sell',
      args: [tokenAddress, sellAmount, 1n],
    })
  } else if (action.targetId === AGENT_TARGET_IDS.FREE_NFT_MINT) {
    const resolvedFreeMint =
      String(action.payload?.contractAddress || '').trim()
        ? null
        : await resolveFreeMintOpportunity({ logs }).catch(() => null)
    const contractAddress = String(
      action.payload?.contractAddress ||
      resolvedFreeMint?.contractAddress ||
      ''
    ).trim()
    if (!contractAddress) {
      throw new Error('No free NFT mint is available right now.')
    }
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: contractAddress,
      abi: NFT_LAUNCH_MINT_ABI,
      functionName: 'mint',
      args: [1n],
      value: 0n,
    })
  } else if (action.targetId === AGENT_TARGET_IDS.SWAPHUB_SWAP) {
    const resolvedSwapHub =
      String(action.payload?.tokenOutAddress || '').trim()
        ? null
        : await resolveSwapHubOpportunity({ logs }).catch(() => null)
    const tokenOutAddress = String(action.payload?.tokenOutAddress || resolvedSwapHub?.address || '').trim()
    if (!tokenOutAddress) {
      throw new Error('No SwapHub token target is available right now.')
    }
    const swapAmountEth = String(action.payload?.swapAmountEth || '0.00008')
    const amountInWei = parseEther(swapAmountEth)
    const quoteClient = getSwapQuoteClient()
    try {
      const amounts = await quoteClient.readContract({
        address: UNISWAP_V2_ROUTER,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, [WETH_ADDRESS, tokenOutAddress]],
      })
      if (!amounts || !Array.isArray(amounts) || BigInt(amounts[1] || 0) <= 0n) {
        throw new Error('No V2 route')
      }
    } catch {
      throw new Error('No SwapHub route is available for the chosen token right now.')
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10)
    hash = await walletClient.writeContract({
      account,
      chain: BASE,
      address: SWAPHUB_AGGREGATOR,
      abi: SWAPHUB_AGGREGATOR_ABI,
      functionName: 'swapV2',
      args: [ZERO_ADDRESS, tokenOutAddress, amountInWei, 1n, deadline],
      value: amountInWei,
    })
    await quoteClient.waitForTransactionReceipt({ hash })
    return {
      hash,
      spentWei: amountInWei.toString(),
      spentEth: formatEther(amountInWei),
    }
  } else if (action.targetId === AGENT_TARGET_IDS.DEPLOY_TOKEN) {
    const name = sanitizeDeployName(action.payload?.name, 'BaseHub Agent Token')
    const symbol = sanitizeDeploySymbol(action.payload?.symbol, 'BHAT')
    const initialSupply = BigInt(String(action.payload?.initialSupply || '1000000'))
    const constructorData = encodeAbiParameters(
      parseAbiParameters('string name, string symbol, uint256 initialSupply'),
      [name, symbol, initialSupply]
    )
    const initCode = ERC20_DEPLOY_BYTECODE + constructorData.slice(2)
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: target.contractAddress,
      abi: BASEHUB_DEPLOYER_ABI,
      functionName: 'deployERC20',
      args: [initCode],
      value: parseEther(DEPLOYER_FEE_ETH),
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const deployedAddress = extractDeployedAddress(receipt, target.contractAddress)
    return {
      hash,
      ...buildDeployReceiptResult({ receipt, target, deployedAddress }),
    }
  } else if (action.targetId === AGENT_TARGET_IDS.DEPLOY_ERC721) {
    const name = sanitizeDeployName(action.payload?.name, 'BaseHub Agent Collection')
    const symbol = sanitizeDeploySymbol(action.payload?.symbol, 'BHNFT')
    const baseTokenUri = String(action.payload?.uri || `${DEFAULT_DEPLOY_METADATA_BASE}/${name.toLowerCase().replace(/\s+/g, '-')}`).trim()
    const constructorData = encodeAbiParameters(
      parseAbiParameters('string name, string symbol, string baseTokenURI'),
      [name, symbol, baseTokenUri]
    )
    const initCode = ERC721_DEPLOY_BYTECODE + constructorData.slice(2)
    const deployData = encodeDeployerCall('deployERC721', initCode)
    hash = await walletClient.sendTransaction({
      account,
      chain: base,
      to: target.contractAddress,
      data: deployData,
      gas: 3_000_000n,
      value: parseEther(DEPLOYER_FEE_ETH),
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const deployedAddress = extractDeployedAddress(receipt, target.contractAddress)
    return {
      hash,
      ...buildDeployReceiptResult({ receipt, target, deployedAddress }),
    }
  } else if (action.targetId === AGENT_TARGET_IDS.DEPLOY_ERC1155) {
    const collectionName = sanitizeDeployName(action.payload?.name, 'BaseHub Agent Multi')
    const uri = String(action.payload?.uri || `${DEFAULT_DEPLOY_METADATA_BASE}/${collectionName.toLowerCase().replace(/\s+/g, '-')}/{id}.json`).trim()
    const constructorData = encodeAbiParameters(parseAbiParameters('string uri'), [uri])
    const initCode = ERC1155_DEPLOY_BYTECODE + constructorData.slice(2)
    const deployData = encodeDeployerCall('deployERC1155', initCode)
    hash = await walletClient.sendTransaction({
      account,
      chain: base,
      to: target.contractAddress,
      data: deployData,
      gas: 3_000_000n,
      value: parseEther(DEPLOYER_FEE_ETH),
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const deployedAddress = extractDeployedAddress(receipt, target.contractAddress)
    return {
      hash,
      ...buildDeployReceiptResult({ receipt, target, deployedAddress }),
    }
  } else {
    throw new Error('This burner MVP only supports whitelisted BaseHub burner actions.')
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const gasCostWei = (receipt.gasUsed || 0n) * (receipt.effectiveGasPrice || 0n)
  const actionCostWei = target.estimatedSpendWei || 0n
  const totalSpentWei = actionCostWei + gasCostWei
  return {
    hash,
    spentWei: totalSpentWei.toString(),
    spentEth: formatEther(totalSpentWei),
  }
}
