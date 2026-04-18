import { parseEther } from 'viem'
import { AGENT_STATUSES } from './agentConstants.js'

export function evaluateAgentAction({ state, action, report }) {
  if (!state.wallet?.address) {
    return { ok: false, reason: 'No burner wallet exists yet.' }
  }

  if (state.status !== AGENT_STATUSES.ACTIVE) {
    return { ok: false, reason: 'Agent is not active.' }
  }

  if (report.executed >= Number(state.settings.dailyTxTarget || 0)) {
    return { ok: false, reason: 'Daily transaction target already reached.' }
  }

  const spendCapWei = parseEther(String(state.settings.maxDailySpendEth || '0'))
  const nextSpendWei = report.spentWei + BigInt(action.estimatedSpendWei || '0')
  if (nextSpendWei > spendCapWei) {
    return { ok: false, reason: 'Daily spend cap would be exceeded.' }
  }

  if (!state.settings.enabledTargetIds.includes(action.targetId)) {
    return { ok: false, reason: 'Target is disabled in current settings.' }
  }

  return { ok: true }
}
