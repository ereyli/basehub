// Multi-network configuration
// Base and InkChain network configs

export const NETWORKS = {
  BASE: {
    chainId: 8453,
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
    isFarcasterSupported: true, // Only Base supports Farcaster
  },
  INKCHAIN: {
    chainId: 57073, // InkChain mainnet chain ID (update if different)
    chainName: 'InkChain',
    nativeCurrency: {
      name: 'Ink',
      symbol: 'INK',
      decimals: 18,
    },
    rpcUrls: [
      'https://rpc.inkchain.io', // Update with actual RPC URL
    ],
    blockExplorerUrls: ['https://explorer.inkchain.io'], // Update with actual explorer
    iconUrls: [],
    isFarcasterSupported: false,
  }
}

// Contract addresses by network
export const CONTRACT_ADDRESSES = {
  BASE: {
    GM_GAME: '0x9276DDa62Fc97f8206467148Baa82D078bD07e37',
    GN_GAME: '0xd5BEff70c711389Be367820a91920af3e0051598',
    FLIP_GAME: '0xc79F867244dceB1245869Cd1506f3118875B197c',
    LUCKY_NUMBER: '0x93FEf7b044D3BE138404D48B5E09e156Ecb1974D',
    DICE_ROLL: '0x4E99ACaAAfa3fD8d996811d79ae4a960923e51e1',
    SLOT_GAME: '0xbDAe561FCaD053902402F3D000cabc9806A6f3c1',
    TOKEN_CONTRACT: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
  },
  INKCHAIN: {
    GM_GAME: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    GN_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    FLIP_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    DICE_ROLL: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
  }
}

// Get network config by chain ID
export const getNetworkConfig = (chainId) => {
  return Object.values(NETWORKS).find(net => net.chainId === chainId) || NETWORKS.BASE
}

// Get contract address for current network
export const getContractAddressByNetwork = (contractName, chainId) => {
  const network = getNetworkConfig(chainId)
  const networkKey = network.chainId === NETWORKS.BASE.chainId ? 'BASE' : 'INKCHAIN'
  return CONTRACT_ADDRESSES[networkKey]?.[contractName] || null
}

// Get all supported networks
export const getSupportedNetworks = () => {
  return Object.values(NETWORKS)
}

// Check if network is supported
export const isNetworkSupported = (chainId) => {
  return Object.values(NETWORKS).some(net => net.chainId === chainId)
}
