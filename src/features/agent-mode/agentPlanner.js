import { formatEther, parseEther } from 'viem'
import { getEnabledTargets } from './agentCatalog.js'
import { discoverBaseHubOpportunities } from './agentDiscovery.js'

const MAX_PLAN_BLOCK_ACTIONS = 24
const PUMPHUB_MICRO_BUY_AMOUNTS_ETH = ['0.000006', '0.000009', '0.000012', '0.000015']

function createActionId(targetId, index) {
  return `${targetId}_${Date.now()}_${index}`
}

function pickRotatingItem(items = [], index = 0) {
  if (!items.length) return null
  return items[index % items.length] || items[0]
}

function pickPumpHubBuyAmount(index = 0) {
  return PUMPHUB_MICRO_BUY_AMOUNTS_ETH[index % PUMPHUB_MICRO_BUY_AMOUNTS_ETH.length]
}

function makeDeployPayload(target, index = 0) {
  const suffix = `${Date.now().toString(36).slice(-4)}${index}`
  if (target.id === 'deploy-token') {
    return {
      name: `BaseHub Agent Token ${suffix}`,
      symbol: `BHA${index}`,
      initialSupply: '1000000',
    }
  }
  if (target.id === 'deploy-erc721') {
    return {
      name: `BaseHub Agent Collection ${suffix}`,
      symbol: `BAN${index}`,
    }
  }
  if (target.id === 'deploy-erc1155') {
    return {
      name: `BaseHub Agent Multi ${suffix}`,
      symbol: `BAM${index}`,
      uri: `https://basehub.fun/agent/metadata/${suffix}/{id}.json`,
    }
  }
  return {}
}

export async function createAgentPlan({ settings, report, logs = [], walletAddress = '' }) {
  const enabledTargets = getEnabledTargets(settings)
  const remainingTxBudget = Math.max(0, Number(settings.dailyTxTarget || 0) - Number(report.executed || 0))
  const planningWindow = Math.max(0, Math.min(remainingTxBudget, MAX_PLAN_BLOCK_ACTIONS))

  if (planningWindow <= 0) {
    return {
      title: 'Daily Burner Plan',
      rationale: 'Daily transaction target already reached.',
      thoughtSummary: 'I am holding off for now because today target is already covered.',
      source: 'fallback',
      actions: [],
    }
  }

  if (enabledTargets.length === 0) {
    return {
      title: 'Daily Burner Plan',
      rationale: 'No BaseHub actions are enabled yet.',
      thoughtSummary: 'I cannot build a route yet because there are no enabled BaseHub actions.',
      source: 'fallback',
      actions: [],
    }
  }

  const freeMintTarget = enabledTargets.find((target) => target.id === 'free-nft-mint')
  const pumpHubBuyTarget = enabledTargets.find((target) => target.id === 'pumphub-buy')
  const pumpHubSellTarget = enabledTargets.find((target) => target.id === 'pumphub-sell')
  const swapHubTarget = enabledTargets.find((target) => target.id === 'swaphub-swap')
  const deployTokenTarget = enabledTargets.find((target) => target.id === 'deploy-token')
  const deployErc721Target = enabledTargets.find((target) => target.id === 'deploy-erc721')
  const deployErc1155Target = enabledTargets.find((target) => target.id === 'deploy-erc1155')
  const discoveredOpportunities = await discoverBaseHubOpportunities({
    settings: { ...settings, walletAddress: walletAddress || settings.walletAddress || '' },
    logs,
  })
  const freeMintOpportunity = discoveredOpportunities.find((item) => item.targetId === 'free-nft-mint' && item.available)
  const pumpHubBuyOpportunity = discoveredOpportunities.find((item) => item.targetId === 'pumphub-buy' && item.available)
  const pumpHubSellOpportunity = discoveredOpportunities.find((item) => item.targetId === 'pumphub-sell' && item.available)
  const swapHubOpportunity = discoveredOpportunities.find((item) => item.targetId === 'swaphub-swap' && item.available)
  const tradeCandidates = Array.isArray(pumpHubBuyOpportunity?.payload?.candidates) ? pumpHubBuyOpportunity.payload.candidates.filter((item) => item.pumpHubTokenAddress) : []
  const sellCandidates = Array.isArray(pumpHubSellOpportunity?.payload?.candidates) ? pumpHubSellOpportunity.payload.candidates.filter((item) => item.pumpHubTokenAddress) : []
  const swapCandidates = Array.isArray(swapHubOpportunity?.payload?.candidates) ? swapHubOpportunity.payload.candidates.filter((item) => item.tokenOutAddress) : []
  const freeMintCandidates = Array.isArray(freeMintOpportunity?.payload?.candidates) ? freeMintOpportunity.payload.candidates.filter((item) => item.contractAddress) : []
  const availableTargets = enabledTargets.filter((target) => {
    if (target.id === 'free-nft-mint') return Boolean(freeMintOpportunity?.available && freeMintCandidates.length)
    if (target.id === 'pumphub-buy') return Boolean(pumpHubBuyOpportunity?.available && tradeCandidates.length)
    if (target.id === 'pumphub-sell') return Boolean(pumpHubSellOpportunity?.available && sellCandidates.length)
    if (target.id === 'swaphub-swap') return Boolean(swapHubOpportunity?.available && swapCandidates.length)
    return true
  })

  // Weighted random selection to create a more human-like action mix.
  // Avoids repeating the same action twice in a row.
  function pickRandomTarget(lastId) {
    const pool = availableTargets.length ? availableTargets : enabledTargets
    if (pool.length === 1) return pool[0]
    const candidates = pool.filter((t) => t.id !== lastId)
    return candidates[Math.floor(Math.random() * candidates.length)] || pool[0]
  }

  async function buildPayload(target, index) {
    if (target.id === 'gm-game') {
      return { message: String(settings.gmMessage || target.messagePlaceholder).slice(0, 100) }
    }
    if (target.id === 'gn-game') {
      return { message: String(settings.gnMessage || target.messagePlaceholder).slice(0, 100) }
    }
    if (target.id === 'flip-game') {
      return { flipSide: Math.random() < 0.5 ? 'heads' : 'tails' }
    }
    if (target.id === 'lucky-number') {
      return { luckyGuess: Math.floor(Math.random() * 10) + 1 }
    }
    if (target.id === 'pumphub-buy') {
      const tradeCandidate = pickRotatingItem(tradeCandidates, index)
      const amountEth = pickPumpHubBuyAmount(index)
      return {
        pumpHubTokenAddress: String(
          tradeCandidate?.pumpHubTokenAddress || pumpHubBuyOpportunity?.payload?.pumpHubTokenAddress || ''
        ).trim(),
        pumpHubTradeAmountEth: amountEth,
        pumpHubTradeAmountUsdLabel: `$${(0.02 + (index % 4) * 0.01).toFixed(2)}`,
      }
    }
    if (target.id === 'pumphub-sell') {
      const tradeCandidate = pickRotatingItem(sellCandidates, index)
      return {
        pumpHubTokenAddress: String(
          tradeCandidate?.pumpHubTokenAddress || pumpHubSellOpportunity?.payload?.pumpHubTokenAddress || ''
        ).trim(),
        pumpHubSellBps: 2000,
      }
    }
    if (target.id === 'free-nft-mint') {
      const mintCandidate = pickRotatingItem(freeMintCandidates, index)
      return {
        contractAddress: String(mintCandidate?.contractAddress || freeMintOpportunity?.payload?.contractAddress || '').trim(),
        slug: String(mintCandidate?.slug || freeMintOpportunity?.payload?.slug || ''),
        collectionName: String(mintCandidate?.collectionName || freeMintOpportunity?.payload?.collectionName || ''),
      }
    }
    if (target.id === 'swaphub-swap') {
      const swapCandidate = pickRotatingItem(swapCandidates, index)
      return {
        tokenOutAddress: String(swapCandidate?.tokenOutAddress || swapHubOpportunity?.payload?.tokenOutAddress || '').trim(),
        tokenOutSymbol: String(swapCandidate?.tokenOutSymbol || swapHubOpportunity?.payload?.tokenOutSymbol || ''),
        swapAmountEth: String(settings.swapHubTradeAmountEth || '0.00008'),
      }
    }
    if (target.id === 'deploy-token' || target.id === 'deploy-erc721' || target.id === 'deploy-erc1155') {
      return makeDeployPayload(target, index)
    }
    return { diceGuess: Math.floor(Math.random() * 6) + 1 }
  }

  const actions = []
  let lastTargetId = null
  const priorityTargets = []

  if (freeMintTarget && freeMintOpportunity && freeMintCandidates.length) {
    priorityTargets.push(freeMintTarget)
  }
  if (pumpHubBuyTarget && pumpHubBuyOpportunity && tradeCandidates.length) {
    priorityTargets.push(pumpHubBuyTarget)
  }
  if (pumpHubSellTarget && pumpHubSellOpportunity && sellCandidates.length && planningWindow >= 6) {
    priorityTargets.push(pumpHubSellTarget)
  }
  if (swapHubTarget && swapHubOpportunity && swapCandidates.length && planningWindow >= 5) {
    priorityTargets.push(swapHubTarget)
  }
  if (deployTokenTarget && planningWindow >= 8) priorityTargets.push(deployTokenTarget)
  if (deployErc721Target && planningWindow >= 12) priorityTargets.push(deployErc721Target)
  if (deployErc1155Target && planningWindow >= 16) priorityTargets.push(deployErc1155Target)

  const desiredMintActions = freeMintTarget && freeMintOpportunity ? Math.min(freeMintCandidates.length || 1, Math.max(2, Math.min(10, Math.floor(planningWindow / 3)))) : 0
  const desiredPumpBuyActions = pumpHubBuyTarget && pumpHubBuyOpportunity ? Math.min(tradeCandidates.length || 1, Math.max(2, Math.min(8, Math.floor(planningWindow / 4)))) : 0
  const desiredPumpSellActions =
    pumpHubSellTarget && pumpHubSellOpportunity && sellCandidates.length
      ? Math.min(sellCandidates.length || 1, Math.max(1, Math.min(6, Math.floor(planningWindow / 5))))
      : 0
  const desiredSwapActions = swapHubTarget && swapHubOpportunity ? Math.min(swapCandidates.length || 1, Math.max(2, Math.min(8, Math.floor(planningWindow / 4)))) : 0

  for (let count = 1; count < desiredMintActions; count += 1) priorityTargets.push(freeMintTarget)
  for (let count = 1; count < desiredPumpBuyActions; count += 1) priorityTargets.push(pumpHubBuyTarget)
  for (let count = 1; count < desiredPumpSellActions; count += 1) priorityTargets.push(pumpHubSellTarget)
  for (let count = 1; count < desiredSwapActions; count += 1) priorityTargets.push(swapHubTarget)

  for (let index = 0; index < planningWindow; index += 1) {
    const priorityTarget = priorityTargets.shift()
    const target = priorityTarget || pickRandomTarget(lastTargetId)
    lastTargetId = target.id
    const payload = await buildPayload(target, index)
    const estimatedSpendWei =
      target.id === 'pumphub-buy'
        ? parseEther(String(payload.pumpHubTradeAmountEth || pickPumpHubBuyAmount(index))).toString()
        : target.id === 'swaphub-swap'
          ? parseEther(String(payload.swapAmountEth || settings.swapHubTradeAmountEth || '0.00008')).toString()
        : target.estimatedSpendWei.toString()
    actions.push({
      id: createActionId(target.id, index),
      targetId: target.id,
      targetType: target.type,
      title: target.title,
      summary: target.summary,
      estimatedSpendWei,
      estimatedSpendEth: formatEther(BigInt(estimatedSpendWei)),
      payload,
    })
  }

  return {
    title: 'Daily Burner Plan',
    rationale: 'Fallback planner created the next block of BaseHub actions inside today’s limits.',
    thoughtSummary:
      planningWindow >= 8
        ? 'I broke the day into a shorter working block instead of dumping the full routine at once. This keeps the plan readable and gives me room to adapt later.'
        : 'I mapped out a short, readable block for the next stretch so the routine feels deliberate instead of repetitive.',
    source: 'fallback',
    actions,
  }
}
