import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Copy, ExternalLink, Play, Power, RefreshCw, Send, Trash2, Zap, Clock, Target, MessageSquare, Activity, ChevronRight, Shield, Sparkles } from 'lucide-react'
import { formatEther, parseEther } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'
import { wrapFetchWithPayment } from 'x402-fetch'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import { NETWORKS } from '../config/networks'
import { isAgentX402PurchaseSkipped } from '../config/features'
import { isInFarcaster } from '../config/rainbowkit'
import { supabase } from '../config/supabase'
import { getEnabledTargets } from '../features/agent-mode/agentCatalog'
import {
  AGENT_GAS_BUFFER_WEI,
  AGENT_INPUT_MODES,
  AGENT_PUMPHUB_MODES,
  AGENT_STATUSES,
  AGENT_TARGETS,
} from '../features/agent-mode/agentConstants'
import {
  connectBaseAccountDirect,
  createDelegatedSubAccount,
  executeCloudAgentAction,
  fetchCloudAgentRun,
  fetchCloudAgentSession,
  getCloudAgentSpenderAddress,
  loadCloudAgentState,
  registerCloudAgentSession,
  requestNativeSpendPermission,
  saveCloudAgentState,
  startCloudAgentRun,
  stopCloudAgentRun,
} from '../features/agent-mode/agentCloud'
import { normalizeAgentError } from '../features/agent-mode/agentErrors'
import { createAgentLlmPlan } from '../features/agent-mode/agentLlmPlanner'
import { fetchAgentMemory, writeAgentMemoryEvent } from '../features/agent-mode/agentMemoryClient'
import { createAgentPlan } from '../features/agent-mode/agentPlanner'
import { evaluateAgentAction } from '../features/agent-mode/agentPolicy'
import {
  approveQueuedAction,
  approveCurrentPlan,
  appendLog,
  appendPlan,
  buildDailyReport,
  clearAgentLogs,
  consumeNextPlannedAction,
  getNextPlannedAction,
  loadAgentState,
  resetAgentPlan,
  setAgentStatus,
  updateAgentState,
  updateQueuedAction,
  updateAgentSettings,
} from '../features/agent-mode/agentStore'
import { getBurnerBalance } from '../features/agent-mode/agentWallet'
import { calculateTokens, calcLevel, getXP, notifyXPRefresh, recordSwapTransaction, recordTransaction } from '../utils/xpUtils'

/* ─── Helpers (unchanged logic) ─── */

function formatStatus(status) {
  if (status === AGENT_STATUSES.ACTIVE) return 'Active'
  if (status === AGENT_STATUSES.PAUSED) return 'Paused'
  return 'Disabled'
}

function formatEth(value, digits = 5) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0 ETH'
  return `${numeric.toFixed(digits)} ETH`
}

function formatShortAddress(address) {
  const value = String(address || '').trim()
  if (!value) return ''
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function createFormFromState(state) {
  return {
    plannerInputMode: AGENT_INPUT_MODES.PROMPT,
    userPrompt: state.settings.userPrompt,
    dailyTxTarget: state.settings.dailyTxTarget,
    maxDailySpendEth: state.settings.maxDailySpendEth,
    allowedActionTypes: state.settings.allowedActionTypes,
    enabledTargetIds: state.settings.enabledTargetIds,
    llmEnabled: state.settings.llmEnabled,
    autoRunEnabled: state.settings.autoRunEnabled,
    intervalMinutes: state.settings.intervalMinutes,
    pumpHubTradeMode: state.settings.pumpHubTradeMode,
    pumpHubTokenAddress: state.settings.pumpHubTokenAddress,
    pumpHubWatchlist: state.settings.pumpHubWatchlist,
    pumpHubTradeAmountEth: state.settings.pumpHubTradeAmountEth,
    swapHubTradeAmountEth: state.settings.swapHubTradeAmountEth,
    freeMintEnabled: state.settings.freeMintEnabled,
  }
}

function buildSettingsFromForm(nextForm) {
  const dailyTxTarget = Math.max(1, Number(nextForm.dailyTxTarget || 1))
  const maxDailySpendEth = String(nextForm.maxDailySpendEth || '0.001')

  return {
    plannerInputMode: nextForm.plannerInputMode,
    dailyTxTarget,
    maxDailySpendEth,
    allowedActionTypes: nextForm.allowedActionTypes,
    enabledTargetIds: nextForm.enabledTargetIds,
    llmEnabled: !!nextForm.llmEnabled,
    objective: buildAutoObjective({
      plannerInputMode: nextForm.plannerInputMode,
      userPrompt: nextForm.userPrompt,
      dailyTxTarget,
      maxDailySpendEth,
      enabledTargetIds: nextForm.enabledTargetIds,
    }).slice(0, 280),
    userPrompt: String(nextForm.userPrompt || '').slice(0, 1200),
    autoRunEnabled: !!nextForm.autoRunEnabled,
    intervalMinutes: Math.max(1, Number(nextForm.intervalMinutes || 1)),
    pumpHubTradeMode: String(nextForm.pumpHubTradeMode || AGENT_PUMPHUB_MODES.SINGLE),
    pumpHubTokenAddress: String(nextForm.pumpHubTokenAddress || '').trim(),
    pumpHubWatchlist: Array.isArray(nextForm.pumpHubWatchlist) ? nextForm.pumpHubWatchlist : [],
    pumpHubTradeAmountEth: String(nextForm.pumpHubTradeAmountEth || '0.0001'),
    swapHubTradeAmountEth: String(nextForm.swapHubTradeAmountEth || '0.00008'),
    freeMintEnabled: !!nextForm.freeMintEnabled,
  }
}

function describeActionPayload(action) {
  if (!action?.payload) return ''
  if (action.payload.message) return action.payload.message
  if (action.payload.flipSide) return `Flip: ${action.payload.flipSide}`
  if (action.payload.luckyGuess) return `Lucky guess: ${action.payload.luckyGuess}`
  if (action.payload.diceGuess) return `Dice guess: ${action.payload.diceGuess}`
  if (action.payload.pumpHubTokenAddress) return `PumpHub: ${action.payload.pumpHubTokenAddress}`
  if (action.payload.tokenOutAddress) return `SwapHub: ${action.payload.tokenOutSymbol || action.payload.tokenOutAddress}`
  if (action.payload.contractAddress) return `NFT: ${action.payload.contractAddress}`
  if (action.payload.name || action.payload.symbol) {
    return [action.payload.name, action.payload.symbol].filter(Boolean).join(' · ')
  }
  return ''
}

function compactSummary(summary) {
  const text = String(summary || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.toLowerCase().includes('exceeds the balance')) return 'Low balance.'
  if (text.toLowerCase().includes('insufficient funds')) return 'Low balance.'
  if (text.toLowerCase().includes('gas fee')) return 'Network fee issue.'
  if (text.toLowerCase().includes('auto-run is paused')) return 'Routine paused.'
  if (text.length <= 120) return text
  return `${text.slice(0, 117)}...`
}

function formatNumber(value) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return numeric.toLocaleString()
}

const AGENT_TX_GAME_TYPES = {
  'gm-game': 'GM_GAME',
  'gn-game': 'GN_GAME',
  'flip-game': 'FLIP_GAME',
  'lucky-number': 'LUCKY_NUMBER',
  'dice-roll': 'DICE_ROLL',
  'pumphub-buy': 'PUMPHUB_BUY',
  'pumphub-sell': 'PUMPHUB_SELL',
  'swaphub-swap': 'SWAPHUB_SWAP',
  'free-nft-mint': 'NFT_MINT',
  'deploy-token': 'DEPLOY_TOKEN',
  'deploy-erc721': 'DEPLOY_ERC721',
  'deploy-erc1155': 'DEPLOY_ERC1155',
}

function getAgentGameType(action) {
  return AGENT_TX_GAME_TYPES[action?.targetId] || String(action?.targetId || 'AGENT_ACTION').toUpperCase()
}

function getAgentBaseXp(action) {
  if (action?.targetId === 'gm-game' || action?.targetId === 'gn-game') return 150
  if (['flip-game', 'lucky-number', 'dice-roll'].includes(action?.targetId)) return 150
  return 30
}

function getAgentAwardGameType(action) {
  if (['gm-game', 'gn-game', 'flip-game', 'lucky-number', 'dice-roll'].includes(action?.targetId)) {
    return getAgentGameType(action)
  }
  return 'CONTRACT_GAME'
}

function estimateUsdFromEthAmount(ethAmount) {
  const eth = Number(ethAmount || 0)
  if (!Number.isFinite(eth) || eth <= 0) return 0
  return Number((eth * 3300).toFixed(2))
}

function describePlannerFallback(error) {
  const rawMessage = String(error?.message || '').trim()
  const message = rawMessage.toLowerCase()
  if (!message) return 'AI planner is temporarily unavailable. Backup plan was created instead.'
  if (message.includes('openai_api_key') || message.includes('api key')) {
    return 'OpenAI key is missing on the server. Backup plan was created instead.'
  }
  if (
    message.includes('econnrefused') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('network')
  ) {
    return 'AI route is unreachable right now. Backup plan was created instead.'
  }
  if (message.includes('http 404')) {
    return 'AI route was not found. Backup plan was created instead.'
  }
  if (message.includes('http 429') || message.includes('rate limit')) {
    return 'OpenAI rate limit reached. Backup plan was created instead.'
  }
  if (
    message.includes('parse') ||
    message.includes('json') ||
    message.includes('schema') ||
    message.includes('serialize') ||
    message.includes('unexpected end')
  ) {
    return 'AI planner returned an unreadable response. Backup plan was created instead.'
  }
  if (
    message.includes('http 500') ||
    message.includes('http 502') ||
    message.includes('http 503') ||
    message.includes('http 504') ||
    message.includes('server error')
  ) {
    return 'AI planner server error. Backup plan was created instead.'
  }
  if (message.includes('openai')) {
    return 'OpenAI request failed. Backup plan was created instead.'
  }
  return `AI planner failed: ${rawMessage}. Backup plan was created instead.`
}

function getMinimumBalanceWei(targets = [], settings = {}) {
  if (!targets.length) return AGENT_GAS_BUFFER_WEI
  const smallestSpend = targets.reduce((min, target) => {
    const spend =
      target.id === 'pumphub-buy'
        ? parseEther(String(settings.pumpHubTradeAmountEth || '0.0001'))
        : BigInt(target.estimatedSpendWei || '0')
    return spend < min ? spend : min
  }, targets[0].id === 'pumphub-buy' ? parseEther(String(settings.pumpHubTradeAmountEth || '0.0001')) : BigInt(targets[0].estimatedSpendWei || '0'))
  return smallestSpend + AGENT_GAS_BUFFER_WEI
}

function formatClock(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function buildTimeline(plan, intervalMinutes) {
  if (!plan?.actions?.length) return []
  const baseDate = new Date(plan.createdAt || Date.now())
  const rounded = new Date(baseDate)
  rounded.setSeconds(0, 0)
  if (rounded.getMinutes() % 5 !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (5 - (rounded.getMinutes() % 5)))
  }
  return plan.actions.map((action, index) => {
    const scheduledAt = new Date(rounded.getTime() + index * Math.max(1, Number(intervalMinutes || 1)) * 60 * 1000)
    return {
      ...action,
      slotLabel: index === 0 ? 'Next' : `Slot ${index + 1}`,
      timeLabel: formatClock(scheduledAt),
      scheduledAt,
    }
  })
}

function summarizePlan(actions = []) {
  if (!actions.length) return 'No actions queued yet.'

  const grouped = actions.reduce((acc, action) => {
    acc[action.title] = (acc[action.title] || 0) + 1
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([title, count]) => `${count}x ${title}`)
    .join(' · ')
}

function summarizeQueueHealth(plan) {
  const queue = Array.isArray(plan?.queue) ? plan.queue : []
  if (!queue.length) {
    return {
      tradeTarget: 'not found',
      freeMintTarget: 'not found',
      deployState: 'not planned',
    }
  }

  const queueHas = (actionType) => queue.some((item) => item.actionType === actionType)
  const queueWithParam = (actionType, key) =>
    queue.some((item) => item.actionType === actionType && String(item.params?.[key] || '').trim())

  const hasTradeAction = queueHas('pumphub-buy') || queueHas('pumphub-sell') || queueHas('swaphub-swap')
  const tradeTargetFound =
    queueWithParam('pumphub-buy', 'pumpHubTokenAddress') ||
    queueWithParam('pumphub-sell', 'pumpHubTokenAddress') ||
    queueWithParam('swaphub-swap', 'tokenOutAddress')

  const hasFreeMintAction = queueHas('free-nft-mint')
  const freeMintFound = queueWithParam('free-nft-mint', 'contractAddress')

  const hasDeployAction = queueHas('deploy-token') || queueHas('deploy-erc721') || queueHas('deploy-erc1155')
  const deployAwaitingApproval = queue.some(
    (item) =>
      ['deploy-token', 'deploy-erc721', 'deploy-erc1155'].includes(item.actionType) &&
      item.requiresApproval &&
      item.status === 'draft'
  )

  return {
    tradeTarget: hasTradeAction ? (tradeTargetFound ? 'found' : 'not found') : 'off',
    freeMintTarget: hasFreeMintAction ? (freeMintFound ? 'found' : 'not found') : 'off',
    deployState: hasDeployAction ? (deployAwaitingApproval ? 'waiting explicit approval' : 'queued') : 'not planned',
  }
}

function formatPlanAsSentence(actions = []) {
  if (!actions.length) return 'I have not locked in a routine yet.'

  const grouped = actions.reduce((acc, action) => {
    acc[action.title] = (acc[action.title] || 0) + 1
    return acc
  }, {})
  const parts = Object.entries(grouped).map(([title, count]) =>
    count === 1 ? title : `${count} ${title} actions`
  )

  if (parts.length === 1) return `I want to focus on ${parts[0]} for this stretch.`
  if (parts.length === 2) return `I am splitting this stretch between ${parts[0]} and ${parts[1]}.`
  return `I am keeping this stretch varied with ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`
}

function buildAutoObjective({ plannerInputMode, userPrompt, dailyTxTarget, maxDailySpendEth, enabledTargetIds }) {
  if (plannerInputMode === AGENT_INPUT_MODES.PROMPT && String(userPrompt || '').trim()) {
    const cleaned = String(userPrompt || '').replace(/\s+/g, ' ').trim()
    return cleaned.slice(0, 220)
  }
  const labels = AGENT_TARGETS.filter((target) => enabledTargetIds.includes(target.id)).map((target) => target.title)
  const focus = labels.length === 0 ? 'light BaseHub activity' : labels.slice(0, 3).join(', ')
  return `Keep this burner active with up to ${dailyTxTarget} thoughtful actions today, stay under ${maxDailySpendEth} ETH, and focus on ${focus}.`
}

function buildAutonomousPrompt(form) {
  const txTarget = Math.max(1, Number(form.dailyTxTarget || 1))
  const cap = String(form.maxDailySpendEth || '0.001')
  const interval = Math.max(1, Number(form.intervalMinutes || 1))

  const capabilities = []
  if (form.enabledTargetIds.includes('pumphub-buy') || form.enabledTargetIds.includes('pumphub-sell')) {
    capabilities.push('agent-discovered PumpHub micro trades')
  }
  if (form.freeMintEnabled) capabilities.push('free NFT mints')
  if (form.enabledTargetIds.includes('gm-game') || form.enabledTargetIds.includes('gn-game')) capabilities.push('light GM/GN social actions')
  if (
    form.enabledTargetIds.includes('flip-game') ||
    form.enabledTargetIds.includes('lucky-number') ||
    form.enabledTargetIds.includes('dice-roll')
  ) capabilities.push('light gameplay')

  const focus = capabilities.length ? capabilities.join(', ') : 'light BaseHub actions'
  return `Create an autonomous daily BaseHub plan for me. Keep it random but human-looking, stay within ${txTarget} actions, under ${cap} ETH, around every ${interval} minutes, and use ${focus}.`
}

const ROUTINE_INTENSITY_OPTIONS = [
  {
    id: 'light',
    label: 'Light',
    dailyTxTarget: 48,
    intervalMinutes: 15,
    summary: 'Low-noise daily activity',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    dailyTxTarget: 120,
    intervalMinutes: 8,
    summary: 'Steady mixed routine',
  },
  {
    id: 'active',
    label: 'Active',
    dailyTxTarget: 212,
    intervalMinutes: 4,
    summary: 'Full daily BaseHub presence',
  },
]

const ROUTINE_BUDGET_OPTIONS = [
  {
    id: 'cheap',
    label: 'Cheap',
    maxDailySpendEth: '0.001',
    summary: 'Keep spend tight',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    maxDailySpendEth: '0.0025',
    summary: 'Room for trade and mint',
  },
  {
    id: 'active',
    label: 'Active',
    maxDailySpendEth: '0.005',
    summary: 'Allows heavier action mix',
  },
]

const ROUTINE_GOAL_OPTIONS = [
  {
    id: 'social',
    label: 'GM / GN',
    summary: 'Daily social presence',
    targetIds: ['gm-game', 'gn-game'],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    summary: 'Coin Flip, Lucky Number, Dice',
    targetIds: ['flip-game', 'lucky-number', 'dice-roll'],
  },
  {
    id: 'trade',
    label: 'Token Trade',
    summary: 'Auto-discover PumpHub and SwapHub trades',
    targetIds: ['pumphub-buy', 'pumphub-sell', 'swaphub-swap'],
  },
  {
    id: 'freeMint',
    label: 'Free NFT Mint',
    summary: 'Auto-discover free launchpad mints',
    targetIds: ['free-nft-mint'],
  },
  {
    id: 'deploy',
    label: 'Deploy',
    summary: 'Include token/NFT deploy actions',
    targetIds: ['deploy-token', 'deploy-erc721', 'deploy-erc1155'],
  },
]

const ROUTINE_QUICK_STARTS = [
  {
    id: 'stay-active',
    label: 'Stay active',
    intensity: 'balanced',
    budget: 'cheap',
    goals: { social: true, gaming: true, trade: false, freeMint: false, deploy: false },
    prompt: 'Stay active on BaseHub with light social actions and casual gameplay. Keep it cheap and natural.',
  },
  {
    id: 'balanced-routine',
    label: 'Balanced routine',
    intensity: 'active',
    budget: 'balanced',
    goals: { social: true, gaming: true, trade: true, freeMint: true, deploy: false },
    prompt: 'Create a balanced BaseHub routine with trades, free mints, social actions, and gameplay mixed naturally.',
  },
  {
    id: 'aggressive-mode',
    label: 'Aggressive mode',
    intensity: 'active',
    budget: 'active',
    goals: { social: true, gaming: true, trade: true, freeMint: true, deploy: true },
    prompt: 'Build a high-activity BaseHub plan with varied actions across trade, mint, deploy, social, and games.',
  },
]

function deriveRoutineBuilderState(form) {
  const intensity =
    form.dailyTxTarget >= 200 ? 'active' : form.dailyTxTarget >= 100 ? 'balanced' : 'light'
  const budget =
    Number(form.maxDailySpendEth || 0) >= 0.005 ? 'active' : Number(form.maxDailySpendEth || 0) >= 0.0025 ? 'balanced' : 'cheap'

  const goals = {
    social: form.enabledTargetIds.includes('gm-game') || form.enabledTargetIds.includes('gn-game'),
    gaming:
      form.enabledTargetIds.includes('flip-game') ||
      form.enabledTargetIds.includes('lucky-number') ||
      form.enabledTargetIds.includes('dice-roll'),
    trade:
      form.enabledTargetIds.includes('pumphub-buy') ||
      form.enabledTargetIds.includes('pumphub-sell'),
    freeMint: !!form.freeMintEnabled,
    deploy:
      form.enabledTargetIds.includes('deploy-token') ||
      form.enabledTargetIds.includes('deploy-erc721') ||
      form.enabledTargetIds.includes('deploy-erc1155'),
  }

  return {
    intensity,
    budget,
    goals,
    dailyTxTarget: String(Math.max(1, Number(form.dailyTxTarget || 1))),
    intervalMinutes: String(Math.max(1, Number(form.intervalMinutes || 4))),
    maxDailySpendEth: String(form.maxDailySpendEth || '0.001'),
    customPrompt: String(form.userPrompt || ''),
  }
}

function sanitizeRoutineNumber(value, fallback, { integer = true, min = 1, max = Infinity } = {}) {
  const raw = String(value ?? '').replace(',', '.').trim()
  const numeric = Number(raw)
  const fallbackNumber = Number(fallback)
  const safeFallback = Number.isFinite(fallbackNumber) ? fallbackNumber : min
  const nextValue = Number.isFinite(numeric) ? numeric : safeFallback
  const bounded = Math.min(max, Math.max(min, nextValue))
  return integer ? Math.round(bounded) : bounded
}

function buildRoutineFormFromBuilder(routineBuilder, currentForm) {
  const selectedIntensity =
    ROUTINE_INTENSITY_OPTIONS.find((item) => item.id === routineBuilder.intensity) || ROUTINE_INTENSITY_OPTIONS[2]
  const selectedBudget =
    ROUTINE_BUDGET_OPTIONS.find((item) => item.id === routineBuilder.budget) || ROUTINE_BUDGET_OPTIONS[1]
  const enabledTargetIds = buildEnabledTargetIdsFromGoals(routineBuilder.goals)
  const dailyTxTarget = sanitizeRoutineNumber(routineBuilder.dailyTxTarget, selectedIntensity.dailyTxTarget, {
    integer: true,
    min: 1,
    max: 2000,
  })
  const intervalMinutes = sanitizeRoutineNumber(routineBuilder.intervalMinutes, selectedIntensity.intervalMinutes, {
    integer: true,
    min: 1,
    max: 240,
  })
  const maxDailySpendEth = String(
    sanitizeRoutineNumber(routineBuilder.maxDailySpendEth, selectedBudget.maxDailySpendEth, {
      integer: false,
      min: 0.0001,
      max: 1,
    })
  )
  const promptText = String(routineBuilder.customPrompt || '').trim() || buildRoutinePromptFromSelections({
    ...routineBuilder,
    dailyTxTarget,
    intervalMinutes,
    maxDailySpendEth,
  })

  return {
    nextForm: {
      ...currentForm,
      userPrompt: promptText,
      plannerInputMode: AGENT_INPUT_MODES.PROMPT,
      llmEnabled: true,
      allowedActionTypes: buildAllowedActionTypesFromGoals(routineBuilder.goals),
      dailyTxTarget,
      intervalMinutes,
      maxDailySpendEth,
      enabledTargetIds,
      freeMintEnabled: !!routineBuilder.goals.freeMint,
      pumpHubTradeMode: AGENT_PUMPHUB_MODES.LATEST,
    },
    normalizedBuilder: {
      ...routineBuilder,
      dailyTxTarget: String(dailyTxTarget),
      intervalMinutes: String(intervalMinutes),
      maxDailySpendEth,
      customPrompt: promptText,
    },
    enabledTargetIds,
  }
}

function buildEnabledTargetIdsFromGoals(goals) {
  const ids = ROUTINE_GOAL_OPTIONS.flatMap((goal) => (goals[goal.id] ? goal.targetIds : []))
  return Array.from(new Set(ids))
}

function buildAllowedActionTypesFromGoals(goals) {
  const typeByGoal = {
    social: 'simple',
    gaming: 'gaming',
    trade: 'trade',
    freeMint: 'nft',
    deploy: 'deploy',
  }

  return Object.entries(goals)
    .filter(([, enabled]) => enabled)
    .map(([goalId]) => typeByGoal[goalId])
    .filter(Boolean)
}

function buildRoutinePromptFromSelections({ intensity, budget, goals, dailyTxTarget, intervalMinutes, maxDailySpendEth }) {
  const intensityConfig = ROUTINE_INTENSITY_OPTIONS.find((item) => item.id === intensity) || ROUTINE_INTENSITY_OPTIONS[2]
  const budgetConfig = ROUTINE_BUDGET_OPTIONS.find((item) => item.id === budget) || ROUTINE_BUDGET_OPTIONS[1]
  const txTarget = Math.max(1, Number(dailyTxTarget || intensityConfig.dailyTxTarget || 1))
  const minutes = Math.max(1, Number(intervalMinutes || intensityConfig.intervalMinutes || 4))
  const spendCap = String(maxDailySpendEth || budgetConfig.maxDailySpendEth)
  const selectedGoals = ROUTINE_GOAL_OPTIONS.filter((goal) => goals[goal.id]).map((goal) => goal.label.toLowerCase())
  const goalText = selectedGoals.length ? selectedGoals.join(', ') : 'light BaseHub activity'

  return `Create a full BaseHub daily routine for me. Keep it human-looking and varied. Plan around ${txTarget} actions, about every ${minutes} minutes, stay under ${spendCap} ETH, and include ${goalText}. Discover trade tokens and free NFT targets yourself inside BaseHub.`
}

function buildAgentBrief(plan, plannedCount, planSentence) {
  if (plan?.thoughtSummary) return plan.thoughtSummary
  if (plannedCount > 0) {
    return `${planSentence} I am keeping this as the current block so I can adapt the next one later instead of forcing the entire day up front.`
  }
  return 'I have not written today plan yet. Ask me to plan and I will explain what I want to do and why.'
}

function createInitialChatMessages(userPrompt = '') {
  const messages = [
    {
      id: 'intro',
      role: 'agent',
      text: 'Tell me what kind of BaseHub routine you want. I will turn it into rules and a daily plan.',
    },
  ]

  const lines = String(userPrompt || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)

  lines.forEach((line, index) => {
    messages.push({
      id: `saved_user_${index}`,
      role: 'user',
      text: line,
    })
  })

  return messages
}

function getStartGate({ cloudReady = false, cloudExecutionReady = false, cloudExecutionIssue = '' }) {
  if (cloudReady) {
    if (cloudExecutionReady) return { ok: true }
    return {
      ok: false,
      reason:
        cloudExecutionIssue ||
        'Cloud permission is saved, but the automatic executor is not ready yet.',
    }
  }

  if (!cloudReady) return { ok: false, reason: 'Set up Cloud Agent first.' }

  return { ok: true }
}

function getCloudExecutionIssue(cloudState) {
  const status = String(cloudState?.status || '')
  const account = cloudState?.accountAddress || cloudState?.universalAddress || cloudState?.subAccount?.address
  if (!account || !['cloud_ready', 'permission_ready'].includes(status)) return ''

  if (cloudState?.accountMode !== 'delegated_sub_account') {
    return 'Full auto needs delegated agent-wallet permission.'
  }

  if (cloudState?.signerModel === 'per_user_agent_signer' || cloudState?.agentSignerAddress) {
    return 'Cloud Agent was set up with the old per-user sender model. Run Update permission once to switch back to the shared sender.'
  }

  if (cloudState?.workerOwnsSubAccount === false) {
    return 'This saved agent wallet belongs to an older sender. Run Update permission once to create a shared-sender compatible agent wallet.'
  }

  if (cloudState?.executionMode !== 'worker_ready' || cloudState?.permissionModel !== 'delegated_worker') {
    return 'Cloud permission is connected, but automatic execution still needs delegated worker permission.'
  }

  return ''
}

function buildCloudStateFromSession(session, fallback = {}) {
  if (!session) return fallback || null
  return {
    ...(fallback || {}),
    status: session.status === 'ready' ? 'cloud_ready' : session.status,
    sessionId: session.id,
    universalAddress: session.owner_address,
    accountMode: session.policy?.accountMode || fallback?.accountMode || 'direct_base_account',
    accountAddress: session.owner_address,
    subAccount: session.sub_account_address && session.sub_account_address !== session.owner_address
      ? { ...(session.policy?.subAccount || {}), ...(fallback?.subAccount || {}), address: session.sub_account_address }
      : null,
    allowanceEth: session.allowance_eth,
    periodInDays: session.period_days,
    spendPermission: session.spend_permission || fallback?.spendPermission,
    executionMode: session.policy?.executionMode || fallback?.executionMode,
    permissionModel: session.policy?.permissionModel || fallback?.permissionModel,
    automationOwner: session.policy?.automationOwner || session.policy?.workerAddress || fallback?.automationOwner,
    workerAddress: session.policy?.workerAddress || session.policy?.spenderAddress || fallback?.workerAddress,
    signerModel: session.policy?.signerModel || fallback?.signerModel || 'shared_worker_signer',
    agentSignerAddress: session.policy?.agentSignerAddress || null,
    workerOwnsSubAccount: typeof session.worker_owns_sub_account === 'boolean' ? session.worker_owns_sub_account : null,
    automationBlocked: session.policy?.automationBlocked || fallback?.automationBlocked,
    registeredAt: session.updated_at || session.created_at,
  }
}

function canReuseCloudSession(session, workerAddress) {
  if (!session?.sub_account_address) return false
  const policy = session.policy || {}
  if (policy.signerModel === 'per_user_agent_signer' || policy.agentSignerAddress) return false
  if (session.worker_owns_sub_account === false) return false
  const policyWorker = String(policy.workerAddress || policy.automationOwner || policy.spenderAddress || '').toLowerCase()
  if (policyWorker && policyWorker !== String(workerAddress || '').toLowerCase()) return false
  return true
}

/* ─── CSS-in-JS Keyframes injection ─── */
const STYLE_ID = 'agent-mode-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes agentPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes agentGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.15); }
      50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.35); }
    }
    @keyframes agentFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes agentSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes agentDot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    @keyframes statusPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}

/* ─── Component ─── */

export default function AgentMode() {
  const { address: paymentWalletAddress, isConnected: isPaymentWalletConnected } = useAccount()
  const { data: paymentWalletClient } = useWalletClient()
  const [agentState, setAgentState] = useState(() => loadAgentState())
  const [form, setForm] = useState(() => createFormFromState(loadAgentState()))
  const [error, setError] = useState(null)
  const [plannerMode, setPlannerMode] = useState('idle')
  const [planFeedback, setPlanFeedback] = useState('')
  const [plannerIssue, setPlannerIssue] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)
  const [isChatting, setIsChatting] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatMessages, setChatMessages] = useState(() =>
    createInitialChatMessages(loadAgentState().settings?.userPrompt)
  )
  const [routineBuilder, setRoutineBuilder] = useState(() =>
    deriveRoutineBuilderState(createFormFromState(loadAgentState()))
  )
  const [balance, setBalance] = useState({ raw: 0n, formatted: '0' })
  const [agentXp, setAgentXp] = useState({ value: 0, loading: false, error: '' })
  const [memorySnapshot, setMemorySnapshot] = useState({
    profile: null,
    memories: [],
    runs: [],
    reflections: [],
    available: false,
    setupError: null,
  })
  const [cloudAgentState, setCloudAgentState] = useState(() => loadCloudAgentState())
  const [cloudRun, setCloudRun] = useState(null)
  const [cloudAgentBusy, setCloudAgentBusy] = useState(false)
  const [cloudAgentMessage, setCloudAgentMessage] = useState('')
  const [agentAccess, setAgentAccess] = useState({
    loading: true,
    hasAccess: false,
    isPassHolder: false,
    priceUsdc: '15',
    setupError: null,
  })
  const [agentAccessBusy, setAgentAccessBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [isMobileRuntime, setIsMobileRuntime] = useState(false)
  const [openSections, setOpenSections] = useState(() => {
    const _initState = loadAgentState()
    const _hasPlan = !!(_initState.currentPlan?.actions?.length || _initState.plans?.[0]?.actions?.length)
    return { routine: !_hasPlan, queue: _hasPlan, activity: false, wallet: false }
  })
  const executionLockRef = useRef(false)
  const chatEndRef = useRef(null)
  const cloudAccountAddress = cloudAgentState?.accountAddress || cloudAgentState?.universalAddress || cloudAgentState?.subAccount?.address || ''
  const cloudDelegatedAddress = cloudAgentState?.subAccount?.address || cloudAgentState?.subAccountAddress || ''
  const cloudExecutionAddress = cloudDelegatedAddress || cloudAccountAddress
  const plannerWalletAddress = cloudExecutionAddress || cloudAccountAddress || ''
  const isFarcasterRuntime = typeof window !== 'undefined' && isInFarcaster()
  const isAgentModeUnsupportedRuntime = isFarcasterRuntime || isMobileRuntime

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const detectMobileRuntime = () => {
      const ua = window.navigator?.userAgent || ''
      const touchMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
      setIsMobileRuntime(Boolean(mobileQuery.matches || touchMobile))
    }

    detectMobileRuntime()
    mobileQuery.addEventListener?.('change', detectMobileRuntime)
    return () => mobileQuery.removeEventListener?.('change', detectMobileRuntime)
  }, [])

  const reloadState = useCallback(() => {
    const next = loadAgentState()
    setAgentState(next)
    setForm(createFormFromState(next))
  }, [])

  const syncCloudRunState = useCallback((run) => {
    if (!run || typeof run !== 'object') return
    setCloudRun(run)

    const hasPlan = run.current_plan && typeof run.current_plan === 'object'
    const hasLogs = Array.isArray(run.logs)
    const runStatus = String(run.status || '')
    const fundingPaused = ['paused_funding', 'failed_balance'].includes(runStatus)
    if (hasPlan || hasLogs) {
      const nextState = updateAgentState((current) => ({
        ...current,
        status: ['active', 'executing'].includes(runStatus)
          ? AGENT_STATUSES.ACTIVE
          : runStatus === 'paused' || fundingPaused
            ? AGENT_STATUSES.PAUSED
            : ['stopped', 'cancelled', 'replaced', 'completed', 'failed'].includes(runStatus) && current.status === AGENT_STATUSES.ACTIVE
              ? AGENT_STATUSES.DISABLED
              : current.status,
        currentPlan: hasPlan ? run.current_plan : current.currentPlan,
        logs: hasLogs ? run.logs : current.logs,
      }))
      setAgentState(nextState)
      setForm(createFormFromState(nextState))
    }
    if (fundingPaused) {
      setError(run.last_error || 'Balance low, add ETH to continue.')
    }
  }, [])

  useEffect(() => {
    reloadState()
  }, [reloadState])

  useEffect(() => {
    const current = loadAgentState()
    if (current.settings.plannerInputMode !== AGENT_INPUT_MODES.PROMPT) {
      updateAgentSettings({ plannerInputMode: AGENT_INPUT_MODES.PROMPT })
      reloadState()
    }
  }, [reloadState])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'basehub_burner_agent_v3') reloadState()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [reloadState])

  useEffect(() => {
    let cancelled = false

    async function refreshBalance() {
      if (!cloudExecutionAddress) {
        setBalance({ raw: 0n, formatted: '0' })
        return
      }

      try {
        const nextBalance = await getBurnerBalance(cloudExecutionAddress)
        if (!cancelled) setBalance(nextBalance)
      } catch (balanceError) {
        if (!cancelled) {
          const normalized = normalizeAgentError(balanceError)
          setError(normalized.shortMessage)
        }
      }
    }

    refreshBalance()
    const intervalId = window.setInterval(refreshBalance, 15000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [cloudExecutionAddress])

  useEffect(() => {
    let cancelled = false

    async function refreshAgentXp() {
      if (!cloudExecutionAddress) {
        setAgentXp({ value: 0, loading: false, error: '' })
        return
      }

      setAgentXp((current) => ({ ...current, loading: true, error: '' }))
      try {
        const xp = await getXP(cloudExecutionAddress)
        if (!cancelled) setAgentXp({ value: Number(xp || 0), loading: false, error: '' })
      } catch (xpError) {
        if (!cancelled) {
          setAgentXp((current) => ({
            ...current,
            loading: false,
            error: xpError?.message || 'Agent XP could not be loaded.',
          }))
        }
      }
    }

    refreshAgentXp()
    const intervalId = window.setInterval(refreshAgentXp, 12000)
    window.addEventListener('basehub_xp_refresh', refreshAgentXp)
    window.addEventListener('storage', refreshAgentXp)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('basehub_xp_refresh', refreshAgentXp)
      window.removeEventListener('storage', refreshAgentXp)
    }
  }, [cloudExecutionAddress])

  useEffect(() => {
    let cancelled = false

    async function loadMemory() {
      if (!plannerWalletAddress) {
        setMemorySnapshot({ profile: null, memories: [], runs: [], reflections: [], available: false, setupError: null })
        return
      }
      const snapshot = await fetchAgentMemory(plannerWalletAddress)
      if (!cancelled) setMemorySnapshot(snapshot)
    }

    loadMemory()
    return () => {
      cancelled = true
    }
  }, [plannerWalletAddress, agentState.logs.length, agentState.currentPlan?.id])

  useEffect(() => {
    let cancelled = false

    async function loadCloudSession() {
      const localCloud = loadCloudAgentState()
      setCloudAgentState(localCloud)
      const ownerAddress = localCloud?.universalAddress || localCloud?.accountAddress
      if (!ownerAddress) return
      try {
        const session = await fetchCloudAgentSession(ownerAddress)
        if (!cancelled && session) {
          setCloudAgentState(buildCloudStateFromSession(session, loadCloudAgentState() || localCloud || {}))
        }
      } catch (cloudError) {
        if (!cancelled) {
          console.warn('[Cloud Agent] session load failed:', cloudError?.message || cloudError)
        }
      }
    }

    loadCloudSession()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshAgentAccess = useCallback(async () => {
    if (isAgentX402PurchaseSkipped()) {
      setAgentAccess({
        loading: false,
        hasAccess: true,
        isPassHolder: false,
        priceUsdc: '0',
        setupError: null,
      })
      return
    }

    if (!paymentWalletAddress) {
      setAgentAccess({
        loading: false,
        hasAccess: false,
        isPassHolder: false,
        priceUsdc: '15',
        setupError: null,
      })
      return
    }

    setAgentAccess((current) => ({ ...current, loading: true, setupError: null }))
    try {
      const response = await fetch(`/api/agent-access?walletAddress=${encodeURIComponent(paymentWalletAddress)}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Agent access check failed.')
      setAgentAccess({
        loading: false,
        hasAccess: !!data.hasAccess,
        isPassHolder: !!data.isPassHolder,
        priceUsdc: String(data.priceUsdc || '15'),
        setupError: data.setupError || null,
      })
    } catch (accessError) {
      setAgentAccess((current) => ({
        ...current,
        loading: false,
        hasAccess: false,
        setupError: accessError?.message || 'Agent access check failed.',
      }))
    }
  }, [paymentWalletAddress])

  useEffect(() => {
    refreshAgentAccess()
  }, [refreshAgentAccess])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isChatting])

  const dailyReport = useMemo(() => buildDailyReport(agentState), [agentState])
  const enabledTargets = useMemo(() => getEnabledTargets(agentState.settings), [agentState.settings])
  const latestPlan = agentState.currentPlan || agentState.plans[0] || null
  const nextAction = useMemo(() => getNextPlannedAction(agentState), [agentState])
  const timeline = useMemo(
    () => buildTimeline(latestPlan, agentState.settings.intervalMinutes),
    [agentState.settings.intervalMinutes, latestPlan]
  )
  const planSummary = useMemo(() => summarizePlan(latestPlan?.actions || []), [latestPlan])
  const planSentence = useMemo(() => formatPlanAsSentence(latestPlan?.actions || []), [latestPlan])
  const isAgentActive = agentState.status === AGENT_STATUSES.ACTIVE
  const isCloudAgentReady = Boolean(
    cloudAccountAddress &&
    ['cloud_ready', 'permission_ready'].includes(String(cloudAgentState?.status || ''))
  )
  const cloudExecutionIssue = useMemo(() => getCloudExecutionIssue(cloudAgentState), [cloudAgentState])
  const isCloudExecutionReady = Boolean(isCloudAgentReady && !cloudExecutionIssue)
  const startGate = useMemo(
    () => getStartGate({
      cloudReady: isCloudAgentReady,
      cloudExecutionReady: isCloudExecutionReady,
      cloudExecutionIssue,
    }),
    [isCloudAgentReady, isCloudExecutionReady, cloudExecutionIssue]
  )
  const hasPlan = Boolean(latestPlan?.actions?.length)
  const isPlanApproved = Boolean(latestPlan?.approvedAt)
  const canStartApprovedPlan = Boolean(hasPlan && isPlanApproved && !isPlanning && !isAgentActive)
  const autoObjective = useMemo(
    () =>
      buildAutoObjective({
        plannerInputMode: form.plannerInputMode,
        userPrompt: form.userPrompt,
        dailyTxTarget: form.dailyTxTarget,
        maxDailySpendEth: form.maxDailySpendEth,
        enabledTargetIds: form.enabledTargetIds,
      }),
    [form.dailyTxTarget, form.enabledTargetIds, form.maxDailySpendEth, form.plannerInputMode, form.userPrompt]
  )
  const plannedCount = Number(latestPlan?.actions?.length || 0)
  const planSentenceText = useMemo(() => formatPlanAsSentence(latestPlan?.actions || []), [latestPlan])
  const agentBrief = useMemo(
    () => buildAgentBrief(latestPlan, plannedCount, planSentenceText),
    [latestPlan, plannedCount, planSentenceText]
  )
  const queueHealth = useMemo(() => summarizeQueueHealth(latestPlan), [latestPlan])
  const isAgentAccessUnlocked = isAgentX402PurchaseSkipped() || agentAccess.hasAccess
  const agentAccessPriceLabel = `${agentAccess.priceUsdc} USDC`
  const startGateWithAccess = useMemo(
    () => (isAgentAccessUnlocked ? startGate : { ok: false, reason: 'Unlock Agent Mode first.' }),
    [isAgentAccessUnlocked, startGate]
  )

  useEffect(() => {
    if (!isCloudAgentReady) return undefined
    const ownerAddress = cloudAgentState?.accountAddress || cloudAgentState?.universalAddress || paymentWalletAddress
    if (!ownerAddress) return undefined

    let cancelled = false
    const pollCloudRun = async () => {
      try {
        const run = await fetchCloudAgentRun(ownerAddress)
        if (cancelled || !run) return
        const runIsLive = ['active', 'executing', 'paused', 'paused_funding', 'failed_balance'].includes(String(run.status || ''))
        const runBelongsToCurrentView = cloudRun?.id && Number(cloudRun.id) === Number(run.id)
        const localIsRunning = agentState.status === AGENT_STATUSES.ACTIVE
        if (runIsLive || runBelongsToCurrentView || localIsRunning) {
          syncCloudRunState(run)
          if (!['paused_funding', 'failed_balance'].includes(String(run.status || ''))) setError(null)
        }
      } catch (cloudRunError) {
        if (!cancelled && agentState.status === AGENT_STATUSES.ACTIVE) {
          console.warn('[Cloud Agent] run sync failed:', cloudRunError?.message || cloudRunError)
        }
      }
    }

    pollCloudRun()
    const intervalId = window.setInterval(pollCloudRun, 10000)
    window.addEventListener('focus', pollCloudRun)
    window.addEventListener('visibilitychange', pollCloudRun)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', pollCloudRun)
      window.removeEventListener('visibilitychange', pollCloudRun)
    }
  }, [
    agentState.status,
    cloudAgentState?.accountAddress,
    cloudAgentState?.universalAddress,
    cloudRun?.id,
    isCloudAgentReady,
    paymentWalletAddress,
    syncCloudRunState,
  ])

  const activeTargetTitles = useMemo(
    () =>
      AGENT_TARGETS.filter(
        (target) =>
          form.enabledTargetIds.includes(target.id) &&
          (
            (target.id !== 'pumphub-buy' && target.id !== 'pumphub-sell') ||
            String(form.pumpHubTokenAddress || '').trim() ||
            (Array.isArray(form.pumpHubWatchlist) && form.pumpHubWatchlist.length > 0) ||
            form.pumpHubTradeMode === AGENT_PUMPHUB_MODES.LATEST
          ) &&
          (target.id !== 'free-nft-mint' || form.freeMintEnabled)
      )
        .map((target) => target.title),
    [form.enabledTargetIds, form.freeMintEnabled, form.pumpHubTokenAddress, form.pumpHubTradeMode, form.pumpHubWatchlist]
  )

  const syncSettings = useCallback(
    (nextForm) => {
      const nextState = updateAgentSettings(buildSettingsFromForm(nextForm))
      reloadState()
      return nextState
    },
    [reloadState]
  )

  const patchForm = useCallback(
    (patch) => {
      setForm((current) => {
        const next = { ...current, ...patch }
        syncSettings(next)
        return next
      })
    },
    [syncSettings]
  )

  const patchRoutineBuilder = useCallback(
    (patch) => {
      setRoutineBuilder((current) => {
        return { ...current, ...patch }
      })
    },
    []
  )

  const toggleRoutineGoal = useCallback((goalId) => {
    setRoutineBuilder((current) => ({
      ...current,
      goals: {
        ...current.goals,
        [goalId]: !current.goals[goalId],
      },
    }))
  }, [])

  const applyQuickStart = useCallback((preset) => {
    const intensityConfig = ROUTINE_INTENSITY_OPTIONS.find((item) => item.id === preset.intensity) || ROUTINE_INTENSITY_OPTIONS[1]
    const budgetConfig = ROUTINE_BUDGET_OPTIONS.find((item) => item.id === preset.budget) || ROUTINE_BUDGET_OPTIONS[1]
    setRoutineBuilder({
      intensity: preset.intensity,
      budget: preset.budget,
      goals: { ...preset.goals },
      dailyTxTarget: String(intensityConfig.dailyTxTarget),
      intervalMinutes: String(intensityConfig.intervalMinutes),
      maxDailySpendEth: budgetConfig.maxDailySpendEth,
      customPrompt: preset.prompt,
    })
    setPlanFeedback('Template selected. Save settings to apply it.')
  }, [])

  const handleSaveRoutineSettings = useCallback(() => {
    const { nextForm, normalizedBuilder, enabledTargetIds } = buildRoutineFormFromBuilder(routineBuilder, form)
    if (enabledTargetIds.length === 0) {
      setError('Select at least one activity first.')
      return null
    }
    setError(null)
    setPlannerIssue('')
    setRoutineBuilder(normalizedBuilder)
    setForm(nextForm)
    const syncedState = syncSettings(nextForm)
    setPlanFeedback('Routine settings saved. Generate a plan when you are ready.')
    return { nextForm, syncedState }
  }, [form, routineBuilder, syncSettings])

  const handleSendMissionMessage = useCallback(() => {
    const run = async () => {
      const message = chatDraft.trim()
      if (!message) return

      const userEntry = {
        id: `user_${Date.now()}`,
        role: 'user',
        text: message,
      }

      setChatMessages((current) => [...current, userEntry])
      setChatDraft('')
      setIsChatting(true)
      setError(null)

      try {
        const res = await fetch(`${window.location.origin}/api/agent-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: plannerWalletAddress,
            message,
            settings: {
              plannerInputMode: form.plannerInputMode,
              dailyTxTarget: form.dailyTxTarget,
              maxDailySpendEth: form.maxDailySpendEth,
              intervalMinutes: form.intervalMinutes,
              pumpHubTradeMode: form.pumpHubTradeMode,
              enabledTargetIds: form.enabledTargetIds,
              pumpHubTokenAddress: form.pumpHubTokenAddress,
              pumpHubWatchlist: form.pumpHubWatchlist,
              pumpHubTradeAmountEth: form.pumpHubTradeAmountEth,
              freeMintEnabled: form.freeMintEnabled,
            },
            conversation: chatMessages.slice(-6).map((entry) => ({
              role: entry.role,
              text: entry.text,
            })),
          }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || 'Agent chat is unavailable right now.')
        }

        const reply = String(data.reply || '').trim()
        const distilledPrompt = String(data.distilledPrompt || message).trim()
        if (!reply) {
          throw new Error('Agent did not return a usable reply.')
        }

        setChatMessages((current) => [
          ...current,
          {
            id: `agent_${Date.now()}`,
            role: 'agent',
            text: reply,
          },
        ])

        const nextPrompt = distilledPrompt || message
        const suggestedSettings = data.suggestedSettings || {}
        const nextForm = {
          userPrompt: nextPrompt,
          dailyTxTarget: suggestedSettings.dailyTxTarget ?? form.dailyTxTarget,
          maxDailySpendEth: suggestedSettings.maxDailySpendEth ?? form.maxDailySpendEth,
          intervalMinutes: suggestedSettings.intervalMinutes ?? form.intervalMinutes,
          pumpHubTradeMode: suggestedSettings.pumpHubTradeMode ?? form.pumpHubTradeMode,
          pumpHubTokenAddress: suggestedSettings.pumpHubTokenAddress ?? form.pumpHubTokenAddress,
          pumpHubWatchlist: suggestedSettings.pumpHubWatchlist ?? form.pumpHubWatchlist,
          pumpHubTradeAmountEth: suggestedSettings.pumpHubTradeAmountEth ?? form.pumpHubTradeAmountEth,
          freeMintEnabled: suggestedSettings.freeMintEnabled ?? form.freeMintEnabled,
          enabledTargetIds: Array.isArray(suggestedSettings.enabledTargetIds) && suggestedSettings.enabledTargetIds.length
            ? suggestedSettings.enabledTargetIds
            : form.enabledTargetIds,
        }
        patchForm(nextForm)

        const nextSettings = buildSettingsFromForm({ ...form, ...nextForm })
        const previewState = {
          ...loadAgentState(),
          settings: nextSettings,
        }
        const previewPlan = await refreshPlan(previewState)
        if (previewPlan?.actions?.length) {
          if (previewPlan.source === 'llm') {
            setPlannerIssue('')
          }
          setPlanFeedback(
            `${previewPlan.source === 'llm' ? 'AI' : 'Backup'} draft ready — ${previewPlan.actions.length} action${previewPlan.actions.length === 1 ? '' : 's'} waiting for approval.`
          )
          setActiveTab('plan')
          setOpenSections(prev => ({ ...prev, queue: true }))
          reloadState()
        }
      } catch (chatError) {
        setError(chatError.message || 'Agent chat is unavailable right now.')
      } finally {
        setIsChatting(false)
      }
    }

    run()
  }, [chatDraft, chatMessages, form, patchForm, plannerWalletAddress, reloadState])

  const refreshPlan = useCallback(
    async (stateOverride) => {
      const current = stateOverride || loadAgentState()
      const report = buildDailyReport(current)
      let plan

      setIsPlanning(true)
      try {
        if (current.settings.llmEnabled) {
          try {
            plan = await createAgentLlmPlan({
              settings: current.settings,
              report,
              logs: current.logs,
              walletAddress: plannerWalletAddress,
            })
            setPlannerMode('ai')
            setPlannerIssue('')
          } catch (llmError) {
            setPlannerMode('backup')
            setPlannerIssue(describePlannerFallback(llmError))
            console.warn('[Agent] LLM planner failed, using fallback:', llmError?.message || llmError)
          }
        }

        if (!plan) {
          plan = await createAgentPlan({
            settings: current.settings,
            report,
            logs: current.logs,
            walletAddress: plannerWalletAddress,
          })
          if (!current.settings.llmEnabled) {
            setPlannerMode('manual')
          }
        }

        appendPlan(plan)
        return plan
      } finally {
        setIsPlanning(false)
      }
    },
    [plannerWalletAddress]
  )

  const pauseForFunding = useCallback(
    (summary) => {
      setAgentStatus(AGENT_STATUSES.PAUSED)
      appendLog({
        status: 'blocked',
        title: 'Agent paused',
        summary,
      })
      reloadState()
      setError(summary)
    },
    [reloadState]
  )

  const handleRefreshPlan = useCallback(async () => {
    if (!isAgentAccessUnlocked) {
      setError('Unlock Agent Mode first.')
      return
    }
    setError(null)
    setPlannerIssue('')
    const current = loadAgentState()
    if (current.status === AGENT_STATUSES.ACTIVE) {
      setAgentStatus(AGENT_STATUSES.DISABLED)
      reloadState()
      setPlanFeedback('Current run stopped. Building a fresh draft...')
    } else {
      setPlanFeedback(
        form.plannerInputMode === AGENT_INPUT_MODES.PROMPT
          ? 'Reading your brief and building a mission...'
          : 'Reviewing today flow and building a routine...'
      )
    }
    setPlannerMode((currentMode) => (currentMode === 'manual' ? 'manual' : 'thinking'))
    const cloudAddress = cloudExecutionAddress
    if (!cloudAddress) {
      setPlanFeedback('')
      setPlannerMode('idle')
      setError('Connect Base Account first.')
      return
    }
    if (
      current.settings.plannerInputMode === AGENT_INPUT_MODES.PROMPT &&
      !String(current.settings.userPrompt || '').trim()
    ) {
      setPlanFeedback('')
      setPlannerMode('idle')
      setError('Tell the agent what you want first.')
      return
    }
    const syncedState = syncSettings(form)
    const plan = await refreshPlan(syncedState)
    if (plan?.actions?.length) {
      if (plan.source === 'llm') {
        setPlannerIssue('')
      }
      setPlanFeedback(
        plan.source === 'llm'
          ? `AI plan ready — ${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'} queued.`
          : `Backup plan ready — ${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'} queued.`
      )
      setError(null)
      try {
        await writeAgentMemoryEvent({
          eventType: 'run',
          walletAddress: cloudAddress,
          status: 'planned',
          summary: plan.rationale || plan.thoughtSummary || 'Agent created a plan block.',
          plannedActions: plan.actions.length,
        })
      } catch (memErr) {
        console.warn('[Agent] Memory write failed:', memErr?.message || memErr)
      }
    } else {
      setPlanFeedback('')
      setError('No plan was generated. Try again.')
    }
    reloadState()
  }, [cloudExecutionAddress, form, isAgentAccessUnlocked, refreshPlan, reloadState, syncSettings])

  const handleAutoPlan = useCallback(async () => {
    if (!isAgentAccessUnlocked) {
      setError('Unlock Agent Mode first.')
      return
    }
    setError(null)
    setPlannerIssue('')
    const current = loadAgentState()
    if (current.status === AGENT_STATUSES.ACTIVE) {
      setAgentStatus(AGENT_STATUSES.DISABLED)
      reloadState()
      setPlanFeedback('Current run stopped. Building a fresh AI draft...')
    }
    const { nextForm, normalizedBuilder, enabledTargetIds } = buildRoutineFormFromBuilder(routineBuilder, form)
    if (enabledTargetIds.length === 0) {
      setError('Select at least one routine goal first.')
      return
    }

    setRoutineBuilder(normalizedBuilder)
    setForm(nextForm)

    if (current.status !== AGENT_STATUSES.ACTIVE) {
      setPlanFeedback('Auto-planning with AI...')
    }
    setPlannerMode('thinking')

    const syncedState = syncSettings(nextForm)
    const plan = await refreshPlan(syncedState)
    if (plan?.actions?.length) {
      if (plan.source === 'llm') {
        setPlannerIssue('')
      }
      setPlanFeedback(`Draft ready — ${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'} waiting for approval.`)
      setActiveTab('plan')
      setOpenSections(prev => ({ ...prev, queue: true }))
    } else {
      setPlanFeedback('')
      setError('No autonomous plan was generated. Try again.')
    }
    reloadState()
  }, [form, isAgentAccessUnlocked, refreshPlan, reloadState, routineBuilder, syncSettings])

  const handleSetupCloudAgent = useCallback(async () => {
    if (!isAgentAccessUnlocked) {
      setError('Unlock Agent Mode first.')
      return
    }
    setCloudAgentBusy(true)
    setCloudAgentMessage('')
    setError(null)
    try {
      const spenderAddress = getCloudAgentSpenderAddress()
      if (!spenderAddress) {
        throw new Error('Cloud Agent spender address is not configured.')
      }

      const selectedBudget =
        ROUTINE_BUDGET_OPTIONS.find((item) => item.id === routineBuilder.budget) || ROUTINE_BUDGET_OPTIONS[1]
      const permissionEth = String(routineBuilder.maxDailySpendEth || form.maxDailySpendEth || selectedBudget.maxDailySpendEth)
      setCloudAgentMessage('Connecting Base Account...')
      const { sdk, provider, universalAddress } = await connectBaseAccountDirect()

      setCloudAgentMessage('Checking saved agent wallet...')
      const savedSession = await fetchCloudAgentSession(universalAddress).catch((sessionError) => {
        console.warn('[Cloud Agent] existing session lookup failed:', sessionError?.message || sessionError)
        return null
      })

      let subAccount = null

      if (canReuseCloudSession(savedSession, spenderAddress)) {
        subAccount = {
          ...(savedSession.policy?.subAccount || {}),
          address: savedSession.sub_account_address,
        }
        setCloudAgentMessage('Using your saved agent wallet...')
      } else {
        const setupMessage = savedSession?.sub_account_address
          ? 'Refreshing the agent wallet permission...'
          : 'Creating delegated agent wallet...'
        setCloudAgentMessage(setupMessage)
        subAccount = await createDelegatedSubAccount({
          sdk,
          workerAddress: spenderAddress,
        })
      }
      const subAccountAddress = subAccount.address
      const reusedSavedSubAccount =
        String(savedSession?.sub_account_address || '').toLowerCase() === String(subAccountAddress || '').toLowerCase()

      setCloudAgentMessage('Requesting limited spend permission...')
      const { permission } = await requestNativeSpendPermission({
        account: universalAddress,
        spender: subAccountAddress,
        allowanceEth: permissionEth,
        periodInDays: 1,
        provider,
      })

      const delegatedCloudState = saveCloudAgentState({
        ...(loadCloudAgentState() || {}),
        mode: 'cloud',
        status: 'permission_ready',
        universalAddress,
        accountAddress: universalAddress,
        subAccount,
        allowanceEth: permissionEth,
        periodInDays: 1,
        spendPermission: permission,
        accountMode: 'delegated_sub_account',
        executionMode: 'worker_ready',
        permissionModel: 'delegated_worker',
        automationOwner: spenderAddress,
        workerAddress: spenderAddress,
        signerModel: 'shared_worker_signer',
        agentSignerAddress: null,
        workerOwnsSubAccount: reusedSavedSubAccount ? savedSession.worker_owns_sub_account : null,
        registeredAt: null,
      })
      setCloudAgentState(delegatedCloudState)

      setCloudAgentMessage('Saving Cloud Agent permission...')
      try {
        const result = await registerCloudAgentSession({
          ownerAddress: universalAddress,
          subAccountAddress,
          subAccount,
          spendPermission: permission,
          allowanceEth: permissionEth,
          periodInDays: 1,
          policy: {
            mode: 'cloud_agent_v1',
            accountMode: 'delegated_sub_account',
            chainId: NETWORKS.BASE.chainId,
            dailyTxTarget: Number(form.dailyTxTarget || 0),
            maxDailySpendEth: permissionEth,
            intervalMinutes: Number(form.intervalMinutes || 4),
            enabledTargetIds: form.enabledTargetIds,
            allowedActionTypes: form.allowedActionTypes,
            spenderAddress,
            automationOwner: spenderAddress,
            workerAddress: spenderAddress,
            signerModel: 'shared_worker_signer',
            agentSignerAddress: null,
            executionMode: 'worker_ready',
            permissionModel: 'delegated_worker',
            requiresActionWhitelist: true,
            subAccount,
          },
        })

        setCloudAgentState({
          ...(result.cloudState || delegatedCloudState || {}),
          universalAddress,
          accountAddress: universalAddress,
          subAccount,
          accountMode: 'delegated_sub_account',
          executionMode: 'worker_ready',
          permissionModel: 'delegated_worker',
          automationOwner: spenderAddress,
          workerAddress: spenderAddress,
          signerModel: 'shared_worker_signer',
          agentSignerAddress: null,
          workerOwnsSubAccount: reusedSavedSubAccount ? savedSession.worker_owns_sub_account : null,
          spendPermission: permission,
        })
        setCloudAgentMessage('Cloud Agent ready. Start will run from the delegated agent wallet automatically.')
      } catch (registrationError) {
        console.warn('[Cloud Agent] session registration failed:', registrationError?.message || registrationError)
        setCloudAgentState(delegatedCloudState)
        setCloudAgentMessage('Cloud Agent ready locally. Session storage could not be saved, but Start can use the delegated agent wallet.')
        setError(`Cloud session warning: ${registrationError?.message || 'registration failed'}`)
      }
    } catch (cloudError) {
      setCloudAgentMessage('')
      const message = cloudError.message || 'Cloud Agent setup failed.'
      const popupHint = /new window|popup|permission to open/i.test(message)
        ? 'Base Account popup could not open. Allow popups for this site, then try Set up cloud again.'
        : message
      setError(popupHint)
    } finally {
      setCloudAgentBusy(false)
    }
  }, [form.allowedActionTypes, form.dailyTxTarget, form.enabledTargetIds, form.intervalMinutes, form.maxDailySpendEth, isAgentAccessUnlocked, routineBuilder.budget, routineBuilder.maxDailySpendEth])

  // Cross-tab mutex: prevent two tabs from executing simultaneously
  const LOCK_KEY = 'basehub_agent_execution_lock'
  const LOCK_TTL_MS = 60000 // 1 minute auto-expire

  function acquireCrossTabLock() {
    const now = Date.now()
    const existing = localStorage.getItem(LOCK_KEY)
    if (existing) {
      const lockTime = Number(existing)
      if (now - lockTime < LOCK_TTL_MS) return false // another tab holds the lock
    }
    localStorage.setItem(LOCK_KEY, String(now))
    return true
  }

  function releaseCrossTabLock() {
    localStorage.removeItem(LOCK_KEY)
  }

  // Safe memory write helper — prevents silent failures
  async function safeWriteMemory(payload) {
    try {
      await writeAgentMemoryEvent(payload)
    } catch (memErr) {
      console.warn('[Agent] Memory write failed:', memErr?.message || memErr)
    }
  }

  async function recordAgentResult({ walletAddress, action, result }) {
    const txHash = result?.hash || result?.txHash
    if (!walletAddress || !txHash || !action?.targetId) return

    const gameType = getAgentGameType(action)
    const xpAmount = getAgentBaseXp(action)

    try {
      if (typeof supabase?.rpc !== 'function') throw new Error('Supabase RPC is not available.')
      const awardType = getAgentAwardGameType(action)
      const { error: awardError } = await supabase.rpc('award_xp', {
        p_wallet_address: walletAddress,
        p_final_xp: xpAmount,
        p_game_type: awardType,
        p_transaction_hash: txHash,
        p_source: 'web',
      })
      if (awardError) throw awardError
      notifyXPRefresh()
    } catch (xpErr) {
      console.warn('[Agent] XP award failed:', xpErr?.message || xpErr)
      try {
        await recordTransaction({
          wallet_address: walletAddress,
          game_type: gameType,
          xp_earned: xpAmount,
          transaction_hash: txHash,
          chain_id: NETWORKS.BASE.chainId,
        })
      } catch (txErr) {
        console.warn('[Agent] Supabase tx record failed:', txErr?.message || txErr)
      }
    }

    if (action.targetId === 'swaphub-swap') {
      try {
        const swapUsd =
          Number(action.payload?.swapAmountUsd || 0) ||
          estimateUsdFromEthAmount(action.payload?.swapAmountEth || action.estimatedSpendEth)
        if (swapUsd > 0) {
          await recordSwapTransaction(walletAddress, swapUsd, txHash)
        }
      } catch (swapErr) {
        console.warn('[Agent] SwapHub volume record failed:', swapErr?.message || swapErr)
      }
    }
  }

  const runNextAction = useCallback(async () => {
    if (executionLockRef.current) return
    if (!acquireCrossTabLock()) return // another tab is executing
    executionLockRef.current = true
    setIsExecuting(true)
    setError(null)
    let current = null
    let shouldContinueAfterSkip = false

    try {
      current = loadAgentState()
      let plan = current.currentPlan
      let action = getNextPlannedAction(current)

      const cloudAddress = cloudExecutionAddress
      const liveBalance = cloudAddress
        ? await getBurnerBalance(cloudAddress)
        : { raw: 0n, formatted: '0' }
      setBalance(liveBalance)

      if (!action) {
        plan = await refreshPlan(current)
        reloadState()
        if (plan && !plan?.approvedAt) {
          approveCurrentPlan()
          reloadState()
          plan = loadAgentState().currentPlan
          setPlanFeedback('Next block prepared automatically. The agent is continuing.')
        }
        action = getNextPlannedAction(loadAgentState()) || plan.actions[0]
      }

      if (!action) {
        appendLog({
          status: 'blocked',
          title: 'No action queued',
          summary: plan?.rationale || 'Planner did not return a new action.',
        })
        reloadState()
        return
      }

      const actionMinimumWei = BigInt(action.estimatedSpendWei || '0') + AGENT_GAS_BUFFER_WEI
      if (liveBalance.raw < actionMinimumWei) {
        pauseForFunding(`Low balance. Add at least ${formatEther(actionMinimumWei)} ETH before restarting.`)
        return
      }

      const policyDecision = evaluateAgentAction({
        state: current,
        action,
        report: buildDailyReport(current),
      })

      if (!policyDecision.ok) {
        appendLog({
          status: 'blocked',
          title: action.title,
          summary: policyDecision.reason,
          targetId: action.targetId,
          targetType: action.targetType,
          payload: action.payload,
        })
        consumeNextPlannedAction(action.id)
        reloadState()
        return
      }

      if (!isCloudExecutionReady) {
        appendLog({ status: 'blocked', title: 'Cloud Agent not ready', summary: cloudExecutionIssue || 'Set up Cloud Agent before starting.' })
        reloadState()
        return
      }

      updateQueuedAction(action.id, {
        status: 'executing',
        scheduledFor: new Date().toISOString(),
      })
      reloadState()

      const result = await executeCloudAgentAction({
        ownerAddress: cloudAddress,
        subAccount: cloudAgentState?.subAccount || null,
        action,
        settings: {
          ...current.settings,
          walletAddress: cloudAddress,
        },
        logs: current.logs,
        spendPermission: cloudAgentState?.spendPermission || null,
      })

      appendLog({
        status: 'success',
        title: action.title,
        summary: action.summary,
        targetId: action.targetId,
        targetType: action.targetType,
        payload: action.payload,
        txHash: result.hash,
        spentWei: result.spentWei,
      })
      await recordAgentResult({
        walletAddress: cloudAddress,
        action,
        result,
      })
      await safeWriteMemory({
        eventType: 'run',
        walletAddress: cloudAddress,
        status: 'success',
        summary: action.summary,
        plannedActions: plan?.actions?.length || 0,
        executedAction: action.title,
      })
      await safeWriteMemory({
        eventType: 'reflection',
        walletAddress: cloudAddress,
        reflectionType: 'execution',
        body: `I executed ${action.title} successfully and can use that result in the next planning pass.`,
        meta: { targetId: action.targetId },
      })
      updateQueuedAction(action.id, {
        status: 'completed',
        executedAt: new Date().toISOString(),
        result: {
          txHash: result.hash,
          spentWei: result.spentWei,
          spentEth: result.spentEth,
        },
      })
      consumeNextPlannedAction(action.id)
      reloadState()
    } catch (runError) {
      const normalized = normalizeAgentError(runError)
      if (current) {
        const failedAction = getNextPlannedAction(current)
        const shouldSkipSellBecauseEmpty =
          failedAction?.targetId === 'pumphub-sell' &&
          normalized.shortMessage === 'No PumpHub token balance to sell.'

        if (shouldSkipSellBecauseEmpty && failedAction?.id) {
          updateQueuedAction(failedAction.id, {
            status: 'failed',
            executedAt: new Date().toISOString(),
            error: 'Skipped because the wallet has no sellable PumpHub token balance yet.',
          })
          appendLog({
            status: 'blocked',
            title: 'PumpHub Sell skipped',
            summary: 'No sellable PumpHub balance yet. I moved on to the next action.',
            targetId: failedAction.targetId,
            targetType: failedAction.targetType,
            payload: failedAction.payload,
          })
          reloadState()
          shouldContinueAfterSkip = true
          setError(null)
          return
        }

        if (failedAction?.id) {
          updateQueuedAction(failedAction.id, {
            status: 'failed',
            executedAt: new Date().toISOString(),
            error: normalized.shortMessage,
          })
        }
      }
      appendLog({
        status: 'failed',
        title: normalized.code === 'fee' || normalized.code === 'balance' ? 'Agent stopped' : 'Execution failed',
        summary: normalized.shortMessage,
      })
      if (cloudAddress || cloudAgentState?.accountAddress || cloudAgentState?.universalAddress) {
        await safeWriteMemory({
          eventType: 'reflection',
          walletAddress: cloudAddress || cloudAgentState?.accountAddress || cloudAgentState?.universalAddress,
          reflectionType: 'failure',
          body: normalized.shortMessage,
          meta: { code: normalized.code },
        })
      }
      if (normalized.shouldPauseAgent) {
        setAgentStatus(AGENT_STATUSES.PAUSED)
      }
      reloadState()
      setError(normalized.shortMessage)
    } finally {
      releaseCrossTabLock()
      executionLockRef.current = false
      setIsExecuting(false)
      if (shouldContinueAfterSkip) {
        window.setTimeout(() => runNextAction(), 150)
      }
    }
  }, [cloudAgentState, cloudExecutionAddress, executeCloudAgentAction, isCloudExecutionReady, pauseForFunding, refreshPlan, reloadState])

  const startAgentRun = useCallback(async () => {
    if (!isAgentAccessUnlocked) {
      setError('Unlock Agent Mode first.')
      return false
    }
    if (!startGateWithAccess.ok) {
      setError(startGateWithAccess.reason)
      return false
    }
    const cloudAddress = cloudExecutionAddress
    const currentState = loadAgentState()
    const approvedPlan = currentState.currentPlan
    const approvedQueue = Array.isArray(approvedPlan?.queue) ? approvedPlan.queue : []
    const approvedActions = Array.isArray(approvedPlan?.actions) ? approvedPlan.actions : []
    const approvedPlanHasWork = approvedQueue.length > 0 || approvedActions.length > 0
    if (isCloudAgentReady && !isCloudExecutionReady) {
      const issue = cloudExecutionIssue || 'Cloud execution is not ready yet.'
      setAgentStatus(AGENT_STATUSES.DISABLED)
      setError(issue)
      setPlanFeedback(issue)
      appendLog({
        status: 'blocked',
        title: 'Cloud executor not ready',
        summary: issue,
      })
      reloadState()
      return false
    }
    try {
      if (isCloudAgentReady) {
        if (!approvedPlan?.approvedAt || !approvedPlanHasWork) {
          setError('Generate and approve a plan before starting.')
          return false
        }
        const startedRun = await startCloudAgentRun({
          ownerAddress: cloudAgentState?.accountAddress || cloudAgentState?.universalAddress || paymentWalletAddress,
          subAccountAddress: cloudAddress,
          subAccount: cloudAgentState?.subAccount || null,
          currentPlan: approvedPlan,
          settings: {
            ...currentState.settings,
            walletAddress: cloudAddress,
          },
          logs: currentState.logs,
          spendPermission: cloudAgentState?.spendPermission || null,
          intervalMinutes: currentState.settings.intervalMinutes,
        })
        syncCloudRunState(startedRun)
      }

      setAgentStatus(AGENT_STATUSES.ACTIVE)
      appendLog({
        status: 'info',
        title: isCloudAgentReady ? 'Cloud Agent started' : 'Agent started',
        summary: isCloudAgentReady
          ? 'Cloud Agent queued on VPS worker. It can continue after this tab is closed.'
          : 'Agent is now following today plan.',
      })
      safeWriteMemory({
        eventType: 'profile',
        walletAddress: cloudAddress,
        objective: autoObjective,
        currentIntent: latestPlan?.nextMove || '',
        plannerMode,
      })
      reloadState()
      if (isCloudAgentReady) {
        setPlanFeedback('Cloud Agent started. VPS worker will execute the approved plan automatically.')
      } else {
        window.setTimeout(() => runNextAction(), 150)
      }
      return true
    } catch (startError) {
      const normalized = normalizeAgentError(startError)
      appendLog({
        status: 'failed',
        title: 'Cloud Agent start failed',
        summary: normalized.shortMessage,
      })
      reloadState()
      setError(normalized.shortMessage)
      return false
    }
  }, [autoObjective, cloudAgentState, cloudExecutionAddress, cloudExecutionIssue, isAgentAccessUnlocked, isCloudAgentReady, isCloudExecutionReady, latestPlan?.nextMove, paymentWalletAddress, plannerMode, reloadState, runNextAction, startGateWithAccess, syncCloudRunState])

  useEffect(() => {
    if (isCloudAgentReady) return undefined
    if (!isCloudExecutionReady) return undefined
    if (agentState.status !== AGENT_STATUSES.ACTIVE) return undefined
    if (!agentState.settings.autoRunEnabled) return undefined

    const intervalMs = Math.max(1, Number(agentState.settings.intervalMinutes || 1)) * 60 * 1000
    const intervalId = window.setInterval(() => {
      runNextAction()
    }, intervalMs)

    return () => window.clearInterval(intervalId)
  }, [
    agentState.settings.autoRunEnabled,
    agentState.settings.intervalMinutes,
    agentState.status,
    isCloudAgentReady,
    isCloudExecutionReady,
    runNextAction,
  ])

  const handleUnlockAgentAccess = useCallback(async () => {
    if (isAgentX402PurchaseSkipped()) {
      await refreshAgentAccess()
      return
    }
    if (!isPaymentWalletConnected || !paymentWalletAddress || !paymentWalletClient) {
      setError('Connect your main wallet first, then unlock Agent Mode.')
      return
    }

    setAgentAccessBusy(true)
    setError(null)
    try {
      const endpoint = agentAccess.isPassHolder ? '/api/x402-agent-access-pass' : '/api/x402-agent-access'
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        paymentWalletClient,
        BigInt(16000000) // 16 USDC max guard; standard price is 15 USDC.
      )

      const response = await fetchWithPayment(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: paymentWalletAddress,
          agentWalletAddress: cloudExecutionAddress || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.message || 'Agent Mode unlock payment failed.')
      }

      await refreshAgentAccess()
      setPlanFeedback('Agent Mode unlocked. You can set up cloud, generate a plan, and start.')
    } catch (unlockError) {
      const message = unlockError?.message || 'Agent Mode unlock payment failed.'
      setError(message)
    } finally {
      setAgentAccessBusy(false)
    }
  }, [
    agentAccess.isPassHolder,
    cloudExecutionAddress,
    isPaymentWalletConnected,
    paymentWalletAddress,
    paymentWalletClient,
    refreshAgentAccess,
  ])

  const handleCopy = useCallback(async (value, key) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(''), 1200)
    } catch {
      setError('Copy failed.')
    }
  }, [])

  /* ─── Status color map ─── */
  const statusConfig = {
    [AGENT_STATUSES.ACTIVE]: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: '#4ade80', dotColor: '#22c55e' },
    [AGENT_STATUSES.PAUSED]: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#fbbf24', dotColor: '#f59e0b' },
    [AGENT_STATUSES.DISABLED]: { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', color: '#94a3b8', dotColor: '#64748b' },
  }
  const sc = statusConfig[agentState.status] || statusConfig[AGENT_STATUSES.DISABLED]

  /* ─── Render ─── */

  const completedQueueActions = latestPlan?.queue?.filter(q => q.status === 'completed').length || 0
  const totalQueueActions = latestPlan?.queue?.length || 0
  const progressPct = totalQueueActions > 0 ? Math.round((completedQueueActions / totalQueueActions) * 100) : 0
  const agentXpLevel = calcLevel(agentXp.value)
  const agentBhupEstimate = calculateTokens(agentXp.value)

  /* shared styles */
  const glassCard = {
    borderRadius: 22,
    background: 'linear-gradient(135deg, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.45) 100%)',
    border: '1px solid rgba(148,163,184,0.07)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }
  const sectionBtn = (isOpen) => ({
    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
    padding: '18px 22px',
    background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer',
    borderBottom: isOpen ? '1px solid rgba(148,163,184,0.05)' : 'none',
    transition: 'background 0.2s ease',
  })
  const sectionBody = { padding: '22px 24px', animation: 'agentFadeIn 0.35s ease' }
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.7)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
  }
  const innerCard = {
    padding: '16px 18px', borderRadius: 16,
    background: 'rgba(2,6,23,0.4)',
    border: '1px solid rgba(148,163,184,0.04)',
  }
  const currentSetupStep = !isAgentAccessUnlocked
    ? 1
    : !isCloudExecutionReady
      ? 2
      : !hasPlan
        ? 3
        : !isPlanApproved
          ? 4
          : isAgentActive
            ? 5
            : 4
  const setupSteps = [
    {
      number: 1,
      title: 'Unlock',
      text: 'Pay once with x402',
      done: isAgentAccessUnlocked,
    },
    {
      number: 2,
      title: 'Cloud',
      text: 'Give limited permission',
      done: isCloudExecutionReady,
    },
    {
      number: 3,
      title: 'Plan',
      text: 'Choose routine and generate',
      done: hasPlan,
    },
    {
      number: 4,
      title: 'Start',
      text: 'Approve and run',
      done: hasPlan && (isPlanApproved || isAgentActive),
    },
  ]
  const cloudIssueShort = cloudExecutionIssue
    ? cloudExecutionIssue.toLowerCase().includes('older') || cloudExecutionIssue.toLowerCase().includes('old ')
      ? 'Permission update needed'
      : 'Setup needs attention'
    : ''

  if (isAgentModeUnsupportedRuntime) {
    const reasonLabel = isFarcasterRuntime ? 'Farcaster mobile' : 'mobile'

    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #080d1a 0%, #060a14 42%, #030712 100%)',
        color: '#e2e8f0',
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        <EmbedMeta
          title="Agent Mode"
          description="Agent Mode is available on desktop web."
          url="https://www.basehub.fun/agent"
        />

        <div style={{
          width: 'min(calc(100% - 28px), 760px)',
          margin: '0 auto',
          padding: 'clamp(18px, 6vw, 38px) 0 80px',
        }}>
          <BackButton />

          <div style={{
            ...glassCard,
            marginTop: 18,
            padding: '24px 22px',
            background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(15,23,42,0.7))',
            border: '1px solid rgba(125,211,252,0.12)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 54,
              height: 54,
              margin: '0 auto 16px',
              borderRadius: 18,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(14,165,233,0.1)',
              border: '1px solid rgba(125,211,252,0.16)',
              color: '#7dd3fc',
            }}>
              <Bot size={24} />
            </div>

            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.03em' }}>
              Agent Mode is web only
            </div>
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.65, color: '#94a3b8' }}>
              Agent Mode is currently disabled on {reasonLabel}. Open BaseHub from a desktop browser to unlock,
              set permissions, and run your cloud agent safely.
            </div>

            <div style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(250,204,21,0.08)',
              border: '1px solid rgba(250,204,21,0.12)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 800,
            }}>
              Payments and setup are blocked here, so you will not be charged from mobile.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #080d1a 0%, #060a14 40%, #030712 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <EmbedMeta
        title="Agent Mode"
        description="Set up Cloud Agent and let it run approved BaseHub routines automatically."
        url="https://www.basehub.fun/agent"
      />

      <div style={{
        width: 'min(calc(100% - 32px), 1180px)',
        margin: '0 auto',
        padding: 'clamp(18px, 2.6vw, 34px) 0 120px',
      }}>
        <BackButton />

        <>
            {/* ─── Header ─── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 14, flexWrap: 'wrap', marginBottom: 22,
              animation: 'agentFadeIn 0.4s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13,
                  background: 'linear-gradient(145deg, rgba(99,102,241,0.14), rgba(59,130,246,0.08))',
                  border: '1px solid rgba(129,140,248,0.1)',
                  display: 'grid', placeItems: 'center',
                  animation: isAgentActive ? 'agentGlow 3s ease-in-out infinite' : 'none',
                  boxShadow: isAgentActive ? '0 0 30px rgba(99,102,241,0.12)' : 'none',
                }}>
                  <Bot size={20} color="#a5b4fc" />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Agent Mode</h1>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569', fontWeight: 500 }}>
                    {formatEth(balance.formatted)} · {dailyReport.executed}/{agentState.settings.dailyTxTarget} today
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 11px', borderRadius: 999,
                  background: 'rgba(250,204,21,0.08)',
                  border: '1px solid rgba(250,204,21,0.12)',
                  color: '#fde68a',
                }}>
                  <Zap size={13} />
                  <span style={{ fontSize: 11, fontWeight: 800 }}>Agent XP</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: '#f8fafc' }}>
                    {agentXp.loading && !agentXp.value ? '...' : formatNumber(agentXp.value)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>L{agentXpLevel}</span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 999,
                  background: sc.bg, border: `1px solid ${sc.border}`,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: sc.dotColor,
                    animation: isAgentActive ? 'statusPulse 2s ease-in-out infinite' : 'none',
                    boxShadow: isAgentActive ? `0 0 8px ${sc.dotColor}` : 'none',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: sc.color, letterSpacing: '0.02em' }}>
                    {formatStatus(agentState.status)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              ...glassCard,
              padding: '16px',
              marginBottom: 16,
              background: 'linear-gradient(135deg, rgba(15,23,42,0.72), rgba(15,23,42,0.46))',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
              }}>
                {setupSteps.map(step => {
                  const active = currentSetupStep === step.number
                  return (
                    <div key={step.number} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: step.done
                        ? 'rgba(34,197,94,0.08)'
                        : active
                          ? 'rgba(96,165,250,0.1)'
                          : 'rgba(2,6,23,0.36)',
                      border: `1px solid ${step.done
                        ? 'rgba(34,197,94,0.16)'
                        : active
                          ? 'rgba(96,165,250,0.18)'
                          : 'rgba(148,163,184,0.05)'}`,
                    }}>
                      <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        background: step.done
                          ? 'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(22,163,74,0.08))'
                          : active
                            ? 'linear-gradient(135deg, rgba(59,130,246,0.24), rgba(99,102,241,0.1))'
                            : 'rgba(15,23,42,0.75)',
                        color: step.done ? '#86efac' : active ? '#bfdbfe' : '#64748b',
                        fontSize: 12,
                        fontWeight: 900,
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        {step.done ? '✓' : step.number}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: step.done ? '#bbf7d0' : active ? '#e0f2fe' : '#94a3b8',
                          letterSpacing: '-0.01em',
                        }}>
                          {step.title}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 11, color: active ? '#93c5fd' : '#64748b', fontWeight: 600 }}>
                          {step.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {!isAgentAccessUnlocked && (
              <div style={{
                ...glassCard,
                padding: '18px 20px',
                marginBottom: 16,
                background: 'linear-gradient(135deg, rgba(250,204,21,0.08), rgba(15,23,42,0.55))',
                border: '1px solid rgba(250,204,21,0.14)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 11,
                    background: 'rgba(250,204,21,0.1)',
                    border: '1px solid rgba(250,204,21,0.14)',
                    display: 'grid', placeItems: 'center',
                    color: '#fde68a',
                  }}>
                    <Shield size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#f8fafc' }}>Unlock Agent Mode</div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 900,
                        color: agentAccess.isPassHolder ? '#86efac' : '#fde68a',
                        background: agentAccess.isPassHolder ? 'rgba(34,197,94,0.12)' : 'rgba(250,204,21,0.1)',
                        border: `1px solid ${agentAccess.isPassHolder ? 'rgba(34,197,94,0.18)' : 'rgba(250,204,21,0.16)'}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}>
                        {agentAccess.loading ? 'checking' : agentAccess.isPassHolder ? '30% discount' : 'one-time'}
                      </span>
                    </div>
                    <div style={{ marginTop: 5, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                      Pay once with your main wallet. Early Access Pass holders get 30% off automatically.
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#fde68a', fontWeight: 900 }}>
                        {agentAccessPriceLabel}
                      </span>
                      {!agentAccess.loading && !agentAccess.isPassHolder && (
                        <a
                          href="/early-access"
                          style={{
                            fontSize: 11,
                            color: '#7dd3fc',
                            fontWeight: 800,
                            textDecoration: 'none',
                          }}
                        >
                          Mint pass for discount
                        </a>
                      )}
                    </div>
                    {agentAccess.setupError && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5', fontWeight: 700 }}>
                        {agentAccess.setupError}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={agentAccessBusy || agentAccess.loading || !isPaymentWalletConnected}
                    onClick={handleUnlockAgentAccess}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '11px 18px',
                      borderRadius: 13,
                      border: '1px solid rgba(250,204,21,0.18)',
                      background: agentAccessBusy || agentAccess.loading || !isPaymentWalletConnected
                        ? 'rgba(250,204,21,0.08)'
                        : 'linear-gradient(135deg, #facc15, #f59e0b)',
                      color: agentAccessBusy || agentAccess.loading || !isPaymentWalletConnected ? '#a16207' : '#111827',
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: agentAccessBusy || agentAccess.loading || !isPaymentWalletConnected ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {agentAccessBusy ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                    {!isPaymentWalletConnected ? 'Connect wallet' : agentAccessBusy ? 'Paying…' : 'Pay with x402'}
                  </button>
                </div>
              </div>
            )}

            {/* ─── Cloud Agent ─── */}
            <div style={{
              ...glassCard,
              padding: '16px 18px',
              marginBottom: 16,
              background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(15,23,42,0.48))',
              border: '1px solid rgba(56,189,248,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'rgba(14,165,233,0.1)',
                  border: '1px solid rgba(56,189,248,0.12)',
                  display: 'grid', placeItems: 'center',
                  color: '#7dd3fc',
                }}>
                  <Shield size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#e0f2fe', letterSpacing: '-0.01em' }}>Cloud Agent</div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      color: isCloudExecutionReady ? '#86efac' : isCloudAgentReady ? '#fbbf24' : '#93c5fd',
                      background: isCloudExecutionReady
                        ? 'rgba(34,197,94,0.12)'
                        : isCloudAgentReady
                          ? 'rgba(245,158,11,0.12)'
                          : 'rgba(59,130,246,0.12)',
                      border: `1px solid ${isCloudExecutionReady
                        ? 'rgba(34,197,94,0.18)'
                        : isCloudAgentReady
                          ? 'rgba(245,158,11,0.18)'
                          : 'rgba(59,130,246,0.18)'}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {isCloudExecutionReady ? 'auto ready' : isCloudAgentReady ? 'permission only' : 'setup beta'}
                    </span>
                  </div>
                  {(cloudAccountAddress || cloudDelegatedAddress) && (
                    <div style={{
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      fontSize: 11,
                      color: '#7dd3fc',
                      fontWeight: 700,
                    }}>
                      {cloudDelegatedAddress && (
                        <>
                          <span>
                            Agent {formatShortAddress(cloudDelegatedAddress)}
                            {cloudAgentState.allowanceEth ? ` · cap ${cloudAgentState.allowanceEth} ETH/day` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(cloudDelegatedAddress, 'cloud-agent-wallet')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              borderRadius: 8,
                              border: '1px solid rgba(56,189,248,0.14)',
                              background: 'rgba(14,165,233,0.08)',
                              color: '#bae6fd',
                              fontSize: 10,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <Copy size={10} />
                            {copiedKey === 'cloud-agent-wallet' ? 'Copied' : 'Copy'}
                          </button>
                        </>
                      )}
                      {cloudAccountAddress && cloudDelegatedAddress && cloudAccountAddress.toLowerCase() !== cloudDelegatedAddress.toLowerCase() && (
                        <span style={{ color: '#64748b', fontWeight: 700 }}>
                          Main {formatShortAddress(cloudAccountAddress)}
                        </span>
                      )}
                      {cloudAccountAddress && !cloudDelegatedAddress && (
                        <span>
                          Main {formatShortAddress(cloudAccountAddress)}
                        </span>
                      )}
                    </div>
                  )}
                  {cloudAgentMessage && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#bae6fd', fontWeight: 600 }}>{cloudAgentMessage}</div>
                  )}
                  {cloudExecutionIssue && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fbbf24', fontWeight: 800 }}>
                      <AlertTriangle size={12} />
                      {cloudIssueShort}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" disabled={cloudAgentBusy || !isAgentAccessUnlocked} onClick={handleSetupCloudAgent} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(56,189,248,0.18)',
                    background: cloudAgentBusy || !isAgentAccessUnlocked ? 'rgba(14,165,233,0.08)' : 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(37,99,235,0.1))',
                    color: cloudAgentBusy || !isAgentAccessUnlocked ? '#64748b' : '#bae6fd',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: cloudAgentBusy ? 'wait' : !isAgentAccessUnlocked ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.01em',
                  }}>
                    {cloudAgentBusy ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={13} />}
                    {isCloudAgentReady ? 'Update permission' : 'Set up cloud'}
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Mission Card ─── */}
            <div style={{
              ...glassCard, padding: '26px 28px', marginBottom: 18,
              background: isAgentActive
                ? 'linear-gradient(145deg, rgba(34,197,94,0.06), rgba(15,23,42,0.55))'
                : hasPlan && isPlanApproved
                  ? 'linear-gradient(145deg, rgba(99,102,241,0.06), rgba(15,23,42,0.55))'
                  : 'linear-gradient(145deg, rgba(15,23,42,0.65), rgba(15,23,42,0.45))',
              border: `1px solid ${isAgentActive ? 'rgba(34,197,94,0.1)' : hasPlan && isPlanApproved ? 'rgba(129,140,248,0.1)' : 'rgba(148,163,184,0.06)'}`,
              boxShadow: isAgentActive ? '0 0 60px rgba(34,197,94,0.05)' : hasPlan && isPlanApproved ? '0 0 60px rgba(99,102,241,0.04)' : 'none',
              animation: 'agentFadeIn 0.5s ease',
            }}>
              {isAgentActive ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'agentPulse 2s ease infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Running</span>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>
                      VPS worker keeps running
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginBottom: 4, letterSpacing: '-0.03em' }}>
                    {nextAction ? nextAction.title : 'Waiting for next action\u2026'}
                  </div>
                  {nextAction?.summary && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 400 }}>{compactSummary(nextAction.summary)}</div>}
                  {totalQueueActions > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{completedQueueActions} of {totalQueueActions}</span>
                        <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>{progressPct}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: 'rgba(148,163,184,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                          width: `${progressPct}%`, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 0 12px rgba(34,197,94,0.3)',
                        }} />
                      </div>
                    </div>
                  )}
                </>
              ) : hasPlan && isPlanApproved ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Sparkles size={14} color="#818cf8" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ready</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 6, letterSpacing: '-0.02em' }}>
                    {plannedCount} action{plannedCount === 1 ? '' : 's'} approved
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, fontWeight: 400 }}>{planSentence}</div>
                </>
              ) : hasPlan ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Clock size={14} color="#f59e0b" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Draft</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 6, letterSpacing: '-0.02em' }}>Review and approve</div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, fontWeight: 400 }}>{planSummary}</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Target size={14} color="#475569" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>No plan</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 6, letterSpacing: '-0.02em' }}>Configure your routine</div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, fontWeight: 400 }}>Select activities, set the pace and budget, then generate a plan.</div>
                </>
              )}
            </div>

            {/* ─── Controls ─── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
              {!hasPlan && !isAgentActive && (
                <button type="button" disabled={isPlanning || !isCloudAgentReady || !isAgentAccessUnlocked} onClick={() => {
                  handleAutoPlan().catch(e => { setPlanFeedback(''); setPlannerMode('backup'); setError(normalizeAgentError(e).shortMessage) })
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, border: 'none',
                  background: isPlanning || !isCloudAgentReady || !isAgentAccessUnlocked ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: isPlanning || !isCloudAgentReady || !isAgentAccessUnlocked ? 'not-allowed' : 'pointer',
                  boxShadow: isPlanning || !isCloudAgentReady || !isAgentAccessUnlocked ? 'none' : '0 2px 16px rgba(99,102,241,0.2)',
                  transition: 'all 0.2s ease',
                }}>
                  {isPlanning ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                  {isPlanning ? 'Planning\u2026' : 'Generate Plan'}
                </button>
              )}
              {hasPlan && !isPlanApproved && (
                <button type="button" disabled={!isAgentAccessUnlocked} onClick={() => {
                  if (!isAgentAccessUnlocked) { setError('Unlock Agent Mode first.'); return }
                  approveCurrentPlan()
                  appendLog({ status: 'info', title: 'Plan approved', summary: 'The agent can now execute this plan.' })
                  setPlanFeedback('Plan approved — start when ready.')
                  reloadState()
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, border: 'none',
                  background: isAgentAccessUnlocked ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(99,102,241,0.2)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: isAgentAccessUnlocked ? 'pointer' : 'not-allowed', letterSpacing: '-0.01em',
                  boxShadow: isAgentAccessUnlocked ? '0 2px 16px rgba(99,102,241,0.2)' : 'none', transition: 'all 0.2s ease',
                }}>
                  <Sparkles size={14} />
                  Approve Plan
                </button>
              )}
              {canStartApprovedPlan && (
                <button type="button" disabled={!startGateWithAccess.ok} onClick={() => {
                  if (!startGateWithAccess.ok) { setError(startGateWithAccess.reason); return }
                  startAgentRun().catch((e) => setError(normalizeAgentError(e).shortMessage))
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, border: 'none',
                  background: startGateWithAccess.ok ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(34,197,94,0.15)',
                  color: startGateWithAccess.ok ? '#fff' : '#475569',
                  fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: startGateWithAccess.ok ? 'pointer' : 'not-allowed',
                  boxShadow: startGateWithAccess.ok ? '0 2px 16px rgba(34,197,94,0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}>
                  <Play size={14} />
                  Start
                </button>
              )}
              {isAgentActive && (
                <button type="button" onClick={() => {
                  stopCloudAgentRun({
                    ownerAddress: cloudAgentState?.accountAddress || cloudAgentState?.universalAddress || paymentWalletAddress,
                  }).catch((e) => setError(normalizeAgentError(e).shortMessage))
                  setAgentStatus(AGENT_STATUSES.DISABLED)
                  appendLog({ status: 'info', title: 'Agent stopped', summary: 'Routine fully stopped.' })
                  reloadState()
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', borderRadius: 12,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(248,113,113,0.12)',
                  color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease',
                }}>
                  <Power size={14} />
                  Stop
                </button>
              )}
              {hasPlan && (
                <button type="button" disabled={isPlanning} onClick={() => {
                  handleRefreshPlan().catch(e => { setPlanFeedback(''); setError(normalizeAgentError(e).shortMessage) })
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11,
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.06)',
                  color: '#64748b', fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
                  cursor: isPlanning ? 'wait' : 'pointer', opacity: isPlanning ? 0.5 : 1, transition: 'all 0.2s ease',
                }}>
                  <RefreshCw size={12} style={{ animation: isPlanning ? 'spin 1s linear infinite' : 'none' }} />
                  Refresh
                </button>
              )}
              {hasPlan && !isAgentActive && (
                <button type="button" disabled={isPlanning} onClick={() => {
                  resetAgentPlan()
                  setPlannerMode('idle')
                  setPlannerIssue('')
                  setError(null)
                  setPlanFeedback('Plan reset. Create a new plan whenever you are ready.')
                  setOpenSections({ routine: true, queue: false, activity: false, wallet: false })
                  reloadState()
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(248,113,113,0.12)',
                  color: '#fca5a5', fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: isPlanning ? 'wait' : 'pointer', opacity: isPlanning ? 0.5 : 1, transition: 'all 0.2s ease',
                }}>
                  <Trash2 size={12} />
                  Reset Plan
                </button>
              )}
            </div>

            {/* ─── Alerts ─── */}
            {planFeedback && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
                background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(129,140,248,0.08)',
                color: '#a5b4fc', fontSize: 13, fontWeight: 600, marginBottom: 12,
                animation: 'agentFadeIn 0.3s ease',
              }}>
                <Sparkles size={13} style={{ flexShrink: 0 }} />
                {planFeedback}
              </div>
            )}
            {plannerIssue && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
                background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(129,140,248,0.08)',
                color: '#a5b4fc', fontSize: 13, marginBottom: 12, animation: 'agentFadeIn 0.2s ease',
              }}>
                <Bot size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflowWrap: 'anywhere' }}>{plannerIssue}</span>
              </div>
            )}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(248,113,113,0.08)',
                color: '#fca5a5', fontSize: 13, marginBottom: 12, animation: 'agentFadeIn 0.2s ease',
              }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflowWrap: 'anywhere' }}>{error}</span>
              </div>
            )}

            {/* ══════════════════════════════════════ */}
            {/*  SECTION: Routine                      */}
            {/* ══════════════════════════════════════ */}
            <div style={{ ...glassCard, marginBottom: 10, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenSections(p => ({ ...p, routine: !p.routine }))} style={sectionBtn(openSections.routine)}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(139,92,246,0.06))',
                  border: '1px solid rgba(168,85,247,0.08)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Target size={14} color="#a78bfa" />
                </div>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Routine</span>
                <ChevronRight size={15} color="#475569" style={{
                  transform: openSections.routine ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease',
                }} />
              </button>
              {openSections.routine && (
                <div style={sectionBody}>
                  {/* Goals */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={labelStyle}>Activities</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                      {ROUTINE_GOAL_OPTIONS.map(goal => {
                        const active = !!routineBuilder.goals[goal.id]
                        const iconMap = {
                          social: <MessageSquare size={18} />,
                          gaming: <Zap size={18} />,
                          trade: <Activity size={18} />,
                          freeMint: <Sparkles size={18} />,
                          deploy: <ExternalLink size={18} />,
                        }
                        return (
                          <button key={goal.id} type="button" onClick={() => toggleRoutineGoal(goal.id)} style={{
                            padding: '18px 10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                            background: active
                              ? 'linear-gradient(145deg, rgba(139,92,246,0.12), rgba(99,102,241,0.06))'
                              : 'rgba(2,6,23,0.4)',
                            border: active ? '1.5px solid rgba(168,85,247,0.25)' : '1px solid rgba(148,163,184,0.04)',
                            transition: 'all 0.2s ease',
                            boxShadow: active ? '0 0 20px rgba(139,92,246,0.06)' : 'none',
                          }}>
                            <div style={{ color: active ? '#c4b5fd' : '#475569', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                              {iconMap[goal.id]}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#e9d5ff' : '#94a3b8', letterSpacing: '-0.01em' }}>{goal.label}</div>
                            <div style={{ fontSize: 10, color: '#475569', marginTop: 3, lineHeight: 1.3 }}>{goal.summary}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Intensity + Budget side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div>
                      <div style={labelStyle}>Pace</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {ROUTINE_INTENSITY_OPTIONS.map(opt => {
                          const active = routineBuilder.intensity === opt.id
                          return (
                            <button key={opt.id} type="button" onClick={() => {
                              setRoutineBuilder(c => ({
                                ...c,
                                intensity: opt.id,
                                dailyTxTarget: String(opt.dailyTxTarget),
                                intervalMinutes: String(opt.intervalMinutes),
                              }))
                              setPlanFeedback('Pace updated in draft. Save settings to apply it.')
                            }} style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                              borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                              background: active ? 'rgba(59,130,246,0.08)' : 'rgba(2,6,23,0.3)',
                              border: active ? '1.5px solid rgba(96,165,250,0.2)' : '1px solid rgba(148,163,184,0.04)',
                              transition: 'all 0.2s ease',
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#bfdbfe' : '#94a3b8' }}>{opt.label}</div>
                                <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>~{opt.dailyTxTarget}/day</div>
                              </div>
                              {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 6px #60a5fa' }} />}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <label style={{ display: 'grid', gap: 5 }}>
                          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tx/day</span>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={routineBuilder.dailyTxTarget ?? ''}
                            onChange={(e) => patchRoutineBuilder({ dailyTxTarget: e.target.value })}
                            style={{
                              width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 11,
                              border: '1px solid rgba(96,165,250,0.12)', background: 'rgba(2,6,23,0.45)',
                              color: '#dbeafe', fontSize: 12, fontWeight: 800, outline: 'none',
                            }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 5 }}>
                          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Every min</span>
                          <input
                            type="number"
                            min="1"
                            max="240"
                            value={routineBuilder.intervalMinutes ?? ''}
                            onChange={(e) => patchRoutineBuilder({ intervalMinutes: e.target.value })}
                            style={{
                              width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 11,
                              border: '1px solid rgba(96,165,250,0.12)', background: 'rgba(2,6,23,0.45)',
                              color: '#dbeafe', fontSize: 12, fontWeight: 800, outline: 'none',
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Budget</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {ROUTINE_BUDGET_OPTIONS.map(opt => {
                          const active = routineBuilder.budget === opt.id
                          return (
                            <button key={opt.id} type="button" onClick={() => {
                              setRoutineBuilder(c => ({
                                ...c,
                                budget: opt.id,
                                maxDailySpendEth: opt.maxDailySpendEth,
                              }))
                              setPlanFeedback('Budget updated in draft. Save settings to apply it.')
                            }} style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                              borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                              background: active ? 'rgba(34,197,94,0.08)' : 'rgba(2,6,23,0.3)',
                              border: active ? '1.5px solid rgba(74,222,128,0.2)' : '1px solid rgba(148,163,184,0.04)',
                              transition: 'all 0.2s ease',
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#bbf7d0' : '#94a3b8' }}>{opt.label}</div>
                                <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{opt.maxDailySpendEth} ETH</div>
                              </div>
                              {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />}
                            </button>
                          )
                        })}
                      </div>
                      <label style={{ display: 'grid', gap: 5, marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          ETH permission / day
                        </span>
                        <input
                          type="number"
                          min="0.0001"
                          max="1"
                          step="0.0001"
                          value={routineBuilder.maxDailySpendEth ?? ''}
                          onChange={(e) => patchRoutineBuilder({ maxDailySpendEth: e.target.value })}
                          style={{
                            width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 11,
                            border: '1px solid rgba(74,222,128,0.12)', background: 'rgba(2,6,23,0.45)',
                            color: '#dcfce7', fontSize: 12, fontWeight: 800, outline: 'none',
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Templates */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={labelStyle}>Templates</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ROUTINE_QUICK_STARTS.map(preset => (
                        <button key={preset.id} type="button" onClick={() => applyQuickStart(preset)} style={{
                          padding: '8px 16px', borderRadius: 999,
                          border: '1px solid rgba(148,163,184,0.06)', background: 'rgba(15,23,42,0.5)',
                          color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 0.15s ease', letterSpacing: '-0.01em',
                        }}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced prompt */}
                  <details style={{ ...innerCard, marginBottom: hasPlan ? 16 : 0 }}>
                    <summary style={{ fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer', letterSpacing: '-0.01em' }}>
                      Custom prompt
                    </summary>
                    <textarea
                      value={routineBuilder.customPrompt ?? ''}
                      onChange={(e) => patchRoutineBuilder({ customPrompt: e.target.value })}
                      placeholder="Describe the routine you want in plain language..."
                      rows={3}
                      style={{
                        marginTop: 12, width: '100%', resize: 'vertical', minHeight: 72,
                        padding: '12px 14px', borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.06)', background: 'rgba(2,6,23,0.5)',
                        color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, outline: 'none', boxSizing: 'border-box',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                  </details>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginTop: 16,
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))',
                    border: '1px solid rgba(148,163,184,0.07)',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
                        Save manual settings
                      </div>
                      <div style={{ marginTop: 3, fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                        Activity, tx/day, interval and ETH permission update the dashboard only after saving.
                      </div>
                    </div>
                    <button type="button" onClick={handleSaveRoutineSettings} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: '1px solid rgba(125,211,252,0.22)',
                      background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(59,130,246,0.12))',
                      color: '#bae6fd',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      letterSpacing: '-0.01em',
                    }}>
                      <CheckCircle2 size={13} />
                      Save settings
                    </button>
                  </div>

                  {/* Agent brief */}
                  {hasPlan && (
                    <div style={innerCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <Bot size={12} color="#818cf8" />
                        <span style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Agent reasoning</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.65, fontWeight: 400 }}>{agentBrief}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════ */}
            {/*  SECTION: Queue                        */}
            {/* ══════════════════════════════════════ */}
            {hasPlan && (
              <div style={{ ...glassCard, marginBottom: 10, overflow: 'hidden' }}>
                <button type="button" onClick={() => setOpenSections(p => ({ ...p, queue: !p.queue }))} style={sectionBtn(openSections.queue)}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))',
                    border: '1px solid rgba(245,158,11,0.08)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Zap size={14} color="#fbbf24" />
                  </div>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Queue</span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: isPlanApproved ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                    color: isPlanApproved ? '#4ade80' : '#fbbf24',
                  }}>{plannedCount}</span>
                  <ChevronRight size={15} color="#475569" style={{
                    transform: openSections.queue ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease',
                  }} />
                </button>
                {openSections.queue && (
                  <div style={sectionBody}>
                    {/* Timing */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                      padding: '10px 14px', borderRadius: 11, ...innerCard,
                    }}>
                      <Clock size={13} color="#475569" />
                      <span style={{ fontSize: 12, color: '#64748b', flex: 1, fontWeight: 500 }}>
                        {timeline.length > 0 ? `~${timeline[0].timeLabel} \u00b7 every ${agentState.settings.intervalMinutes}m` : 'Generate a plan first'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: isPlanApproved ? '#4ade80' : '#f59e0b',
                      }}>
                        {isPlanApproved ? 'Approved' : 'Draft'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: 6 }}>
                      {Array.isArray(latestPlan?.queue) && latestPlan.queue.slice(0, 10).map((item, idx) => (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', borderRadius: 12,
                          background: 'rgba(2,6,23,0.35)', border: '1px solid rgba(148,163,184,0.03)',
                          animation: `agentFadeIn ${0.08 + idx * 0.03}s ease`,
                        }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', flexShrink: 0,
                            background: item.status === 'completed' ? 'rgba(34,197,94,0.1)' : item.status === 'executing' ? 'rgba(59,130,246,0.1)' : 'rgba(148,163,184,0.06)',
                            color: item.status === 'completed' ? '#4ade80' : item.status === 'executing' ? '#60a5fa' : '#475569',
                            fontSize: 10, fontWeight: 800,
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{item.title}</div>
                            {item.reason && <div style={{ fontSize: 11, color: '#475569', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: item.status === 'completed' ? 'rgba(34,197,94,0.08)' : item.status === 'executing' ? 'rgba(59,130,246,0.08)' : 'rgba(148,163,184,0.06)',
                              color: item.status === 'completed' ? '#4ade80' : item.status === 'executing' ? '#60a5fa' : item.requiresApproval && item.status === 'draft' ? '#f59e0b' : '#64748b',
                            }}>
                              {item.requiresApproval && item.status === 'draft' ? 'pending' : item.status}
                            </span>
                            {item.requiresApproval && item.status === 'draft' && (
                              <button type="button" onClick={() => { approveQueuedAction(item.id); reloadState() }} style={{
                                padding: '4px 10px', borderRadius: 7, border: 'none',
                                background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                              }}>
                                OK
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isPlanApproved && (
                      <button type="button" onClick={() => {
                        approveCurrentPlan()
                        appendLog({ status: 'info', title: 'Plan approved', summary: 'The agent can now execute this plan.' })
                        setPlanFeedback('Plan approved — start when ready.')
                        reloadState()
                      }} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        width: '100%', marginTop: 16, padding: '11px', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06))',
                        color: '#a5b4fc', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}>
                        <Sparkles size={13} />
                        Approve All
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════ */}
            {/*  SECTION: Activity                     */}
            {/* ══════════════════════════════════════ */}
            <div style={{ ...glassCard, marginBottom: 10, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenSections(p => ({ ...p, activity: !p.activity }))} style={sectionBtn(openSections.activity)}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.06))',
                  border: '1px solid rgba(34,197,94,0.08)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Activity size={14} color="#4ade80" />
                </div>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Activity</span>
                {agentState.logs.length > 0 && (
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.08)', color: '#4ade80' }}>
                    {agentState.logs.length}
                  </span>
                )}
                <ChevronRight size={15} color="#475569" style={{
                  transform: openSections.activity ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease',
                }} />
              </button>
              {openSections.activity && (
                <div style={sectionBody}>
                  {agentState.logs.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                      <button type="button" onClick={() => { clearAgentLogs(); reloadState() }} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7,
                        background: 'transparent', border: '1px solid rgba(148,163,184,0.06)',
                        color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>
                        <Trash2 size={10} /> Clear
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: 6 }}>
                    {agentState.logs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 20px', color: '#334155', fontSize: 13, fontWeight: 500 }}>
                        No activity yet
                      </div>
                    ) : agentState.logs.slice(0, 10).map((log, idx) => (
                      <div key={log.id} style={{
                        padding: '11px 14px', borderRadius: 12, background: 'rgba(2,6,23,0.35)',
                        border: '1px solid rgba(148,163,184,0.03)',
                        animation: `agentFadeIn ${0.06 + idx * 0.03}s ease`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                              background: log.status === 'success' ? '#22c55e' : log.status === 'failed' || log.status === 'blocked' ? '#ef4444' : '#6366f1',
                              boxShadow: log.status === 'success' ? '0 0 6px #22c55e' : 'none',
                            }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{log.title}</span>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
                            color: log.status === 'success' ? '#4ade80' : log.status === 'failed' || log.status === 'blocked' ? '#f87171' : '#64748b',
                          }}>{log.status}</span>
                        </div>
                        {compactSummary(log.summary) && (
                          <p style={{ margin: '4px 0 0 14px', fontSize: 12, color: '#475569', lineHeight: 1.4, fontWeight: 400 }}>
                            {compactSummary(log.summary)}
                          </p>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginLeft: 14 }}>
                          <span style={{ fontSize: 10, color: '#334155' }}>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {log.txHash && (
                            <a href={`${NETWORKS.BASE.blockExplorerUrls[0]}/tx/${log.txHash}`} target="_blank" rel="noreferrer" style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              color: '#818cf8', fontSize: 11, fontWeight: 600, textDecoration: 'none',
                            }}>
                              tx <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              ...glassCard,
              marginTop: 18,
              marginBottom: 24,
              padding: 'clamp(18px, 2vw, 26px)',
              background: 'linear-gradient(135deg, rgba(14,165,233,0.05), rgba(15,23,42,0.62))',
              border: '1px solid rgba(125,211,252,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(14,165,233,0.08)',
                  border: '1px solid rgba(125,211,252,0.12)',
                }}>
                  <Shield size={17} color="#7dd3fc" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>How Agent Mode Works</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>One setup, one plan, then the VPS worker keeps the routine moving.</div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
              }}>
                {[
                  ['1', 'Unlock', 'Pay once with your main wallet to enable Agent Mode.'],
                  ['2', 'Give permission', 'Create or update the agent wallet with a daily ETH cap.'],
                  ['3', 'Generate plan', 'Pick the routine style and approve the action plan.'],
                  ['4', 'Run safely', 'The VPS worker executes approved BaseHub actions until limits stop it.'],
                ].map(([step, title, body]) => (
                  <div key={step} style={{
                    padding: '14px 15px',
                    borderRadius: 15,
                    background: 'rgba(2,6,23,0.35)',
                    border: '1px solid rgba(148,163,184,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                      <span style={{
                        width: 22,
                        height: 22,
                        borderRadius: 8,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(96,165,250,0.1)',
                        color: '#93c5fd',
                        fontSize: 11,
                        fontWeight: 900,
                      }}>{step}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>{body}</p>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 12,
                padding: '11px 13px',
                borderRadius: 13,
                background: 'rgba(250,204,21,0.05)',
                border: '1px solid rgba(250,204,21,0.08)',
                color: '#94a3b8',
                fontSize: 12,
                lineHeight: 1.5,
              }}>
                XP, NFTs, tokens, and transaction history belong to the agent wallet that sends the transactions. If the agent pauses, add ETH to that wallet or lower the daily limits.
              </div>
            </div>

          </>
      </div>
    </div>
  )
}
