import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, Copy, ExternalLink, Lock, Play, Power, RefreshCw, Send, Trash2, Eye, EyeOff, Zap, Clock, Target, Wallet, MessageSquare, Activity, ChevronRight, Shield, Sparkles, Unlock } from 'lucide-react'
import { formatEther, parseEther } from 'viem'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import { getAddressExplorerUrl, NETWORKS } from '../config/networks'
import { getEnabledTargets } from '../features/agent-mode/agentCatalog'
import {
  AGENT_GAS_BUFFER_WEI,
  AGENT_INPUT_MODES,
  AGENT_PUMPHUB_MODES,
  AGENT_STATUSES,
  AGENT_TARGETS,
} from '../features/agent-mode/agentConstants'
import { encryptPrivateKey, decryptPrivateKey, isEncryptedWallet, isLegacyWallet } from '../features/agent-mode/agentCrypto'
import { normalizeAgentError } from '../features/agent-mode/agentErrors'
import { executeAgentAction } from '../features/agent-mode/agentExecutor'
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
  createAgentWallet,
  deleteAgentWallet,
  getNextPlannedAction,
  loadAgentState,
  migrateWalletToEncrypted,
  resetAgentPlan,
  setAgentStatus,
  updateQueuedAction,
  updateAgentSettings,
} from '../features/agent-mode/agentStore'
import { createBurnerWallet, getBurnerBalance, maskPrivateKey } from '../features/agent-mode/agentWallet'

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

  return { intensity, budget, goals }
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

function buildRoutinePromptFromSelections({ intensity, budget, goals }) {
  const intensityConfig = ROUTINE_INTENSITY_OPTIONS.find((item) => item.id === intensity) || ROUTINE_INTENSITY_OPTIONS[2]
  const budgetConfig = ROUTINE_BUDGET_OPTIONS.find((item) => item.id === budget) || ROUTINE_BUDGET_OPTIONS[1]
  const selectedGoals = ROUTINE_GOAL_OPTIONS.filter((goal) => goals[goal.id]).map((goal) => goal.label.toLowerCase())
  const goalText = selectedGoals.length ? selectedGoals.join(', ') : 'light BaseHub activity'

  return `Create a full BaseHub daily routine for me. Keep it human-looking and varied. Plan around ${intensityConfig.dailyTxTarget} actions, about every ${intensityConfig.intervalMinutes} minutes, stay under ${budgetConfig.maxDailySpendEth} ETH, and include ${goalText}. Discover trade tokens and free NFT targets yourself inside BaseHub.`
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

function getStartGate({ wallet, enabledTargets, balance, settings }) {
  if (!wallet?.address) {
    return { ok: false, reason: 'Create a burner wallet first.' }
  }

  if (!enabledTargets.length) {
    return { ok: false, reason: 'Enable at least one BaseHub action.' }
  }

  const minimumWei = getMinimumBalanceWei(enabledTargets, settings)
  if ((balance?.raw || 0n) < minimumWei) {
    return {
      ok: false,
      reason: `Fund the burner with at least ${formatEther(minimumWei)} ETH to start.`,
    }
  }

  return { ok: true }
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
  const [agentState, setAgentState] = useState(() => loadAgentState())
  const [form, setForm] = useState(() => createFormFromState(loadAgentState()))
  const [error, setError] = useState(null)
  const [plannerMode, setPlannerMode] = useState('idle')
  const [planFeedback, setPlanFeedback] = useState('')
  const [plannerIssue, setPlannerIssue] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [showPrivateKey, setShowPrivateKey] = useState(false)
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
  const [memorySnapshot, setMemorySnapshot] = useState({
    profile: null,
    memories: [],
    runs: [],
    reflections: [],
    available: false,
    setupError: null,
  })
  const [activeTab, setActiveTab] = useState('chat')
  const [openSections, setOpenSections] = useState(() => {
    const _initState = loadAgentState()
    const _hasPlan = !!(_initState.currentPlan?.actions?.length || _initState.plans?.[0]?.actions?.length)
    return { routine: !_hasPlan, queue: _hasPlan, activity: false, wallet: false }
  })
  const executionLockRef = useRef(false)
  const chatEndRef = useRef(null)

  // ─── PIN / Encryption state ───
  // The decrypted private key lives ONLY in memory (never localStorage)
  const sessionKeyRef = useRef(null)
  const [isWalletLocked, setIsWalletLocked] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinModalMode, setPinModalMode] = useState('unlock') // 'unlock' | 'create' | 'migrate'
  const [pinConfirmInput, setPinConfirmInput] = useState('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [pendingStartAfterUnlock, setPendingStartAfterUnlock] = useState(false)

  const reloadState = useCallback(() => {
    const next = loadAgentState()
    setAgentState(next)
    setForm(createFormFromState(next))
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
    setRoutineBuilder(deriveRoutineBuilderState(form))
  }, [
    form.dailyTxTarget,
    form.maxDailySpendEth,
    form.enabledTargetIds,
    form.freeMintEnabled,
  ])

  useEffect(() => {
    let cancelled = false

    async function refreshBalance() {
      if (!agentState.wallet?.address) {
        setBalance({ raw: 0n, formatted: '0' })
        return
      }

      try {
        const nextBalance = await getBurnerBalance(agentState.wallet.address)
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
  }, [agentState.wallet?.address])

  useEffect(() => {
    let cancelled = false

    async function loadMemory() {
      if (!agentState.wallet?.address) {
        setMemorySnapshot({ profile: null, memories: [], runs: [], reflections: [], available: false, setupError: null })
        return
      }
      const snapshot = await fetchAgentMemory(agentState.wallet.address)
      if (!cancelled) setMemorySnapshot(snapshot)
    }

    loadMemory()
    return () => {
      cancelled = true
    }
  }, [agentState.wallet?.address, agentState.logs.length, agentState.currentPlan?.id])

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
  const walletExplorerUrl = agentState.wallet?.address
    ? getAddressExplorerUrl(NETWORKS.BASE.chainId, agentState.wallet.address)
    : null
  const startGate = useMemo(
    () => getStartGate({ wallet: agentState.wallet, enabledTargets, balance, settings: agentState.settings }),
    [agentState.wallet, enabledTargets, balance, agentState.settings]
  )
  const hasPlan = Boolean(latestPlan?.actions?.length)
  const isPlanApproved = Boolean(latestPlan?.approvedAt)
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
    setRoutineBuilder({
      intensity: preset.intensity,
      budget: preset.budget,
      goals: { ...preset.goals },
    })
    patchForm({
      userPrompt: preset.prompt,
    })
  }, [patchForm])

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
            walletAddress: agentState.wallet?.address || '',
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
  }, [agentState.wallet?.address, chatDraft, chatMessages, form, patchForm, reloadState])

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
              walletAddress: current.wallet?.address,
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
            walletAddress: current.wallet?.address,
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
    []
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
    if (!current.wallet?.address) {
      setPlanFeedback('')
      setPlannerMode('idle')
      setError('Create a burner wallet first.')
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
          walletAddress: current.wallet.address,
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
  }, [form, refreshPlan, reloadState, syncSettings])

  const handleAutoPlan = useCallback(async () => {
    setError(null)
    setPlannerIssue('')
    const current = loadAgentState()
    if (current.status === AGENT_STATUSES.ACTIVE) {
      setAgentStatus(AGENT_STATUSES.DISABLED)
      reloadState()
      setPlanFeedback('Current run stopped. Building a fresh AI draft...')
    }
    const enabledTargetIds = buildEnabledTargetIdsFromGoals(routineBuilder.goals)
    if (enabledTargetIds.length === 0) {
      setError('Select at least one routine goal first.')
      return
    }

    const selectedIntensity =
      ROUTINE_INTENSITY_OPTIONS.find((item) => item.id === routineBuilder.intensity) || ROUTINE_INTENSITY_OPTIONS[2]
    const selectedBudget =
      ROUTINE_BUDGET_OPTIONS.find((item) => item.id === routineBuilder.budget) || ROUTINE_BUDGET_OPTIONS[1]
    const autoPrompt = buildRoutinePromptFromSelections(routineBuilder)
    const nextForm = {
      ...form,
      userPrompt: autoPrompt,
      plannerInputMode: AGENT_INPUT_MODES.PROMPT,
      llmEnabled: true,
      allowedActionTypes: buildAllowedActionTypesFromGoals(routineBuilder.goals),
      dailyTxTarget: selectedIntensity.dailyTxTarget,
      intervalMinutes: selectedIntensity.intervalMinutes,
      maxDailySpendEth: selectedBudget.maxDailySpendEth,
      enabledTargetIds,
      freeMintEnabled: !!routineBuilder.goals.freeMint,
      pumpHubTradeMode: AGENT_PUMPHUB_MODES.LATEST,
    }
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
  }, [form, refreshPlan, reloadState, routineBuilder, syncSettings])

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

      const liveBalance = current.wallet?.address
        ? await getBurnerBalance(current.wallet.address)
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

      if (!sessionKeyRef.current) {
        appendLog({ status: 'blocked', title: 'Wallet locked', summary: 'Unlock the wallet with your PIN to continue.' })
        reloadState()
        return
      }

      updateQueuedAction(action.id, {
        status: 'executing',
        scheduledFor: new Date().toISOString(),
      })
      reloadState()

      const result = await executeAgentAction({
        action,
        privateKey: sessionKeyRef.current,
        settings: current.settings,
        logs: current.logs,
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
      await safeWriteMemory({
        eventType: 'run',
        walletAddress: current.wallet.address,
        status: 'success',
        summary: action.summary,
        plannedActions: plan?.actions?.length || 0,
        executedAction: action.title,
      })
      await safeWriteMemory({
        eventType: 'reflection',
        walletAddress: current.wallet.address,
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
      if (current?.wallet?.address) {
        await safeWriteMemory({
          eventType: 'reflection',
          walletAddress: current.wallet.address,
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
  }, [pauseForFunding, refreshPlan, reloadState])

  const startAgentRun = useCallback(() => {
    if (!startGate.ok) {
      setError(startGate.reason)
      return false
    }
    setAgentStatus(AGENT_STATUSES.ACTIVE)
    appendLog({ status: 'info', title: 'Agent started', summary: 'Agent is now following today plan.' })
    writeAgentMemoryEvent({
      eventType: 'profile',
      walletAddress: agentState.wallet.address,
      objective: autoObjective,
      currentIntent: latestPlan?.nextMove || '',
      plannerMode,
    })
    reloadState()
    window.setTimeout(() => runNextAction(), 150)
    return true
  }, [agentState.wallet?.address, autoObjective, latestPlan?.nextMove, plannerMode, reloadState, runNextAction, startGate])

  useEffect(() => {
    if (!agentState.wallet?.address) return undefined
    if (!sessionKeyRef.current) return undefined
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
    agentState.wallet?.address,
    isWalletLocked,
    runNextAction,
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
  const isAgentActive = agentState.status === AGENT_STATUSES.ACTIVE

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #080d1a 0%, #060a14 40%, #030712 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <EmbedMeta
        title="Agent Mode"
        description="Create a burner wallet in BaseHub and let it run BaseHub routines from its own address."
        url="https://www.basehub.fun/agent"
      />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 100px' }}>
        <BackButton />

        {/* ═══════════════════════════════════════════ */}
        {/*  WELCOME — No wallet                       */}
        {/* ═══════════════════════════════════════════ */}
        {!agentState.wallet ? (
          <div style={{
            position: 'relative', overflow: 'hidden',
            ...glassCard,
            padding: '56px 36px 52px', textAlign: 'center',
            maxWidth: 480, margin: '56px auto',
            animation: 'agentFadeIn 0.7s ease',
            boxShadow: '0 8px 60px rgba(59,130,246,0.06), 0 0 0 1px rgba(148,163,184,0.04)',
          }}>
            {/* Ambient glow */}
            <div style={{
              position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
              width: 400, height: 400,
              background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(59,130,246,0.04) 40%, transparent 70%)',
              filter: 'blur(60px)', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -80, right: -80, width: 240, height: 240,
              background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
              filter: 'blur(50px)', pointerEvents: 'none',
            }} />

            <div style={{
              width: 68, height: 68, borderRadius: 20, margin: '0 auto 28px',
              background: 'linear-gradient(145deg, rgba(99,102,241,0.15), rgba(59,130,246,0.1))',
              border: '1px solid rgba(129,140,248,0.12)',
              display: 'grid', placeItems: 'center', position: 'relative',
              boxShadow: '0 0 40px rgba(99,102,241,0.1)',
            }}>
              <Bot size={32} color="#a5b4fc" />
            </div>

            <h1 style={{
              margin: '0 0 10px', fontSize: 26, fontWeight: 800,
              background: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.03em',
            }}>
              Agent Mode
            </h1>
            <p style={{
              margin: '0 auto 40px', fontSize: 14, color: '#64748b',
              lineHeight: 1.7, maxWidth: 340, fontWeight: 400,
            }}>
              Automated on-chain routines from an isolated burner wallet. Set your strategy, approve the plan, and let it run.
            </p>

            <div style={{ display: 'grid', gap: 8, textAlign: 'left', marginBottom: 40 }}>
              {[
                { icon: <Wallet size={16} />, t: 'Create wallet', d: 'PIN-encrypted burner on Base' },
                { icon: <Target size={16} />, t: 'Configure routine', d: 'Activity types, pace and budget' },
                { icon: <Play size={16} />, t: 'Approve & launch', d: 'Review the plan, then start' },
              ].map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderRadius: 14, background: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(148,163,184,0.04)',
                  transition: 'border-color 0.2s ease',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(59,130,246,0.06))',
                    border: '1px solid rgba(129,140,248,0.08)',
                    display: 'grid', placeItems: 'center', color: '#818cf8', flexShrink: 0,
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>{s.t}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => {
              setPinModalMode('create'); setPinInput(''); setPinConfirmInput(''); setPinError(''); setShowPinModal(true)
            }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '13px 36px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
              transition: 'all 0.2s ease', letterSpacing: '-0.01em',
            }}>
              <Wallet size={16} />
              Create Wallet
            </button>
          </div>
        ) : (
          /* ═══════════════════════════════════════════ */
          /*  DASHBOARD                                 */
          /* ═══════════════════════════════════════════ */
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

            {/* ─── Wallet locked ─── */}
            {isWalletLocked && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(217,119,6,0.03))',
                border: '1px solid rgba(245,158,11,0.1)',
                marginBottom: 16, animation: 'agentFadeIn 0.3s ease',
              }}>
                <Lock size={14} color="#f59e0b" />
                <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600, flex: 1, letterSpacing: '-0.01em' }}>
                  {isLegacyWallet(agentState.wallet) ? 'Legacy wallet — encrypt with a PIN' : 'Wallet locked — unlock to run'}
                </span>
                <button type="button" onClick={() => {
                  setPinModalMode(isLegacyWallet(agentState.wallet) ? 'migrate' : 'unlock')
                  setPinInput(''); setPinConfirmInput(''); setPinError(''); setShowPinModal(true)
                }} style={{
                  padding: '6px 16px', borderRadius: 9, border: 'none',
                  background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}>
                  {isLegacyWallet(agentState.wallet) ? 'Set PIN' : 'Unlock'}
                </button>
              </div>
            )}

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
                    <span style={{ fontSize: 11, color: '#334155', marginLeft: 'auto', fontWeight: 500 }}>Tab must stay open</span>
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
              {!hasPlan && (
                <button type="button" disabled={isPlanning || isWalletLocked} onClick={() => {
                  handleAutoPlan().catch(e => { setPlanFeedback(''); setPlannerMode('backup'); setError(normalizeAgentError(e).shortMessage) })
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, border: 'none',
                  background: isPlanning || isWalletLocked ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: isPlanning || isWalletLocked ? 'not-allowed' : 'pointer',
                  boxShadow: isPlanning || isWalletLocked ? 'none' : '0 2px 16px rgba(99,102,241,0.2)',
                  transition: 'all 0.2s ease',
                }}>
                  {isPlanning ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                  {isPlanning ? 'Planning\u2026' : 'Generate Plan'}
                </button>
              )}
              {hasPlan && !isPlanApproved && (
                <button type="button" onClick={() => {
                  approveCurrentPlan()
                  appendLog({ status: 'info', title: 'Plan approved', summary: 'The agent can now execute this plan.' })
                  setPlanFeedback('Plan approved — start when ready.')
                  reloadState()
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em',
                  boxShadow: '0 2px 16px rgba(99,102,241,0.2)', transition: 'all 0.2s ease',
                }}>
                  <Sparkles size={14} />
                  Approve Plan
                </button>
              )}
              {isPlanApproved && !isAgentActive && (
                <button type="button" disabled={!startGate.ok} onClick={() => {
                  if (!startGate.ok) { setError(startGate.reason); return }
                  if (isWalletLocked) {
                    setPinModalMode(isLegacyWallet(agentState.wallet) ? 'migrate' : 'unlock')
                    setPinError('')
                    setPinInput('')
                    setPinConfirmInput('')
                    setPendingStartAfterUnlock(true)
                    setShowPinModal(true)
                    return
                  }
                  startAgentRun()
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, border: 'none',
                  background: startGate.ok ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(34,197,94,0.15)',
                  color: startGate.ok ? '#fff' : '#475569',
                  fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: startGate.ok ? 'pointer' : 'not-allowed',
                  boxShadow: startGate.ok ? '0 2px 16px rgba(34,197,94,0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}>
                  <Play size={14} />
                  {isWalletLocked ? 'Start & Unlock' : 'Start'}
                </button>
              )}
              {isAgentActive && (
                <button type="button" onClick={() => {
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
                            <button key={opt.id} type="button" onClick={() => setRoutineBuilder(c => ({ ...c, intensity: opt.id }))} style={{
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
                    </div>
                    <div>
                      <div style={labelStyle}>Budget</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {ROUTINE_BUDGET_OPTIONS.map(opt => {
                          const active = routineBuilder.budget === opt.id
                          return (
                            <button key={opt.id} type="button" onClick={() => setRoutineBuilder(c => ({ ...c, budget: opt.id }))} style={{
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
                      value={form.userPrompt}
                      onChange={(e) => patchForm({ userPrompt: e.target.value })}
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

            {/* ══════════════════════════════════════ */}
            {/*  SECTION: Wallet                       */}
            {/* ══════════════════════════════════════ */}
            <div style={{ ...glassCard, marginBottom: 10, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenSections(p => ({ ...p, wallet: !p.wallet }))} style={sectionBtn(openSections.wallet)}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.06))',
                  border: '1px solid rgba(59,130,246,0.08)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Shield size={14} color="#60a5fa" />
                </div>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Wallet</span>
                <span style={{ fontSize: 11, color: '#334155', fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500 }}>
                  {agentState.wallet.address.slice(0, 6)}\u2026{agentState.wallet.address.slice(-4)}
                </span>
                <ChevronRight size={15} color="#475569" style={{
                  transform: openSections.wallet ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease',
                }} />
              </button>
              {openSections.wallet && (
                <div style={{ ...sectionBody, display: 'grid', gap: 12 }}>
                  {/* Address */}
                  <div style={innerCard}>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>Address</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', fontFamily: "'SF Mono', 'Fira Code', monospace", overflowWrap: 'anywhere', lineHeight: 1.6, letterSpacing: '0.01em' }}>
                      {agentState.wallet.address}
                    </div>
                  </div>

                  {/* Balance */}
                  <div style={{ ...innerCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 4 }}>Balance</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{formatEth(balance.formatted)}</div>
                    </div>
                    <div style={{
                      padding: '5px 12px', borderRadius: 8,
                      background: startGate.ok ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                      color: startGate.ok ? '#4ade80' : '#f59e0b', fontSize: 11, fontWeight: 700,
                    }}>
                      {startGate.ok ? 'Funded' : 'Low balance'}
                    </div>
                  </div>

                  {/* Private Key */}
                  <div style={innerCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ ...labelStyle, marginBottom: 0 }}>Private Key</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5,
                          background: isWalletLocked ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                          color: isWalletLocked ? '#f59e0b' : '#4ade80', fontSize: 10, fontWeight: 700,
                        }}>
                          {isWalletLocked ? <Lock size={9} /> : <Unlock size={9} />}
                          {isWalletLocked ? 'Locked' : 'Open'}
                        </span>
                        {!isWalletLocked && sessionKeyRef.current && (
                          <button type="button" onClick={() => setShowPrivateKey(c => !c)} style={{
                            background: 'transparent', border: 'none', padding: '2px 6px',
                            color: '#475569', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            {showPrivateKey ? <EyeOff size={10} /> : <Eye size={10} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11,
                      color: showPrivateKey && !isWalletLocked ? '#fca5a5' : '#334155',
                      overflowWrap: 'anywhere', lineHeight: 1.5,
                    }}>
                      {showPrivateKey && !isWalletLocked && sessionKeyRef.current
                        ? sessionKeyRef.current
                        : isEncryptedWallet(agentState.wallet)
                          ? 'AES-256-GCM encrypted'
                          : maskPrivateKey(agentState.wallet.privateKey || '')}
                    </div>
                  </div>

                  {/* Lock controls */}
                  <div style={{
                    padding: '12px 16px', borderRadius: 13,
                    background: isWalletLocked ? 'rgba(245,158,11,0.04)' : 'rgba(34,197,94,0.04)',
                    border: `1px solid ${isWalletLocked ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isWalletLocked ? '#f59e0b' : '#4ade80' }}>
                      {isWalletLocked
                        ? isLegacyWallet(agentState.wallet) ? 'Legacy — needs PIN' : 'Enter PIN to unlock'
                        : 'Session unlocked'}
                    </span>
                    {isWalletLocked ? (
                      <button type="button" onClick={() => {
                        setPinModalMode(isLegacyWallet(agentState.wallet) ? 'migrate' : 'unlock')
                        setPinInput(''); setPinConfirmInput(''); setPinError(''); setShowPinModal(true)
                      }} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                      }}>
                        <Unlock size={11} />
                        {isLegacyWallet(agentState.wallet) ? 'Set PIN' : 'Unlock'}
                      </button>
                    ) : (
                      <button type="button" onClick={() => { sessionKeyRef.current = null; setIsWalletLocked(true); setShowPrivateKey(false) }} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 14px', borderRadius: 8,
                        background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(148,163,184,0.06)',
                        color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}>
                        <Lock size={11} /> Lock
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleCopy(agentState.wallet.address, 'address')} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9,
                      background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(148,163,184,0.06)',
                      color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                    }}>
                      <Copy size={11} />
                      {copiedKey === 'address' ? 'Copied' : 'Copy'}
                    </button>
                    {walletExplorerUrl && (
                      <a href={walletExplorerUrl} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9,
                        background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(148,163,184,0.06)',
                        color: '#94a3b8', fontSize: 11, fontWeight: 600, textDecoration: 'none',
                      }}>
                        <ExternalLink size={11} /> Explorer
                      </a>
                    )}
                    <button type="button" onClick={() => {
                      deleteAgentWallet(); sessionKeyRef.current = null; setIsWalletLocked(true); reloadState(); setShowPrivateKey(false)
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9,
                      marginLeft: 'auto',
                      background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(248,113,113,0.06)',
                      color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── PIN Modal ─── */}
      {showPinModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
          display: 'grid', placeItems: 'center',
          animation: 'agentFadeIn 0.2s ease',
        }}>
          <div style={{
            width: '100%', maxWidth: 380, padding: 32, borderRadius: 24,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
            border: '1px solid rgba(148,163,184,0.06)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(145deg, rgba(99,102,241,0.15), rgba(59,130,246,0.08))',
                border: '1px solid rgba(129,140,248,0.1)',
                display: 'grid', placeItems: 'center',
              }}>
                <Lock size={20} color="#a5b4fc" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                  {pinModalMode === 'create' ? 'Set PIN' : pinModalMode === 'migrate' ? 'Encrypt Wallet' : 'Unlock'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569', fontWeight: 400 }}>
                  {pinModalMode === 'create' ? 'Choose a PIN to encrypt your key'
                    : pinModalMode === 'migrate' ? 'Set a PIN for your existing key'
                    : 'Enter PIN to decrypt'}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>
                  {pinModalMode === 'unlock' ? 'PIN' : 'Choose PIN (4+ chars)'}
                </label>
                <input type="password" value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pinModalMode === 'unlock') document.getElementById('pin-submit-btn')?.click() }}
                  autoFocus placeholder="Enter PIN\u2026"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.08)',
                    color: '#f1f5f9', fontSize: 16, letterSpacing: '0.12em',
                    outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                  }}
                />
              </div>

              {(pinModalMode === 'create' || pinModalMode === 'migrate') && (
                <div>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>Confirm PIN</label>
                  <input type="password" value={pinConfirmInput}
                    onChange={(e) => { setPinConfirmInput(e.target.value); setPinError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('pin-submit-btn')?.click() }}
                    placeholder="Confirm\u2026"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.08)',
                      color: '#f1f5f9', fontSize: 16, letterSpacing: '0.12em',
                      outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {pinError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(248,113,113,0.08)',
                  color: '#fca5a5', fontSize: 13,
                }}>
                  <AlertTriangle size={12} /> {pinError}
                </div>
              )}

              {(pinModalMode === 'create' || pinModalMode === 'migrate') && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.06)',
                  color: '#f59e0b', fontSize: 11, lineHeight: 1.5, fontWeight: 500,
                }}>
                  If you lose this PIN the key cannot be recovered.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button"
                  onClick={() => {
                    setShowPinModal(false)
                    setPinInput('')
                    setPinConfirmInput('')
                    setPinError('')
                    setPendingStartAfterUnlock(false)
                  }}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12,
                    background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(148,163,184,0.06)',
                    color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >Cancel</button>
                <button id="pin-submit-btn" type="button" disabled={isDecrypting}
                  onClick={async () => {
                    const pin = pinInput.trim()
                    if (pin.length < 4) { setPinError('PIN must be at least 4 characters.'); return }
                    if (pinModalMode === 'create' || pinModalMode === 'migrate') {
                      if (pin !== pinConfirmInput.trim()) { setPinError('PINs do not match.'); return }
                    }
                    setIsDecrypting(true); setPinError('')
                    try {
                      if (pinModalMode === 'create') {
                        const raw = createBurnerWallet()
                        const encrypted = await encryptPrivateKey(raw.privateKey, pin)
                        createAgentWallet({ address: raw.address, encryptedKey: encrypted, createdAt: raw.createdAt })
                        sessionKeyRef.current = raw.privateKey
                        setIsWalletLocked(false)
                        setOpenSections(prev => ({ ...prev, routine: true }))
                        reloadState(); setShowPinModal(false); setPinInput(''); setPinConfirmInput('')
                        if (pendingStartAfterUnlock) {
                          setPendingStartAfterUnlock(false)
                          window.setTimeout(() => startAgentRun(), 120)
                        }
                      } else if (pinModalMode === 'migrate') {
                        const legacyKey = agentState.wallet.privateKey
                        if (!legacyKey) { setPinError('No private key found.'); return }
                        const encrypted = await encryptPrivateKey(legacyKey, pin)
                        migrateWalletToEncrypted(encrypted)
                        sessionKeyRef.current = legacyKey
                        setIsWalletLocked(false); reloadState(); setShowPinModal(false); setPinInput(''); setPinConfirmInput('')
                        if (pendingStartAfterUnlock) {
                          setPendingStartAfterUnlock(false)
                          window.setTimeout(() => startAgentRun(), 120)
                        }
                      } else {
                        const decrypted = await decryptPrivateKey(agentState.wallet.encryptedKey, pin)
                        sessionKeyRef.current = decrypted
                        setIsWalletLocked(false); setShowPinModal(false); setPinInput('')
                        if (pendingStartAfterUnlock) {
                          setPendingStartAfterUnlock(false)
                          window.setTimeout(() => startAgentRun(), 120)
                        }
                      }
                    } catch (cryptoErr) { setPinError(cryptoErr.message || 'Decryption failed.') }
                    finally { setIsDecrypting(false) }
                  }}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                    background: isDecrypting ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: isDecrypting ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: isDecrypting ? 'none' : '0 2px 12px rgba(99,102,241,0.15)',
                  }}
                >
                  {isDecrypting ? (
                    <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> {pinModalMode === 'unlock' ? 'Decrypting\u2026' : 'Encrypting\u2026'}</>
                  ) : (
                    <>{pinModalMode === 'unlock' ? <Unlock size={13} /> : <Shield size={13} />} {pinModalMode === 'unlock' ? 'Unlock' : 'Encrypt'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
