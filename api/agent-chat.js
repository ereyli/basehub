import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getBaseHubKnowledgeSummary } from '../src/features/agent-mode/agentKnowledge.js'
import { getAgentMemorySnapshot, insertAgentMemory } from './_agentMemory.js'

const app = new Hono()
app.use('/*', cors())

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

function sanitizeConversation(items = []) {
  return Array.isArray(items)
    ? items.slice(-8).map((item) => ({
        role: item?.role === 'agent' ? 'assistant' : 'user',
        text: String(item?.text || '').slice(0, 500),
      }))
    : []
}

function buildConversationText(items = []) {
  return items
    .map((item) => `${item.role === 'assistant' ? 'Agent' : 'User'}: ${item.text}`)
    .join('\n')
}

const AGENT_TARGET_IDS = {
  GM: 'gm-game',
  GN: 'gn-game',
  FLIP: 'flip-game',
  LUCKY: 'lucky-number',
  DICE: 'dice-roll',
  PUMPHUB_BUY: 'pumphub-buy',
  PUMPHUB_SELL: 'pumphub-sell',
  FREE_NFT_MINT: 'free-nft-mint',
  DEPLOY_TOKEN: 'deploy-token',
  DEPLOY_ERC721: 'deploy-erc721',
  DEPLOY_ERC1155: 'deploy-erc1155',
}

const targetIds = new Set(Object.values(AGENT_TARGET_IDS))
const DEFAULT_AUTONOMOUS_TARGETS = Object.values(AGENT_TARGET_IDS)

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function normalizeCap(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return String(Math.min(0.02, Math.max(0.00005, numeric)))
}

function normalizeSuggestedSettings(settings = {}, fallback = {}) {
  const enabledTargetIds = Array.isArray(settings.enabledTargetIds)
    ? settings.enabledTargetIds.filter((item) => targetIds.has(item))
    : []

  const normalized = {
    dailyTxTarget: clampNumber(settings.dailyTxTarget, clampNumber(fallback.dailyTxTarget, 4, 1, 500), 1, 500),
    maxDailySpendEth: normalizeCap(settings.maxDailySpendEth, normalizeCap(fallback.maxDailySpendEth, '0.001')),
    intervalMinutes: clampNumber(settings.intervalMinutes, clampNumber(fallback.intervalMinutes, 30, 1, 240), 1, 240),
    pumpHubTradeMode: 'latest',
    pumpHubTokenAddress: '',
    pumpHubWatchlist: [],
    pumpHubTradeAmountEth: normalizeCap(settings.pumpHubTradeAmountEth, normalizeCap(fallback.pumpHubTradeAmountEth, '0.0001')),
    freeMintEnabled:
      typeof settings.freeMintEnabled === 'boolean'
        ? settings.freeMintEnabled
        : !!fallback.freeMintEnabled,
    enabledTargetIds: enabledTargetIds.length
      ? enabledTargetIds
      : Array.isArray(fallback.enabledTargetIds)
        ? fallback.enabledTargetIds.filter((item) => targetIds.has(item))
        : DEFAULT_AUTONOMOUS_TARGETS,
  }

  if (normalized.freeMintEnabled && !normalized.enabledTargetIds.includes(AGENT_TARGET_IDS.FREE_NFT_MINT)) {
    normalized.enabledTargetIds = [...normalized.enabledTargetIds, AGENT_TARGET_IDS.FREE_NFT_MINT]
  }

  const deployTargets = [
    AGENT_TARGET_IDS.DEPLOY_TOKEN,
    AGENT_TARGET_IDS.DEPLOY_ERC721,
    AGENT_TARGET_IDS.DEPLOY_ERC1155,
  ]
  const rawJoined = JSON.stringify(settings).toLowerCase()
  const wantsDeploy = /deploy|token çıkart|token deploy|erc20|erc721|erc1155|launch token|koleksiyon çıkar/.test(rawJoined)
  if (wantsDeploy) {
    normalized.enabledTargetIds = [...new Set([...normalized.enabledTargetIds, ...deployTargets])]
  }

  const wantsTradeTargets =
    normalized.pumpHubTradeMode === 'latest'

  if (wantsTradeTargets && !normalized.enabledTargetIds.includes(AGENT_TARGET_IDS.PUMPHUB_BUY)) {
    normalized.enabledTargetIds = [...normalized.enabledTargetIds, AGENT_TARGET_IDS.PUMPHUB_BUY]
  }
  if (wantsTradeTargets && !normalized.enabledTargetIds.includes(AGENT_TARGET_IDS.PUMPHUB_SELL)) {
    normalized.enabledTargetIds = [...normalized.enabledTargetIds, AGENT_TARGET_IDS.PUMPHUB_SELL]
  }

  return normalized
}

app.post('/', async (c) => {
  try {
    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      return c.json({ error: 'OPENAI_API_KEY is missing on the server.' }, 500)
    }

    const body = await c.req.json().catch(() => ({}))
    const message = String(body.message || '').trim()
    const walletAddress = String(body.walletAddress || '').trim()
    const settings = body.settings && typeof body.settings === 'object' ? body.settings : {}
    const conversation = sanitizeConversation(body.conversation)

    if (!message) {
      return c.json({ error: 'Message is required.' }, 400)
    }

    const memorySnapshot = await getAgentMemorySnapshot(walletAddress)
    const model = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1-mini'

    const response = await fetch('https://api.openai.com/v1/responses', {
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
                  'You are BaseHub Burner Agent speaking directly to the user inside a setup chat. Do not sound templated, robotic, or generic. Read the user message carefully and respond like a thoughtful agent that actually understood the request. Be concise, natural, specific, and reply in the same language as the user unless they clearly ask otherwise. You are helping the user shape the mission for the burner wallet. Current live burner-safe actions are GM, GN, Coin Flip, Lucky Number, Dice Roll, PumpHub tiny buys, PumpHub tiny sells, and free NFT mints from BaseHub NFT Launchpad. Important behavior: when the user gives a clear instruction, directly apply it by updating the suggested settings and reply as if the change has already been made. Do not ask for confirmation, approval, or permission again. Only ask a follow-up question if the request is genuinely ambiguous. The agent must self-discover PumpHub trade targets and free NFT mint targets inside BaseHub; never rely on the user to provide token or NFT addresses. Default stance: keep the full live BaseHub action set available, let the planner discover live opportunities, and only narrow the action mix when the user explicitly asks. PumpHub trading should always use discovery mode. If the user asks for free NFT mints, enable freeMintEnabled and the free NFT target. Keep the reply short and operational. Return structured JSON only.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  message,
                  settings,
                  memorySnapshot,
                  capabilityKnowledge: getBaseHubKnowledgeSummary(),
                  recentConversation: buildConversationText(conversation),
                }),
              },
            ],
          },
        ],
        max_output_tokens: 400,
        text: {
          format: {
            type: 'json_schema',
            name: 'agent_chat_reply',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                reply: { type: 'string' },
                distilledPrompt: { type: 'string' },
                suggestedSettings: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    dailyTxTarget: { type: 'integer' },
                    maxDailySpendEth: { type: 'string' },
                    intervalMinutes: { type: 'integer' },
                    pumpHubTradeMode: { type: 'string', enum: ['single', 'watchlist', 'latest'] },
                    pumpHubTokenAddress: { type: 'string' },
                    pumpHubWatchlist: { type: 'array', items: { type: 'string' } },
                    pumpHubTradeAmountEth: { type: 'string' },
                    freeMintEnabled: { type: 'boolean' },
                    enabledTargetIds: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: Object.values(AGENT_TARGET_IDS),
                      },
                    },
                  },
                  required: ['dailyTxTarget', 'maxDailySpendEth', 'intervalMinutes', 'pumpHubTradeMode', 'pumpHubTokenAddress', 'pumpHubWatchlist', 'pumpHubTradeAmountEth', 'freeMintEnabled', 'enabledTargetIds'],
                },
              },
              required: ['reply', 'distilledPrompt', 'suggestedSettings'],
            },
          },
        },
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return c.json(
        {
          error:
            payload.error?.message ||
            payload.message ||
            `OpenAI request failed with HTTP ${response.status}`,
        },
        500
      )
    }

    const text = extractOutputText(payload).trim()
    const parsed = JSON.parse(text || '{}')
    const reply = String(parsed.reply || '').trim()
    const distilledPrompt = String(parsed.distilledPrompt || message).trim()
    const suggestedSettings = normalizeSuggestedSettings(parsed.suggestedSettings, settings)

    if (walletAddress && reply) {
      try {
        await insertAgentMemory({
          walletAddress,
          memoryType: 'chat',
          title: 'Agent chat',
          body: `User: ${message}\n\nAgent: ${reply}`,
          meta: { distilledPrompt, suggestedSettings },
        })
      } catch (memoryError) {
        console.warn('[agent-chat] Memory write skipped:', memoryError?.message || memoryError)
      }
    }

    return c.json({
      reply,
      distilledPrompt,
      suggestedSettings,
      model,
    })
  } catch (error) {
    return c.json({ error: error.message || 'Agent chat failed.' }, 500)
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
    res.end(JSON.stringify({ error: error.message || 'Agent chat failed.' }))
  }
}
