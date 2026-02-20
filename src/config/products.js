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
  ANALYSIS: 'analysis',
  DEPLOY: 'deploy',
  SOCIAL: 'social',
  NFT: 'nft',
}

/** Nav section id -> product ids for sidebar/bottom nav */
export const NAV_SECTIONS = {
  gaming: ['flip', 'dice', 'slot', 'lucky'],
  nft: ['early-access', 'nft-launchpad', 'nft-launchpad-explore', 'prediction-arena'],
  analysis: ['wallet-analysis', 'contract-security', 'allowance-cleaner'],
  deploy: ['deploy', 'deploy-erc721', 'deploy-erc1155'],
  social: ['featured-profiles'],
  dex: ['swap'],
}

/** Mobile header quick menu: id list (order matters) */
export const MOBILE_MENU_IDS = ['home', 'swap', 'pumphub', 'flip', 'dice', 'wallet-analysis', 'deploy', 'badges', 'profile']

/** Static menu entries (not in PRODUCTS) for mobile header */
const MOBILE_STATIC_ITEMS = [
  { id: 'home', path: '/', label: 'Home', color: '#3b82f6', icon: 'Home' },
  { id: 'pumphub', path: '/pumphub', label: 'Pumphub', color: '#06b6d4', icon: 'Zap' },
  { id: 'badges', path: '/badges', label: 'Badges', color: '#eab308', icon: 'Award' },
  { id: 'profile', path: '/profile', label: 'Profile', color: '#14b8a6', icon: 'User' },
]

export const PRODUCTS = [
  { id: 'early-access', path: '/early-access', label: 'Early Access', title: 'Early Access Pass', description: 'Mint your BaseHub Early Access Pass and unlock exclusive benefits', category: CATEGORIES.EARLY_ACCESS, color: '#fbbf24', icon: 'Rocket', xpReward: '3000 XP', bonusXP: null, networks: ['base'] },
  { id: 'nft-wheel', path: '/nft-wheel', label: 'NFT Wheel', title: 'NFT Wheel of Fortune', description: 'Spin to win massive XP rewards (NFT holders only)', category: CATEGORIES.EARLY_ACCESS, color: '#8b5cf6', icon: 'Sparkles', xpReward: '2K-50K XP', bonusXP: 'MEGA JACKPOT!', networks: ['base'], isNFTGated: true },
  { id: 'x402-premium', path: null, label: 'x402 test', title: 'x402 test', description: 'Pay 0.1 USDC via x402', category: CATEGORIES.SOCIAL, color: '#8b5cf6', icon: 'Star', xpReward: '500 XP', bonusXP: '0.1 USDC', networks: ['base'], isX402: true, isPayment: true },
  { id: 'swap', path: '/swap', label: 'SwapHub', title: 'SwapHub', description: 'DEX Aggregator - Swap tokens on Base', category: CATEGORIES.DEX, color: '#3b82f6', icon: 'ArrowLeftRight', xpReward: '5k XP / $100', bonusXP: 'Milestones up to 50M XP', networks: ['base'] },
  { id: 'flip', path: '/flip', label: 'Coinflip', title: 'Coin Flip', description: 'Flip a coin and earn XP', category: CATEGORIES.GAMING, color: '#f59e0b', icon: 'Coins', iconImage: '/crypto-logos/basahub logo/CoinFlip.png', xpReward: '150 XP', bonusXP: '+500 XP (Win)', networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'dice', path: '/dice', label: 'Dice Roll', title: 'Dice Roll', description: 'Roll dice and earn XP', category: CATEGORIES.GAMING, color: '#10b981', icon: 'Dice1', iconImage: '/crypto-logos/basahub logo/DiceRoll.png', xpReward: '150 XP', bonusXP: '+1500 XP (Win)', networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'slot', path: '/slot', label: 'Slots', title: 'Crypto Slots', description: 'Spin the reels and win XP', category: CATEGORIES.GAMING, color: '#dc2626', icon: 'Gift', iconImage: '/crypto-logos/basahub logo/CryptoSloth.png', xpReward: '150 XP', bonusXP: '+2000 XP (Combo)', networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'lucky', path: '/lucky', label: 'Lucky Number', title: 'Lucky Number', description: 'Guess 1-10 and earn XP', category: CATEGORIES.GAMING, color: '#3b82f6', icon: 'RotateCcw', iconImage: '/crypto-logos/basahub logo/luckynumber.png', xpReward: '150 XP', bonusXP: '+1000 XP (Win)', networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'wallet-analysis', path: '/wallet-analysis', label: 'Wallet Analysis', title: 'Wallet Analysis', description: 'Get fun insights about any wallet', category: CATEGORIES.ANALYSIS, color: '#3b82f6', icon: 'Search', xpReward: '400 XP', bonusXP: '0.40 USDC', networks: ['base'], isX402: true },
  { id: 'contract-security', path: '/contract-security', label: 'Contract Security', title: 'Contract Security', description: 'Analyze smart contract security risks', category: CATEGORIES.ANALYSIS, color: '#8b5cf6', icon: 'Shield', xpReward: '500 XP', bonusXP: '0.50 USDC', networks: ['base'], isX402: true },
  { id: 'allowance-cleaner', path: '/allowance-cleaner', label: 'Allowance Cleaner', title: 'Allowance Cleaner', description: 'Scan and revoke risky token approvals', category: CATEGORIES.ANALYSIS, color: '#8b5cf6', icon: 'Trash2', xpReward: '300 XP', bonusXP: '0.1 USDC', networks: ['base'], isX402: true },
  { id: 'featured-profiles', path: '/featured-profiles', label: 'Featured Profiles', title: 'Featured Profiles', description: 'Register your profile and connect through mutual follows', category: CATEGORIES.SOCIAL, color: '#f59e0b', icon: 'Star', xpReward: '200 XP', bonusXP: '0.2-6.0 USDC', networks: ['base'], isX402: true },
  { id: 'prediction-arena', path: '/prediction-arena', label: 'Prediction Arena', title: 'Prediction Arena', description: 'Create yes/no ETH prediction rounds and win by side consensus', category: CATEGORIES.NFT, color: '#14b8a6', icon: 'Users', xpReward: '2000 XP', bonusXP: '200 XP per bet', networks: ['base'] },
  { id: 'deploy', path: '/deploy', label: 'Deploy Token', title: 'Deploy Token', description: 'Create your own ERC20 token', category: CATEGORIES.DEPLOY, color: '#f59e0b', icon: 'Coins', iconImage: '/crypto-logos/basahub logo/ERC20.png', xpReward: '850 XP', bonusXP: null, networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'deploy-erc721', path: '/deploy-erc721', label: 'ERC721', title: 'Deploy ERC721', description: 'Deploy your own NFT contract', category: CATEGORIES.DEPLOY, color: '#06b6d4', icon: 'Package', iconImage: '/crypto-logos/basahub logo/ERC-721.png', xpReward: '850 XP', bonusXP: null, networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'deploy-erc1155', path: '/deploy-erc1155', label: 'ERC1155', title: 'Deploy ERC1155', description: 'Deploy multi-token contract', category: CATEGORIES.DEPLOY, color: '#8b5cf6', icon: 'Factory', iconImage: '/crypto-logos/basahub logo/ERC-1155.png', xpReward: '850 XP', bonusXP: null, networks: ['base', 'ink', 'soneium', 'katana', 'arc-restnet', 'robinhood-testnet'] },
  { id: 'nft-launchpad', path: '/nft-launchpad', label: 'NFT Launchpad', title: 'NFT Launchpad', description: 'Create your own NFT collection. Upload art or generate with AI, then deploy on Base.', category: CATEGORIES.NFT, color: '#3b82f6', icon: 'Package', xpReward: '2000 XP', bonusXP: '200 XP per mint', networks: ['base'], isX402: true, holderDiscount: 'Pass: 0.0005 ETH deploy' },
  { id: 'nft-launchpad-explore', path: '/nft-launchpad?tab=explore', label: 'Launched NFTs', title: 'Launched Collections', description: 'Browse and mint from NFT collections launched on Base', category: CATEGORIES.NFT, color: '#10b981', icon: 'LayoutGrid', xpReward: '200 XP', bonusXP: null, networks: ['base'] },
]

/** Get product by id */
export function getProductById(id) {
  return PRODUCTS.find(p => p.id === id)
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
 * Seçili ağa göre ürünleri filtreler.
 * Testnet seçildiğinde sadece o testnet için deploy edilmiş kontratı olan kartlar döner.
 * chainId yoksa (cüzdan bağlı değil) tüm ürünler döner.
 */
export function getProductsForHomeByNetwork(chainId, getNetworkKey) {
  if (chainId == null || !getNetworkKey) return PRODUCTS
  const networkKey = getNetworkKey(chainId)
  if (!networkKey) return PRODUCTS
  return PRODUCTS.filter(p => p.networks && p.networks.includes(networkKey))
}

/** Get mobile header menu items (order by MOBILE_MENU_IDS; label/icon from PRODUCTS or MOBILE_STATIC_ITEMS) */
export function getMobileMenuItems() {
  return MOBILE_MENU_IDS.map(id => {
    const staticItem = MOBILE_STATIC_ITEMS.find(s => s.id === id)
    if (staticItem) return staticItem
    const product = getProductById(id)
    if (product) return { id: product.id, path: product.path, label: product.label, color: product.color, icon: product.icon }
    return null
  }).filter(Boolean)
}
