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
    logoURI: undefined, // Will be fetched automatically from CoinGecko/TrustWallet
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
  }
};

// Popular token pairs for quick access
export const POPULAR_TOKENS = ['ETH', 'USDC', 'JESSE', 'VIRTUAL'];

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

