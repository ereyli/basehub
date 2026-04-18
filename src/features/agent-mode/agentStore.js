import { formatEther } from 'viem'
import { AGENT_STORAGE_KEY, AGENT_STATUSES, DEFAULT_AGENT_SETTINGS } from './agentConstants'
import { createBurnerWallet } from './agentWallet'

const MAX_PLANS = 20
const MAX_LOGS = 150

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function createDefaultState() {
  return {
    version: 3,
    status: AGENT_STATUSES.DISABLED,
    wallet: null,
    settings: { ...DEFAULT_AGENT_SETTINGS },
    currentPlan: null,
    plans: [],
    logs: [],
  }
}

function normalizeQueue(queue = []) {
  return Array.isArray(queue)
    ? queue.map((item, index) => ({
        id: item.id || createId('queue'),
        status: item.status || 'draft',
        actionType: item.actionType || item.targetId || 'unknown',
        title: item.title || 'Queued action',
        reason: item.reason || item.summary || '',
        params: item.params || item.payload || {},
        priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : index + 1,
        riskLevel: item.riskLevel || 'low',
        estimatedCostEth: item.estimatedCostEth || '0',
        estimatedSpendWei: item.estimatedSpendWei || '0',
        requiresApproval: Boolean(item.requiresApproval),
        executorMapping: item.executorMapping || item.actionType || item.targetId || 'unknown',
        targetType: item.targetType || 'simple',
        approvedAt: item.approvedAt || null,
        scheduledFor: item.scheduledFor || null,
        executedAt: item.executedAt || null,
        result: item.result || null,
        error: item.error || null,
      }))
    : []
}

function getPendingActionsFromQueue(queue = []) {
  return normalizeQueue(queue)
    .filter((item) => ['draft', 'approved', 'scheduled', 'executing'].includes(item.status))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .map((item) => ({
      id: item.id,
      targetId: item.executorMapping || item.actionType,
      targetType: item.targetType,
      title: item.title,
      summary: item.reason,
      estimatedSpendWei: item.estimatedSpendWei || '0',
      estimatedSpendEth: item.estimatedCostEth || '0',
      payload: item.params || {},
      status: item.status,
      requiresApproval: item.requiresApproval,
      priority: item.priority,
    }))
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return null
  const queue = normalizeQueue(plan.queue || plan.actions || [])
  return {
    ...plan,
    queue,
    actions: getPendingActionsFromQueue(queue),
  }
}

function sanitizeState(raw) {
  const base = createDefaultState()
  return {
    ...base,
    ...(raw || {}),
    settings: {
      ...base.settings,
      ...(raw?.settings || {}),
      plannerInputMode:
        typeof raw?.settings?.plannerInputMode === 'string'
          ? raw.settings.plannerInputMode
          : base.settings.plannerInputMode,
      allowedActionTypes: Array.isArray(raw?.settings?.allowedActionTypes)
        ? raw.settings.allowedActionTypes
        : base.settings.allowedActionTypes,
      enabledTargetIds: Array.isArray(raw?.settings?.enabledTargetIds)
        ? raw.settings.enabledTargetIds
        : base.settings.enabledTargetIds,
      llmEnabled:
        typeof raw?.settings?.llmEnabled === 'boolean'
          ? raw.settings.llmEnabled
          : base.settings.llmEnabled,
      userPrompt:
        typeof raw?.settings?.userPrompt === 'string'
          ? raw.settings.userPrompt
          : base.settings.userPrompt,
      pumpHubTokenAddress:
        typeof raw?.settings?.pumpHubTokenAddress === 'string'
          ? raw.settings.pumpHubTokenAddress
          : base.settings.pumpHubTokenAddress,
      pumpHubTradeMode:
        typeof raw?.settings?.pumpHubTradeMode === 'string'
          ? raw.settings.pumpHubTradeMode
          : base.settings.pumpHubTradeMode,
      pumpHubWatchlist: Array.isArray(raw?.settings?.pumpHubWatchlist)
        ? raw.settings.pumpHubWatchlist
        : base.settings.pumpHubWatchlist,
      pumpHubTradeAmountEth:
        typeof raw?.settings?.pumpHubTradeAmountEth === 'string'
          ? raw.settings.pumpHubTradeAmountEth
          : base.settings.pumpHubTradeAmountEth,
      swapHubTradeAmountEth:
        typeof raw?.settings?.swapHubTradeAmountEth === 'string'
          ? raw.settings.swapHubTradeAmountEth
          : base.settings.swapHubTradeAmountEth,
      freeMintEnabled:
        typeof raw?.settings?.freeMintEnabled === 'boolean'
          ? raw.settings.freeMintEnabled
          : base.settings.freeMintEnabled,
    },
    currentPlan:
      raw?.currentPlan && typeof raw.currentPlan === 'object'
        ? normalizePlan(raw.currentPlan)
        : base.currentPlan,
    plans: Array.isArray(raw?.plans) ? raw.plans.slice(0, MAX_PLANS).map((plan) => normalizePlan(plan)).filter(Boolean) : [],
    logs: Array.isArray(raw?.logs) ? raw.logs.slice(0, MAX_LOGS) : [],
  }
}

export function loadAgentState() {
  try {
    const raw = localStorage.getItem(AGENT_STORAGE_KEY)
    if (!raw) return createDefaultState()
    return sanitizeState(JSON.parse(raw))
  } catch {
    return createDefaultState()
  }
}

export function saveAgentState(nextState) {
  const sanitized = sanitizeState(nextState)
  localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(sanitized))
  return sanitized
}

export function updateAgentState(updater) {
  const current = loadAgentState()
  const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
  return saveAgentState(next)
}

/**
 * Create a new agent wallet and store it with encrypted private key.
 * The caller is responsible for encrypting the private key before passing it here.
 *
 * @param {{ address: string, encryptedKey: object, createdAt: string }} walletData
 */
export function createAgentWallet(walletData) {
  return updateAgentState((current) => ({
    ...current,
    wallet: {
      address: walletData.address,
      encryptedKey: walletData.encryptedKey,
      createdAt: walletData.createdAt,
      // No plain-text privateKey stored
    },
    status: AGENT_STATUSES.DISABLED,
  }))
}

/**
 * Migrate a legacy wallet by replacing plain-text key with encrypted payload.
 * Called once when a legacy wallet is detected and user sets a PIN.
 *
 * @param {{ encryptedKey: object }} encryptedPayload
 */
export function migrateWalletToEncrypted(encryptedPayload) {
  return updateAgentState((current) => {
    if (!current.wallet) return current
    const { privateKey, ...rest } = current.wallet
    return {
      ...current,
      wallet: {
        ...rest,
        encryptedKey: encryptedPayload,
        // privateKey is intentionally omitted
      },
    }
  })
}

export function deleteAgentWallet() {
  return saveAgentState(createDefaultState())
}

export function updateAgentSettings(settingsPatch) {
  return updateAgentState((current) => ({
    ...current,
    settings: {
      ...current.settings,
      ...settingsPatch,
    },
  }))
}

export function setAgentStatus(status) {
  return updateAgentState((current) => ({
    ...current,
    status,
  }))
}

export function appendPlan(plan) {
  const normalizedPlan = normalizePlan({ id: createId('plan'), createdAt: nowIso(), approvedAt: null, ...plan })
  const historyPlan = normalizePlan({ id: createId('plan_history'), createdAt: nowIso(), approvedAt: null, ...plan })
  return updateAgentState((current) => ({
    ...current,
    currentPlan: normalizedPlan,
    plans: [historyPlan, ...current.plans].slice(0, MAX_PLANS),
  }))
}

export function approveCurrentPlan() {
  return updateAgentState((current) => {
    if (!current.currentPlan) return current
    const approvedAt = nowIso()
    const queue = normalizeQueue(current.currentPlan.queue).map((item) =>
      item.requiresApproval
        ? item
        : {
            ...item,
            status: 'approved',
            approvedAt,
          }
    )
    return {
      ...current,
      currentPlan: normalizePlan({
        ...current.currentPlan,
        approvedAt,
        queue,
      }),
      plans: current.plans.map((plan, index) =>
        index === 0
          ? normalizePlan({
              ...plan,
              approvedAt,
              queue,
            })
          : plan
      ),
    }
  })
}

export function approveQueuedAction(actionId) {
  return updateAgentState((current) => {
    if (!current.currentPlan || !Array.isArray(current.currentPlan.queue)) return current
    const approvedAt = nowIso()
    const queue = normalizeQueue(current.currentPlan.queue).map((item) =>
      item.id === actionId
        ? {
            ...item,
            status: 'approved',
            approvedAt,
          }
        : item
    )
    return {
      ...current,
      currentPlan: normalizePlan({
        ...current.currentPlan,
        queue,
      }),
      plans: current.plans.map((plan, index) =>
        index === 0
          ? normalizePlan({
              ...plan,
              queue,
            })
          : plan
      ),
    }
  })
}

export function updateQueuedAction(actionId, patch = {}) {
  return updateAgentState((current) => {
    if (!current.currentPlan || !Array.isArray(current.currentPlan.queue)) return current
    const queue = normalizeQueue(current.currentPlan.queue).map((item) =>
      item.id === actionId ? { ...item, ...patch } : item
    )
    return {
      ...current,
      currentPlan: normalizePlan({
        ...current.currentPlan,
        queue,
      }),
    }
  })
}

export function consumeNextPlannedAction(actionId) {
  return updateQueuedAction(actionId, {
    status: 'completed',
    executedAt: nowIso(),
  })
}

export function appendLog(log) {
  return updateAgentState((current) => ({
    ...current,
    logs: [{ id: createId('log'), timestamp: nowIso(), spentWei: '0', ...log }, ...current.logs].slice(0, MAX_LOGS),
  }))
}

export function clearAgentLogs() {
  return updateAgentState((current) => ({
    ...current,
    logs: [],
  }))
}

export function resetAgentPlan() {
  return updateAgentState((current) => ({
    ...current,
    status: AGENT_STATUSES.DISABLED,
    currentPlan: null,
    plans: [],
    logs: [],
  }))
}

export function buildDailyReport(state) {
  // Use local timezone for day boundary so "today" matches the user's clock
  const now = new Date()
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const logs = (state.logs || []).filter((entry) => String(entry.timestamp || '').startsWith(dayKey))
  const successLogs = logs.filter((entry) => entry.status === 'success')
  const blockedLogs = logs.filter((entry) => entry.status === 'blocked')
  const spentWei = successLogs.reduce((sum, entry) => sum + BigInt(entry.spentWei || '0'), 0n)

  return {
    dayKey,
    executed: successLogs.length,
    blocked: blockedLogs.length,
    spentWei,
    spentEth: formatEther(spentWei),
  }
}

export function getNextPlannedAction(state) {
  const nextPlan = normalizePlan(state.currentPlan)
  if (!nextPlan || !Array.isArray(nextPlan.queue) || nextPlan.queue.length === 0) return null
  const next = nextPlan.queue
    .filter((item) => item.status === 'approved' || item.status === 'scheduled')
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))[0]
  if (!next) return null
  return {
    id: next.id,
    targetId: next.executorMapping || next.actionType,
    targetType: next.targetType,
    title: next.title,
    summary: next.reason,
    estimatedSpendWei: next.estimatedSpendWei || '0',
    estimatedSpendEth: next.estimatedCostEth || '0',
    payload: next.params || {},
    status: next.status,
    requiresApproval: next.requiresApproval,
    priority: next.priority,
  }
}
