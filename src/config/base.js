// Base Network Configuration
export const BASE_CONFIG = {
  chainId: 8453, // Base mainnet
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [
    'https://mainnet.base.org',
    'https://base-mainnet.g.alchemy.com/v2/demo',
    'https://base-mainnet.public.blastapi.io',
  ],
  blockExplorerUrls: ['https://basescan.org'],
  iconUrls: ['https://base.org/favicon.ico'],
}

// Base Testnet Configuration removed - only mainnet supported

// Contract addresses for our games (Base Mainnet - DEPLOYED!)
export const CONTRACT_ADDRESSES = {
  // Mainnet addresses (NO COOLDOWN - UPDATED!)
  GM_GAME: '0x9276DDa62Fc97f8206467148Baa82D078bD07e37',
  GN_GAME: '0xd5BEff70c711389Be367820a91920af3e0051598',
  FLIP_GAME: '0xc79F867244dceB1245869Cd1506f3118875B197c', // FlipGame unchanged (no cooldown)
  LUCKY_NUMBER: '0x93FEf7b044D3BE138404D48B5E09e156Ecb1974D',
  DICE_ROLL: '0x4E99ACaAAfa3fD8d996811d79ae4a960923e51e1',
  SLOT_GAME: '0xbDAe561FCaD053902402F3D000cabc9806A6f3c1', // SlotGame deployed
  TOKEN_CONTRACT: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b', // Token contract unchanged
  BASEHUB_DEPLOYER: '0xDC7EE816aEb2879A7B15bB7950638840f8695917', // Single-tx ERC20/721/1155 deploy + fee (token arzı kullanıcıya)

  // Testnet addresses removed - only mainnet supported
}

// Game configurations
export const GAME_CONFIG = {
  GM_REWARD: '1000000000000000000', // 1 token in wei
  GN_REWARD: '1000000000000000000', // 1 token in wei
  FLIP_MIN_BET: '100000000000000', // 0.0001 ETH in wei
  FLIP_MAX_BET: '10000000000000000', // 0.01 ETH in wei
  LUCKY_NUMBER_REWARD: '2000000000000000000', // 2 tokens in wei
  DICE_ROLL_REWARD: '3000000000000000000', // 3 tokens in wei
  GAME_FEE: '5000000000000', // 0.000005 ETH in wei
}

// Gas configurations
export const GAS_CONFIG = {
  GAS_LIMIT: '200000',
  GAS_PRICE: '2000000000', // 2 gwei
  MAX_FEE_PER_GAS: '3000000000', // 3 gwei
  MAX_PRIORITY_FEE_PER_GAS: '2000000000', // 2 gwei
}

// Only mainnet supported - no testnet
export const IS_TESTNET = false // Always false - only mainnet supported

export const getCurrentConfig = () => {
  return BASE_CONFIG // Always return mainnet config
}

export const getContractAddress = (contractName) => {
  return CONTRACT_ADDRESSES[contractName] // Direct access to mainnet addresses
}

// Re-export from networks.js for backward compatibility
export { NETWORKS, getNetworkConfig, getContractAddressByNetwork, isNetworkSupported } from './networks'
