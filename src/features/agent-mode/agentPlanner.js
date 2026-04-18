import { formatEther, parseEther } from 'viem'
import { getEnabledTargets } from './agentCatalog.js'
import { discoverBaseHubOpportunities } from './agentDiscovery.js'

const MAX_PLAN_BLOCK_ACTIONS = 24

function createActionId(targetId, index) {
  return `${targetId}_${Date.now()}_${index}`
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
  const discoveredOpportunities = await discoverBaseHubOpportunities({
    settings: { ...settings, walletAddress: walletAddress || settings.walletAddress || '' },
    logs,
  })
  const freeMintOpportunity = discoveredOpportunities.find((item) => item.targetId === 'free-nft-mint' && item.available)
  const pumpHubBuyOpportunity = discoveredOpportunities.find((item) => item.targetId === 'pumphub-buy' && item.available)
  const pumpHubSellOpportunity = discoveredOpportunities.find((item) => item.targetId === 'pumphub-sell' && item.available)
  const swapHubOpportunity = discoveredOpportunities.find((item) => item.targetId === 'swaphub-swap' && item.available)
  const tradeCandidates = Array.isArray(pumpHubBuyOpportunity?.payload?.candidates) ? pumpHubBuyOpportunity.payload.candidates.filter((item) => item.pumpHubTokenAddress) : []
  const swapCandidates = Array.isArray(swapHubOpportunity?.payload?.candidates) ? swapHubOpportunity.payload.candidates.filter((item) => item.tokenOutAddress) : []
  const freeMintCandidates = Array.isArray(freeMintOpportunity?.payload?.candidates) ? freeMintOpportunity.payload.candidates.filter((item) => item.contractAddress) : []

  // Weighted random selection to create a more human-like action mix.
  // Avoids repeating the same action twice in a row.
  function pickRandomTarget(lastId) {
    if (enabledTargets.length === 1) return enabledTargets[0]
    const candidates = enabledTargets.filter((t) => t.id !== lastId)
    return candidates[Math.floor(Math.random() * candidates.length)] || enabledTargets[0]
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
      const tradeCandidate = tradeCandidates[index % Math.max(1, tradeCandidates.length)] || null
      return {
        pumpHubTokenAddress: String(
          tradeCandidate?.pumpHubTokenAddress || pumpHubBuyOpportunity?.payload?.pumpHubTokenAddress || ''
        ).trim(),
        pumpHubTradeAmountEth: String(settings.pumpHubTradeAmountEth || '0.0001'),
      }
    }
    if (target.id === 'pumphub-sell') {
      const tradeCandidate = tradeCandidates[index % Math.max(1, tradeCandidates.length)] || null
      return {
        pumpHubTokenAddress: String(
          tradeCandidate?.pumpHubTokenAddress || pumpHubSellOpportunity?.payload?.pumpHubTokenAddress || ''
        ).trim(),
        pumpHubSellBps: 2000,
      }
    }
    if (target.id === 'free-nft-mint') {
      const mintCandidate = freeMintCandidates[index % Math.max(1, freeMintCandidates.length)] || null
      return {
        contractAddress: String(mintCandidate?.contractAddress || freeMintOpportunity?.payload?.contractAddress || '').trim(),
        slug: String(mintCandidate?.slug || freeMintOpportunity?.payload?.slug || ''),
        collectionName: String(mintCandidate?.collectionName || freeMintOpportunity?.payload?.collectionName || ''),
      }
    }
    if (target.id === 'swaphub-swap') {
      const swapCandidate = swapCandidates[index % Math.max(1, swapCandidates.length)] || null
      return {
        tokenOutAddress: String(swapCandidate?.tokenOutAddress || swapHubOpportunity?.payload?.tokenOutAddress || '').trim(),
        tokenOutSymbol: String(swapCandidate?.tokenOutSymbol || swapHubOpportunity?.payload?.tokenOutSymbol || ''),
        swapAmountEth: String(settings.swapHubTradeAmountEth || '0.00008'),
      }
    }
    return { diceGuess: Math.floor(Math.random() * 6) + 1 }
  }

  const actions = []
  let lastTargetId = null
  const priorityTargets = []

  if (freeMintTarget) {
    priorityTargets.push(freeMintTarget)
  }
  if (pumpHubBuyTarget) {
    priorityTargets.push(pumpHubBuyTarget)
  }
  if (pumpHubSellTarget && pumpHubSellOpportunity && planningWindow >= 6) {
    priorityTargets.push(pumpHubSellTarget)
  }
  if (swapHubTarget && planningWindow >= 5) {
    priorityTargets.push(swapHubTarget)
  }
  if (deployTokenTarget && planningWindow >= 5) {
    priorityTargets.push(deployTokenTarget)
  }

  const desiredMintActions = freeMintTarget ? Math.min(freeMintCandidates.length || 1, Math.max(2, Math.min(10, Math.floor(planningWindow / 3)))) : 0
  const desiredPumpBuyActions = pumpHubBuyTarget ? Math.min(tradeCandidates.length || 1, Math.max(2, Math.min(8, Math.floor(planningWindow / 4)))) : 0
  const desiredPumpSellActions =
    pumpHubSellTarget && pumpHubSellOpportunity
      ? Math.min(tradeCandidates.length || 1, Math.max(1, Math.min(6, Math.floor(planningWindow / 5))))
      : 0
  const desiredSwapActions = swapHubTarget ? Math.min(swapCandidates.length || 1, Math.max(2, Math.min(8, Math.floor(planningWindow / 4)))) : 0

  for (let count = 1; count < desiredMintActions; count += 1) priorityTargets.push(freeMintTarget)
  for (let count = 1; count < desiredPumpBuyActions; count += 1) priorityTargets.push(pumpHubBuyTarget)
  for (let count = 1; count < desiredPumpSellActions; count += 1) priorityTargets.push(pumpHubSellTarget)
  for (let count = 1; count < desiredSwapActions; count += 1) priorityTargets.push(swapHubTarget)

  for (let index = 0; index < planningWindow; index += 1) {
    const priorityTarget = priorityTargets.shift()
    const target = priorityTarget || pickRandomTarget(lastTargetId)
    lastTargetId = target.id
    const payload =
      target.id === 'free-nft-mint'
        ? {
            contractAddress: String((freeMintCandidates[index % Math.max(1, freeMintCandidates.length)]?.contractAddress) || freeMintOpportunity?.payload?.contractAddress || '').trim(),
            slug: String((freeMintCandidates[index % Math.max(1, freeMintCandidates.length)]?.slug) || freeMintOpportunity?.payload?.slug || ''),
            collectionName: String((freeMintCandidates[index % Math.max(1, freeMintCandidates.length)]?.collectionName) || freeMintOpportunity?.payload?.collectionName || ''),
          }
        : target.id === 'pumphub-buy'
          ? {
              pumpHubTokenAddress: String(
                (tradeCandidates[index % Math.max(1, tradeCandidates.length)]?.pumpHubTokenAddress) || pumpHubBuyOpportunity?.payload?.pumpHubTokenAddress || ''
              ).trim(),
              pumpHubTradeAmountEth: String(settings.pumpHubTradeAmountEth || '0.0001'),
            }
          : target.id === 'pumphub-sell'
            ? {
                pumpHubTokenAddress: String(
                  (tradeCandidates[index % Math.max(1, tradeCandidates.length)]?.pumpHubTokenAddress) || pumpHubSellOpportunity?.payload?.pumpHubTokenAddress || pumpHubBuyOpportunity?.payload?.pumpHubTokenAddress || ''
                ).trim(),
                pumpHubSellBps: 2000,
              }
            : target.id === 'swaphub-swap'
              ? {
                  tokenOutAddress: String(
                    (swapCandidates[index % Math.max(1, swapCandidates.length)]?.tokenOutAddress) || swapHubOpportunity?.payload?.tokenOutAddress || ''
                  ).trim(),
                  tokenOutSymbol: String(
                    (swapCandidates[index % Math.max(1, swapCandidates.length)]?.tokenOutSymbol) || swapHubOpportunity?.payload?.tokenOutSymbol || ''
                  ),
                  swapAmountEth: String(settings.swapHubTradeAmountEth || '0.00008'),
                }
            : target.id === 'deploy-token'
              ? {
                  name: 'BaseHub Agent Token',
                  symbol: 'BHAT',
                  initialSupply: '1000000',
                }
        : await buildPayload(target, index)
    const estimatedSpendWei =
      target.id === 'pumphub-buy'
        ? parseEther(String(settings.pumpHubTradeAmountEth || '0.0001')).toString()
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
