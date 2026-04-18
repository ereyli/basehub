import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { parseEther } from 'viem'
import { getBaseHubKnowledgeSummary } from '../src/features/agent-mode/agentKnowledge.js'
import { getActionRegistry } from '../src/features/agent-mode/agentActionRegistry.js'
import { createQueuedAction, validateDraftPlan } from '../src/features/agent-mode/agentValidator.js'
import { getAgentMemorySnapshot, insertAgentMemory, insertAgentReflection, upsertAgentProfile } from './_agentMemory.js'

const app = new Hono()

app.use('/*', cors())

function jsonSchemaForTargets(targetIds = [], maxItems = 1) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string' },
      thoughtSummary: { type: 'string' },
      diaryEntry: { type: 'string' },
      nextMove: { type: 'string' },
      memorySummary: { type: 'string' },
      criticNote: { type: 'string' },
      rationale: { type: 'string' },
      actions: {
        type: 'array',
        maxItems,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            targetId: { type: 'string', enum: targetIds },
            message: { type: ['string', 'null'] },
            reason: { type: 'string' },
            priority: { type: 'integer' },
            flipSide: { type: ['string', 'null'], enum: ['heads', 'tails', null] },
            luckyGuess: { type: ['integer', 'null'] },
            diceGuess: { type: ['integer', 'null'] },
            pumpHubTokenAddress: { type: ['string', 'null'] },
            pumpHubTradeAmountEth: { type: ['string', 'null'] },
            pumpHubSellBps: { type: ['integer', 'null'] },
            tokenOutAddress: { type: ['string', 'null'] },
            tokenOutSymbol: { type: ['string', 'null'] },
            swapAmountEth: { type: ['string', 'null'] },
            contractAddress: { type: ['string', 'null'] },
            slug: { type: ['string', 'null'] },
            collectionName: { type: ['string', 'null'] },
            name: { type: ['string', 'null'] },
            symbol: { type: ['string', 'null'] },
            initialSupply: { type: ['string', 'null'] },
            uri: { type: ['string', 'null'] },
          },
          required: ['targetId', 'message', 'reason', 'priority', 'flipSide', 'luckyGuess', 'diceGuess', 'pumpHubTokenAddress', 'pumpHubTradeAmountEth', 'pumpHubSellBps', 'tokenOutAddress', 'tokenOutSymbol', 'swapAmountEth', 'contractAddress', 'slug', 'collectionName', 'name', 'symbol', 'initialSupply', 'uri'],
        },
      },
    },
    required: ['intent', 'thoughtSummary', 'diaryEntry', 'nextMove', 'memorySummary', 'criticNote', 'rationale', 'actions'],
  }
}

function sanitizeInput(body = {}) {
  const settings = body.settings || {}
  const report = body.report || {}
  const availableTargets = Array.isArray(body.availableTargets) ? body.availableTargets : []
  const basehubKnowledge = Array.isArray(body.basehubKnowledge) ? body.basehubKnowledge : []
  const discoveredOpportunities = Array.isArray(body.discoveredOpportunities) ? body.discoveredOpportunities : []
  const recentLogs = Array.isArray(body.recentLogs) ? body.recentLogs : []
  const toolContext =
    body.toolContext && typeof body.toolContext === 'object' ? body.toolContext : { toolCatalog: [], capabilityGraph: [] }

  return {
    settings: {
      plannerInputMode: String(settings.plannerInputMode || 'prompt').slice(0, 32),
      objective: String(settings.objective || '').slice(0, 280),
      userPrompt: String(settings.userPrompt || '').slice(0, 1200),
      dailyTxTarget: Number(settings.dailyTxTarget || 0),
      maxDailySpendEth: String(settings.maxDailySpendEth || ''),
      pumpHubTradeMode: String(settings.pumpHubTradeMode || 'single').slice(0, 20),
      pumpHubTokenAddress: String(settings.pumpHubTokenAddress || '').slice(0, 80),
      pumpHubWatchlist: Array.isArray(settings.pumpHubWatchlist) ? settings.pumpHubWatchlist.slice(0, 12) : [],
      pumpHubTradeAmountEth: String(settings.pumpHubTradeAmountEth || '').slice(0, 32),
      swapHubTradeAmountEth: String(settings.swapHubTradeAmountEth || '').slice(0, 32),
      freeMintEnabled: !!settings.freeMintEnabled,
      gmMessage: String(settings.gmMessage || '').slice(0, 100),
      gnMessage: String(settings.gnMessage || '').slice(0, 100),
      walletAddress: String(settings.walletAddress || '').slice(0, 80),
    },
    report: {
      executed: Number(report.executed || 0),
      blocked: Number(report.blocked || 0),
      spentEth: String(report.spentEth || '0'),
    },
    availableTargets: availableTargets.map((target) => ({
      id: String(target.id || ''),
      title: String(target.title || ''),
      summary: String(target.summary || ''),
      estimatedSpendWei: String(target.estimatedSpendWei || '0'),
      messagePlaceholder: String(target.messagePlaceholder || ''),
      payloadHints:
        target.payloadHints && typeof target.payloadHints === 'object'
          ? target.payloadHints
          : null,
    })),
    basehubKnowledge: basehubKnowledge.slice(0, 40).map((item) => ({
      id: String(item.id || ''),
      title: String(item.title || ''),
      category: String(item.category || ''),
      description: String(item.description || '').slice(0, 220),
      currentlyExecutableByBurner: !!item.currentlyExecutableByBurner,
    })),
    discoveredOpportunities: discoveredOpportunities.slice(0, 30).map((item) => ({
      targetId: String(item.targetId || ''),
      title: String(item.title || ''),
      available: !!item.available,
      source: String(item.source || ''),
      priorityScore: Number(item.priorityScore || 0),
      summary: String(item.summary || '').slice(0, 220),
      payload:
        item.payload && typeof item.payload === 'object'
          ? {
              pumpHubTokenAddress: String(item.payload.pumpHubTokenAddress || ''),
              pumpHubTradeAmountEth: String(item.payload.pumpHubTradeAmountEth || ''),
              pumpHubSellBps: Number(item.payload.pumpHubSellBps || 0),
              tokenOutAddress: String(item.payload.tokenOutAddress || ''),
              tokenOutSymbol: String(item.payload.tokenOutSymbol || ''),
              swapAmountEth: String(item.payload.swapAmountEth || ''),
              contractAddress: String(item.payload.contractAddress || ''),
              slug: String(item.payload.slug || ''),
              collectionName: String(item.payload.collectionName || ''),
              candidates: Array.isArray(item.payload.candidates)
                ? item.payload.candidates.slice(0, 8).map((candidate) => ({
                    pumpHubTokenAddress: String(candidate.pumpHubTokenAddress || ''),
                    tokenOutAddress: String(candidate.tokenOutAddress || ''),
                    tokenOutSymbol: String(candidate.tokenOutSymbol || ''),
                    contractAddress: String(candidate.contractAddress || ''),
                    slug: String(candidate.slug || ''),
                    collectionName: String(candidate.collectionName || ''),
                    name: String(candidate.name || ''),
                    symbol: String(candidate.symbol || ''),
                  }))
                : [],
            }
          : {},
    })),
    recentLogs: recentLogs.slice(0, 12).map((log) => ({
      status: String(log.status || ''),
      targetId: log.targetId ? String(log.targetId) : null,
      summary: String(log.summary || '').slice(0, 180),
      timestamp: String(log.timestamp || ''),
    })),
    toolContext: {
      toolCatalog: Array.isArray(toolContext.toolCatalog) ? toolContext.toolCatalog.slice(0, 20) : [],
      capabilityGraph: Array.isArray(toolContext.capabilityGraph) ? toolContext.capabilityGraph.slice(0, 30) : [],
    },
  }
}

function extractOutputText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text
  }

  const message = Array.isArray(payload.output)
    ? payload.output.find((item) => item?.type === 'message')
    : null
  const textItem = Array.isArray(message?.content)
    ? message.content.find((item) => item?.type === 'output_text' && typeof item.text === 'string')
    : null

  return textItem?.text || ''
}

function tryParseJson(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return null

  const candidates = [
    raw,
    raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim(),
  ]

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

function getPlanningWindow(remainingTxBudget) {
  return Math.max(1, Math.min(remainingTxBudget, 24))
}

function getPlannerMaxOutputTokens(planningWindow) {
  return Math.max(1800, Math.min(6500, 1200 + planningWindow * 170))
}

function createStructuredAction(targetId, reason, priority, payload = {}) {
  return {
    targetId,
    message: payload.message ?? null,
    reason,
    priority,
    flipSide: payload.flipSide ?? null,
    luckyGuess: payload.luckyGuess ?? null,
    diceGuess: payload.diceGuess ?? null,
    pumpHubTokenAddress: payload.pumpHubTokenAddress ?? null,
    pumpHubTradeAmountEth: payload.pumpHubTradeAmountEth ?? null,
    pumpHubSellBps: payload.pumpHubSellBps ?? null,
    tokenOutAddress: payload.tokenOutAddress ?? null,
    tokenOutSymbol: payload.tokenOutSymbol ?? null,
    swapAmountEth: payload.swapAmountEth ?? null,
    contractAddress: payload.contractAddress ?? null,
    slug: payload.slug ?? null,
    collectionName: payload.collectionName ?? null,
    name: payload.name ?? null,
    symbol: payload.symbol ?? null,
    initialSupply: payload.initialSupply ?? null,
    uri: payload.uri ?? null,
  }
}

function dedupeActions(actions = []) {
  const seen = new Set()
  return actions.filter((action) => {
    const key = `${action.targetId}:${action.pumpHubTokenAddress || ''}:${action.tokenOutAddress || ''}:${action.contractAddress || ''}:${action.slug || ''}:${action.message || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildRotatingActions(targetId, candidates = [], count = 1, makePayload) {
  return candidates.slice(0, count).map((candidate, index) =>
    createStructuredAction(targetId, makePayload(candidate, index).reason, index + 1, makePayload(candidate, index).payload)
  )
}

async function requestOpenAiPlan({
  openAiKey,
  model,
  body,
  memorySnapshot,
  planningWindow,
  compact = false,
}) {
  const planningRules = compact
    ? [
        'Return strict valid JSON only.',
        'Keep every top-level text field to one very short sentence.',
        `Return only the next ${planningWindow} concrete actions.`,
        'Prefer discovered opportunities and do not leave addresses empty when a live target exists.',
      ]
    : [
        'Think in terms of a simple morning-to-night routine, not a burst of back-to-back bot actions.',
        'Use the user objective as the main style guide.',
        'If a userPrompt is present, treat it like a direct conversation from the owner and echo its intent naturally in the plan.',
        'If recent logs show repeated actions, gently diversify the next steps.',
        'Prefer short, ordinary explanations for each action reason.',
        'Keep GM/GN messages casual and human, not promotional.',
        'Use PumpHub Buy or PumpHub Sell only when trade activity fits the user mission.',
        'The agent must self-discover PumpHub trade targets from discoveredOpportunities instead of relying on user-provided addresses.',
        'If PumpHub Buy is used, set pumpHubTokenAddress and pumpHubTradeAmountEth on that action when known.',
        'If PumpHub Sell is used, set pumpHubTokenAddress when known and set pumpHubSellBps to a small value like 1500 or 2000.',
        'Use SwapHub Swap when broader DEX activity fits the user mission.',
        'If SwapHub Swap is used, set tokenOutAddress and tokenOutSymbol when known and keep swapAmountEth tiny.',
        'Use Free NFT Mint when the user wants NFT activity and freeMintEnabled is true.',
        'Use discoveredOpportunities as the live source of truth for what BaseHub currently offers.',
        'If a discovered opportunity is marked unavailable, do not schedule that action.',
        'If a discovered PumpHub, SwapHub, or free NFT opportunity is available, strongly prefer using its payload values instead of leaving addresses empty.',
        'When enough free NFT opportunities exist, spread mints across many different collections instead of reusing one.',
        'When enough trade opportunities exist, spread buys and swaps across many different token contracts instead of repeating one target.',
        'When the user asks for autonomous behavior, behave like you already scanned BaseHub and selected the best live opportunities.',
        'The thoughtSummary should sound like a real agent speaking to its owner, not a dashboard report.',
        'Use first-person phrasing like "I want to...", "I am keeping today light...", or "I chose..." when natural.',
        'Make the user feel the agent has a point of view and a plan.',
        'Keep intent, thoughtSummary, diaryEntry, nextMove, memorySummary, criticNote, and rationale very short. One sentence each.',
        'Do not repeat the same idea across multiple top-level fields.',
        `Think about the whole day, but only return the next ${planningWindow} concrete actions, not the entire day if the budget is huge.`,
        'Do not mechanically rotate every target in order. Small clusters and deliberate variety are better than obvious loops.',
      ]

  const requestBody = {
    ...body,
    fallbackKnowledge: compact ? body.basehubKnowledge.slice(0, 12) : getBaseHubKnowledgeSummary(),
    memorySnapshot: compact
      ? {
          profile: memorySnapshot?.profile || null,
          recentMemories: Array.isArray(memorySnapshot?.memories) ? memorySnapshot.memories.slice(0, 3) : [],
        }
      : memorySnapshot,
    discoveredOpportunities: compact ? body.discoveredOpportunities.slice(0, 12) : body.discoveredOpportunities,
    basehubKnowledge: compact ? body.basehubKnowledge.slice(0, 12) : body.basehubKnowledge,
    recentLogs: compact ? body.recentLogs.slice(0, 6) : body.recentLogs,
    planningRules,
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You are the user’s personal onchain agent inside BaseHub. Speak like a calm, smart operator shaping today’s routine. You may only choose from the explicitly provided executable burner targets. Never invent new targets or actions. Build a realistic, low-drama daily routine that feels human, varied, and intentional. Think about the whole day, but return only the next planning window of actions. If plannerInputMode is prompt, treat userPrompt as the direct mission. If plannerInputMode is routine, respect the manual setup. Keep every top-level text field very short: one sentence each, ideally under 20 words. Do not write long diary paragraphs. Favor compact operational language so the JSON stays small and complete.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(requestBody),
            },
          ],
        },
      ],
      max_output_tokens: compact
        ? Math.min(6500, getPlannerMaxOutputTokens(planningWindow) + 800)
        : getPlannerMaxOutputTokens(planningWindow),
      text: {
        format: {
          type: 'json_schema',
          name: 'burner_agent_plan',
          strict: true,
          schema: jsonSchemaForTargets(
            body.availableTargets.map((target) => target.id),
            planningWindow
          ),
        },
      },
    }),
  })

  const payload = await openAiResponse.json().catch(() => ({}))
  if (!openAiResponse.ok) {
    throw new Error(
      payload.error?.message ||
      payload.message ||
      `OpenAI request failed with HTTP ${openAiResponse.status}`
    )
  }

  const extractedText = extractOutputText(payload)
  const parsed = tryParseJson(extractedText)
  return { parsed, payload, extractedText }
}

function repairActions(parsed, body, planningWindow) {
  const actions = Array.isArray(parsed.actions) ? [...parsed.actions] : []
  const availableIds = new Set(body.availableTargets.map((target) => target.id))
  const discovered = Array.isArray(body.discoveredOpportunities) ? body.discoveredOpportunities : []
  const byTargetId = (targetId) => discovered.find((item) => item.targetId === targetId && item.available)
  const userIntentText = `${body.settings.userPrompt || ''} ${parsed.intent || ''} ${parsed.nextMove || ''}`.toLowerCase()

  const tradeBuy = byTargetId('pumphub-buy')
  const tradeSell = byTargetId('pumphub-sell')
  const swapHub = byTargetId('swaphub-swap')
  const freeMint = byTargetId('free-nft-mint')
  const deployToken = body.availableTargets.find((target) => target.id === 'deploy-token')
  const deployErc721 = body.availableTargets.find((target) => target.id === 'deploy-erc721')
  const deployErc1155 = body.availableTargets.find((target) => target.id === 'deploy-erc1155')

  const wantsBroadActivity =
    /active|random|routine|basehub|genel|karışık|mixed|varied|autonomous|otomatik/.test(userIntentText)
  const wantsTrade = /trade|pump|token|al.?sat|buy|sell/.test(userIntentText)
  const wantsMint = /nft|mint|free mint|launchpad|ücretsiz/.test(userIntentText)
  const wantsDeploy = /deploy|erc20|erc721|erc1155|launch token|launch collection|çıkar|oluştur/.test(userIntentText)

  const hasTarget = (targetId) => actions.some((action) => action?.targetId === targetId)
  const requiredActions = []
  const tradeCandidates = Array.isArray(tradeBuy?.payload?.candidates) ? tradeBuy.payload.candidates.filter((item) => item.pumpHubTokenAddress) : []
  const swapCandidates = Array.isArray(swapHub?.payload?.candidates) ? swapHub.payload.candidates.filter((item) => item.tokenOutAddress) : []
  const freeMintCandidates = Array.isArray(freeMint?.payload?.candidates) ? freeMint.payload.candidates.filter((item) => item.contractAddress) : []
  const desiredMintCount = Math.min(freeMintCandidates.length || 1, Math.max(2, Math.min(10, Math.floor(planningWindow / 3))))
  const desiredTradeCount = Math.min(tradeCandidates.length || 1, Math.max(2, Math.min(8, Math.floor(planningWindow / 4))))
  const desiredSwapCount = Math.min(swapCandidates.length || 1, Math.max(2, Math.min(8, Math.floor(planningWindow / 4))))

  if (availableIds.has('pumphub-buy') && (wantsTrade || wantsBroadActivity) && !hasTarget('pumphub-buy')) {
    const rotatingBuys = buildRotatingActions(
      'pumphub-buy',
      tradeCandidates.length ? tradeCandidates : [{ pumpHubTokenAddress: tradeBuy?.payload?.pumpHubTokenAddress || '' }],
      desiredTradeCount,
      (candidate, index) => ({
        reason: index === 0
          ? 'Open the routine with a small PumpHub buy on a fresh token.'
          : 'Rotate into a different PumpHub token so trade activity looks less repetitive.',
        payload: {
          pumpHubTokenAddress: candidate.pumpHubTokenAddress || '',
          pumpHubTradeAmountEth: tradeBuy?.payload?.pumpHubTradeAmountEth || body.settings.pumpHubTradeAmountEth || '0.0001',
        },
      })
    )
    requiredActions.push(...rotatingBuys)
  }

  if (availableIds.has('free-nft-mint') && (wantsMint || wantsBroadActivity) && !hasTarget('free-nft-mint')) {
    const rotatingMints = buildRotatingActions(
      'free-nft-mint',
      freeMintCandidates.length ? freeMintCandidates : [{
        contractAddress: freeMint?.payload?.contractAddress || '',
        slug: freeMint?.payload?.slug || '',
        collectionName: freeMint?.payload?.collectionName || '',
      }],
      desiredMintCount,
      (candidate, index) => ({
        reason: index === 0
          ? 'Take one live free mint from BaseHub launchpad.'
          : 'Use another free mint so the NFT routine is spread across projects.',
        payload: {
          contractAddress: candidate.contractAddress || '',
          slug: candidate.slug || '',
          collectionName: candidate.collectionName || '',
        },
      })
    )
    requiredActions.push(...rotatingMints)
  }

  if (
    availableIds.has('pumphub-sell') &&
    tradeSell?.available &&
    planningWindow >= 6 &&
    (wantsTrade || wantsBroadActivity) &&
    !hasTarget('pumphub-sell')
  ) {
    const rotatingSells = buildRotatingActions(
      'pumphub-sell',
      Array.isArray(tradeSell?.payload?.candidates) && tradeSell.payload.candidates.length
        ? tradeSell.payload.candidates
        : [{ pumpHubTokenAddress: tradeSell?.payload?.pumpHubTokenAddress || '' }],
      Math.min(desiredTradeCount, Math.max(1, planningWindow - 4)),
      (candidate, index) => ({
        reason: index === 0
          ? 'Trim a small PumpHub position to keep buy and sell behavior balanced.'
          : 'Rotate the sell leg across another PumpHub token so trading looks distributed.',
        payload: {
          pumpHubTokenAddress: candidate.pumpHubTokenAddress || '',
          pumpHubSellBps: tradeSell?.payload?.pumpHubSellBps || 2000,
        },
      })
    )
    requiredActions.push(...rotatingSells)
  }

  if (availableIds.has('swaphub-swap') && (wantsTrade || wantsBroadActivity) && !hasTarget('swaphub-swap')) {
    const rotatingSwaps = buildRotatingActions(
      'swaphub-swap',
      swapCandidates.length
        ? swapCandidates
        : [{ tokenOutAddress: swapHub?.payload?.tokenOutAddress || '', tokenOutSymbol: swapHub?.payload?.tokenOutSymbol || '' }],
      desiredSwapCount,
      (candidate, index) => ({
        reason: index === 0
          ? 'Route one tiny SwapHub swap through a fresh Base token.'
          : 'Use a different SwapHub token route so DEX activity stays distributed.',
        payload: {
          tokenOutAddress: candidate.tokenOutAddress || '',
          tokenOutSymbol: candidate.tokenOutSymbol || '',
          swapAmountEth: swapHub?.payload?.swapAmountEth || '0.00008',
        },
      })
    )
    requiredActions.push(...rotatingSwaps)
  }

  if ((wantsDeploy || wantsBroadActivity) && !hasTarget('deploy-token') && deployToken && planningWindow >= 5) {
    requiredActions.push(
      createStructuredAction('deploy-token', 'Draft a simple ERC20 deploy so the routine includes one higher-intent BaseHub action.', 9, {
        name: 'BaseHub Agent Token',
        symbol: 'BHAT',
        initialSupply: '1000000',
      })
    )
  }

  if ((wantsDeploy || wantsBroadActivity) && !hasTarget('deploy-erc721') && deployErc721 && planningWindow >= 7) {
    requiredActions.push(
      createStructuredAction('deploy-erc721', 'Draft a lightweight ERC721 collection deploy for a higher-intent step.', 10, {
        name: 'BaseHub Agent Collection',
        symbol: 'BHNFT',
        uri: 'https://basehub.fun/agent/metadata/basehub-agent-collection',
      })
    )
  }

  if ((wantsDeploy || wantsBroadActivity) && !hasTarget('deploy-erc1155') && deployErc1155 && planningWindow >= 9) {
    requiredActions.push(
      createStructuredAction('deploy-erc1155', 'Draft a lightweight ERC1155 deploy for a higher-intent step.', 11, {
        name: 'BaseHub Agent Multi',
        symbol: 'BHMULTI',
        uri: 'https://basehub.fun/agent/metadata/{id}.json',
      })
    )
  }

  const deployActions = requiredActions.filter((action) => action.targetId.startsWith('deploy-'))
  const nonDeployActions = requiredActions.filter((action) => !action.targetId.startsWith('deploy-'))
  const mixedRequired = []
  while (nonDeployActions.length || deployActions.length) {
    if (nonDeployActions.length) mixedRequired.push(nonDeployActions.shift())
    if (nonDeployActions.length) mixedRequired.push(nonDeployActions.shift())
    if (deployActions.length) mixedRequired.push(deployActions.shift())
  }

  parsed.actions = dedupeActions([...mixedRequired, ...actions]).slice(0, planningWindow).map((action, index) => ({
    ...action,
    priority: index + 1,
  }))

  return parsed
}

app.post('/', async (c) => {
  try {
    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      return c.json({ error: 'OPENAI_API_KEY is missing on the server.' }, 500)
    }

    const body = sanitizeInput(await c.req.json().catch(() => ({})))
    const remainingTxBudget = Math.max(0, body.settings.dailyTxTarget - body.report.executed)
    const memorySnapshot = await getAgentMemorySnapshot(body.settings.walletAddress)

    if (remainingTxBudget <= 0) {
      return c.json({
        thoughtSummary: 'Daily target is already reached, so no new action is needed.',
        intent: 'Hold steady',
        diaryEntry: 'I am not opening a new block because today target is already covered.',
        nextMove: 'Wait for the next planning cycle.',
        memorySummary: 'No new memory created.',
        criticNote: 'No execution needed.',
        rationale: 'No action scheduled because the daily transaction target is exhausted.',
        actions: [],
        model: process.env.OPENAI_AGENT_MODEL || 'gpt-4.1-mini',
      })
    }

    if (body.availableTargets.length === 0) {
      return c.json({
        thoughtSummary: 'No allowed BaseHub targets are enabled.',
        intent: 'Wait for configuration',
        diaryEntry: 'I cannot shape a route yet because nothing is enabled for me to use.',
        nextMove: 'Enable at least one BaseHub action.',
        memorySummary: 'No actionable tools available.',
        criticNote: 'Blocked by configuration.',
        rationale: 'The planner cannot suggest an action until GM or GN is enabled.',
        actions: [],
        model: process.env.OPENAI_AGENT_MODEL || 'gpt-4.1-mini',
      })
    }

    const model = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1-mini'
    const planningWindow = getPlanningWindow(remainingTxBudget)

    // The LLM can reason broadly about BaseHub, but structured outputs keep the burner agent
    // confined to the small whitelist of actions that this MVP can safely execute.
    let { parsed, payload, extractedText } = await requestOpenAiPlan({
      openAiKey,
      model,
      body,
      memorySnapshot,
      planningWindow,
      compact: false,
    })

    if (!parsed) {
      const retry = await requestOpenAiPlan({
        openAiKey,
        model,
        body,
        memorySnapshot,
        planningWindow,
        compact: true,
      })
      parsed = retry.parsed
      payload = retry.payload
      extractedText = retry.extractedText
    }

    if (!parsed) {
      return c.json(
        {
          error: 'OpenAI returned invalid JSON output.',
          debug:
            extractedText && typeof extractedText === 'string'
              ? extractedText.slice(0, 400)
              : JSON.stringify(payload).slice(0, 400),
        },
        500
      )
    }

    const repaired = repairActions(parsed, body, planningWindow)
    const contextLike = {
      limits: {
        dailyEthBudget: body.settings.maxDailySpendEth,
      },
      trade: {
        canSellPumpHub: Boolean(
          body.discoveredOpportunities.find((item) => item.targetId === 'pumphub-sell' && item.available)
        ),
      },
    }
    const queue = repaired.actions.map((action, index) =>
      createQueuedAction(
        {
          actionType: action.targetId,
          title:
            body.availableTargets.find((target) => target.id === action.targetId)?.title ||
            action.targetId,
          reason: action.reason,
          priority: action.priority,
          riskLevel:
            getActionRegistry().find((entry) => entry.actionType === action.targetId)?.riskLevel || 'low',
          estimatedCostEth:
            getActionRegistry().find((entry) => entry.actionType === action.targetId)?.estimatedCostEth || '0',
          estimatedSpendWei:
            action.targetId === 'pumphub-buy'
              ? String(
                  parseEther(
                    String(
                      action.pumpHubTradeAmountEth ||
                      body.discoveredOpportunities.find((item) => item.targetId === 'pumphub-buy')?.payload?.pumpHubTradeAmountEth ||
                      body.settings.pumpHubTradeAmountEth ||
                      '0.0001'
                    )
                  )
                )
              : body.availableTargets.find((target) => target.id === action.targetId)?.estimatedSpendWei || '0',
          params: {
            message: action.message,
            flipSide: action.flipSide,
            luckyGuess: action.luckyGuess,
            diceGuess: action.diceGuess,
            pumpHubTokenAddress: action.pumpHubTokenAddress,
            pumpHubTradeAmountEth: action.pumpHubTradeAmountEth,
            pumpHubSellBps: action.pumpHubSellBps,
            contractAddress: action.contractAddress,
            slug: action.slug,
            collectionName: action.collectionName,
            name: action.name,
            symbol: action.symbol,
            initialSupply: action.initialSupply,
            uri: action.uri,
          },
        },
        index
      )
    )
    const validated = validateDraftPlan({ queue, context: contextLike })

    const validatedActions = validated.queue.map((item) => ({
      targetId: item.actionType,
      message: item.params?.message ?? null,
      reason: item.reason,
      priority: item.priority,
      flipSide: item.params?.flipSide ?? null,
      luckyGuess: item.params?.luckyGuess ?? null,
      diceGuess: item.params?.diceGuess ?? null,
      pumpHubTokenAddress: item.params?.pumpHubTokenAddress ?? null,
      pumpHubTradeAmountEth: item.params?.pumpHubTradeAmountEth ?? null,
      pumpHubSellBps: item.params?.pumpHubSellBps ?? null,
      tokenOutAddress: item.params?.tokenOutAddress ?? null,
      tokenOutSymbol: item.params?.tokenOutSymbol ?? null,
      swapAmountEth: item.params?.swapAmountEth ?? null,
      contractAddress: item.params?.contractAddress ?? null,
      slug: item.params?.slug ?? null,
      collectionName: item.params?.collectionName ?? null,
      name: item.params?.name ?? null,
      symbol: item.params?.symbol ?? null,
      initialSupply: item.params?.initialSupply ?? null,
      uri: item.params?.uri ?? null,
    }))

    const actionTitles = validatedActions.map((action) => action.targetId).join(', ')

    if (body.settings.walletAddress) {
      try {
        await upsertAgentProfile({
          walletAddress: body.settings.walletAddress,
          objective: repaired.intent || '',
          currentIntent: repaired.nextMove || '',
          plannerMode: 'ai-v2',
        })
        await insertAgentMemory({
          walletAddress: body.settings.walletAddress,
          memoryType: 'plan',
          title: repaired.intent || 'Agent plan',
          body: repaired.diaryEntry || repaired.thoughtSummary || '',
          meta: { actionTitles, plannedCount: validatedActions.length },
        })
        await insertAgentReflection({
          walletAddress: body.settings.walletAddress,
          reflectionType: 'critic',
          body: repaired.criticNote || '',
          meta: { rationale: repaired.rationale || '' },
        })
      } catch (memoryError) {
        console.warn('[agent-llm-plan] Memory write skipped:', memoryError?.message || memoryError)
      }
    }

    return c.json({
      intent: repaired.intent || '',
      thoughtSummary: repaired.thoughtSummary || '',
      diaryEntry: repaired.diaryEntry || '',
      nextMove: repaired.nextMove || '',
      memorySummary: repaired.memorySummary || '',
      criticNote: repaired.criticNote || '',
      rationale: repaired.rationale || '',
      actions: validatedActions,
      queue: validated.queue,
      warnings: validated.warnings,
      requiresApproval: validated.queue.some((item) => item.requiresApproval),
      model,
    })
  } catch (error) {
    return c.json({ error: error.message || 'LLM planner failed.' }, 500)
  }
})

export default async function handler(req, res) {
  try {
    const urlParts = (req.url || '/').split('?')
    const queryString = urlParts[1] || ''
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
    const fullUrl = `${protocol}://${host}/${queryString ? `?${queryString}` : ''}`

    let body
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers: new Headers(req.headers || {}),
      body,
    })

    const response = await app.fetch(request)

    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    res.statusCode = response.status
    const text = await response.text()
    res.end(text)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: error.message || 'LLM planner failed.' }))
  }
}
