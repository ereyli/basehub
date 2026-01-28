import { Token } from '@uniswap/sdk-core';

// Base chain ID
export const BASE_CHAIN_ID = 8453;

// Token interface for our app
export interface AppToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
  sdkToken: Token;
}

// Token addresses on Base
export const TOKEN_ADDRESSES = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USD Base Coin (bridged)
  cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // Coinbase Wrapped Staked ETH
  // WBTC: '0x0555E30da8f98308EdbB23e1bB6c4fE6Cee5b76b', // Invalid address - commented out
  AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', // Aerodrome
  BRETT: '0x532f27101965dd16442E59d40670FaF5eBB142E4', // Brett (Based)
  BHUB: '0x0000000000000000000000000000000000000000', // BaseHub Token (Not deployed yet)
  JESSE: '0x50F88fe97f72CD3E75b9Eb4f747F59BcEBA80d59', // Jesse Token
  VIRTUAL: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', // Virtual Token
  // Meme Tokens
  TOSHI: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', // Toshi Token
  MOCHI: '0xF6e932Ca12afa26665dC4dDE7e27be02A7c02e50', // Mochi Token
  DOGINME: '0x6921B130D297cc43754afba22e5EAc0FBf8Db75b', // Doginme Token
  KEYCAT: '0x9a26F5433671751C3276a065f57e5a02D2817973', // Keyboard Cat Token
  NORMIE: '0x47b464eDB8Dc9BC67b5CD4C9310BB87b773845bD', // Normie Token
  MIGGLES: '0xB1a03EdA10342529bBF8EB700a06C60441fEf25d', // Miggles Token
  BENJI: '0xbc45647ea894030a4e9801ec03479739fa2485f0', // Basenji (BENJI) Token
  TYBG: '0x0d97f261b1e88845184f678e2d1e7a98d9fd38de', // Base God (TYBG) Token
  BOMET: '0x33e7F871Ce502ec77A0D96fDcd02C9219f95E944', // Bomet Token
  CLAWD: '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07', // CLAWD Token
};

// SDK Token instances
const WETH_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.WETH, 18, 'WETH', 'Wrapped Ether');
const USDC_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.USDC, 6, 'USDC', 'USD Coin');
const DAI_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.DAI, 18, 'DAI', 'Dai Stablecoin');
const USDbC_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.USDbC, 6, 'USDbC', 'USD Base Coin');
const cbETH_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.cbETH, 18, 'cbETH', 'Coinbase Wrapped Staked ETH');
// const WBTC_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.WBTC, 8, 'WBTC', 'Wrapped BTC'); // Invalid address
const AERO_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.AERO, 18, 'AERO', 'Aerodrome');
const BRETT_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.BRETT, 18, 'BRETT', 'Brett');
const BHUB_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.BHUB, 18, 'BHUB', 'BaseHub Token');
const JESSE_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.JESSE, 18, 'JESSE', 'Jesse');
const VIRTUAL_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.VIRTUAL, 18, 'VIRTUAL', 'Virtual');
// Meme Token instances (addresses updated)
const TOSHI_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.TOSHI, 18, 'TOSHI', 'Toshi');
const MOCHI_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.MOCHI, 18, 'MOCHI', 'Mochi');
const DOGINME_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.DOGINME, 18, 'DOGINME', 'Doge In Me');
const KEYCAT_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.KEYCAT, 18, 'KEYCAT', 'Keyboard Cat');
const NORMIE_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.NORMIE, 18, 'NORMIE', 'Normie');
const MIGGLES_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.MIGGLES, 18, 'MIGGLES', 'Miggles');
const BENJI_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.BENJI, 18, 'BENJI', 'Benji');
const TYBG_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.TYBG, 18, 'TYBG', 'TYBG');
const BOMET_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.BOMET, 18, 'BOMET', 'Bomet');
const CLAWD_TOKEN = new Token(BASE_CHAIN_ID, TOKEN_ADDRESSES.CLAWD, 18, 'CLAWD', 'CLAWD');

// Default token list
export const DEFAULT_TOKENS: Record<string, AppToken> = {
  ETH: {
    address: TOKEN_ADDRESSES.WETH,
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    isNative: true,
    sdkToken: WETH_TOKEN
  },
  WETH: {
    address: TOKEN_ADDRESSES.WETH,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    isNative: false,
    sdkToken: WETH_TOKEN
  },
  USDC: {
    address: TOKEN_ADDRESSES.USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    isNative: false,
    sdkToken: USDC_TOKEN
  },
  DAI: {
    address: TOKEN_ADDRESSES.DAI,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
    isNative: false,
    sdkToken: DAI_TOKEN
  },
  USDbC: {
    address: TOKEN_ADDRESSES.USDbC,
    symbol: 'USDbC',
    name: 'USD Base Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    isNative: false,
    sdkToken: USDbC_TOKEN
  },
  cbETH: {
    address: TOKEN_ADDRESSES.cbETH,
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/27008/small/cbeth.png',
    isNative: false,
    sdkToken: cbETH_TOKEN
  },
  AERO: {
    address: TOKEN_ADDRESSES.AERO,
    symbol: 'AERO',
    name: 'Aerodrome',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/31745/small/token.png',
    isNative: false,
    sdkToken: AERO_TOKEN
  },
  BRETT: {
    address: TOKEN_ADDRESSES.BRETT,
    symbol: 'BRETT',
    name: 'Brett',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/35529/small/1000050750.png',
    isNative: false,
    sdkToken: BRETT_TOKEN
  },
  BHUB: {
    address: TOKEN_ADDRESSES.BHUB,
    symbol: 'BHUB',
    name: 'BaseHub Token',
    decimals: 18,
    logoURI: '/icon.png',
    isNative: false,
    sdkToken: BHUB_TOKEN
  },
  JESSE: {
    address: TOKEN_ADDRESSES.JESSE,
    symbol: 'JESSE',
    name: 'Jesse',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/70790/small/jesse.png',
    isNative: false,
    sdkToken: JESSE_TOKEN
  },
  VIRTUAL: {
    address: TOKEN_ADDRESSES.VIRTUAL,
    symbol: 'VIRTUAL',
    name: 'Virtual',
    decimals: 18,
    logoURI: undefined, // Will be fetched automatically from CoinGecko/TrustWallet
    isNative: false,
    sdkToken: VIRTUAL_TOKEN
  },
  // Meme Tokens
  TOSHI: {
    address: TOKEN_ADDRESSES.TOSHI,
    symbol: 'TOSHI',
    name: 'Toshi',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/31126/small/Toshi_Logo_-_Circular.png',
    isNative: false,
    sdkToken: TOSHI_TOKEN
  },
  MOCHI: {
    address: TOKEN_ADDRESSES.MOCHI,
    symbol: 'MOCHI',
    name: 'Mochi',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xF6e932Ca12afa26665dC4dDE7e27be02A7c02e50/logo.png',
    isNative: false,
    sdkToken: MOCHI_TOKEN
  },
  DOGINME: {
    address: TOKEN_ADDRESSES.DOGINME,
    symbol: 'DOGINME',
    name: 'Doge In Me',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x6921B130D297cc43754afba22e5EAc0FBf8Db75b/logo.png',
    isNative: false,
    sdkToken: DOGINME_TOKEN
  },
  KEYCAT: {
    address: TOKEN_ADDRESSES.KEYCAT,
    symbol: 'KEYCAT',
    name: 'Keyboard Cat',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/36608/small/IMG_9500.jpeg',
    isNative: false,
    sdkToken: KEYCAT_TOKEN
  },
  NORMIE: {
    address: TOKEN_ADDRESSES.NORMIE,
    symbol: 'NORMIE',
    name: 'Normie',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/35880/small/NORMIEsite.png',
    isNative: false,
    sdkToken: NORMIE_TOKEN
  },
  MIGGLES: {
    address: TOKEN_ADDRESSES.MIGGLES,
    symbol: 'MIGGLES',
    name: 'Miggles',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/39251/small/New_LOGO.png',
    isNative: false,
    sdkToken: MIGGLES_TOKEN
  },
  BENJI: {
    address: TOKEN_ADDRESSES.BENJI,
    symbol: 'BENJI',
    name: 'Basenji',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/36416/small/photo_2025-12-04_22.13.35.png',
    isNative: false,
    sdkToken: BENJI_TOKEN
  },
  TYBG: {
    address: TOKEN_ADDRESSES.TYBG,
    symbol: 'TYBG',
    name: 'Base God',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/34563/small/tybg.png',
    isNative: false,
    sdkToken: TYBG_TOKEN
  },
  BOMET: {
    address: TOKEN_ADDRESSES.BOMET,
    symbol: 'BOMET',
    name: 'Bomet',
    decimals: 18,
    logoURI: 'https://coin-images.coingecko.com/coins/images/68659/small/logo-128.png',
    isNative: false,
    sdkToken: BOMET_TOKEN
  },
  CLAWD: {
    address: TOKEN_ADDRESSES.CLAWD,
    symbol: 'CLAWD',
    name: 'CLAWD',
    decimals: 18,
    // Leave undefined so logo can be auto-fetched via fetchTokenLogo (TrustWallet/CoinGecko/Uniswap list)
    logoURI: undefined,
    isNative: false,
    sdkToken: CLAWD_TOKEN
  }
};

// Popular token pairs for quick access
export const POPULAR_TOKENS = ['ETH', 'USDC', 'JESSE', 'VIRTUAL', 'BHUB'];

// Meme tokens category
export const MEME_TOKENS = ['TOSHI', 'MOCHI', 'DOGINME', 'KEYCAT', 'NORMIE', 'MIGGLES', 'BENJI', 'TYBG', 'BOMET', 'CLAWD'];

// Fee tiers for Uniswap V3 pools
export const FEE_TIERS = {
  LOWEST: 500,    // 0.05% - for stablecoin pairs
  LOW: 3000,      // 0.3% - for most pairs
  MEDIUM: 10000   // 1% - for exotic pairs
};

// Local storage key for custom tokens
const CUSTOM_TOKENS_KEY = 'customTokens';

// Load custom tokens from local storage
export function loadCustomTokens(): Record<string, AppToken> {
  try {
    const stored = localStorage.getItem(CUSTOM_TOKENS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Recreate sdkToken for each custom token
      const tokens: Record<string, AppToken> = {};
      for (const [key, token] of Object.entries(parsed)) {
        const t = token as AppToken;
        tokens[key] = {
          ...t,
          sdkToken: new Token(BASE_CHAIN_ID, t.address, t.decimals, t.symbol, t.name)
        };
      }
      return tokens;
    }
  } catch (e) {
    console.error('Failed to load custom tokens:', e);
  }
  return {};
}

// Save custom token to local storage
export function saveCustomToken(token: AppToken): void {
  try {
    const existing = loadCustomTokens();
    // Store without sdkToken (not serializable)
    const toStore = {
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      isNative: false
    };
    existing[token.symbol] = { ...toStore, sdkToken: token.sdkToken } as AppToken;
    
    // Save without sdkToken
    const storableTokens: Record<string, Omit<AppToken, 'sdkToken'>> = {};
    for (const [key, t] of Object.entries(existing)) {
      storableTokens[key] = {
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
        isNative: t.isNative
      };
    }
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(storableTokens));
  } catch (e) {
    console.error('Failed to save custom token:', e);
  }
}

// Remove custom token from local storage
export function removeCustomToken(symbol: string): void {
  try {
    const existing = loadCustomTokens();
    delete existing[symbol];
    
    const storableTokens: Record<string, Omit<AppToken, 'sdkToken'>> = {};
    for (const [key, t] of Object.entries(existing)) {
      storableTokens[key] = {
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
        isNative: t.isNative
      };
    }
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(storableTokens));
  } catch (e) {
    console.error('Failed to remove custom token:', e);
  }
}

// Get all tokens (default + custom)
export function getAllTokens(): Record<string, AppToken> {
  return { ...DEFAULT_TOKENS, ...loadCustomTokens() };
}

// Helper function to get token by address (includes custom tokens)
export function getTokenByAddress(address: string): AppToken | undefined {
  const allTokens = getAllTokens();
  return Object.values(allTokens).find(
    token => token.address.toLowerCase() === address.toLowerCase()
  );
}

// Helper function to search tokens (includes custom tokens)
export function searchTokens(query: string): AppToken[] {
  const allTokens = getAllTokens();
  const lowerQuery = query.toLowerCase();
  return Object.values(allTokens).filter(token =>
    token.symbol.toLowerCase().includes(lowerQuery) ||
    token.name.toLowerCase().includes(lowerQuery) ||
    token.address.toLowerCase().includes(lowerQuery)
  );
}

// Get token logo from various sources
export function getTokenLogoURI(address: string): string {
  // Try TrustWallet first (Base chain)
  const baseUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${address}/logo.png`;
  return baseUrl;
}

