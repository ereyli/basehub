import { getActionRegistry } from './agentActionRegistry.js'
import { discoverBaseHubOpportunities } from './agentDiscovery.js'
import { getBaseHubKnowledgeSummary } from './agentKnowledge.js'

function summarizeMemory(memorySnapshot = {}) {
  const memories = Array.isArray(memorySnapshot.memories) ? memorySnapshot.memories : []
  const reflections = Array.isArray(memorySnapshot.reflections) ? memorySnapshot.reflections : []
  const notes = memories.slice(0, 4).map((item) => item.title || item.body).filter(Boolean)
  const successfulPatterns = reflections
    .filter((item) => item.reflection_type === 'execution' || item.reflection_type === 'critic')
    .slice(0, 4)
    .map((item) => item.body)
    .filter(Boolean)

  return {
    preferredActions: [],
    rejectedActions: [],
    successfulPatterns,
    notes,
  }
}

export async function buildAgentContext({
  settings,
  walletAddress,
  balance,
  report,
  logs = [],
  memorySnapshot = {},
}) {
  const discoveredOpportunities = await discoverBaseHubOpportunities({ settings, logs })
  const freeMints = discoveredOpportunities
    .filter((item) => item.targetId === 'free-nft-mint' && item.available)
    .map((item) => item.payload)
  const newPumpHubTokens = discoveredOpportunities
    .filter((item) => item.targetId === 'pumphub-buy' && item.available)
    .map((item) => item.payload)

  return {
    wallet: {
      address: walletAddress || '',
      ethBalance: String(balance?.formatted || '0'),
      tokenBalances: [],
    },
    usage: {
      todayActionCount: Number(report?.executed || 0),
      todayGasSpentEth: String(report?.spentEth || '0'),
      todayVolumeEth: String(report?.spentEth || '0'),
      pendingActions: 0,
      completedActions: Number(report?.executed || 0),
      failedActions: Number(report?.blocked || 0),
    },
    limits: {
      dailyActionTarget: Number(settings?.dailyTxTarget || 0),
      dailyEthBudget: String(settings?.maxDailySpendEth || '0'),
      minIntervalMinutes: Number(settings?.intervalMinutes || 1),
      maxSingleTradeEth: String(settings?.pumpHubTradeAmountEth || '0.0001'),
    },
    userPolicy: {
      riskMode: 'medium',
      allowTokenTrading: true,
      allowFreeMints: !!settings?.freeMintEnabled,
      allowPaidMints: false,
      allowGames: true,
      allowBaseHubNativeOnly: false,
      autoExecuteLowRisk: true,
      requireApprovalForTrades: false,
      requireApprovalForMints: false,
    },
    features: {
      gmGame: true,
      gnGame: true,
      coinFlip: true,
      pumpHubTrading: true,
      nftMinting: true,
      autoPlan: true,
      deploy: true,
    },
    market: {
      trendingTokens: newPumpHubTokens,
      newPumpHubTokens,
      freeMints,
    },
    basehub: {
      supportedActions: getActionRegistry(),
      knowledge: getBaseHubKnowledgeSummary(),
    },
    memory: summarizeMemory(memorySnapshot),
    discoveredOpportunities,
  }
}
