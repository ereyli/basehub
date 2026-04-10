import tempoLogo from '../../Tempo logo.jpg'

// Multi-network configuration
// Mainnet + Testnet. When adding testnet networks, also add them to CONTRACT_ADDRESSES.
// Keys used in product.networks: 'base', 'ink', 'soneium', 'katana', 'tempo' (+ testnet keys)

export const NETWORKS = {
  BASE: {
    chainId: 8453,
    networkKey: 'base', // matches product.networks
    chainName: 'Base',
    isTestnet: false,
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
      'https://rpc-qnd.inkonchain.com', // QuickNode - primary (rpc-gel bazen block out of range veriyor)
      'https://ink.drpc.org',
      'https://rpc-ten.inkonchain.com',
      'https://rpc-gel.inkonchain.com',
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
    rpcUrls: [
      'https://rpc.soneium.org',
      'https://soneium.drpc.org',
      'https://soneium-rpc.publicnode.com',
    ],
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
  MEGAETH: {
    chainId: 4326,
    networkKey: 'megaeth',
    chainName: 'MegaETH',
    isTestnet: false,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.megaeth.com/rpc'],
    blockExplorerUrls: ['https://megaeth.blockscout.com'],
    iconUrls: [],
    isFarcasterSupported: false,
  },
  TEMPO: {
    chainId: 4217,
    networkKey: 'tempo',
    chainName: 'Tempo Mainnet',
    isTestnet: false,
    nativeCurrency: {
      name: 'USD',
      symbol: 'USD',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.tempo.xyz'],
    blockExplorerUrls: ['https://explore.tempo.xyz'],
    iconUrls: [tempoLogo],
    isFarcasterSupported: false,
  },
  // Arc Testnet - currency is USDC, auto "Add Network" prompt if not in wallet
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
    iconUrls: ['/arc-testnet-logo.jpg'],
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
    iconUrls: ['/robinhood-testnet-logo.png'],
    isFarcasterSupported: false,
  },
}

// Contract addresses by network
export const CONTRACT_ADDRESSES = {
  BASE: {
    GM_GAME: '0xc3Ea6F7B014C6D9c4C421Ba5bcea3bD25F97f623',
    GN_GAME: '0xEcD289eA7aB254bD53062A26F377f146A624F133',
    FLIP_GAME: '0x9BE475499498f0e07bC3D89a91D8dE1b97A036b6',
    LUCKY_NUMBER: '0x48FF955604a44D5dbbF1e6c0fD8924CB99D46EF0',
    DICE_ROLL: '0xB8c1D2C73eC319B9484944c4E1ea7c1cc93ec2C2',
    SLOT_GAME: '0xbDAe561FCaD053902402F3D000cabc9806A6f3c1',
    TOKEN_CONTRACT: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0xDC7EE816aEb2879A7B15bB7950638840f8695917',
    BASEHUB_NFT_COLLECTION_DEPLOYER: '0x8b31312A6cD06839EFE768bD3D09bE785b83574A',
  },
  INKCHAIN: {
    GM_GAME: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    GN_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    FLIP_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    DICE_ROLL: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0xF0F9f37217C0D9EEba1506FcD2E6846399D758cD',
    BASEHUB_NFT_COLLECTION_DEPLOYER: '0x7E9C82Cb8A7C4B1EC1FDB7F3db660cdf9607DA9c',
  },
  SONEIUM: {
    GM_GAME: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    GN_GAME: '0x1fe43a182B2a4A5845B91bA29Cd7E7EEBC4b68Df',
    DICE_ROLL: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    FLIP_GAME: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0x9E54449DD4c042279aA454710481Cf33E15d8cb7',
    BASEHUB_NFT_COLLECTION_DEPLOYER: '0x4F018B2d0f59Aa33f0AC0c45eDE01D27329C4938',
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
  MEGAETH: {
    GM_GAME: '0x84e4dD821c8F848470Fc49Def3B14Fc870Fa97f0',
    GN_GAME: '0x5E86e9Cd50E7F64b692b90FaE1487d2F6ED1AbA9',
    FLIP_GAME: '0x74A2C6466d98253cA932fe6a6CcB811d4d7d5784',
    DICE_ROLL: '0x933570b7A6B872e1be0A1585AACcDbf609C5F981',
    LUCKY_NUMBER: '0xA15CE1eAdA8E34ec67d82f8D7aB242a42C767C2d',
    SLOT_GAME: '0xB2b2c587E51175a2aE4713d8Ea68A934a8527a4b',
    BASEHUB_DEPLOYER: '0xff48b92CbCFc1679Aa16a1D8a712A5d489220D0B',
    BASEHUB_NFT_COLLECTION_DEPLOYER: '0xCaA2a1FB271AE0a04415654e62FB26BDd1AdAC64',
  },
  TEMPO: {
    BASEHUB_DEPLOYER: '0x240eF5297a89e1354A83B4e58f8F0d19FB6051ed',
    BASEHUB_NFT_COLLECTION_DEPLOYER: '0x0854F20209f06bc6FaB3Dd9047784B4E08bE9e9b',
    DICE_ROLL: '0xc4a94DabeDb0Db43354874c67814c226391452B8',
    FLIP_GAME: '0x3Ce4AbC8c6921Cd84C76848200D35BA70609aB69',
    GM_GAME: '0x90Bb363ba2441fb4a9A0B49d1D5e8E7AB413c9d6',
    GN_GAME: '0x62eEA88cbaD6146Ce75D30D692eAD0de799e98C3',
    LUCKY_NUMBER: '0x71a625487DC88fa1Be54EC8BD96E240aCdAF8Fb0',
    SLOT_GAME: '0x9E54449DD4c042279aA454710481Cf33E15d8cb7',
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

// Key in NETWORKS object (BASE, INKCHAIN, BASE_SEPOLIA etc.) - matches CONTRACT_ADDRESSES
export const getNetworkConfigKey = (chainId) => {
  const entry = Object.entries(NETWORKS).find(([, net]) => net.chainId === chainId)
  return entry ? entry[0] : 'BASE'
}

// Key used with product.networks: 'base', 'ink', 'base-sepolia' etc.
export const getNetworkKey = (chainId) => {
  const net = getNetworkConfig(chainId)
  return net?.networkKey ?? 'base'
}

// Mainnet networks only (NetworkSelector Mainnet group)
export const getMainnetNetworks = () => {
  return Object.values(NETWORKS).filter(net => net && net.isTestnet === false)
}

// Testnet networks only (NetworkSelector Testnet group). Currently empty; will grow as networks are added.
export const getTestnetNetworks = () => {
  return Object.values(NETWORKS).filter(net => net && net.isTestnet === true)
}

// Is the given chainId a testnet? (XP is not earned on testnets.)
export const isTestnetChainId = (chainId) => {
  if (chainId == null) return false
  return getTestnetNetworks().some(net => net.chainId === Number(chainId))
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

/** Short label for mint/deploy UI (must match actual `getExplorerUrl` chain). */
export const getBlockExplorerDisplayName = (chainId) => {
  const cid = chainId != null ? Number(chainId) : NaN
  if (cid === NETWORKS.BASE.chainId) return 'Basescan'
  if (cid === NETWORKS.INKCHAIN.chainId) return 'Ink Explorer'
  if (cid === NETWORKS.SONEIUM.chainId) return 'Soneium Explorer'
  if (cid === NETWORKS.MEGAETH.chainId) return 'MegaETH Explorer'
  if (cid === NETWORKS.TEMPO.chainId) return 'Tempo Explorer'
  if (cid === NETWORKS.KATANA.chainId) return 'Katana Explorer'
  const net = getNetworkConfig(cid)
  if (net?.chainName) return `${net.chainName} Explorer`
  return 'Explorer'
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

/** OpenSea market URL. Base, Ink ve Soneium desteklenir. */
export const getCollectionMarketUrl = (contractAddress, chainId) => {
  if (!contractAddress) return ''
  if (chainId === NETWORKS.BASE.chainId) return `https://opensea.io/assets/base/${contractAddress}`
  if (chainId === NETWORKS.INKCHAIN.chainId) return `https://opensea.io/assets/ink/${contractAddress}`
  if (chainId === NETWORKS.SONEIUM.chainId) return `https://opensea.io/assets/soneium/${contractAddress}`
  return getAddressExplorerUrl(chainId, contractAddress) || ''
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
