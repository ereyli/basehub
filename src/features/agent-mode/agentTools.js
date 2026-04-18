import { AGENT_TARGETS } from './agentConstants.js'
import { summarizeCapabilityGraph } from './agentCapabilityGraph.js'

export function getAgentToolCatalog(settings = {}) {
  const enabledIds = new Set(settings.enabledTargetIds || [])
  return AGENT_TARGETS.filter((target) => enabledIds.has(target.id)).map((target) => ({
    toolName: `run_${target.id.replace(/-/g, '_')}`,
    targetId: target.id,
    title: target.title,
    category: target.type,
    summary: target.summary,
    estimatedSpendWei: target.estimatedSpendWei.toString(),
    requiresPumpHubToken: target.id === 'pumphub-buy' || target.id === 'pumphub-sell',
    autoDiscoversFreeMint: target.id === 'free-nft-mint',
  }))
}

export function getAgentReasoningContext(settings = {}) {
  return {
    toolCatalog: getAgentToolCatalog(settings),
    capabilityGraph: summarizeCapabilityGraph(),
  }
}
