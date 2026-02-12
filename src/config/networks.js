// Multi-network configuration
// Mainnet + Testnet. Testnet ağları ekledikçe CONTRACT_ADDRESSES'a da ekleyin.
// product.networks içinde kullanılan key'ler: 'base', 'ink', 'soneium', 'katana' (+ testnet key'leri)

export const NETWORKS = {
  BASE: {
    chainId: 8453,
    networkKey: 'base', // product.networks ile eşleşir
    chainName: 'Base',
    isTestnet: false,
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
    chainId: 57073,
    networkKey: 'ink',
    chainName: 'InkChain',
    isTestnet: false,
    nativeCurrency: {
      name: 'Ink',
      symbol: 'INK',
      decimals: 18,
    },
    rpcUrls: [
      'https://rpc-gel.inkonchain.com',
      'https://rpc-qnd.inkonchain.com',
    ],
    blockExplorerUrls: ['https://explorer.inkonchain.com'],
    iconUrls: [],
    isFarcasterSupported: false,
  },
  SONEIUM: {
    chainId: 1868,
    networkKey: 'soneium',
    chainName: 'Soneium',
    isTestnet: false,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.soneium.org'],
    blockExplorerUrls: ['https://soneium.blockscout.com'],
    iconUrls: [],
    isFarcasterSupported: false,
  },
  KATANA: {
    chainId: 747474,
    networkKey: 'katana',
    chainName: 'Katana',
    isTestnet: false,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.katana.network'],
    blockExplorerUrls: ['https://explorer.katanarpc.com'],
    iconUrls: [],
    isFarcasterSupported: false,
  },
  // Arc Testnet - para birimi USDC, cüzdanda yoksa otomatik "Ağ ekle" onayı açılır
  ARC_RESTNET: {
    chainId: 5042002, // 0x4cef52
    networkKey: 'arc-restnet',
    chainName: 'Arc Testnet',
    isTestnet: true,
    nativeCurrency: {
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
    },
    rpcUrls: [
      'https://arc-testnet.drpc.org',
      'https://rpc.testnet.arc.network',
    ],
    blockExplorerUrls: ['https://testnet.arcscan.app'],
    iconUrls: [],
    isFarcasterSupported: false,
  },
  ROBINHOOD_TESTNET: {
    chainId: 46630,
    networkKey: 'robinhood-testnet',
    chainName: 'Robinhood Chain Testnet',
    isTestnet: true,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.testnet.chain.robinhood.com'],
    blockExplorerUrls: ['https://explorer.testnet.chain.robinhood.com'],
    iconUrls: [],
    isFarcasterSupported: false,
  },
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
    BASEHUB_DEPLOYER: '0xDC7EE816aEb2879A7B15bB7950638840f8695917',
  },
  INKCHAIN: {
    GM_GAME: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    GN_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    FLIP_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    DICE_ROLL: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0xF0F9f37217C0D9EEba1506FcD2E6846399D758cD',
  },
  SONEIUM: {
    GM_GAME: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    GN_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    DICE_ROLL: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    FLIP_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0x9E54449DD4c042279aA454710481Cf33E15d8cb7',
  },
  KATANA: {
    GM_GAME: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    GN_GAME: '0x84e4dD821c8F848470Fc49Def3B14Fc870Fa97f0',
    FLIP_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    DICE_ROLL: '0xCaA2a1FB271AE0a04415654e62FB26BDd1AdAC64',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0x3Ce4AbC8c6921Cd84C76848200D35BA70609aB69',
  },
  ARC_RESTNET: {
    DICE_ROLL: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    FLIP_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    GM_GAME: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    GN_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0x84e4dD821c8F848470Fc49Def3B14Fc870Fa97f0',
  },
  ROBINHOOD_TESTNET: {
    DICE_ROLL: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    FLIP_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    GM_GAME: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    GN_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0x84e4dD821c8F848470Fc49Def3B14Fc870Fa97f0',
  },
}

// Get network config by chain ID
export const getNetworkConfig = (chainId) => {
  return Object.values(NETWORKS).find(net => net.chainId === chainId) || NETWORKS.BASE
}

// NETWORKS objesindeki key (BASE, INKCHAIN, BASE_SEPOLIA vb.) - CONTRACT_ADDRESSES ile eşleşir
export const getNetworkConfigKey = (chainId) => {
  const entry = Object.entries(NETWORKS).find(([, net]) => net.chainId === chainId)
  return entry ? entry[0] : 'BASE'
}

// product.networks ile kullanılan key: 'base', 'ink', 'base-sepolia' vb.
export const getNetworkKey = (chainId) => {
  const net = getNetworkConfig(chainId)
  return net?.networkKey ?? 'base'
}

// Sadece mainnet ağları (NetworkSelector Mainnet grubu)
export const getMainnetNetworks = () => {
  return Object.values(NETWORKS).filter(net => net && net.isTestnet === false)
}

// Sadece testnet ağları (NetworkSelector Testnet grubu). Şu an boş; ekledikçe dolacak.
export const getTestnetNetworks = () => {
  return Object.values(NETWORKS).filter(net => net && net.isTestnet === true)
}

// Get contract address for current network
export const getContractAddressByNetwork = (contractName, chainId) => {
  const configKey = getNetworkConfigKey(chainId)
  return CONTRACT_ADDRESSES[configKey]?.[contractName] ?? null
}

// Get all supported networks
export const getSupportedNetworks = () => {
  return Object.values(NETWORKS)
}

// Check if network is supported
export const isNetworkSupported = (chainId) => {
  return Object.values(NETWORKS).some(net => net.chainId === chainId)
}

// Get block explorer URL for a network
export const getExplorerUrl = (chainId) => {
  const network = getNetworkConfig(chainId)
  return network.blockExplorerUrls[0] || NETWORKS.BASE.blockExplorerUrls[0]
}

// Get transaction explorer URL
export const getTransactionExplorerUrl = (chainId, txHash) => {
  const explorerUrl = getExplorerUrl(chainId)
  return `${explorerUrl}/tx/${txHash}`
}

// Get address explorer URL
export const getAddressExplorerUrl = (chainId, address) => {
  const explorerUrl = getExplorerUrl(chainId)
  return `${explorerUrl}/address/${address}`
}

/** EIP-3085 params for wallet_addEthereumChain. Returns null if chainId not supported. MetaMask requires rpcUrls to be string[]. */
export const getAddChainParams = (chainId) => {
  const network = getNetworkConfig(chainId)
  if (!network) return null
  const firstRpc = Array.isArray(network.rpcUrls) && network.rpcUrls[0] && String(network.rpcUrls[0]).startsWith('https://')
    ? String(network.rpcUrls[0])
    : null
  if (!firstRpc) return null

  const params = {
    chainId: `0x${Number(chainId).toString(16)}`,
    chainName: String(network.chainName),
    nativeCurrency: {
      name: String(network.nativeCurrency.name),
      symbol: String(network.nativeCurrency.symbol),
      decimals: Number(network.nativeCurrency.decimals),
    },
    rpcUrls: [firstRpc],
  }
  const firstExplorer = network.blockExplorerUrls?.[0] || (Array.isArray(network.blockExplorerUrls) ? network.blockExplorerUrls[0] : null)
  if (firstExplorer && String(firstExplorer).startsWith('http')) {
    params.blockExplorerUrls = [String(firstExplorer)]
  }
  return params
}
