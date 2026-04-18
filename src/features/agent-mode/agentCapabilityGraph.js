import { AGENT_TARGET_IDS, AGENT_TARGETS } from './agentConstants.js'

export const BASEHUB_CAPABILITY_GRAPH = [
  {
    id: AGENT_TARGET_IDS.GM,
    label: 'GM Game',
    category: 'social',
    status: 'live',
    intent: 'Open the day with light onchain presence.',
    whyItMatters: 'Creates simple recurring activity with low cost.',
    risk: 'low',
    idealMoments: ['morning check-in', 'quiet periods', 'after a failed game run'],
    antiPatterns: ['spamming many GM calls in sequence', 'using the exact same phrase all day'],
  },
  {
    id: AGENT_TARGET_IDS.GN,
    label: 'GN Game',
    category: 'social',
    status: 'live',
    intent: 'Close a routine block with a low-friction signoff action.',
    whyItMatters: 'Adds a human-looking end-of-session rhythm.',
    risk: 'low',
    idealMoments: ['late block close', 'after other interactions', 'end of day'],
    antiPatterns: ['opening and closing with GN repeatedly', 'pairing every GM with immediate GN'],
  },
  {
    id: AGENT_TARGET_IDS.FLIP,
    label: 'Coin Flip',
    category: 'gaming',
    status: 'live',
    intent: 'Add playful variety to the wallet routine.',
    whyItMatters: 'Breaks up repetitive social actions with a tiny game action.',
    risk: 'low',
    idealMoments: ['midday variety', 'after too many message actions', 'short engagement burst'],
    antiPatterns: ['running many flips back to back', 'always choosing the same side'],
  },
  {
    id: AGENT_TARGET_IDS.LUCKY,
    label: 'Lucky Number',
    category: 'gaming',
    status: 'live',
    intent: 'Inject one-off variety with a number pick.',
    whyItMatters: 'Adds another distinct tool to the daily mix.',
    risk: 'low',
    idealMoments: ['when the day needs variety', 'after repeated flip usage'],
    antiPatterns: ['choosing the same guess every time', 'stacking immediately after dice and flip'],
  },
  {
    id: AGENT_TARGET_IDS.DICE,
    label: 'Dice Roll',
    category: 'gaming',
    status: 'live',
    intent: 'Use a simple game move when the routine needs energy.',
    whyItMatters: 'Helps the routine look less scripted than only GM/GN.',
    risk: 'low',
    idealMoments: ['afternoon refresh', 'after a social-only block'],
    antiPatterns: ['using dice in every block', 'looping dice with lucky number too predictably'],
  },
  {
    id: 'swap',
    label: 'SwapHub',
    category: 'dex',
    status: 'live',
    intent: 'Rotate tiny DEX swaps across Base tokens for broader contract activity.',
    whyItMatters: 'Adds another contract surface beyond PumpHub and spreads activity across more assets.',
    risk: 'medium',
    idealMoments: ['when the routine needs diversity', 'between game and social actions', 'low-size random trade blocks'],
    antiPatterns: ['repeating the same output token too often', 'using sizes that stress the ETH budget'],
  },
  {
    id: 'free-nft-mint',
    label: 'Free NFT Mint',
    category: 'nft',
    status: 'live',
    intent: 'Pick up free BaseHub launchpad mints when they are available.',
    whyItMatters: 'Adds collectible activity without increasing mint spend.',
    risk: 'medium',
    idealMoments: ['when free launchpad drops are active', 'as a standout action in a light routine'],
    antiPatterns: ['minting every cycle', 'minting sold-out or paid collections'],
  },
  {
    id: 'deploy-token',
    label: 'Token Deploy',
    category: 'deploy',
    status: 'planned',
    intent: 'Launch a lightweight token through BaseHub deploy surfaces.',
    whyItMatters: 'Creates a stronger onchain action with more intent than micro interactions.',
    risk: 'high',
    idealMoments: ['opt-in power users', 'separate high-risk routine blocks'],
    antiPatterns: ['deploying automatically without explicit limits', 'using large budgets'],
  },
  {
    id: 'pumphub-buy',
    label: 'PumpHub Buy',
    category: 'trade',
    status: 'live',
    intent: 'Buy a tiny amount of a PumpHub token when trade activity is part of the routine.',
    whyItMatters: 'Lets the agent add small trade activity alongside social and game actions.',
    risk: 'high',
    idealMoments: ['tiny-budget experimental routines', 'watchlist rotation', 'latest-launch exploration'],
    antiPatterns: ['large trade sizes', 'trading every cycle', 'trading without a hard cap'],
  },
  {
    id: 'pumphub-sell',
    label: 'PumpHub Sell',
    category: 'trade',
    status: 'live',
    intent: 'Trim a small slice of an existing PumpHub position.',
    whyItMatters: 'Adds realistic buy/sell rhythm instead of only accumulating.',
    risk: 'high',
    idealMoments: ['after recent buys', 'when a trade loop needs balance'],
    antiPatterns: ['selling empty balances', 'full exits on tiny routines', 'selling every cycle'],
  },
  {
    id: 'swaphub-swap',
    label: 'SwapHub Swap',
    category: 'trade',
    status: 'live',
    intent: 'Use SwapHub to rotate tiny ETH swaps into different Base tokens.',
    whyItMatters: 'Expands trade behavior across more contracts and token types.',
    risk: 'medium',
    idealMoments: ['when broad BaseHub activity is requested', 'to diversify away from a single PumpHub-only pattern'],
    antiPatterns: ['swapping the same token repeatedly', 'using large trade sizes', 'clustering too many swaps back to back'],
  },
]

export function getLiveCapabilities() {
  const liveIds = new Set(AGENT_TARGETS.map((target) => target.id))
  return BASEHUB_CAPABILITY_GRAPH.filter((item) => liveIds.has(item.id))
}

export function summarizeCapabilityGraph() {
  const liveIds = new Set(AGENT_TARGETS.map((target) => target.id))

  // Send full context only for live capabilities (saves LLM tokens)
  const live = BASEHUB_CAPABILITY_GRAPH
    .filter((item) => liveIds.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      intent: item.intent,
      risk: item.risk,
      antiPatterns: item.antiPatterns,
    }))

  // Planned items as a brief mention (not full objects)
  const planned = BASEHUB_CAPABILITY_GRAPH
    .filter((item) => !liveIds.has(item.id))
    .map((item) => item.label)

  return { live, plannedFeatures: planned }
}
