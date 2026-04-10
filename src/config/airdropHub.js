import { NETWORKS, CONTRACT_ADDRESSES } from './networks'

/** Shown with a flame / hot border in the hub UI */
export const HUB_HOT_NETWORK_KEYS = new Set(['base', 'ink', 'soneium', 'megaeth'])

/** Public logo paths (same as NetworkSelector / Home network picker) */
export const HUB_CHAIN_LOGO = {
  base: '/base-logo.jpg',
  ink: '/ink-logo.jpg',
  soneium: '/soneium-logo.jpg',
  megaeth: '/megaeth-logo.jpg',
  tempo: '/Tempo logo.jpg',
  katana: '/katana-logo.jpg',
  // Match Home / NetworkSelector / rainbowkit (jpg reads better in circular avatars than wide white SVG)
  'arc-restnet': '/arc-testnet-logo.jpg',
  'robinhood-testnet': '/robinhood-testnet-logo.png',
}

export function getHubChainLogoUrl(networkKey) {
  return HUB_CHAIN_LOGO[networkKey] || null
}

/**
 * Hub modules per chain: GM, GN, Flip / Dice / Lucky (no Slot — credits), then three deploys via BaseHubDeployer.
 * XP uses the same hooks as the main app.
 */
export const HUB_MODULES = [
  { id: 'gm', label: 'GM', path: '/gm', contractKey: 'GM_GAME' },
  { id: 'gn', label: 'GN', path: '/gn', contractKey: 'GN_GAME' },
  { id: 'flip', label: 'Flip', path: '/flip', contractKey: 'FLIP_GAME' },
  { id: 'dice', label: 'Dice', path: '/dice', contractKey: 'DICE_ROLL' },
  { id: 'lucky', label: 'Lucky', path: '/lucky', contractKey: 'LUCKY_NUMBER' },
  { id: 'deploy20', label: 'ERC-20', path: '/deploy', requiresDeployer: true },
  { id: 'deploy721', label: 'ERC-721', path: '/deploy-erc721', requiresDeployer: true },
  { id: 'deploy1155', label: 'ERC-1155', path: '/deploy-erc1155', requiresDeployer: true },
]

const NETWORK_ORDER = ['base', 'ink', 'soneium', 'megaeth', 'tempo', 'katana', 'arc-restnet', 'robinhood-testnet']

function configKeyForNetworkKey(networkKey) {
  const entry = Object.entries(NETWORKS).find(([, n]) => n.networkKey === networkKey)
  return entry ? entry[0] : null
}

/** Full batch order (wallet prompts in this sequence). Games use auto-picked choices in the hub runner. */
export const HUB_BATCH_STEP_IDS = [
  'gm',
  'gn',
  'flip',
  'dice',
  'lucky',
  'deploy20',
  'deploy721',
  'deploy1155',
]

/** Modules available on this chain (tags + progress denominator). */
export function getHubModulesForNetwork(networkKey) {
  const ck = configKeyForNetworkKey(networkKey)
  if (!ck) return []
  const addr = CONTRACT_ADDRESSES[ck] || {}
  return HUB_MODULES.filter((def) => {
    if (def.requiresDeployer) return Boolean(addr.BASEHUB_DEPLOYER)
    if (def.contractKey) return Boolean(addr[def.contractKey])
    return false
  })
}

export function listHubNetworks(mode) {
  const all = Object.values(NETWORKS).filter(Boolean)
  const filtered =
    mode === 'mainnet'
      ? all.filter((n) => !n.isTestnet)
      : mode === 'testnet'
        ? all.filter((n) => n.isTestnet)
        : all
  return [...filtered].sort((a, b) => {
    const ia = NETWORK_ORDER.indexOf(a.networkKey)
    const ib = NETWORK_ORDER.indexOf(b.networkKey)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}
