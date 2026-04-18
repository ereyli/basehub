import { parseEther } from 'viem'

// Server-safe Base-only constants for Agent Mode.
// Avoid importing src/config/networks.js here because that module pulls image assets
// and other browser-oriented config that breaks Node/edge route execution.
const AGENT_BASE_NETWORK = {
  chainId: 8453,
  rpcUrls: ['https://mainnet.base.org'],
}

const AGENT_BASE_CONTRACTS = {
  GM_GAME: '0xc3Ea6F7B014C6D9c4C421Ba5bcea3bD25F97f623',
  GN_GAME: '0xEcD289eA7aB254bD53062A26F377f146A624F133',
  FLIP_GAME: '0x9BE475499498f0e07bC3D89a91D8dE1b97A036b6',
  LUCKY_NUMBER: '0x48FF955604a44D5dbbF1e6c0fD8924CB99D46EF0',
  DICE_ROLL: '0xB8c1D2C73eC319B9484944c4E1ea7c1cc93ec2C2',
  BASEHUB_DEPLOYER: '0xDC7EE816aEb2879A7B15bB7950638840f8695917',
  PUMPHUB_FACTORY: '0xE7c2Fe007C65349C91B8ccAC3c5BE5a7f2FDaF21',
  SWAPHUB_AGGREGATOR: '0xbf579e68ba69de03ccec14476eb8d765ec558257',
  WETH: '0x4200000000000000000000000000000000000006',
  ZERO: '0x0000000000000000000000000000000000000000',
}

export const AGENT_STORAGE_KEY = 'basehub_burner_agent_v3'
export const AGENT_BASE_CHAIN_ID = AGENT_BASE_NETWORK.chainId
const agentModeRpcFromEnv =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_MODE_RPC_URL
    ? String(import.meta.env.VITE_AGENT_MODE_RPC_URL).trim()
    : ''
export const AGENT_RPC_URL = agentModeRpcFromEnv || AGENT_BASE_NETWORK.rpcUrls[0]

export const AGENT_STATUSES = {
  DISABLED: 'disabled',
  ACTIVE: 'active',
  PAUSED: 'paused',
}

export const AGENT_INPUT_MODES = {
  PROMPT: 'prompt',
  ROUTINE: 'routine',
}

export const AGENT_ACTION_TYPES = {
  SIMPLE: 'simple',
  GAMING: 'gaming',
  TRADE: 'trade',
  NFT: 'nft',
  DEPLOY: 'deploy',
}

export const AGENT_TARGET_IDS = {
  GM: 'gm-game',
  GN: 'gn-game',
  FLIP: 'flip-game',
  LUCKY: 'lucky-number',
  DICE: 'dice-roll',
  PUMPHUB_BUY: 'pumphub-buy',
  PUMPHUB_SELL: 'pumphub-sell',
  SWAPHUB_SWAP: 'swaphub-swap',
  FREE_NFT_MINT: 'free-nft-mint',
  DEPLOY_TOKEN: 'deploy-token',
  DEPLOY_ERC721: 'deploy-erc721',
  DEPLOY_ERC1155: 'deploy-erc1155',
}

export const AGENT_PUMPHUB_MODES = {
  SINGLE: 'single',
  WATCHLIST: 'watchlist',
  LATEST: 'latest',
}

export const GAME_FEE_WEI = parseEther('0.00002')
export const GM_GAME_FEE_WEI = GAME_FEE_WEI
export const AGENT_GAS_BUFFER_WEI = parseEther('0.00003')

export const GM_SEND_ABI = [
  {
    name: 'sendGM',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'message', type: 'string' }],
    outputs: [],
  },
]

export const GN_SEND_ABI = [
  {
    name: 'sendGN',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'message', type: 'string' }],
    outputs: [],
  },
]

export const FLIP_PLAY_ABI = [
  {
    name: 'playFlip',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'choice', type: 'uint8' }],
    outputs: [],
  },
]

export const LUCKY_NUMBER_ABI = [
  {
    name: 'guessLuckyNumber',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'guess', type: 'uint256' }],
    outputs: [],
  },
]

export const DICE_ROLL_ABI = [
  {
    name: 'rollDice',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'guess', type: 'uint256' }],
    outputs: [],
  },
]

export const PUMPHUB_FACTORY_ABI = [
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 't', type: 'address' },
      { name: 'min', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 't', type: 'address' },
      { name: 'amt', type: 'uint256' },
      { name: 'min', type: 'uint256' },
    ],
    outputs: [],
  },
]

export const SWAPHUB_AGGREGATOR_ABI = [
  {
    name: 'swapV2',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
]

export const UNISWAP_V2_ROUTER_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
]

export const AGENT_SWAPHUB_TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
  { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', name: 'USD Base Coin', decimals: 6 },
  { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH', decimals: 18 },
  { address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', symbol: 'AERO', name: 'Aerodrome', decimals: 18 },
  { address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', symbol: 'BRETT', name: 'Brett', decimals: 18 },
  { address: '0x50F88fe97f72CD3E75b9Eb4f747F59BcEBA80d59', symbol: 'JESSE', name: 'Jesse', decimals: 18 },
  { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', symbol: 'VIRTUAL', name: 'Virtual', decimals: 18 },
  { address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', symbol: 'TOSHI', name: 'Toshi', decimals: 18 },
  { address: '0xF6e932Ca12afa26665dC4dDE7e27be02A7c02e50', symbol: 'MOCHI', name: 'Mochi', decimals: 18 },
  { address: '0x6921B130D297cc43754afba22e5EAc0FBf8Db75b', symbol: 'DOGINME', name: 'Doginme', decimals: 18 },
  { address: '0x9a26F5433671751C3276a065f57e5a02D2817973', symbol: 'KEYCAT', name: 'Keyboard Cat', decimals: 18 },
  { address: '0x47b464eDB8Dc9BC67b5CD4C9310BB87b773845bD', symbol: 'NORMIE', name: 'Normie', decimals: 18 },
  { address: '0xB1a03EdA10342529bBF8EB700a06C60441fEf25d', symbol: 'MIGGLES', name: 'Miggles', decimals: 18 },
  { address: '0xbc45647ea894030a4e9801ec03479739fa2485f0', symbol: 'BENJI', name: 'Benji', decimals: 18 },
  { address: '0x0d97f261b1e88845184f678e2d1e7a98d9fd38de', symbol: 'TYBG', name: 'TYBG', decimals: 18 },
  { address: '0x33e7F871Ce502ec77A0D96fDcd02C9219f95E944', symbol: 'BOMET', name: 'Bomet', decimals: 18 },
  { address: '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07', symbol: 'CLAWD', name: 'CLAWD', decimals: 18 },
]

export const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
]

export const NFT_LAUNCH_MINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
]

export const AGENT_TARGETS = [
  {
    id: AGENT_TARGET_IDS.GM,
    type: AGENT_ACTION_TYPES.SIMPLE,
    title: 'GM Game',
    contractAddress: AGENT_BASE_CONTRACTS.GM_GAME,
    summary: 'Sends a GM transaction to the BaseHub GM contract on Base.',
    messagePlaceholder: 'GM from my BaseHub burner',
    estimatedSpendWei: GAME_FEE_WEI,
  },
  {
    id: AGENT_TARGET_IDS.GN,
    type: AGENT_ACTION_TYPES.SIMPLE,
    title: 'GN Game',
    contractAddress: AGENT_BASE_CONTRACTS.GN_GAME,
    summary: 'Sends a GN transaction to the BaseHub GN contract on Base.',
    messagePlaceholder: 'GN from my BaseHub burner',
    estimatedSpendWei: GAME_FEE_WEI,
  },
  {
    id: AGENT_TARGET_IDS.FLIP,
    type: AGENT_ACTION_TYPES.GAMING,
    title: 'Coin Flip',
    contractAddress: AGENT_BASE_CONTRACTS.FLIP_GAME,
    summary: 'Plays the BaseHub coin flip game on Base.',
    messagePlaceholder: '',
    estimatedSpendWei: GAME_FEE_WEI,
    payloadHints: {
      flipSide: ['heads', 'tails'],
    },
  },
  {
    id: AGENT_TARGET_IDS.LUCKY,
    type: AGENT_ACTION_TYPES.GAMING,
    title: 'Lucky Number',
    contractAddress: AGENT_BASE_CONTRACTS.LUCKY_NUMBER,
    summary: 'Plays the BaseHub lucky number game on Base.',
    messagePlaceholder: '',
    estimatedSpendWei: GAME_FEE_WEI,
    payloadHints: {
      luckyGuessMin: 1,
      luckyGuessMax: 10,
    },
  },
  {
    id: AGENT_TARGET_IDS.DICE,
    type: AGENT_ACTION_TYPES.GAMING,
    title: 'Dice Roll',
    contractAddress: AGENT_BASE_CONTRACTS.DICE_ROLL,
    summary: 'Plays the BaseHub dice roll game on Base.',
    messagePlaceholder: '',
    estimatedSpendWei: GAME_FEE_WEI,
    payloadHints: {
      diceGuessMin: 1,
      diceGuessMax: 6,
    },
  },
  {
    id: AGENT_TARGET_IDS.PUMPHUB_BUY,
    type: AGENT_ACTION_TYPES.TRADE,
    title: 'PumpHub Buy',
    contractAddress: AGENT_BASE_CONTRACTS.PUMPHUB_FACTORY,
    summary: 'Buys a tiny amount of a PumpHub token on Base.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0.0001'),
    payloadHints: {
      pumpHubTokenAddress: '0x...',
      pumpHubTradeAmountEth: '0.0001',
    },
  },
  {
    id: AGENT_TARGET_IDS.PUMPHUB_SELL,
    type: AGENT_ACTION_TYPES.TRADE,
    title: 'PumpHub Sell',
    contractAddress: AGENT_BASE_CONTRACTS.PUMPHUB_FACTORY,
    summary: 'Sells a small slice of a PumpHub token balance on Base.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0'),
    payloadHints: {
      pumpHubTokenAddress: '0x...',
      pumpHubSellBps: 2000,
    },
  },
  {
    id: AGENT_TARGET_IDS.SWAPHUB_SWAP,
    type: AGENT_ACTION_TYPES.TRADE,
    title: 'SwapHub Swap',
    contractAddress: AGENT_BASE_CONTRACTS.SWAPHUB_AGGREGATOR,
    summary: 'Swaps a tiny amount of ETH into a Base token through SwapHub.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0.00008'),
    payloadHints: {
      tokenOutAddress: '0x...',
      tokenOutSymbol: 'USDC',
      swapAmountEth: '0.00008',
    },
  },
  {
    id: AGENT_TARGET_IDS.FREE_NFT_MINT,
    type: AGENT_ACTION_TYPES.NFT,
    title: 'Free NFT Mint',
    contractAddress: '',
    summary: 'Mints a free NFT from BaseHub NFT Launchpad on Base.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0'),
    payloadHints: {
      contractAddress: '0x...',
      slug: 'collection-slug',
    },
  },
  {
    id: AGENT_TARGET_IDS.DEPLOY_TOKEN,
    type: AGENT_ACTION_TYPES.DEPLOY,
    title: 'Deploy Token',
    contractAddress: AGENT_BASE_CONTRACTS.BASEHUB_DEPLOYER,
    summary: 'Deploys a simple ERC20 token through BaseHub deployer.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0.00025'),
    payloadHints: {
      name: 'BaseHub Agent Token',
      symbol: 'BHAT',
      initialSupply: '1000000',
    },
  },
  {
    id: AGENT_TARGET_IDS.DEPLOY_ERC721,
    type: AGENT_ACTION_TYPES.DEPLOY,
    title: 'Deploy ERC721',
    contractAddress: AGENT_BASE_CONTRACTS.BASEHUB_DEPLOYER,
    summary: 'Deploys a simple ERC721 collection through BaseHub deployer.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0.00025'),
    payloadHints: {
      name: 'BaseHub Agent Collection',
      symbol: 'BHNFT',
    },
  },
  {
    id: AGENT_TARGET_IDS.DEPLOY_ERC1155,
    type: AGENT_ACTION_TYPES.DEPLOY,
    title: 'Deploy ERC1155',
    contractAddress: AGENT_BASE_CONTRACTS.BASEHUB_DEPLOYER,
    summary: 'Deploys a simple ERC1155 collection through BaseHub deployer.',
    messagePlaceholder: '',
    estimatedSpendWei: parseEther('0.00025'),
    payloadHints: {
      name: 'BaseHub Agent Multi',
      symbol: 'BHMULTI',
      uri: 'https://basehub.fun/agent/metadata/{id}.json',
    },
  },
]

export const DEFAULT_AGENT_SETTINGS = {
  plannerInputMode: AGENT_INPUT_MODES.PROMPT,
  dailyTxTarget: 3,
  maxDailySpendEth: '0.001',
  allowedActionTypes: [AGENT_ACTION_TYPES.SIMPLE, AGENT_ACTION_TYPES.GAMING, AGENT_ACTION_TYPES.TRADE, AGENT_ACTION_TYPES.NFT, AGENT_ACTION_TYPES.DEPLOY],
  enabledTargetIds: [
    AGENT_TARGET_IDS.GM,
    AGENT_TARGET_IDS.GN,
    AGENT_TARGET_IDS.FLIP,
    AGENT_TARGET_IDS.LUCKY,
    AGENT_TARGET_IDS.DICE,
    AGENT_TARGET_IDS.PUMPHUB_BUY,
    AGENT_TARGET_IDS.PUMPHUB_SELL,
    AGENT_TARGET_IDS.SWAPHUB_SWAP,
    AGENT_TARGET_IDS.FREE_NFT_MINT,
    AGENT_TARGET_IDS.DEPLOY_TOKEN,
    AGENT_TARGET_IDS.DEPLOY_ERC721,
    AGENT_TARGET_IDS.DEPLOY_ERC1155,
  ],
  llmEnabled: true,
  objective: 'Act like a real person using BaseHub through the day with light, varied routine activity.',
  userPrompt:
    'Keep this burner active on BaseHub in a human-looking way. Mix light social actions with a little gameplay and stay calm on spend.',
  autoRunEnabled: true,
  intervalMinutes: 30,
  gmMessage: 'GM from my BaseHub burner',
  gnMessage: 'GN from my BaseHub burner',
  pumpHubTradeMode: AGENT_PUMPHUB_MODES.LATEST,
  pumpHubTokenAddress: '',
  pumpHubWatchlist: [],
  pumpHubTradeAmountEth: '0.0001',
  swapHubTradeAmountEth: '0.00008',
  freeMintEnabled: true,
}
