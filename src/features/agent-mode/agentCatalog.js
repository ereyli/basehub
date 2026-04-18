import { AGENT_ACTION_TYPES, AGENT_TARGETS } from './agentConstants.js'

export const AGENT_ACTION_OPTIONS = [
  {
    id: AGENT_ACTION_TYPES.SIMPLE,
    label: 'Simple interactions',
    description: 'Small BaseHub contract calls like GM and GN.',
  },
  {
    id: AGENT_ACTION_TYPES.GAMING,
    label: 'Games',
    description: 'BaseHub gaming contracts like Flip, Lucky Number, and Dice.',
  },
  {
    id: AGENT_ACTION_TYPES.TRADE,
    label: 'Trades',
    description: 'Tiny PumpHub buys/sells and SwapHub swaps.',
  },
  {
    id: AGENT_ACTION_TYPES.NFT,
    label: 'Free NFT mints',
    description: 'Free mints discovered from BaseHub NFT Launchpad.',
  },
]

export function getAgentTargetById(targetId) {
  return AGENT_TARGETS.find((target) => target.id === targetId) || null
}

export function getEnabledTargets(settings = {}) {
  const allowedTypes = Array.isArray(settings.allowedActionTypes) ? settings.allowedActionTypes : []
  const enabledIds = Array.isArray(settings.enabledTargetIds) ? settings.enabledTargetIds : []
  return AGENT_TARGETS.filter(
    (target) =>
      allowedTypes.includes(target.type) &&
      enabledIds.includes(target.id) &&
      (target.id !== 'free-nft-mint' || settings.freeMintEnabled)
  )
}
