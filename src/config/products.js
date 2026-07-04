/**
 * Central config for all products/tools/games.
 * Home, WebBottomNav, FarcasterBottomNav, and MobileHeader consume this.
 * icon: Lucide icon name (string). iconImage: optional path for custom image.
 */

export const CATEGORIES = {
  EARLY_ACCESS: 'earlyAccess',
  DEX: 'dex',
  PUMP: 'pump',
  GAMING: 'gaming',
  GUILD: 'guild',
  ANALYSIS: 'analysis',
  DEPLOY: 'deploy',
  SOCIAL: 'social',
  NFT: 'nft',
  /** Wallet-centered bounded automation for the BaseHub web app */
  AGENT: 'agent',
}

/** Nav section id -> product ids for sidebar/bottom nav */
export const NAV_SECTIONS = {
  gaming: ['flip', 'dice', 'slot', 'lucky'],
  guild: ['base-guild-companion'],
  /** Agent: wallet-centered bounded automation for BaseHub actions */
  agent: ['agent-mode'],
  nft: ['early-access', 'nft-launchpad', 'nft-launchpad-explore', 'nft-plinko'],
  analysis: ['wallet-analysis', 'contract-security', 'allowance-cleaner'],
  deploy: ['deploy-b20', 'deploy-erc8004', 'agent-directory', 'deploy', 'deploy-erc721', 'deploy-erc1155'],
  social: [],
  dex: ['swap'],
}

/** Mobile header quick menu: id list (order matters) */
export const MOBILE_MENU_IDS = ['home', 'swap', 'agent-mode', 'pumphub', 'flip', 'dice', 'wallet-analysis', 'deploy', 'badges', 'profile']

/** Static menu entries (not in PRODUCTS) for mobile header */
const MOBILE_STATIC_ITEMS = [
  { id: 'home', path: '/', label: 'Home', color: '#3b82f6', icon: 'Home' },
  { id: 'pumphub', path: '/pumphub', label: 'Pumphub', color: '#06b6d4', icon: 'Zap' },
  { id: 'badges', path: '/badges', label: 'Badges', color: '#eab308', icon: 'Award' },
  { id: 'profile', path: '/profile', label: 'Profile', color: '#14b8a6', icon: 'User' },
]

/** English cast share text per feature (miniapp card cast button) */
const CAST_SHARE = {
  'early-access': 'Mint the BaseHub Early Access Pass and unlock exclusive benefits. Multi-chain Web3 platform on Base!',
  'nft-wheel': 'Spin the NFT Wheel on BaseHub – XP rewards for NFT holders. Pay via x402 (USDC on Base).',
  'nft-plinko': 'Drop the NFT Plinko ball on BaseHub – same XP odds as the Wheel. Pay via x402 (USDC on Base).',
  'x402-premium': 'Pay with USDC via x402 on BaseHub. Simple Web3 payments on Base.',
  'swap': 'Swap tokens on Base with SwapHub – DEX aggregator. Earn XP at $100, $1k, $10k volume milestones!',
  'flip': 'Flip a coin and earn XP on BaseHub. Simple, fun, multi-chain gaming!',
  'dice': 'Roll the dice and win XP on BaseHub. Play across Base, InkChain and more.',
  'slot': 'Spin the Crypto Slots on BaseHub. Match symbols, win XP and combos!',
  'lucky': 'Pick a number 1–10 and earn XP on BaseHub. Quick game, instant rewards.',
  'wallet-analysis': 'Get fun insights about any wallet on BaseHub. Portfolio, activity and more.',
  'contract-security': 'Analyze smart contract security risks on BaseHub. Stay safe on-chain.',
  'allowance-cleaner': 'Scan and revoke risky token approvals on BaseHub. Take back control of your wallet.',
  'base-guild-companion': 'Track your Base Guild mission progress with wallet checks and one-click actions inside BaseHub.',
  'agent-mode': 'Create an agent wallet on BaseHub and let it run BaseHub GM and GN actions from its own address.',
  'deploy': 'Deploy your own ERC20 token on BaseHub. No code – multi-chain in one click.',
  'deploy-b20': 'Base-native B20 token launches are coming soon to BaseHub on Base mainnet.',
  'deploy-erc721': 'Deploy your own NFT collection (ERC721) on BaseHub. Base, Ink, Soneium and more.',
  'deploy-erc1155': 'Deploy multi-token contracts (ERC1155) on BaseHub. One contract, many assets.',
  'deploy-erc8004': 'Register a trustless ERC-8004 AI agent identity on BaseHub and earn 5,000 XP.',
  'agent-directory': 'Browse ERC-8004 AI agents registered on Base through BaseHub.',
  'nft-launchpad': 'Create and mint NFT collections on BaseHub. Upload art or generate with AI, deploy on Base, Arbitrum, Optimism, Monad and more.',
  'nft-launchpad-explore': 'Browse and mint from NFT collections launched on BaseHub. Base, Ink, Soneium, Arbitrum, Optimism, Monad and more.',
}

const FULL_EVM_NETWORKS = ['base', 'ink', 'soneium', 'katana', 'megaeth', 'tempo', 'arc-restnet', 'robinhood', 'arbitrum', 'optimism', 'monad']
const NFT_LAUNCHPAD_NETWORKS = ['base', 'ink', 'soneium', 'megaeth', 'tempo', 'robinhood', 'arbitrum', 'optimism', 'monad']

const PRODUCTS_ALL = [
  { id: 'early-access', path: '/early-access', label: 'Early Access', title: 'Early Access Pass', description: 'Mint your BaseHub Early Access Pass and unlock exclusive benefits', castShareText: CAST_SHARE['early-access'], category: CATEGORIES.EARLY_ACCESS, color: '#fbbf24', icon: 'Rocket', xpReward: '3000 XP', bonusXP: null, networks: ['base'] },
  { id: 'nft-wheel', path: '/nft-wheel', label: 'NFT Wheel', title: 'NFT Wheel of Fortune', description: 'Spin to win XP — pay via x402 on Base (USDC). NFT holders only.', castShareText: CAST_SHARE['nft-wheel'], category: CATEGORIES.EARLY_ACCESS, color: '#8b5cf6', icon: 'Sparkles', xpReward: '2K-224K XP', bonusXP: 'MEGA JACKPOT!', networks: ['base'], isNFTGated: true },
  { id: 'nft-plinko', path: '/nft-plinko', label: 'NFT Plinko', title: 'NFT Plinko', description: 'Drop the ball and win XP — same odds as Wheel. Pay via x402. NFT holders only.', castShareText: CAST_SHARE['nft-plinko'], category: CATEGORIES.EARLY_ACCESS, color: '#22d3ee', icon: 'CircleDot', xpReward: '2K-224K XP', bonusXP: 'MEGA JACKPOT!', networks: ['base'], isNFTGated: true },
  { id: 'x402-premium', path: null, label: 'x402 test', title: 'x402 test', description: 'Pay 0.1 USDC via x402', castShareText: CAST_SHARE['x402-premium'], category: CATEGORIES.SOCIAL, color: '#8b5cf6', icon: 'Star', xpReward: '500 XP', bonusXP: '0.1 USDC', networks: ['base'], isX402: true, isPayment: true },
  { id: 'swap', path: '/swap', label: 'SwapHub', title: 'SwapHub', description: 'DEX Aggregator - Swap tokens on Base', castShareText: CAST_SHARE['swap'], category: CATEGORIES.DEX, color: '#3b82f6', icon: 'ArrowLeftRight', xpReward: '5k XP / $100', bonusXP: 'Milestones up to 50M XP', networks: ['base'] },
  { id: 'flip', path: '/flip', label: 'Coinflip', title: 'Coin Flip', description: 'Flip a coin and earn XP', castShareText: CAST_SHARE['flip'], category: CATEGORIES.GAMING, color: '#f59e0b', icon: 'Coins', iconImage: '/crypto-logos/basahub logo/CoinFlip.png', xpReward: '150 XP', bonusXP: '+500 XP (Win)', networks: FULL_EVM_NETWORKS },
  { id: 'dice', path: '/dice', label: 'Dice Roll', title: 'Dice Roll', description: 'Roll dice and earn XP', castShareText: CAST_SHARE['dice'], category: CATEGORIES.GAMING, color: '#10b981', icon: 'Dice1', iconImage: '/crypto-logos/basahub logo/DiceRoll.png', xpReward: '150 XP', bonusXP: '+1500 XP (Win)', networks: FULL_EVM_NETWORKS },
  { id: 'slot', path: '/slot', label: 'Slots', title: 'Crypto Slots', description: 'Spin the reels and win XP', castShareText: CAST_SHARE['slot'], category: CATEGORIES.GAMING, color: '#dc2626', icon: 'Gift', iconImage: '/crypto-logos/basahub logo/CryptoSloth.png', xpReward: '150 XP', bonusXP: '+2000 XP (Combo)', networks: FULL_EVM_NETWORKS },
  { id: 'lucky', path: '/lucky', label: 'Lucky Number', title: 'Lucky Number', description: 'Guess 1-10 and earn XP', castShareText: CAST_SHARE['lucky'], category: CATEGORIES.GAMING, color: '#3b82f6', icon: 'RotateCcw', iconImage: '/crypto-logos/basahub logo/luckynumber.png', xpReward: '150 XP', bonusXP: '+1000 XP (Win)', networks: FULL_EVM_NETWORKS },
  { id: 'wallet-analysis', path: '/wallet-analysis', label: 'Wallet Analysis', title: 'Wallet Analysis', description: 'Get fun insights about any wallet', castShareText: CAST_SHARE['wallet-analysis'], category: CATEGORIES.ANALYSIS, color: '#3b82f6', icon: 'Search', xpReward: '400 XP', bonusXP: '0.40 USDC', networks: ['base'], isX402: true },
  { id: 'contract-security', path: '/contract-security', label: 'Contract Security', title: 'Contract Security', description: 'Analyze smart contract security risks', castShareText: CAST_SHARE['contract-security'], category: CATEGORIES.ANALYSIS, color: '#8b5cf6', icon: 'Shield', xpReward: '500 XP', bonusXP: '0.50 USDC', networks: ['base'], isX402: true },
  { id: 'allowance-cleaner', path: '/allowance-cleaner', label: 'Allowance Cleaner', title: 'Allowance Cleaner', description: 'Scan and revoke risky token approvals', castShareText: CAST_SHARE['allowance-cleaner'], category: CATEGORIES.ANALYSIS, color: '#8b5cf6', icon: 'Trash2', xpReward: '300 XP', bonusXP: '0.1 USDC', networks: ['base'], isX402: true },
  { id: 'base-guild-companion', path: '/base-guild', label: 'Base Guild', title: 'Base Guild Companion', description: 'Complete Base Guild-style missions with one-click actions and wallet checks', castShareText: CAST_SHARE['base-guild-companion'], category: CATEGORIES.GUILD, color: '#2563eb', icon: 'Shield', xpReward: '500 XP', bonusXP: 'Community bonus', networks: ['base'] },
  { id: 'agent-mode', path: '/agent', label: 'Agent', title: 'Agent Mode (Beta)', description: 'Create a delegated agent wallet and let it run approved BaseHub actions with your limits', castShareText: CAST_SHARE['agent-mode'], category: CATEGORIES.AGENT, color: '#60a5fa', icon: 'Bot', xpReward: 'Setup', bonusXP: 'Agent', networks: ['base'] },
  { id: 'deploy-b20', path: '/deploy-b20', label: 'B20', title: 'B20 Launchpad', description: 'Base-native B20 asset and stablecoin launches', castShareText: CAST_SHARE['deploy-b20'], category: CATEGORIES.DEPLOY, color: '#2563eb', icon: 'Rocket', iconImage: '/crypto-logos/basahub logo/B20.svg', xpReward: '5000 XP', bonusXP: 'Coming Soon', networks: ['base'] },
  { id: 'deploy', path: '/deploy', label: 'Deploy Token', title: 'Deploy Token', description: 'Create your own ERC20 token', castShareText: CAST_SHARE['deploy'], category: CATEGORIES.DEPLOY, color: '#f59e0b', icon: 'Coins', iconImage: '/crypto-logos/basahub logo/ERC20.png', xpReward: '850 XP', bonusXP: null, networks: FULL_EVM_NETWORKS },
  { id: 'deploy-erc721', path: '/deploy-erc721', label: 'ERC721', title: 'Deploy ERC721', description: 'Deploy your own NFT contract', castShareText: CAST_SHARE['deploy-erc721'], category: CATEGORIES.DEPLOY, color: '#06b6d4', icon: 'Package', iconImage: '/crypto-logos/basahub logo/ERC-721.png', xpReward: '850 XP', bonusXP: null, networks: FULL_EVM_NETWORKS },
  { id: 'deploy-erc1155', path: '/deploy-erc1155', label: 'ERC1155', title: 'Deploy ERC1155', description: 'Deploy multi-token contract', category: CATEGORIES.DEPLOY, color: '#8b5cf6', icon: 'Factory', iconImage: '/crypto-logos/basahub logo/ERC-1155.png', xpReward: '850 XP', bonusXP: null, networks: FULL_EVM_NETWORKS },
  { id: 'deploy-erc8004', path: '/deploy-erc8004', label: 'ERC-8004', title: 'Deploy ERC-8004 Agent', description: 'Register a trustless AI agent identity', castShareText: CAST_SHARE['deploy-erc8004'], category: CATEGORIES.DEPLOY, color: '#22c55e', icon: 'Bot', xpReward: '5000 XP', bonusXP: 'New', networks: ['base'] },
  { id: 'agent-directory', path: '/agents', label: 'Agents', title: 'Agent Directory', description: 'Browse ERC-8004 AI agents registered on BaseHub', castShareText: CAST_SHARE['agent-directory'], category: CATEGORIES.DEPLOY, color: '#60a5fa', icon: 'Users', xpReward: 'Explore', bonusXP: 'Directory', networks: ['base'] },
  { id: 'nft-launchpad', path: '/nft-launchpad', label: 'NFT Launchpad', title: 'NFT Launchpad', description: 'Create your own NFT collection. Upload art or generate with AI, then deploy on Base, Ink, Soneium, MegaETH, Tempo, Robinhood, Arbitrum, Optimism or Monad.', castShareText: CAST_SHARE['nft-launchpad'], category: CATEGORIES.NFT, color: '#3b82f6', icon: 'Package', xpReward: '2000 XP', bonusXP: '200 XP per mint', networks: NFT_LAUNCHPAD_NETWORKS, isX402: true, holderDiscount: 'Pass: 0.0005 ETH deploy (Base)' },
  { id: 'nft-launchpad-explore', path: '/nft-launchpad?tab=explore', label: 'Launched NFTs', title: 'Launched Collections', description: 'Browse and mint from NFT collections launched on Base, Ink, Soneium, MegaETH, Tempo, Robinhood, Arbitrum, Optimism or Monad', castShareText: CAST_SHARE['nft-launchpad-explore'], category: CATEGORIES.NFT, color: '#10b981', icon: 'LayoutGrid', xpReward: '200 XP', bonusXP: null, networks: NFT_LAUNCHPAD_NETWORKS },
]

/** Public catalog */
export const PRODUCTS = PRODUCTS_ALL

/** Get product by id */
export function getProductById(id) {
  return PRODUCTS.find(p => p.id === id)
}

/** List of networks supported in the category (union of product networks). Returns in a fixed order for consistency. */
const NETWORK_ORDER = ['base', 'ink', 'tempo', 'soneium', 'katana', 'megaeth', 'arbitrum', 'optimism', 'monad', 'arc-restnet', 'robinhood']
export function getNetworksForProductIds(productIds) {
  const set = new Set()
  PRODUCTS.filter(p => productIds && productIds.includes(p.id)).forEach(p => {
    (p.networks || []).forEach(n => set.add(n))
  })
  return NETWORK_ORDER.filter(n => set.has(n))
}

/** Get products by category (Home sections) */
export function getProductsByCategory(category) {
  return PRODUCTS.filter(p => p.category === category)
}

/** Get nav items for a section (id, path, label, color, icon) */
export function getNavItems(sectionKey) {
  const ids = NAV_SECTIONS[sectionKey]
  if (!ids) return []
  return ids.map(id => {
    const p = getProductById(id)
    return p ? { id: p.id, path: p.path, label: p.label, title: p.title, color: p.color, icon: p.icon } : null
  }).filter(Boolean)
}

/** Get all products for Home (full list, same order as PRODUCTS for consistent filtering) */
export function getProductsForHome() {
  return PRODUCTS
}

/**
 * Filters products by the selected network.
 * When a testnet is selected, only cards with a deployed contract on that testnet are shown.
 * If chainId is missing (wallet not connected), all products are returned.
 */
export function getProductsForHomeByNetwork(chainId, getNetworkKey) {
  if (chainId == null || !getNetworkKey) return PRODUCTS
  const networkKey = getNetworkKey(chainId)
  if (!networkKey) return PRODUCTS
  return PRODUCTS.filter(p => p.networks && p.networks.includes(networkKey))
}

/** Get mobile header menu items (order by MOBILE_MENU_IDS; label/icon from PRODUCTS or MOBILE_STATIC_ITEMS) */
export function getMobileMenuItems() {
  return MOBILE_MENU_IDS.map((id) => {
    const staticItem = MOBILE_STATIC_ITEMS.find(s => s.id === id)
    if (staticItem) return staticItem
    const product = getProductById(id)
    if (product) return { id: product.id, path: product.path, label: product.label, color: product.color, icon: product.icon }
    return null
  }).filter(Boolean)
}
