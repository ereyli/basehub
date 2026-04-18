import { formatEther } from 'viem'
import { AGENT_ACTION_TYPES, AGENT_TARGET_IDS, AGENT_TARGETS } from './agentConstants.js'

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
}

const APPROVAL_MODES = {
  CHAT_ONLY: 'chat_only',
  DRAFT: 'draft',
  ASSISTED: 'assisted',
  ALWAYS_APPROVE: 'always_approve',
}

function createRegistryEntry(target, overrides = {}) {
  return {
    actionType: target.id,
    title: target.title,
    description: target.summary,
    category: target.type,
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.ASSISTED,
    estimatedCostEth: formatEther(target.estimatedSpendWei),
    supported: true,
    inputSchema: target.payloadHints || {},
    executorMapping: target.id,
    ...overrides,
  }
}

export const AGENT_ACTION_REGISTRY = [
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.GM)),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.GN)),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.FLIP)),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.LUCKY)),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.DICE)),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.PUMPHUB_BUY), {
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.ASSISTED,
  }),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.PUMPHUB_SELL), {
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.ASSISTED,
  }),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.SWAPHUB_SWAP), {
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.ASSISTED,
  }),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.FREE_NFT_MINT), {
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.ASSISTED,
  }),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.DEPLOY_TOKEN), {
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.DRAFT,
  }),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.DEPLOY_ERC721), {
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.DRAFT,
  }),
  createRegistryEntry(AGENT_TARGETS.find((item) => item.id === AGENT_TARGET_IDS.DEPLOY_ERC1155), {
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: false,
    approvalMode: APPROVAL_MODES.DRAFT,
  }),
]

export function getActionRegistry() {
  return AGENT_ACTION_REGISTRY
}

export function getRegistryEntry(actionType) {
  return AGENT_ACTION_REGISTRY.find((item) => item.actionType === actionType) || null
}

export function getActionCategoryWeights() {
  return [
    { category: AGENT_ACTION_TYPES.SIMPLE, weight: 0.18 },
    { category: AGENT_ACTION_TYPES.GAMING, weight: 0.24 },
    { category: AGENT_ACTION_TYPES.TRADE, weight: 0.28 },
    { category: AGENT_ACTION_TYPES.NFT, weight: 0.18 },
    { category: AGENT_ACTION_TYPES.DEPLOY, weight: 0.12 },
  ]
}
