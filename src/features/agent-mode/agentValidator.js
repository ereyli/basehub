import { parseEther } from 'viem'
import { getRegistryEntry } from './agentActionRegistry.js'

const APPROVABLE_STATUSES = new Set(['draft', 'approved', 'scheduled'])

export function createQueuedAction(draftAction, index) {
  const registry = getRegistryEntry(draftAction.actionType || draftAction.targetId)
  const status = draftAction.requiresApproval || registry?.requiresApproval ? 'draft' : 'draft'
  return {
    id: draftAction.id || `${draftAction.actionType || draftAction.targetId}_${Date.now()}_${index}`,
    status,
    actionType: draftAction.actionType || draftAction.targetId,
    title: draftAction.title,
    reason: draftAction.reason || draftAction.summary || '',
    params: draftAction.params || draftAction.payload || {},
    priority: Number.isFinite(Number(draftAction.priority)) ? Number(draftAction.priority) : index + 1,
    riskLevel: draftAction.riskLevel || registry?.riskLevel || 'low',
    estimatedCostEth: draftAction.estimatedCostEth || registry?.estimatedCostEth || '0',
    estimatedSpendWei: draftAction.estimatedSpendWei || '0',
    requiresApproval: Boolean(draftAction.requiresApproval || registry?.requiresApproval),
    executorMapping: registry?.executorMapping || draftAction.targetId || draftAction.actionType,
    targetType: registry?.category || draftAction.targetType || 'simple',
    approvedAt: null,
    scheduledFor: null,
    executedAt: null,
    result: null,
    error: null,
  }
}

export function validateDraftPlan({ queue = [], context }) {
  const warnings = []
  const spendCapWei = parseEther(String(context?.limits?.dailyEthBudget || '0'))
  let runningWei = 0n
  const validQueue = []
  const canSellPumpHub = Boolean(context?.trade?.canSellPumpHub)

  for (const action of queue) {
    const registry = getRegistryEntry(action.actionType)
    if (!registry || !registry.supported) {
      warnings.push(`${action.title} is not supported in the current action registry.`)
      continue
    }

    const estimatedWei = BigInt(action.estimatedSpendWei || 0)
    if (runningWei + estimatedWei > spendCapWei) {
      warnings.push(`${action.title} was removed because it would exceed the daily budget.`)
      continue
    }

    runningWei += estimatedWei
    validQueue.push(action)
  }

  const sellIndices = validQueue
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.actionType === 'pumphub-sell')

  if (sellIndices.length && !canSellPumpHub) {
    const removedCount = sellIndices.length
    const filteredQueue = validQueue.filter((item) => item.actionType !== 'pumphub-sell')
    validQueue.length = 0
    validQueue.push(...filteredQueue)
    warnings.push(
      removedCount === 1
        ? 'PumpHub sell was removed because there is no sellable token balance yet.'
        : `Removed ${removedCount} PumpHub sell actions because there is no sellable token balance yet.`
    )
  }

  const reorderedQueue = validQueue.map((item, index) => ({
    ...item,
    priority: index + 1,
  }))

  return {
    warnings,
    queue: reorderedQueue,
    hasExecutableActions: reorderedQueue.some((item) => APPROVABLE_STATUSES.has(item.status)),
  }
}
