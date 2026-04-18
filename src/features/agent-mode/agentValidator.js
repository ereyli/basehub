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

  const firstBuyIndex = validQueue.findIndex((item) => item.actionType === 'pumphub-buy')
  const sellIndices = validQueue
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.actionType === 'pumphub-sell')

  if (sellIndices.length && !canSellPumpHub) {
    if (firstBuyIndex === -1) {
      const removedCount = sellIndices.length
      const filteredQueue = validQueue.filter((item) => item.actionType !== 'pumphub-sell')
      validQueue.length = 0
      validQueue.push(...filteredQueue)
      warnings.push(
        removedCount === 1
          ? 'PumpHub sell was removed because there is no token balance and no earlier buy in the draft.'
          : `Removed ${removedCount} PumpHub sell actions because there is no token balance and no earlier buy in the draft.`
      )
    } else {
      const preBuySells = sellIndices.filter((entry) => entry.index < firstBuyIndex)
      if (preBuySells.length) {
        const reordered = []
        const deferredSells = []

        validQueue.forEach((item, index) => {
          if (index < firstBuyIndex && item.actionType === 'pumphub-sell') {
            deferredSells.push(item)
            return
          }
          reordered.push(item)
        })

        const insertIndex = reordered.findIndex((item, index) => index > firstBuyIndex && item.actionType !== 'pumphub-buy')
        reordered.splice(insertIndex === -1 ? reordered.length : insertIndex, 0, ...deferredSells)
        validQueue.length = 0
        validQueue.push(...reordered)
        warnings.push(
          preBuySells.length === 1
            ? 'PumpHub sell was moved after the first buy because no sellable balance existed yet.'
            : `${preBuySells.length} PumpHub sell actions were moved after the first buy because no sellable balance existed yet.`
        )
      }
    }
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
