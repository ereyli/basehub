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
    'https://base.drpc.org',
    'https://base-rpc.publicnode.com',
    'https://1rpc.io/base',
    'https://base.meowrpc.com',
  ],
  blockExplorerUrls: ['https://basescan.org'],
  iconUrls: ['https://base.org/favicon.ico'],
}

// Base Testnet Configuration removed - only mainnet supported

// Contract addresses for our games (Base Mainnet - DEPLOYED!)
export const CONTRACT_ADDRESSES = {
  // Mainnet addresses (new contracts)
  GM_GAME: '0xc3Ea6F7B014C6D9c4C421Ba5bcea3bD25F97f623',
  GN_GAME: '0xEcD289eA7aB254bD53062A26F377f146A624F133',
  FLIP_GAME: '0x9BE475499498f0e07bC3D89a91D8dE1b97A036b6',
  LUCKY_NUMBER: '0x48FF955604a44D5dbbF1e6c0fD8924CB99D46EF0',
  DICE_ROLL: '0xB8c1D2C73eC319B9484944c4E1ea7c1cc93ec2C2',
  SLOT_GAME: '0xbDAe561FCaD053902402F3D000cabc9806A6f3c1', // SlotGame deployed
  TOKEN_CONTRACT: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b', // Token contract unchanged
  BASEHUB_DEPLOYER: '0xDC7EE816aEb2879A7B15bB7950638840f8695917', // Single-tx ERC20/721/1155 deploy + fee (token supply to user)

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
  GAME_FEE: '20000000000000', // 0.00002 ETH in wei
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
