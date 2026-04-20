import { formatEther, parseEther } from 'viem'
import { getEnabledTargets } from './agentCatalog.js'
import { buildAgentContext } from './agentContextBuilder.js'
import { discoverBaseHubOpportunities } from './agentDiscovery.js'
import { getBaseHubKnowledgeSummary } from './agentKnowledge.js'
import { getAgentReasoningContext } from './agentTools.js'
import { createQueuedAction } from './agentValidator.js'

const PUMPHUB_MICRO_BUY_AMOUNTS_ETH = ['0.000006', '0.000009', '0.000012', '0.000015']

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
    return { name: `BaseHub Agent Token ${suffix}`, symbol: `BHA${index}`, initialSupply: '1000000' }
  }
  if (target.id === 'deploy-erc721') {
    return { name: `BaseHub Agent Collection ${suffix}`, symbol: `BAN${index}` }
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

function getApiBase() {
  // In the browser, always prefer same-origin so Vite's /api proxy works in local dev
  // and production uses the deployed app origin.
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
}

function createAction(target, item, index, resolved = {}) {
  const payload = {}
  let estimatedSpendWei = target.estimatedSpendWei
  if (target.id === 'gm-game' || target.id === 'gn-game') {
    payload.message = String(item.message || target.messagePlaceholder).slice(0, 100)
  }
  if (target.id === 'flip-game') {
    payload.flipSide = item.flipSide === 'tails' ? 'tails' : 'heads'
  }
  if (target.id === 'lucky-number') {
    const guess = Number(item.luckyGuess)
    payload.luckyGuess = Number.isInteger(guess) ? Math.min(10, Math.max(1, guess)) : 7
  }
  if (target.id === 'dice-roll') {
    const guess = Number(item.diceGuess)
    payload.diceGuess = Number.isInteger(guess) ? Math.min(6, Math.max(1, guess)) : 4
  }
  if (target.id === 'pumphub-buy') {
    payload.pumpHubTokenAddress = String(
      item.pumpHubTokenAddress || resolved.pumpHubTokenAddress || ''
    ).trim()
    payload.pumpHubTradeAmountEth = String(resolved.pumpHubTradeAmountEth || item.pumpHubTradeAmountEth || pickPumpHubBuyAmount(index))
    payload.pumpHubTradeAmountUsdLabel = String(item.pumpHubTradeAmountUsdLabel || resolved.pumpHubTradeAmountUsdLabel || '')
    estimatedSpendWei = parseEther(payload.pumpHubTradeAmountEth)
  }
  if (target.id === 'pumphub-sell') {
    payload.pumpHubTokenAddress = String(
      item.pumpHubTokenAddress || resolved.pumpHubTokenAddress || ''
    ).trim()
    payload.pumpHubSellBps = Number(item.pumpHubSellBps || 2000)
    estimatedSpendWei = 0n
  }
  if (target.id === 'swaphub-swap') {
    payload.tokenOutAddress = String(item.tokenOutAddress || resolved.tokenOutAddress || '').trim()
    payload.tokenOutSymbol = String(item.tokenOutSymbol || resolved.tokenOutSymbol || '')
    payload.swapAmountEth = String(item.swapAmountEth || '0.00008')
    estimatedSpendWei = parseEther(payload.swapAmountEth)
  }
  if (target.id === 'free-nft-mint') {
    payload.contractAddress = String(
      item.contractAddress || resolved.contractAddress || ''
    ).trim()
    payload.slug = String(item.slug || resolved.slug || '')
    payload.collectionName = String(item.collectionName || resolved.collectionName || '')
    estimatedSpendWei = 0n
  }
  if (target.id === 'deploy-token' || target.id === 'deploy-erc721' || target.id === 'deploy-erc1155') {
    Object.assign(payload, makeDeployPayload(target, index))
    if (item.name) payload.name = String(item.name)
    if (item.symbol) payload.symbol = String(item.symbol)
    if (item.initialSupply) payload.initialSupply = String(item.initialSupply)
    if (item.uri) payload.uri = String(item.uri)
    estimatedSpendWei = target.estimatedSpendWei
  }

  return {
    id: `${target.id}_${Date.now()}_${index}`,
    targetId: target.id,
    targetType: target.type,
    title: target.title,
    summary: item.reason || target.summary,
    estimatedSpendWei: estimatedSpendWei.toString(),
    estimatedSpendEth: formatEther(estimatedSpendWei),
    payload,
  }
}

export async function createAgentLlmPlan({ settings, report, logs, walletAddress }) {
  const availableTargets = getEnabledTargets(settings)
  const discoveredOpportunities = await discoverBaseHubOpportunities({
    settings: { ...settings, walletAddress: walletAddress || settings.walletAddress || '' },
    logs,
  })
  const pumpHubBuyOpportunity = discoveredOpportunities.find((item) => item.targetId === 'pumphub-buy' && item.available)
  const pumpHubSellOpportunity = discoveredOpportunities.find((item) => item.targetId === 'pumphub-sell' && item.available)
  const swapHubOpportunity = discoveredOpportunities.find((item) => item.targetId === 'swaphub-swap' && item.available)
  const freeMintOpportunity = discoveredOpportunities.find((item) => item.targetId === 'free-nft-mint' && item.available)
  const pumpHubBuyCandidates = Array.isArray(pumpHubBuyOpportunity?.payload?.candidates)
    ? pumpHubBuyOpportunity.payload.candidates.filter((item) => item.pumpHubTokenAddress)
    : []
  const pumpHubSellCandidates = Array.isArray(pumpHubSellOpportunity?.payload?.candidates)
    ? pumpHubSellOpportunity.payload.candidates.filter((item) => item.pumpHubTokenAddress)
    : []
  const swapHubCandidates = Array.isArray(swapHubOpportunity?.payload?.candidates)
    ? swapHubOpportunity.payload.candidates.filter((item) => item.tokenOutAddress)
    : []
  const freeMintCandidates = Array.isArray(freeMintOpportunity?.payload?.candidates)
    ? freeMintOpportunity.payload.candidates.filter((item) => item.contractAddress)
    : []
  const context = await buildAgentContext({
    settings,
    walletAddress,
    balance: null,
    report,
    logs,
    memorySnapshot: {},
  })
  const serializedTargets = availableTargets.map((target) => ({
    id: target.id,
    type: target.type,
    title: target.title,
    summary: target.summary,
    messagePlaceholder: target.messagePlaceholder || '',
    estimatedSpendWei: String(target.estimatedSpendWei || '0'),
    payloadHints:
      target.payloadHints && typeof target.payloadHints === 'object'
        ? { ...target.payloadHints }
        : null,
  }))
  const serializedReport = {
    executed: Number(report?.executed || 0),
    blocked: Number(report?.blocked || 0),
    spentWei: String(report?.spentWei || '0'),
    spentEth: String(report?.spentEth || '0'),
  }
  const res = await fetch(`${getApiBase()}/api/agent-llm-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      settings: {
        ...settings,
        walletAddress,
      },
      context,
      report: serializedReport,
      toolContext: getAgentReasoningContext(settings),
      basehubKnowledge: getBaseHubKnowledgeSummary(),
      discoveredOpportunities: discoveredOpportunities.map((item) => ({
        targetId: item.targetId,
        title: item.title,
        available: !!item.available,
        source: item.source,
        priorityScore: Number(item.priorityScore || 0),
        summary: item.summary || '',
        payload: item.payload || {},
      })),
      availableTargets: serializedTargets,
      recentLogs: (logs || []).slice(0, 12).map((log) => ({
        status: log.status,
        targetId: log.targetId || null,
        summary: log.summary || '',
        timestamp: log.timestamp,
      })),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.message || `LLM planner failed with HTTP ${res.status}`)
  }

  const allowedIds = new Set(availableTargets.map((target) => target.id))
  const actions = Array.isArray(data.actions)
    ? data.actions
        .filter((item) => item && allowedIds.has(item.targetId))
        .map((item, index) => {
          const target = availableTargets.find((candidate) => candidate.id === item.targetId)
          if (!target) return null
          const pumpBuyCandidate = pickRotatingItem(pumpHubBuyCandidates, index)
          const pumpSellCandidate = pickRotatingItem(pumpHubSellCandidates, index)
          const swapCandidate = pickRotatingItem(swapHubCandidates, index)
          const mintCandidate = pickRotatingItem(freeMintCandidates, index)
          const amountEth = pickPumpHubBuyAmount(index)

          return createAction(target, item, index, {
            pumpHubTokenAddress:
              pumpBuyCandidate?.pumpHubTokenAddress ||
              pumpSellCandidate?.pumpHubTokenAddress ||
              pumpHubBuyOpportunity?.payload?.pumpHubTokenAddress ||
              '',
            pumpHubTradeAmountEth: amountEth,
            pumpHubTradeAmountUsdLabel: `$${(0.02 + (index % 4) * 0.01).toFixed(2)}`,
            tokenOutAddress: swapCandidate?.tokenOutAddress || swapHubOpportunity?.payload?.tokenOutAddress || '',
            tokenOutSymbol: swapCandidate?.tokenOutSymbol || swapHubOpportunity?.payload?.tokenOutSymbol || '',
            contractAddress: mintCandidate?.contractAddress || freeMintOpportunity?.payload?.contractAddress || '',
            slug: mintCandidate?.slug || freeMintOpportunity?.payload?.slug || '',
            collectionName: mintCandidate?.collectionName || freeMintOpportunity?.payload?.collectionName || '',
          })
        })
        .filter(Boolean)
    : []
  const queue = Array.isArray(data.queue)
    ? data.queue.map((item, index) =>
        createQueuedAction(
          {
            ...item,
            actionType: item.actionType || item.targetId,
            title: item.title || availableTargets.find((target) => target.id === (item.actionType || item.targetId))?.title || 'Queued action',
            reason: item.reason || item.summary || '',
            params: item.params || item.payload || {},
            priority: item.priority ?? index + 1,
            riskLevel: item.riskLevel,
            estimatedCostEth: item.estimatedCostEth,
            estimatedSpendWei: item.estimatedSpendWei,
            requiresApproval: item.requiresApproval,
          },
          index
        )
      )
    : actions.map((action, index) =>
        createQueuedAction(
          {
            actionType: action.targetId,
            title: action.title,
            reason: action.summary,
            params: action.payload,
            priority: index + 1,
            estimatedCostEth: action.estimatedSpendEth,
            estimatedSpendWei: action.estimatedSpendWei,
          },
          index
        )
      )

  return {
    title: 'AI Burner Plan',
    intent: typeof data.intent === 'string' ? data.intent : '',
    rationale: typeof data.rationale === 'string' ? data.rationale : 'LLM planner generated a burner action queue.',
    thoughtSummary: typeof data.thoughtSummary === 'string' ? data.thoughtSummary : '',
    diaryEntry: typeof data.diaryEntry === 'string' ? data.diaryEntry : '',
    nextMove: typeof data.nextMove === 'string' ? data.nextMove : '',
    memorySummary: typeof data.memorySummary === 'string' ? data.memorySummary : '',
    criticNote: typeof data.criticNote === 'string' ? data.criticNote : '',
    model: typeof data.model === 'string' ? data.model : null,
    plannerInputMode: settings.plannerInputMode,
    userPrompt: settings.userPrompt || '',
    source: 'llm',
    actions,
    queue,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    requiresApproval: Boolean(data.requiresApproval),
  }
}
