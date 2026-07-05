import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance, useChainId } from 'wagmi';
import { parseUnits, formatUnits, maxUint256, createPublicClient, http, fallback, encodeFunctionData, encodePacked } from 'viem';
import { base } from 'wagmi/chains';
import { DEFAULT_TOKENS, POPULAR_TOKENS, MEME_TOKENS, FEE_TIERS, searchTokens, getAllTokens, saveCustomToken, removeCustomToken, getTokenByAddress, BASE_CHAIN_ID, type AppToken } from '../config/tokens';
import { Token } from '@uniswap/sdk-core';
import StatsPanel from './StatsPanel';
import swaphubLogo from '../assets/swaphub-logo.png';
import { recordSwapTransaction } from '../utils/xpUtils';
import { calculateNetOutput, type SplitRouteResult } from '../utils/splitRouteEngine';
import { useQuestSystem } from '../hooks/useQuestSystem';
import { NETWORKS } from '../config/networks';
import { DATA_SUFFIX } from '../config/wagmi';
import { AlertCircle } from 'lucide-react';

// ETH price state - will be fetched from CoinGecko API
let cachedEthPrice = 2950; // Default fallback price
let lastFetchTime = 0;
const PRICE_CACHE_DURATION = 60000; // Cache for 1 minute

// Fetch ETH price from CoinGecko API
async function fetchEthPrice(): Promise<number> {
  const now = Date.now();
  
  // Return cached price if still fresh
  if (now - lastFetchTime < PRICE_CACHE_DURATION) {
    return cachedEthPrice;
  }
  
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const price = data?.ethereum?.usd;
      
      if (price && typeof price === 'number' && price > 0) {
        cachedEthPrice = price;
        lastFetchTime = now;
        console.log('✅ ETH price updated:', `$${price.toFixed(2)}`);
        return price;
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch ETH price from CoinGecko, using cached price:', cachedEthPrice);
  }
  
  return cachedEthPrice;
}

// Helper function to calculate USD value for a token amount
// If swapAmount is provided, use it to calculate USD value based on swap ratio
function calculateUsdValue(
  amount: string, 
  token: AppToken, 
  swapAmount: string | undefined, 
  swapToken: AppToken | undefined,
  ethPrice: number
): string {
  if (!amount || parseFloat(amount) === 0) return '$0';
  
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) return '$0';
  
  // ETH/WETH/cbETH: Use ETH price
  if (token.symbol === 'ETH' || token.symbol === 'WETH' || token.symbol === 'cbETH') {
    const usdValue = amountNum * ethPrice;
    return `$${formatNumber(usdValue, 2)}`;
  }
  
  // Stablecoins: 1 USD per token
  if (token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI') {
    return `$${formatNumber(amountNum, 2)}`;
  }
  
  // If we have swap amounts, calculate USD value based on swap ratio
  // For unknown tokens, derive price from swap ratio with known tokens
  if (swapAmount && swapToken && parseFloat(swapAmount) > 0) {
    const swapAmountNum = parseFloat(swapAmount);
    
    // Calculate USD value of swap token (the other side of the swap)
    let swapUsdValue = 0;
    if (swapToken.symbol === 'ETH' || swapToken.symbol === 'WETH' || swapToken.symbol === 'cbETH') {
      swapUsdValue = swapAmountNum * ethPrice;
    } else if (swapToken.symbol === 'USDC' || swapToken.symbol === 'USDT' || swapToken.symbol === 'DAI') {
      swapUsdValue = swapAmountNum;
    }
    
    // If we can calculate swap USD value, derive current token's USD value
    // The swap ratio tells us: amountNum of token = swapUsdValue in USD
    if (swapUsdValue > 0 && amountNum > 0) {
      // Simply use the swap USD value directly
      // Example: 28000 SKITTEN = 0.0086 ETH = $25.37
      // So 28000 SKITTEN is worth $25.37
      return `$${formatNumber(swapUsdValue, 2)}`;
    }
  }
  
  // For other tokens without swap data, show dash
  return '-';
}

// Smart number formatting - reduces unnecessary decimals
function formatNumber(value: number, maxDecimals: number = 4): string {
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return '0';
  
  // For values >= 1, use max 2 decimals
  if (value >= 1) {
    const formatted = value.toFixed(2);
    // Remove trailing zeros
    return parseFloat(formatted).toString();
  }
  
  // Keep crypto amounts readable; never show scientific notation in the UI.
  const decimalsToShow = value >= 0.01 ? maxDecimals : value >= 0.0001 ? 6 : 8;
  const formatted = value.toFixed(decimalsToShow).replace(/\.?0+$/, '');
  return formatted === '0' && value > 0 ? value.toFixed(8).replace(/\.?0+$/, '') : formatted;
}

// Helper function to check if image URL is valid (using Image object)
const checkImageUrl = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(false), 1500);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    img.src = url;
  });
};

// Fetch token logo from multiple sources
async function fetchTokenLogo(address: string, symbol: string): Promise<string | null> {
  const normalizedAddress = address.toLowerCase();
  
  // 1. Try Trust Wallet Assets (Base) - most reliable
  const trustWalletBaseUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${normalizedAddress}/logo.png`;
  const trustWalletBaseValid = await checkImageUrl(trustWalletBaseUrl);
  if (trustWalletBaseValid) {
    console.log('✅ Logo found: Trust Wallet Base', trustWalletBaseUrl);
    return trustWalletBaseUrl;
  }

  // 2. Try CoinGecko API (by contract address)
  try {
    const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/base/contract/${normalizedAddress}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
    const response = await fetch(coingeckoUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      // Try large first, then small, then thumb
      const logoUrls = [data?.image?.large, data?.image?.small, data?.image?.thumb].filter(Boolean);
      for (const logoUrl of logoUrls) {
        const isValid = await checkImageUrl(logoUrl);
        if (isValid) {
          console.log('✅ Logo found: CoinGecko', logoUrl);
          return logoUrl;
        }
      }
    }
  } catch (e) {
    console.warn('CoinGecko API error:', e);
  }

  // 3. Try Trust Wallet Ethereum assets (for bridged tokens)
  const trustWalletEthUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${normalizedAddress}/logo.png`;
  const trustWalletEthValid = await checkImageUrl(trustWalletEthUrl);
  if (trustWalletEthValid) {
    console.log('✅ Logo found: Trust Wallet Ethereum', trustWalletEthUrl);
    return trustWalletEthUrl;
  }

  // 4. Try Uniswap Token List (Base) - slower, so try last
  try {
    const uniswapListUrl = 'https://raw.githubusercontent.com/Uniswap/token-lists/main/src/tokens/base.json';
    const response = await fetch(uniswapListUrl);
    if (response.ok) {
      const data = await response.json();
      const token = data.tokens?.find((t: any) => 
        t.address?.toLowerCase() === normalizedAddress && 
        (t.chainId === 8453 || t.chainId === '8453')
      );
      if (token?.logoURI) {
        const isValid = await checkImageUrl(token.logoURI);
        if (isValid) {
          console.log('✅ Logo found: Uniswap Token List', token.logoURI);
          return token.logoURI;
        }
      }
    }
  } catch (e) {
    console.warn('Uniswap token list error:', e);
  }

  console.warn('❌ No logo found for token:', symbol, address);
  return null;
}

// Token item with balance display
interface TokenListItemProps {
  token: AppToken;
  onClick: () => void;
  isDisabled?: boolean;
  ethPrice: number;
}

// Custom token item with remove button
function CustomTokenItemWithRemove({ 
  token, 
  isOtherToken, 
  onSelect, 
  onRemove,
  ethPrice
}: { 
  token: AppToken; 
  isOtherToken: boolean; 
  onSelect: () => void; 
  onRemove: (e: React.MouseEvent) => void;
  ethPrice: number;
}) {
  const { address: userAddress } = useAccount();
  const { data: balance } = useBalance({
    address: userAddress,
    token: token.isNative ? undefined : (token.address as `0x${string}`),
    chainId: base.id,
    query: { staleTime: 30_000 }
  });

  const balanceFormatted = balance 
    ? parseFloat(formatUnits(balance.value, balance.decimals))
    : 0;

  const getUsdValue = () => {
    if (!balance || balanceFormatted === 0) return null;
    if (token.symbol === 'ETH' || token.symbol === 'WETH' || token.symbol === 'cbETH') {
      return formatNumber(balanceFormatted * ethPrice, 2);
    }
    if (token.symbol === 'USDC' || token.symbol === 'USDbC' || token.symbol === 'DAI') {
      return formatNumber(balanceFormatted, 2);
    }
    return null;
  };

  const usdValue = getUsdValue();

  return (
    <div
      style={{
        ...tokenListItemStyles.container,
        opacity: isOtherToken ? 0.5 : 1,
        cursor: isOtherToken ? 'not-allowed' : 'pointer',
        position: 'relative' as const
      }}
      onClick={() => !isOtherToken && onSelect()}
    >
      <div style={tokenListItemStyles.left}>
        {(token.logoURI || tokenLogos?.[token.symbol]) ? (
          <img 
            src={token.logoURI || tokenLogos?.[token.symbol]} 
            alt={token.symbol} 
            style={tokenListItemStyles.logo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={tokenListItemStyles.logoPlaceholder}>
            {token.symbol.charAt(0)}
          </div>
        )}
        <div style={tokenListItemStyles.info}>
          <div style={tokenListItemStyles.symbol}>{token.symbol}</div>
          <div style={tokenListItemStyles.name}>{token.name}</div>
        </div>
      </div>
      {balanceFormatted > 0 && (
        <div style={{ ...tokenListItemStyles.right, paddingRight: '32px' }}>
          {usdValue && <div style={tokenListItemStyles.usdValue}>${formatNumber(parseFloat(usdValue), 2)}</div>}
          <div style={tokenListItemStyles.balance}>
            {formatNumber(balanceFormatted)}
          </div>
        </div>
      )}
      <button
        onClick={onRemove}
        style={{
          position: 'absolute' as const,
          top: '50%',
          right: '12px',
          transform: 'translateY(-50%)',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          lineHeight: 1,
          padding: 0,
          transition: 'all 0.2s',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
          e.currentTarget.style.color = '#ff4444';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
        }}
      >
        ×
      </button>
    </div>
  );
}

function TokenListItem({ token, onClick, isDisabled, ethPrice, tokenLogos }: TokenListItemProps & { tokenLogos?: Record<string, string> }) {
  const { address } = useAccount();
  const { data: balance } = useBalance({
    address: address,
    token: token.isNative ? undefined : (token.address as `0x${string}`),
    chainId: base.id,
    query: { staleTime: 30_000 }
  });

  const balanceFormatted = balance
    ? parseFloat(formatUnits(balance.value, balance.decimals))
    : 0;
  
  // Calculate USD value (simplified - you can integrate a price API)
  const getUsdValue = () => {
    if (!balance || balanceFormatted === 0) return null;
    
    // For ETH-based tokens
    if (token.symbol === 'ETH' || token.symbol === 'WETH' || token.symbol === 'cbETH') {
      return formatNumber(balanceFormatted * ethPrice, 2);
    }
    // For stablecoins
    if (token.symbol === 'USDC' || token.symbol === 'USDbC' || token.symbol === 'DAI') {
      return formatNumber(balanceFormatted, 2);
    }
    return null;
  };

  const usdValue = getUsdValue();

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        ...tokenListItemStyles.container,
        opacity: isDisabled ? 0.5 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer'
      }}
    >
      <div style={tokenListItemStyles.left}>
        {(token.logoURI || tokenLogos?.[token.symbol]) ? (
          <img 
            src={token.logoURI || tokenLogos?.[token.symbol]} 
            alt={token.symbol} 
            style={tokenListItemStyles.logo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={tokenListItemStyles.logoPlaceholder}>
            {token.symbol.charAt(0)}
          </div>
        )}
        <div style={tokenListItemStyles.info}>
          <div style={tokenListItemStyles.symbol}>{token.symbol}</div>
          <div style={tokenListItemStyles.name}>{token.name}</div>
        </div>
      </div>
          {balanceFormatted > 0 && (
        <div style={tokenListItemStyles.right}>
          {usdValue && <div style={tokenListItemStyles.usdValue}>${usdValue}</div>}
          <div style={tokenListItemStyles.balance}>
            {formatNumber(balanceFormatted)}
          </div>
        </div>
      )}
    </button>
  );
}

const tokenListItemStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#1a1a1a',
    flexShrink: 0
  },
  logoPlaceholder: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: '14px',
    fontWeight: 'bold',
    flexShrink: 0
  },
  info: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '1px',
    minWidth: 0
  },
  symbol: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff'
  },
  name: {
    fontSize: '12px',
    color: '#666666',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '140px'
  },
  right: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '1px',
    flexShrink: 0
  },
  usdValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ffffff'
  },
  balance: {
    fontSize: '12px',
    color: '#666666'
  }
};

// UNISWAP V3 - SwapRouter02
const SWAP_ROUTER_02 = '0x2626664c2603336E57B271c5C0b26F421741e481';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const QUOTER_V2_ADDRESS = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';

// UNISWAP V2 - Router02 on Base
const UNISWAP_V2_ROUTER = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';
const UNISWAP_V2_FACTORY = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6';

// Additional Base DEX routers/quoters
const PANCAKESWAP_V3_ROUTER = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
const PANCAKESWAP_V3_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';

// OUR SWAP AGGREGATOR V4 (VITE_SWAP_AGGREGATOR_ADDRESS can override this per environment)
const DEFAULT_SWAP_AGGREGATOR = '0x645A71B8E06c1979e0F140B1ceA68ffa5efBC497';
const SWAP_AGGREGATOR = (import.meta.env.VITE_SWAP_AGGREGATOR_ADDRESS || DEFAULT_SWAP_AGGREGATOR) as `0x${string}`;
const DEFAULT_SWAP_AGGREGATOR_ADAPTER = '0xCB8409EE16c10c1460f1Fd07a27AC3D7b882dA5A';
const SWAP_AGGREGATOR_ADAPTER = (import.meta.env.VITE_SWAP_AGGREGATOR_ADAPTER_ADDRESS || DEFAULT_SWAP_AGGREGATOR_ADAPTER) as `0x${string}`;
const DEFAULT_PROTOCOL_FEE_BPS = 50;
const ENABLE_SPLIT_ROUTE_PREVIEW = import.meta.env.VITE_ENABLE_SPLIT_ROUTE_PREVIEW !== 'false';
const SPLIT_QUOTE_CHUNKS = 4;
const SPLIT_ALLOCATION_UNITS = 10;
const SPLIT_MIN_INPUT_USD = 25;
const GAS_ADJUSTED_ROUTE_SCORING = import.meta.env.VITE_GAS_ADJUSTED_ROUTE_SCORING !== 'false';
const MULTI_HOP_ROUTE_PREVIEW = import.meta.env.VITE_MULTI_HOP_ROUTE_PREVIEW !== 'false';
const ENABLE_ADAPTER_V2_MULTI_HOP = import.meta.env.VITE_ENABLE_ADAPTER_V2_MULTI_HOP === 'true';
const GAS_ESTIMATE_UNITS = {
  'uniswap-v3': 185_000n,
  'uniswap-v2': 165_000n,
  'pancakeswap-v3': 190_000n,
  aerodrome: 175_000n
} as const;
const MULTI_HOP_GAS_PER_EXTRA_HOP = 55_000n;

// Aggregator V4 ABI - split-route execution through allowlisted adapters
const AGGREGATOR_ABI = [
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      {
        name: 'steps',
        type: 'tuple[]',
        components: [
          { name: 'adapter', type: 'address' },
          { name: 'router', type: 'address' },
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'routerCalldata', type: 'bytes' },
          { name: 'dexId', type: 'bytes32' }
        ]
      }
    ],
    name: 'executeSplit',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'feeBps',
    outputs: [{ type: 'uint16' }],
    stateMutability: 'view',
    type: 'function'
  }
];

// Zero address represents native ETH in our aggregator
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


// Protocol type for swap routing
type SwapProtocol = 'uniswap-v3' | 'uniswap-v2' | 'pancakeswap-v3' | 'aerodrome';

type SwapRoutePlan = {
  protocol: SwapProtocol;
  label: string;
  router: `0x${string}`;
  rawQuote: bigint;
  routerCalldata: `0x${string}`;
  bestFeeTier?: number;
  path?: `0x${string}`[];
  estimatedGasUnits?: bigint;
  gasCostInOutputToken?: bigint;
  gasAdjustedQuote?: bigint;
  hopCount?: number;
};

type SplitRoutePreview = SplitRouteResult<SwapProtocol>;

const DEX_IDS: Record<SwapProtocol, `0x${string}`> = {
  'uniswap-v3': '0x554e49535741505f563300000000000000000000000000000000000000000000',
  'uniswap-v2': '0x554e49535741505f563200000000000000000000000000000000000000000000',
  'pancakeswap-v3': '0x50414e43414b455f563300000000000000000000000000000000000000000000',
  aerodrome: '0x4145524f44524f4d450000000000000000000000000000000000000000000000'
};

const QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const V3_QUOTER_EXACT_INPUT_ABI = [
  {
    inputs: [
      { name: 'path', type: 'bytes' },
      { name: 'amountIn', type: 'uint256' }
    ],
    name: 'quoteExactInput',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' },
      { name: 'gasEstimate', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// Uniswap V2 Router ABI
const V2_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' }
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForETH',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const UNISWAP_V3_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

const UNISWAP_V3_EXACT_INPUT_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInput',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

const PANCAKESWAP_V3_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

const PANCAKESWAP_V3_EXACT_INPUT_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInput',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

const AERODROME_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      {
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' }
        ],
        name: 'routes',
        type: 'tuple[]'
      }
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' }
        ],
        name: 'routes',
        type: 'tuple[]'
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// V2 Factory ABI for checking pair existence
const V2_FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' }
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  // For reading token info (custom token import)
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }
];

// WETH ABI for wrap/unwrap operations (ETH↔WETH)
const WETH_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: []
  }
];

export default function SwapInterface() {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { updateQuestProgress } = useQuestSystem();
  const { writeContractAsync, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ hash });
  const swapClient = React.useMemo(() => createPublicClient({
    chain: base,
    transport: fallback([
      http('https://base-mainnet.g.alchemy.com/v2/EXk1VtDVCaeNBRAWsi7WA', { timeout: 10_000, retryCount: 2, retryDelay: 800 }),
      http('https://base.drpc.org', { timeout: 12_000, retryCount: 1, retryDelay: 1000 }),
      http('https://base-rpc.publicnode.com', { timeout: 12_000, retryCount: 1, retryDelay: 1000 }),
      http('https://1rpc.io/base', { timeout: 12_000, retryCount: 1, retryDelay: 1000 }),
    ], { rank: false, retryCount: 2, retryDelay: 1000 }),
  }), []);
  
  // SwapHub only works on Base network
  const isOnBase = chainId === NETWORKS.BASE.chainId;

  // ETH price state - updated from CoinGecko API
  const [ethPriceUsd, setEthPriceUsd] = useState<number>(2950);

  // Mobile responsive hook
  const [isMobile, setIsMobile] = useState(false);

  // Token and amount states - must be defined before useEffect hooks that use them
  const [tokenIn, setTokenIn] = useState<AppToken>(DEFAULT_TOKENS.ETH);
  const [tokenOut, setTokenOut] = useState<AppToken>(DEFAULT_TOKENS.USDC);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('0');
  const [transactionStep, setTransactionStep] = useState<'idle' | 'approving' | 'approved' | 'swapping' | 'success'>('idle');
  const quoteRequestIdRef = useRef(0);
  const pendingSwapVolumeRef = useRef<{ swapAmountUSD: number } | null>(null);
  const QUOTE_CACHE_MS = 15_000;
  const quoteCacheRef = useRef<{
    key: string;
    amountOut: string;
    bestProtocol: SwapProtocol;
    bestV3Fee: number;
    bestRoutePlan: SwapRoutePlan | null;
    routePlans: SwapRoutePlan[];
    splitRoutePreview: SplitRoutePreview | null;
    priceImpact: string;
    v3Available: boolean;
    v2Available: boolean;
    timestamp: number;
  } | null>(null);
  const gasPriceCacheRef = useRef<{ value: bigint; timestamp: number } | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch ETH price on mount and periodically update
  useEffect(() => {
    const updateEthPrice = async () => {
      try {
        const price = await fetchEthPrice();
        setEthPriceUsd(price);
        console.log('🔄 ETH price updated in component:', `$${price.toFixed(2)}`);
      } catch (error) {
        console.error('❌ Error updating ETH price:', error);
        // Keep using cached/default price
      }
    };
    
    // Fetch immediately on mount
    updateEthPrice();
    
    // Update every 2 minutes
    const interval = setInterval(updateEthPrice, 120000);
    
    return () => clearInterval(interval);
  }, []);

  // Record swap volume when tx confirms (use amount stored in ref at submit time so we don't depend on state)
  const lastRecordedHashRef = useRef<string | null>(null);
  const swapToRecordRef = useRef<{ hash: string; amount: number } | null>(null);
  const recordSentForHashRef = useRef<string | null>(null);
  const [xpSuccessToast, setXpSuccessToast] = useState<{ xp: number; message: string } | null>(null);
  // XP recording is now handled inline in handleSwap after swapClient confirms the receipt.
  useEffect(() => {
    if (!xpSuccessToast) return;
    const t = setTimeout(() => setXpSuccessToast(null), 4000);
    return () => clearTimeout(t);
  }, [xpSuccessToast]);
  const [showTokenSelect, setShowTokenSelect] = useState<'in' | 'out' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  // Load slippage from localStorage, default to 0.5%
  const [slippage, setSlippage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('swapSlippage');
      return saved ? parseFloat(saved) : 0.5;
    }
    return 0.5;
  });
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedFeeTier, setSelectedFeeTier] = useState(FEE_TIERS.LOW); // Default 0.3% - more common pools
  const [priceImpact, setPriceImpact] = useState<string>('0');
  const [customTokens, setCustomTokens] = useState<Record<string, AppToken>>({});
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({}); // Cache for fetched logos
  const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false);
  const [customTokenError, setCustomTokenError] = useState<string | null>(null);
  const [foundToken, setFoundToken] = useState<AppToken | null>(null);
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<SwapProtocol>('uniswap-v3');
  const [selectedRoutePlan, setSelectedRoutePlan] = useState<SwapRoutePlan | null>(null);
  const [allRoutePlans, setAllRoutePlans] = useState<SwapRoutePlan[]>([]);
  const [splitRoutePreview, setSplitRoutePreview] = useState<SplitRoutePreview | null>(null);
  const [v2Available, setV2Available] = useState(false);
  const [v3Available, setV3Available] = useState(false);
  const [noLiquidityError, setNoLiquidityError] = useState(false);
  const [quoteRetryTrigger, setQuoteRetryTrigger] = useState(0);
  const [dontShowWarning, setDontShowWarning] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  const [showMemeTokens, setShowMemeTokens] = useState(true); // Default to open
  const [isConfirmingPrice, setIsConfirmingPrice] = useState(false);

  // Get balance for tokenIn (native ETH or ERC20 token)
  const { data: displayBalance, refetch: refetchBalanceIn } = useBalance({
    address: address,
    token: tokenIn.isNative ? undefined : (tokenIn.address as `0x${string}`),
    chainId: base.id
  });

  // Get balance for tokenOut
  const { data: tokenOutBalance, refetch: refetchBalanceOut } = useBalance({
    address: address,
    token: tokenOut.isNative ? undefined : (tokenOut.address as `0x${string}`),
    chainId: base.id
  });

  // Check allowance - always approve aggregator contract
  // Native ETH doesn't need approval
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address, SWAP_AGGREGATOR],
    query: {
      enabled: !!address && !tokenIn.isNative
    }
  });

  // Read protocol fee from aggregator
  const { data: protocolFeeBps } = useReadContract({
    address: SWAP_AGGREGATOR as `0x${string}`,
    abi: AGGREGATOR_ABI,
    functionName: 'feeBps'
  });
  const getProtocolFeeBps = () => {
    return typeof protocolFeeBps === 'bigint' ? Number(protocolFeeBps) : DEFAULT_PROTOCOL_FEE_BPS;
  };

  // Load custom tokens from localStorage on mount and refresh logos
  useEffect(() => {
    const loadedTokens = getAllTokens();
    // Filter out default tokens, keep only custom ones
    const customOnly: Record<string, AppToken> = {};
    for (const [key, token] of Object.entries(loadedTokens)) {
      if (!DEFAULT_TOKENS[key]) {
        customOnly[key] = token;
      }
    }
    setCustomTokens(customOnly);

    // Refresh logos for tokens that don't have one or have invalid logo
    const refreshLogos = async () => {
      try {
        // First, refresh logos for DEFAULT_TOKENS that don't have logoURI
        const logoUpdates: Record<string, string> = {};
        for (const [key, token] of Object.entries(DEFAULT_TOKENS)) {
          if (!token.logoURI) {
            console.log('🔄 Fetching logo for default token:', token.symbol);
            try {
              const logoURI = await fetchTokenLogo(token.address, token.symbol);
              if (logoURI) {
                logoUpdates[key] = logoURI;
                console.log('✅ Logo fetched for default token:', token.symbol, logoURI);
              }
            } catch (e) {
              console.warn('Failed to fetch logo for default token', token.symbol, e);
            }
          }
        }
        // Update state with fetched logos
        if (Object.keys(logoUpdates).length > 0) {
          setTokenLogos(prev => ({ ...prev, ...logoUpdates }));
        }
        
        // Then, refresh logos for custom tokens
        for (const [key, token] of Object.entries(customOnly)) {
          try {
            // If no logo or logo might be invalid, try to fetch
            if (!token.logoURI) {
              console.log('🔄 Refreshing logo for token:', token.symbol);
              try {
                const logoURI = await fetchTokenLogo(token.address, token.symbol);
                if (logoURI) {
                  // Update token with new logo
                  const updatedToken = { ...token, logoURI };
                  customOnly[key] = updatedToken;
                  // Save to localStorage
                  saveCustomToken(updatedToken);
                  // Update state
                  setCustomTokens(prev => ({ ...prev, [key]: updatedToken }));
                  console.log('✅ Logo refreshed for:', token.symbol, logoURI);
                }
              } catch (e) {
                console.warn('Failed to refresh logo for', token.symbol, e);
              }
            } else {
              // Verify existing logo is still valid
              try {
                const isValid = await checkImageUrl(token.logoURI);
                if (!isValid) {
                  console.log('🔄 Logo invalid, refreshing for token:', token.symbol);
                  try {
                    const logoURI = await fetchTokenLogo(token.address, token.symbol);
                    if (logoURI) {
                      const updatedToken = { ...token, logoURI };
                      customOnly[key] = updatedToken;
                      saveCustomToken(updatedToken);
                      setCustomTokens(prev => ({ ...prev, [key]: updatedToken }));
                      console.log('✅ Logo refreshed for:', token.symbol, logoURI);
                    }
                  } catch (e) {
                    console.warn('Failed to refresh logo for', token.symbol, e);
                  }
                }
              } catch (e) {
                console.warn('Failed to check logo validity for', token.symbol, e);
              }
            }
          } catch (e) {
            console.warn('Error processing token', token.symbol, e);
          }
        }
      } catch (error) {
        console.error('❌ Error in refreshLogos:', error);
      }
    };

    // Refresh logos in background (don't block UI)
    refreshLogos();
  }, []);

  // Fetch custom token info from contract address (preview only, don't save yet)
  const fetchCustomToken = async (contractAddress: string) => {
    if (!swapClient) return;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      setCustomTokenError('Invalid address format');
      setFoundToken(null);
      return;
    }

    // Check if token already exists
    const existing = getTokenByAddress(contractAddress);
    if (existing) {
      // Token already exists, show it as found
      setFoundToken(existing);
      setIsLoadingCustomToken(false);
      return;
    }

    setIsLoadingCustomToken(true);
    setCustomTokenError(null);
    setFoundToken(null);

    try {
      // Fetch token info from contract
      const [name, symbol, decimals] = await Promise.all([
        swapClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name'
        }),
        swapClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }),
        swapClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals'
        })
      ]);

      // Create token object
      const sdkToken = new Token(BASE_CHAIN_ID, contractAddress, Number(decimals), String(symbol), String(name));
      
      // Try to fetch logo from multiple sources
      let logoURI: string | null = null;
      try {
        console.log('🔍 Fetching logo for token:', String(symbol), contractAddress);
        logoURI = await fetchTokenLogo(contractAddress, String(symbol));
        if (logoURI) {
          console.log('✅ Logo fetched successfully:', logoURI);
        } else {
          console.warn('⚠️ No logo found for token:', String(symbol));
        }
      } catch (logoError) {
        console.warn('❌ Failed to fetch logo:', logoError);
        // Continue without logo
      }

      const newToken: AppToken = {
        address: contractAddress,
        symbol: String(symbol),
        name: String(name),
        decimals: Number(decimals),
        logoURI: logoURI || undefined,
        isNative: false,
        sdkToken
      };

      // Just show the token, don't save yet
      setFoundToken(newToken);
      console.log('🔍 Token found:', newToken);
    } catch (error) {
      console.error('Failed to fetch token info:', error);
      setCustomTokenError('Could not fetch token info. Make sure the address is a valid ERC20 token on Base.');
      setFoundToken(null);
    } finally {
      setIsLoadingCustomToken(false);
    }
  };

  // Import the found token (save to localStorage and select)
  const handleImportToken = () => {
    if (!foundToken) return;

    // Check if user wants to skip warning
    const skipWarning = localStorage.getItem('skipTokenImportWarning') === 'true';
    
    if (!skipWarning && !showImportWarning) {
      setShowImportWarning(true);
      return;
    }

    // Save user preference
    if (dontShowWarning) {
      localStorage.setItem('skipTokenImportWarning', 'true');
    }

    // Check if it's an existing token (already in list)
    const existing = getTokenByAddress(foundToken.address);
    if (!existing) {
      // Save to localStorage
      saveCustomToken(foundToken);
      // Update state
      setCustomTokens(prev => ({ ...prev, [foundToken.symbol]: foundToken }));
      console.log('✅ Token imported:', foundToken);
    }

    // Select the token and reset swap state
    if (showTokenSelect === 'in') {
      setTokenIn(foundToken);
    } else {
      setTokenOut(foundToken);
    }
    
    // Reset swap state for new token
    resetSwapState();
    
    // Reset import states
    setShowTokenSelect(null);
    setTokenSearchQuery('');
    setFoundToken(null);
    setShowImportWarning(false);
    setDontShowWarning(false);
  };

  // Cancel import
  const handleCancelImport = () => {
    setShowImportWarning(false);
    setFoundToken(null);
    setTokenSearchQuery('');
  };

  // Check if search query is a contract address and auto-fetch (preview only)
  useEffect(() => {
    if (tokenSearchQuery && /^0x[a-fA-F0-9]{40}$/.test(tokenSearchQuery)) {
      // It's a valid address, try to fetch
      const debounceTimer = setTimeout(() => {
        fetchCustomToken(tokenSearchQuery);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setCustomTokenError(null);
      setFoundToken(null);
    }
  }, [tokenSearchQuery]);

  useEffect(() => {
    if (tokenIn.isNative || !amountIn) {
      setNeedsApproval(false);
      return;
    }

    if (allowance !== undefined && allowance !== null && amountIn) {
      const amountInWei = parseUnits(amountIn, tokenIn.decimals);
      const allowanceBigInt = typeof allowance === 'bigint' ? allowance : BigInt(allowance.toString());
      setNeedsApproval(allowanceBigInt < amountInWei);
    }
  }, [allowance, amountIn, tokenIn]);

  // Check if this is a wrap/unwrap operation (ETH↔WETH)
  const isWrapOperation = (tokenIn.isNative && tokenOut.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) ||
                          (tokenIn.symbol === 'WETH' && tokenOut.isNative);
  const isWrap = tokenIn.isNative && tokenOut.address.toLowerCase() === WETH_ADDRESS.toLowerCase(); // ETH→WETH
  const isUnwrap = tokenIn.address.toLowerCase() === WETH_ADDRESS.toLowerCase() && tokenOut.isNative; // WETH→ETH

  // Helper function for retry logic with exponential backoff (429-aware)
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    delay: number = 400
  ): Promise<T | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (attempt === maxRetries) {
          console.warn(`⚠️ Failed after ${maxRetries + 1} attempts:`, error);
          return null;
        }
        const msg = (error?.message || error?.details || '').toLowerCase();
        const is429 = msg.includes('429') || msg.includes('rate limit') || msg.includes('too many request');
        const wait = is429 ? Math.min(3000 * (attempt + 1), 8000) : delay * (attempt + 1);
        if (is429) console.log(`⏳ Rate limited (429), waiting ${wait}ms before retry...`);
        else console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
    return null;
  };

  // Return type that distinguishes "no pool" from "RPC error" so callers don't confuse them
  type QuoteResult<T> = { data: T; rpcError: false } | { data: null; rpcError: true };

  const isTransientRpcError = (err: any): boolean => {
    const msg = (err?.message || err?.shortMessage || err?.details || '').toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many request')
      || msg.includes('timeout') || msg.includes('timed out') || msg.includes('econnreset')
      || msg.includes('econnrefused') || msg.includes('network') || msg.includes('fetch')
      || msg.includes('503') || msg.includes('502') || msg.includes('500')
      || msg.includes('403') || msg.includes('401') || msg.includes('forbidden') || msg.includes('unauthorized')
      || msg.includes('request failed') || msg.includes('http request');
  };

  // Multicall-based V3 quotes: all fee tiers in a single RPC call instead of 3 separate ones
  // Uses simulateContract individually per fee tier when multicall returns all-failures (Quoter V2 is nonpayable)
  const multicallV3Quotes = async (
    client: typeof swapClient,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint,
    feeTiers: number[],
    attempt: number = 0
  ): Promise<QuoteResult<{ quote: bigint; fee: number }>> => {
    const MAX_RETRIES = 2;
    try {
      // First try multicall (1 RPC call for all fee tiers)
      const results = await client.multicall({
        contracts: feeTiers.map((fee) => ({
          address: QUOTER_V2_ADDRESS as `0x${string}`,
          abi: QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: tokenInAddr as `0x${string}`, tokenOut: tokenOutAddr as `0x${string}`, amountIn: amountInWei, fee, sqrtPriceLimitX96: BigInt(0) }]
        })),
        allowFailure: true
      });

      let best: bigint | null = null;
      let bestFee = FEE_TIERS.LOW;
      let allFailed = true;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'success') {
          allFailed = false;
          if (r.result) {
            const q = (r.result as any[])[0] as bigint;
            if (q > 0n && (!best || q > best)) { best = q; bestFee = feeTiers[i]; }
          }
        }
      }

      if (best) return { data: { quote: best, fee: bestFee }, rpcError: false };

      // All sub-calls reverted in multicall — Quoter V2 uses revert-based quoting,
      // Multicall3 staticcall may not propagate the return correctly on all RPC nodes.
      // Fall back to individual simulateContract calls (parallel, still 1 call each).
      if (allFailed && attempt === 0) {
        console.log('⚠️ V3 multicall: all sub-calls failed, falling back to individual simulateContract...');
        const individualResults = await Promise.allSettled(
          feeTiers.map((fee) =>
            client.simulateContract({
              address: QUOTER_V2_ADDRESS as `0x${string}`,
              abi: QUOTER_ABI,
              functionName: 'quoteExactInputSingle',
              args: [{ tokenIn: tokenInAddr as `0x${string}`, tokenOut: tokenOutAddr as `0x${string}`, amountIn: amountInWei, fee, sqrtPriceLimitX96: BigInt(0) }]
            }).then(({ result }) => ({ quote: result[0] as bigint, fee }))
          )
        );
        for (const r of individualResults) {
          if (r.status === 'fulfilled' && r.value.quote > 0n && (!best || r.value.quote > best)) {
            best = r.value.quote;
            bestFee = r.value.fee;
          }
        }
        // Check if all individual calls also failed with RPC errors
        const allIndividualFailed = individualResults.every(r => r.status === 'rejected');
        if (best) return { data: { quote: best, fee: bestFee }, rpcError: false };
        if (allIndividualFailed) {
          const firstErr = (individualResults[0] as PromiseRejectedResult)?.reason;
          if (isTransientRpcError(firstErr) && attempt < MAX_RETRIES) {
            const wait = 2000 * (attempt + 1);
            console.log(`⏳ V3 individual calls RPC error, retry in ${wait}ms...`);
            await new Promise(r => setTimeout(r, wait));
            return multicallV3Quotes(client, tokenInAddr, tokenOutAddr, amountInWei, feeTiers, attempt + 1);
          }
          return { data: null, rpcError: true };
        }
        return { data: null, rpcError: false };
      }

      return { data: null, rpcError: false };
    } catch (err: any) {
      if (isTransientRpcError(err) && attempt < MAX_RETRIES) {
        const wait = (err?.message || '').toLowerCase().includes('429') ? 3000 * (attempt + 1) : 1500 * (attempt + 1);
        console.log(`⏳ V3 multicall RPC error, retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
        return multicallV3Quotes(client, tokenInAddr, tokenOutAddr, amountInWei, feeTiers, attempt + 1);
      }
      console.warn('⚠️ V3 multicall failed:', err?.shortMessage || err?.message);
      return { data: null, rpcError: true };
    }
  };

  const quoteUniswapV2Path = async (
    client: typeof swapClient,
    path: `0x${string}`[],
    amountInWei: bigint,
    attempt: number = 0
  ): Promise<QuoteResult<bigint>> => {
    const MAX_RETRIES = 2;
    if (path.length < 2) return { data: null, rpcError: false };
    try {
      const amounts = await client.readContract({
        address: UNISWAP_V2_ROUTER as `0x${string}`,
        abi: V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, path]
      });
      const output = (amounts as bigint[])[path.length - 1];
      return output > 0n ? { data: output, rpcError: false } : { data: null, rpcError: false };
    } catch (err: any) {
      if (isTransientRpcError(err) && attempt < MAX_RETRIES) {
        const wait = (err?.message || '').toLowerCase().includes('429') ? 3000 * (attempt + 1) : 1500 * (attempt + 1);
        console.log(`⏳ V2 path quote RPC error, retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
        return quoteUniswapV2Path(client, path, amountInWei, attempt + 1);
      }
      return { data: null, rpcError: isTransientRpcError(err) };
    }
  };

  const getUniswapV2CandidatePaths = (tokenInAddr: string, tokenOutAddr: string): `0x${string}`[][] => {
    const direct = [tokenInAddr as `0x${string}`, tokenOutAddr as `0x${string}`];
    if (!MULTI_HOP_ROUTE_PREVIEW) return [direct];

    const bases = [
      WETH_ADDRESS,
      DEFAULT_TOKENS.USDC.address,
      DEFAULT_TOKENS.USDbC.address
    ];
    const seen = new Set<string>();
    const paths: `0x${string}`[][] = [];
    const pushPath = (path: `0x${string}`[]) => {
      const key = path.map((item) => item.toLowerCase()).join('-');
      if (seen.has(key)) return;
      seen.add(key);
      paths.push(path);
    };

    pushPath(direct);
    for (const middle of bases) {
      if (normalizeAddress(middle) === normalizeAddress(tokenInAddr) || normalizeAddress(middle) === normalizeAddress(tokenOutAddr)) continue;
      pushPath([tokenInAddr as `0x${string}`, middle as `0x${string}`, tokenOutAddr as `0x${string}`]);
    }
    return paths;
  };

  const quoteUniswapV2Paths = async (
    client: typeof swapClient,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint
  ): Promise<QuoteResult<{ quote: bigint; path: `0x${string}`[] }>> => {
    const paths = getUniswapV2CandidatePaths(tokenInAddr, tokenOutAddr);
    const results = await Promise.allSettled(paths.map((path) =>
      quoteUniswapV2Path(client, path, amountInWei).then((result) => ({ ...result, path }))
    ));

    let best: { quote: bigint; path: `0x${string}`[] } | null = null;
    let sawRpcError = false;
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        if (isTransientRpcError(result.reason)) sawRpcError = true;
        continue;
      }
      if (result.value.rpcError) {
        sawRpcError = true;
        continue;
      }
      const quote = result.value.data;
      if (quote && (!best || quote > best.quote)) {
        best = { quote, path: result.value.path };
      }
    }

    return best ? { data: best, rpcError: false } : { data: null, rpcError: sawRpcError };
  };

  const getProtocolLabel = (protocol: SwapProtocol) => {
    switch (protocol) {
      case 'uniswap-v3': return 'Uniswap V3';
      case 'uniswap-v2': return 'Uniswap V2';
      case 'pancakeswap-v3': return 'PancakeSwap V3';
      case 'aerodrome': return 'Aerodrome';
      default: return 'DEX';
    }
  };

  const normalizeAddress = (value?: string) => value?.toLowerCase() ?? '';

  const getKnownTokenByQuoteAddress = (addressValue: string) => {
    const normalized = normalizeAddress(addressValue);
    return Object.values(DEFAULT_TOKENS).find((token) => normalizeAddress(token.address) === normalized);
  };

  const isStableQuoteToken = (token?: AppToken | null) => {
    return !!token && ['USDC', 'USDT', 'USDbC', 'DAI'].includes(token.symbol);
  };

  const getTokenUsdValueFromWei = (amountWei: bigint, token?: AppToken | null) => {
    if (!token || amountWei <= 0n) return 0;
    const amount = parseFloat(formatUnits(amountWei, token.decimals));
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (token.symbol === 'ETH' || token.symbol === 'WETH' || token.symbol === 'cbETH') return amount * ethPriceUsd;
    if (isStableQuoteToken(token)) return amount;
    return 0;
  };

  const getCachedGasPrice = async (client: typeof swapClient) => {
    const cached = gasPriceCacheRef.current;
    if (cached && Date.now() - cached.timestamp < 10_000) return cached.value;
    const value = await client.getGasPrice();
    gasPriceCacheRef.current = { value, timestamp: Date.now() };
    return value;
  };

  const estimateGasCostInOutputToken = async (
    client: typeof swapClient,
    gasPrice: bigint,
    estimatedGasUnits: bigint,
    rawQuote: bigint,
    amountInWei: bigint,
    tokenInAddr: string,
    tokenOutAddr: string
  ) => {
    if (!GAS_ADJUSTED_ROUTE_SCORING || !client || estimatedGasUnits <= 0n || rawQuote <= 0n) return 0n;
    try {
      const gasCostWei = gasPrice * estimatedGasUnits;
      const tokenOutMeta = getKnownTokenByQuoteAddress(tokenOutAddr);

      if (normalizeAddress(tokenOutAddr) === normalizeAddress(WETH_ADDRESS) || tokenOutMeta?.symbol === 'ETH' || tokenOutMeta?.symbol === 'WETH') {
        return gasCostWei;
      }

      const gasUsd = parseFloat(formatUnits(gasCostWei, 18)) * ethPriceUsd;
      if (!Number.isFinite(gasUsd) || gasUsd <= 0) return 0n;

      if (isStableQuoteToken(tokenOutMeta)) {
        return parseUnits(gasUsd.toFixed(Math.min(tokenOutMeta.decimals, 6)), tokenOutMeta.decimals);
      }

      const tokenInMeta = getKnownTokenByQuoteAddress(tokenInAddr);
      const inputUsd = getTokenUsdValueFromWei(amountInWei, tokenInMeta);
      const outputAmount = parseFloat(formatUnits(rawQuote, tokenOutMeta?.decimals ?? tokenOut.decimals));
      if (!inputUsd || !outputAmount || !Number.isFinite(outputAmount) || outputAmount <= 0) return 0n;

      const outputTokenUsd = inputUsd / outputAmount;
      if (!Number.isFinite(outputTokenUsd) || outputTokenUsd <= 0) return 0n;
      const gasOutputAmount = gasUsd / outputTokenUsd;
      if (!Number.isFinite(gasOutputAmount) || gasOutputAmount <= 0) return 0n;
      return parseUnits(gasOutputAmount.toFixed(Math.min(tokenOutMeta?.decimals ?? tokenOut.decimals, 12)), tokenOutMeta?.decimals ?? tokenOut.decimals);
    } catch {
      return 0n;
    }
  };

  const withGasAdjustedScore = async (
    plans: SwapRoutePlan[],
    amountInWei: bigint,
    tokenInAddr: string,
    tokenOutAddr: string
  ): Promise<SwapRoutePlan[]> => {
    if (!GAS_ADJUSTED_ROUTE_SCORING || !swapClient || plans.length === 0) {
      return plans.map((plan) => ({ ...plan, gasAdjustedQuote: plan.rawQuote, gasCostInOutputToken: 0n }));
    }

    const gasPrice = await getCachedGasPrice(swapClient);
    return Promise.all(plans.map(async (plan) => {
      const estimatedGasUnits = plan.estimatedGasUnits ?? GAS_ESTIMATE_UNITS[plan.protocol];
      const gasCostInOutputToken = await estimateGasCostInOutputToken(
        swapClient,
        gasPrice,
        estimatedGasUnits,
        plan.rawQuote,
        amountInWei,
        tokenInAddr,
        tokenOutAddr
      );
      return {
        ...plan,
        estimatedGasUnits,
        gasCostInOutputToken,
        gasAdjustedQuote: plan.rawQuote > gasCostInOutputToken ? plan.rawQuote - gasCostInOutputToken : 0n
      };
    }));
  };

  const sortRoutePlans = (plans: SwapRoutePlan[]) => {
    return [...plans].sort((a, b) => {
      const aScore = GAS_ADJUSTED_ROUTE_SCORING ? (a.gasAdjustedQuote ?? a.rawQuote) : a.rawQuote;
      const bScore = GAS_ADJUSTED_ROUTE_SCORING ? (b.gasAdjustedQuote ?? b.rawQuote) : b.rawQuote;
      if (aScore !== bScore) return aScore > bScore ? -1 : 1;
      return a.rawQuote > b.rawQuote ? -1 : a.rawQuote < b.rawQuote ? 1 : 0;
    });
  };

  const getMultiHopBaseAddresses = (tokenInAddr: string, tokenOutAddr: string) => {
    const bases = [
      WETH_ADDRESS,
      DEFAULT_TOKENS.USDC.address,
      DEFAULT_TOKENS.USDbC.address
    ];
    return bases.filter((middle, index, list) => {
      const normalized = normalizeAddress(middle);
      return normalized !== normalizeAddress(tokenInAddr)
        && normalized !== normalizeAddress(tokenOutAddr)
        && list.findIndex((item) => normalizeAddress(item) === normalized) === index;
    }) as `0x${string}`[];
  };

  const buildV3Path = (tokens: `0x${string}`[], fees: number[]) => {
    if (tokens.length !== fees.length + 1) return null;
    const types: ('address' | 'uint24')[] = [];
    const values: (`0x${string}` | number)[] = [];
    for (let i = 0; i < fees.length; i++) {
      types.push('address', 'uint24');
      values.push(tokens[i], fees[i]);
    }
    types.push('address');
    values.push(tokens[tokens.length - 1]);
    return encodePacked(types, values);
  };

  const buildUniswapV3Calldata = (
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint,
    fee: number
  ) => encodeFunctionData({
    abi: UNISWAP_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: tokenInAddr as `0x${string}`,
      tokenOut: tokenOutAddr as `0x${string}`,
      fee,
      recipient: SWAP_AGGREGATOR,
      amountIn: amountInWei,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    }]
  });

  const buildUniswapV3ExactInputCalldata = (
    path: `0x${string}`,
    amountInWei: bigint
  ) => encodeFunctionData({
    abi: UNISWAP_V3_EXACT_INPUT_ROUTER_ABI,
    functionName: 'exactInput',
    args: [{
      path,
      recipient: SWAP_AGGREGATOR,
      amountIn: amountInWei,
      amountOutMinimum: 0n
    }]
  });

  const buildPancakeV3Calldata = (
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint,
    fee: number,
    deadline: bigint
  ) => encodeFunctionData({
    abi: PANCAKESWAP_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: tokenInAddr as `0x${string}`,
      tokenOut: tokenOutAddr as `0x${string}`,
      fee,
      recipient: SWAP_AGGREGATOR,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    }]
  });

  const buildPancakeV3ExactInputCalldata = (
    path: `0x${string}`,
    amountInWei: bigint,
    deadline: bigint
  ) => encodeFunctionData({
    abi: PANCAKESWAP_V3_EXACT_INPUT_ROUTER_ABI,
    functionName: 'exactInput',
    args: [{
      path,
      recipient: SWAP_AGGREGATOR,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: 0n
    }]
  });

  const buildUniswapV2Calldata = (
    path: `0x${string}`[],
    amountInWei: bigint,
    deadline: bigint
  ) => encodeFunctionData({
    abi: V2_ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [
      amountInWei,
      0n,
      path,
      SWAP_AGGREGATOR,
      deadline
    ]
  });

  const buildAerodromeCalldata = (
    routes: { from: `0x${string}`; to: `0x${string}`; stable: boolean; factory: `0x${string}` }[],
    amountInWei: bigint,
    deadline: bigint
  ) => encodeFunctionData({
    abi: AERODROME_ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [
      amountInWei,
      0n,
      routes,
      SWAP_AGGREGATOR,
      deadline
    ]
  });

  const quotePancakeV3 = async (
    client: typeof swapClient,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint,
    feeTiers: number[]
  ): Promise<QuoteResult<{ quote: bigint; fee: number }>> => {
    try {
      const results = await Promise.allSettled(
        feeTiers.map((fee) =>
          client.simulateContract({
            address: PANCAKESWAP_V3_QUOTER as `0x${string}`,
            abi: QUOTER_ABI,
            functionName: 'quoteExactInputSingle',
            args: [{ tokenIn: tokenInAddr as `0x${string}`, tokenOut: tokenOutAddr as `0x${string}`, amountIn: amountInWei, fee, sqrtPriceLimitX96: 0n }]
          }).then(({ result }) => ({ quote: result[0] as bigint, fee }))
        )
      );
      let best: { quote: bigint; fee: number } | null = null;
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.quote > 0n && (!best || r.value.quote > best.quote)) {
          best = r.value;
        }
      }
      return best ? { data: best, rpcError: false } : { data: null, rpcError: false };
    } catch (err: any) {
      return { data: null, rpcError: isTransientRpcError(err) };
    }
  };

  const quoteV3ExactInputPaths = async (
    client: typeof swapClient,
    quoter: `0x${string}`,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint,
    feePairs: number[][],
    protocolLabel: string
  ): Promise<QuoteResult<{ quote: bigint; path: `0x${string}`; fees: number[] }>> => {
    if (!ENABLE_ADAPTER_V2_MULTI_HOP || !MULTI_HOP_ROUTE_PREVIEW) return { data: null, rpcError: false };
    try {
      const middleTokens = getMultiHopBaseAddresses(tokenInAddr, tokenOutAddr);
      const candidatePaths = middleTokens.flatMap((middle) =>
        feePairs.map((fees) => {
          const path = buildV3Path([tokenInAddr as `0x${string}`, middle, tokenOutAddr as `0x${string}`], fees);
          return path ? { path, fees } : null;
        }).filter(Boolean) as { path: `0x${string}`; fees: number[] }[]
      );
      if (candidatePaths.length === 0) return { data: null, rpcError: false };

      const results = await Promise.allSettled(candidatePaths.map((candidate) =>
        client.simulateContract({
          address: quoter,
          abi: V3_QUOTER_EXACT_INPUT_ABI,
          functionName: 'quoteExactInput',
          args: [candidate.path, amountInWei]
        }).then(({ result }) => ({ quote: result[0] as bigint, path: candidate.path, fees: candidate.fees }))
      ));

      let best: { quote: bigint; path: `0x${string}`; fees: number[] } | null = null;
      let sawRpcError = false;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.quote > 0n && (!best || result.value.quote > best.quote)) best = result.value;
        } else if (isTransientRpcError(result.reason)) {
          sawRpcError = true;
        }
      }
      return best ? { data: best, rpcError: false } : { data: null, rpcError: sawRpcError };
    } catch (err: any) {
      console.warn(`⚠️ ${protocolLabel} multi-hop quote failed:`, err?.shortMessage || err?.message);
      return { data: null, rpcError: isTransientRpcError(err) };
    }
  };

  const quoteAerodrome = async (
    client: typeof swapClient,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint
  ): Promise<QuoteResult<{ quote: bigint; stable: boolean }>> => {
    try {
      const routes = [false, true];
      const results = await Promise.allSettled(
        routes.map((stable) =>
          client.readContract({
            address: AERODROME_ROUTER as `0x${string}`,
            abi: AERODROME_ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [amountInWei, [{ from: tokenInAddr as `0x${string}`, to: tokenOutAddr as `0x${string}`, stable, factory: AERODROME_FACTORY as `0x${string}` }]]
          }).then((amounts) => ({ quote: (amounts as bigint[])[1], stable }))
        )
      );
      let best: { quote: bigint; stable: boolean } | null = null;
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.quote > 0n && (!best || r.value.quote > best.quote)) {
          best = r.value;
        }
      }
      return best ? { data: best, rpcError: false } : { data: null, rpcError: false };
    } catch (err: any) {
      return { data: null, rpcError: isTransientRpcError(err) };
    }
  };

  const getAerodromeCandidateRoutes = (tokenInAddr: string, tokenOutAddr: string) => {
    const direct = [false, true].map((stable) => ({
      routes: [{ from: tokenInAddr as `0x${string}`, to: tokenOutAddr as `0x${string}`, stable, factory: AERODROME_FACTORY as `0x${string}` }],
      label: stable ? 'Stable' : 'Volatile',
      hopCount: 1
    }));
    if (!ENABLE_ADAPTER_V2_MULTI_HOP || !MULTI_HOP_ROUTE_PREVIEW) return direct;

    const multiHop = getMultiHopBaseAddresses(tokenInAddr, tokenOutAddr).flatMap((middle) => {
      const variants: { stableA: boolean; stableB: boolean; label: string }[] = [
        { stableA: false, stableB: false, label: 'Volatile 2-hop' },
        { stableA: true, stableB: true, label: 'Stable 2-hop' },
        { stableA: false, stableB: true, label: 'Mixed 2-hop' },
        { stableA: true, stableB: false, label: 'Mixed 2-hop' }
      ];
      return variants.map((variant) => ({
        routes: [
          { from: tokenInAddr as `0x${string}`, to: middle, stable: variant.stableA, factory: AERODROME_FACTORY as `0x${string}` },
          { from: middle, to: tokenOutAddr as `0x${string}`, stable: variant.stableB, factory: AERODROME_FACTORY as `0x${string}` }
        ],
        label: variant.label,
        hopCount: 2
      }));
    });

    return [...direct, ...multiHop];
  };

  const quoteAerodromeRoutes = async (
    client: typeof swapClient,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountInWei: bigint
  ): Promise<QuoteResult<{ quote: bigint; routes: { from: `0x${string}`; to: `0x${string}`; stable: boolean; factory: `0x${string}` }[]; label: string; hopCount: number }>> => {
    try {
      const candidates = getAerodromeCandidateRoutes(tokenInAddr, tokenOutAddr);
      const results = await Promise.allSettled(
        candidates.map((candidate) =>
          client.readContract({
            address: AERODROME_ROUTER as `0x${string}`,
            abi: AERODROME_ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [amountInWei, candidate.routes]
          }).then((amounts) => ({
            quote: (amounts as bigint[])[candidate.routes.length],
            routes: candidate.routes,
            label: candidate.label,
            hopCount: candidate.hopCount
          }))
        )
      );
      let best: { quote: bigint; routes: { from: `0x${string}`; to: `0x${string}`; stable: boolean; factory: `0x${string}` }[]; label: string; hopCount: number } | null = null;
      let sawRpcError = false;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.quote > 0n && (!best || result.value.quote > best.quote)) best = result.value;
        } else if (isTransientRpcError(result.reason)) {
          sawRpcError = true;
        }
      }
      return best ? { data: best, rpcError: false } : { data: null, rpcError: sawRpcError };
    } catch (err: any) {
      return { data: null, rpcError: isTransientRpcError(err) };
    }
  };

  const getRoutePlansForAmount = async (
    amountInWei: bigint,
    tokenInAddr: string,
    tokenOutAddr: string
  ): Promise<SwapRoutePlan[]> => {
    if (!swapClient || amountInWei <= 0n) return [];
    const feeTiersToTry = [FEE_TIERS.LOWEST, FEE_TIERS.LOW, FEE_TIERS.MEDIUM];
    const pancakeFeeTiers = [100, 500, 2500, 10000];
    const v3MultiHopFeePairs = [[FEE_TIERS.LOW, FEE_TIERS.LOW], [FEE_TIERS.LOW, FEE_TIERS.MEDIUM], [FEE_TIERS.MEDIUM, FEE_TIERS.LOW]];
    const pancakeMultiHopFeePairs = [[500, 500], [500, 2500], [2500, 500]];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    const [v3Res, v3MultiRes, v2Res, pancakeRes, pancakeMultiRes, aerodromeRes] = await Promise.all([
      multicallV3Quotes(swapClient, tokenInAddr, tokenOutAddr, amountInWei, feeTiersToTry),
      quoteV3ExactInputPaths(swapClient, QUOTER_V2_ADDRESS as `0x${string}`, tokenInAddr, tokenOutAddr, amountInWei, v3MultiHopFeePairs, 'Uniswap V3'),
      quoteUniswapV2Paths(swapClient, tokenInAddr, tokenOutAddr, amountInWei),
      quotePancakeV3(swapClient, tokenInAddr, tokenOutAddr, amountInWei, pancakeFeeTiers),
      quoteV3ExactInputPaths(swapClient, PANCAKESWAP_V3_QUOTER as `0x${string}`, tokenInAddr, tokenOutAddr, amountInWei, pancakeMultiHopFeePairs, 'PancakeSwap V3'),
      quoteAerodromeRoutes(swapClient, tokenInAddr, tokenOutAddr, amountInWei)
    ]);

    const plans: SwapRoutePlan[] = [];
    if (v3Res.data?.quote) {
      plans.push({
        protocol: 'uniswap-v3',
        label: 'Uniswap V3',
        router: SWAP_ROUTER_02 as `0x${string}`,
        rawQuote: v3Res.data.quote,
        bestFeeTier: v3Res.data.fee,
        routerCalldata: buildUniswapV3Calldata(tokenInAddr, tokenOutAddr, amountInWei, v3Res.data.fee),
        estimatedGasUnits: GAS_ESTIMATE_UNITS['uniswap-v3'],
        hopCount: 1
      });
    }
    if (v3MultiRes.data?.quote) {
      plans.push({
        protocol: 'uniswap-v3',
        label: 'Uniswap V3 2-hop',
        router: SWAP_ROUTER_02 as `0x${string}`,
        rawQuote: v3MultiRes.data.quote,
        bestFeeTier: v3MultiRes.data.fees[0],
        routerCalldata: buildUniswapV3ExactInputCalldata(v3MultiRes.data.path, amountInWei),
        estimatedGasUnits: GAS_ESTIMATE_UNITS['uniswap-v3'] + MULTI_HOP_GAS_PER_EXTRA_HOP,
        hopCount: 2
      });
    }
    if (v2Res.data) {
      const v2Path = v2Res.data.path;
      const isMultiHop = v2Path.length > 2;
      plans.push({
        protocol: 'uniswap-v2',
        label: isMultiHop ? `Uniswap V2 ${v2Path.length - 1}-hop` : 'Uniswap V2',
        router: UNISWAP_V2_ROUTER as `0x${string}`,
        rawQuote: v2Res.data.quote,
        routerCalldata: buildUniswapV2Calldata(v2Path, amountInWei, deadline),
        path: v2Path,
        estimatedGasUnits: GAS_ESTIMATE_UNITS['uniswap-v2'] + (BigInt(Math.max(v2Path.length - 2, 0)) * MULTI_HOP_GAS_PER_EXTRA_HOP),
        hopCount: v2Path.length - 1
      });
    }
    if (pancakeRes.data?.quote) {
      plans.push({
        protocol: 'pancakeswap-v3',
        label: 'PancakeSwap V3',
        router: PANCAKESWAP_V3_ROUTER as `0x${string}`,
        rawQuote: pancakeRes.data.quote,
        bestFeeTier: pancakeRes.data.fee,
        routerCalldata: buildPancakeV3Calldata(tokenInAddr, tokenOutAddr, amountInWei, pancakeRes.data.fee, deadline),
        estimatedGasUnits: GAS_ESTIMATE_UNITS['pancakeswap-v3'],
        hopCount: 1
      });
    }
    if (pancakeMultiRes.data?.quote) {
      plans.push({
        protocol: 'pancakeswap-v3',
        label: 'PancakeSwap V3 2-hop',
        router: PANCAKESWAP_V3_ROUTER as `0x${string}`,
        rawQuote: pancakeMultiRes.data.quote,
        bestFeeTier: pancakeMultiRes.data.fees[0],
        routerCalldata: buildPancakeV3ExactInputCalldata(pancakeMultiRes.data.path, amountInWei, deadline),
        estimatedGasUnits: GAS_ESTIMATE_UNITS['pancakeswap-v3'] + MULTI_HOP_GAS_PER_EXTRA_HOP,
        hopCount: 2
      });
    }
    if (aerodromeRes.data?.quote) {
      plans.push({
        protocol: 'aerodrome',
        label: `Aerodrome ${aerodromeRes.data.label}`,
        router: AERODROME_ROUTER as `0x${string}`,
        rawQuote: aerodromeRes.data.quote,
        routerCalldata: buildAerodromeCalldata(aerodromeRes.data.routes, amountInWei, deadline),
        estimatedGasUnits: GAS_ESTIMATE_UNITS.aerodrome + (BigInt(Math.max(aerodromeRes.data.hopCount - 1, 0)) * MULTI_HOP_GAS_PER_EXTRA_HOP),
        hopCount: aerodromeRes.data.hopCount
      });
    }

    const scoredPlans = await withGasAdjustedScore(plans, amountInWei, tokenInAddr, tokenOutAddr);
    return sortRoutePlans(scoredPlans);
  };

  const getSplitRoutePreview = async (
    amountInWei: bigint,
    tokenInAddr: string,
    tokenOutAddr: string,
    fullAmountPlans: SwapRoutePlan[]
  ): Promise<SplitRoutePreview | null> => {
    if (!ENABLE_SPLIT_ROUTE_PREVIEW || !swapClient || fullAmountPlans.length < 2 || amountInWei < BigInt(SPLIT_ALLOCATION_UNITS)) {
      return null;
    }
    const tokenInMeta = getKnownTokenByQuoteAddress(tokenInAddr);
    const inputUsd = getTokenUsdValueFromWei(amountInWei, tokenInMeta);
    if (inputUsd > 0 && inputUsd < SPLIT_MIN_INPUT_USD) return null;

    const candidates = fullAmountPlans.slice(0, 4);
    const bestSingleRawOutput = candidates[0]?.rawQuote ?? 0n;
    if (bestSingleRawOutput <= 0n) return null;

    const allocations: number[][] = [];
    const buildAllocations = (index: number, remaining: number, current: number[]) => {
      if (index === candidates.length - 1) {
        allocations.push([...current, remaining]);
        return;
      }
      for (let units = 0; units <= remaining; units++) {
        current.push(units);
        buildAllocations(index + 1, remaining - units, current);
        current.pop();
      }
    };
    buildAllocations(0, SPLIT_ALLOCATION_UNITS, []);

    let bestSplit: {
      parts: SplitRoutePreview['parts'];
      rawOutput: bigint;
    } | null = null;
    const planCache = new Map<string, Promise<SwapRoutePlan[]>>();
    const getCachedPlans = (partAmount: bigint) => {
      const key = partAmount.toString();
      const cached = planCache.get(key);
      if (cached) return cached;
      const promise = getRoutePlansForAmount(partAmount, tokenInAddr, tokenOutAddr);
      planCache.set(key, promise);
      return promise;
    };

    const possiblePartAmounts = Array.from({ length: SPLIT_ALLOCATION_UNITS - 1 }, (_, index) => {
      const units = index + 1;
      return (amountInWei * BigInt(units)) / BigInt(SPLIT_ALLOCATION_UNITS);
    }).filter((partAmount, index, list) => partAmount > 0n && list.findIndex((item) => item === partAmount) === index);
    await Promise.allSettled(possiblePartAmounts.map((partAmount) => getCachedPlans(partAmount)));

    for (const allocation of allocations) {
      const activeIndexes = allocation
        .map((units, index) => ({ units, index }))
        .filter((entry) => entry.units > 0);
      if (activeIndexes.length < 2) continue;

      let allocatedInput = 0n;
      let rawOutput = 0n;
      const parts: SplitRoutePreview['parts'] = [];
      let allocationFailed = false;

      for (let i = 0; i < activeIndexes.length; i++) {
        const { units, index } = activeIndexes[i];
        const candidate = candidates[index];
        const partAmount = i === activeIndexes.length - 1
          ? amountInWei - allocatedInput
          : (amountInWei * BigInt(units)) / BigInt(SPLIT_ALLOCATION_UNITS);
        allocatedInput += partAmount;
        if (partAmount <= 0n) {
          allocationFailed = true;
          break;
        }

        const partPlans = await getCachedPlans(partAmount);
        const partPlan = partPlans.find((plan) => plan.protocol === candidate.protocol && plan.label === candidate.label)
          ?? partPlans.find((plan) => plan.protocol === candidate.protocol);
        if (!partPlan || partPlan.rawQuote <= 0n) {
          allocationFailed = true;
          break;
        }

        rawOutput += partPlan.rawQuote;
        parts.push({
          candidate: {
            protocol: partPlan.protocol,
            label: partPlan.label,
            rawQuote: candidate.rawQuote
          },
          amountIn: partAmount,
          estimatedRawOut: partPlan.rawQuote,
          shareBps: Number((partAmount * 10_000n) / amountInWei)
        });
      }

      if (allocationFailed || allocatedInput !== amountInWei || rawOutput <= bestSingleRawOutput) continue;
      if (!bestSplit || rawOutput > bestSplit.rawOutput) {
        bestSplit = { parts, rawOutput };
      }
    }

    if (!bestSplit || bestSplit.parts.length < 2) return null;
    const improvementBps = Number(((bestSplit.rawOutput - bestSingleRawOutput) * 10_000n) / bestSingleRawOutput);
    if (improvementBps < 1) return null;
    const feeBps = getProtocolFeeBps();
    const { netOutput, feeAmount } = calculateNetOutput(bestSplit.rawOutput, feeBps);
    return {
      parts: bestSplit.parts.sort((a, b) => (a.estimatedRawOut > b.estimatedRawOut ? -1 : a.estimatedRawOut < b.estimatedRawOut ? 1 : 0)),
      rawOutput: bestSplit.rawOutput,
      netOutput,
      feeAmount,
      improvementBps,
      bestSingleRawOutput
    };
  };

  // Fetch fresh quote (no cache) for swap execution - used when user clicks swap
  const getFreshQuote = async (
    amountInWei: bigint,
    tokenInAddr: string,
    tokenOutAddr: string,
    tokenOutDecimals: number
  ): Promise<{ formatted: string; bestProtocol: SwapProtocol; bestFeeTier: number; routePlan: SwapRoutePlan; routePlans: SwapRoutePlan[] } | null> => {
    if (!swapClient) return null;
    const sortedPlans = await getRoutePlansForAmount(amountInWei, tokenInAddr, tokenOutAddr);
    const bestPlan = sortedPlans[0];
    if (!bestPlan) return null;

    const feeBps = getProtocolFeeBps();
    const feeMultiplier = BigInt(10000) - BigInt(feeBps);
    const userReceivesWei = (bestPlan.rawQuote * feeMultiplier) / BigInt(10000);
    const formatted = formatUnits(userReceivesWei, tokenOutDecimals);
    return {
      formatted,
      bestProtocol: bestPlan.protocol,
      bestFeeTier: bestPlan.bestFeeTier ?? FEE_TIERS.LOW,
      routePlan: bestPlan,
      routePlans: sortedPlans
    };
  };

  // Fetch quote from supported Base DEXes in parallel, use best available
  useEffect(() => {
    const MAX_RPC_AUTO_RETRIES = 2;

    const fetchQuote = async (rpcRetry: number = 0) => {
      if (!amountIn || parseFloat(amountIn) <= 0) {
        setAmountOut('0');
        setPriceImpact('0');
        setNoLiquidityError(false);
        setSplitRoutePreview(null);
        return;
      }

      // Special case: Wrap/Unwrap (1:1 conversion, no swap needed)
      if (isWrapOperation) {
        console.log('🔄 Wrap/Unwrap operation detected (1:1 rate)');
        setAmountOut(amountIn); // 1:1 conversion
        setPriceImpact('0');
        setNoLiquidityError(false);
        setIsLoadingQuote(false);
        setSelectedProtocol('uniswap-v3'); // Use v3 for display purposes
        setSelectedRoutePlan(null);
        setAllRoutePlans([]);
        setSplitRoutePreview(null);
        setV3Available(true);
        setV2Available(false);
        return;
      }

      if (!swapClient) {
        console.log('⚠️ swapClient is undefined');
        return;
      }

      const amountInWei = parseUnits(amountIn, tokenIn.decimals);
      const tokenInAddr = tokenIn.isNative ? WETH_ADDRESS : tokenIn.address;
      const tokenOutAddr = tokenOut.isNative ? WETH_ADDRESS : tokenOut.address;
      const cacheKey = `${tokenInAddr.toLowerCase()}-${tokenOutAddr.toLowerCase()}-${amountIn}`;

      // Quote cache: skip RPC if same request was done recently
      if (rpcRetry === 0 && quoteCacheRef.current && quoteCacheRef.current.key === cacheKey && (Date.now() - quoteCacheRef.current.timestamp) < QUOTE_CACHE_MS) {
        const c = quoteCacheRef.current;
        setAmountOut(c.amountOut);
        setPriceImpact(c.priceImpact);
        setSelectedProtocol(c.bestProtocol);
        setSelectedRoutePlan(c.bestRoutePlan);
        setAllRoutePlans(c.routePlans || []);
        setSplitRoutePreview(c.splitRoutePreview || null);
        setSelectedFeeTier(c.bestV3Fee);
        setV3Available(c.v3Available);
        setV2Available(c.v2Available);
        setNoLiquidityError(false);
        setIsLoadingQuote(false);
        return;
      }

      const currentRequestId = rpcRetry === 0 ? ++quoteRequestIdRef.current : quoteRequestIdRef.current;
      setIsLoadingQuote(true);
      setNoLiquidityError(false);
      if (rpcRetry === 0) {
        console.log('🔄 Fetching quotes from Aerodrome, Uniswap and PancakeSwap...');
        console.log('   Input:', amountIn, tokenIn.symbol, '→', tokenOut.symbol);
      } else {
        console.log(`🔄 Auto-retry ${rpcRetry}/${MAX_RPC_AUTO_RETRIES} for quote...`);
      }

      const freshQuote = await getFreshQuote(amountInWei, tokenInAddr, tokenOutAddr, tokenOut.decimals);

      if (currentRequestId !== quoteRequestIdRef.current) return;

      if (!freshQuote) {
        if (rpcRetry < MAX_RPC_AUTO_RETRIES) {
          const wait = 2000 * (rpcRetry + 1);
          console.log(`⚠️ No route yet — auto-retry in ${wait}ms (${rpcRetry + 1}/${MAX_RPC_AUTO_RETRIES})...`);
          setTimeout(() => {
            if (quoteRequestIdRef.current === currentRequestId) fetchQuote(rpcRetry + 1);
          }, wait);
          return;
        }
        console.log('❌ No liquidity across supported Base DEXes');
        setAmountOut('0');
        setPriceImpact('0');
        setNoLiquidityError(true);
        setSplitRoutePreview(null);
        setIsLoadingQuote(false);
        return;
      }

      const bestQuote = freshQuote.routePlan.rawQuote;
      const bestProtocol = freshQuote.bestProtocol;
      const bestV3Fee = freshQuote.bestFeeTier;
      setV3Available(bestProtocol === 'uniswap-v3');
      setV2Available(bestProtocol === 'uniswap-v2');
      setSelectedFeeTier(bestV3Fee);
      setSelectedProtocol(bestProtocol);
      setSelectedRoutePlan(freshQuote.routePlan);
      setAllRoutePlans(freshQuote.routePlans);
      setSplitRoutePreview(null);

      const feeBps = getProtocolFeeBps();
      const feeBpsBigInt = BigInt(feeBps);
      const feeMultiplier = BigInt(10000) - feeBpsBigInt;
      const userReceivesWei = (bestQuote * feeMultiplier) / BigInt(10000);
      const feeAmountWei = bestQuote - userReceivesWei;

      const formatted = formatUnits(userReceivesWei, tokenOut.decimals);
      const feeFormatted = formatUnits(feeAmountWei, tokenOut.decimals);
      console.log('💵 Raw output:', formatUnits(bestQuote, tokenOut.decimals), tokenOut.symbol);
      console.log('💰 Protocol fee:', feeFormatted, tokenOut.symbol, `(${feeBps / 100}% = ${feeBps} bps)`);
      console.log('✨ User receives:', formatted, tokenOut.symbol, `via ${freshQuote.routePlan.label}`);

      const inputUsdStr = calculateUsdValue(amountIn, tokenIn, formatted, tokenOut, ethPriceUsd);
      const outputUsdStr = calculateUsdValue(formatted, tokenOut, amountIn, tokenIn, ethPriceUsd);
      const inputUsd = inputUsdStr && inputUsdStr !== '-' ? parseFloat(inputUsdStr.replace('$', '').replace(',', '')) : 0;
      const outputUsd = outputUsdStr && outputUsdStr !== '-' ? parseFloat(outputUsdStr.replace('$', '').replace(',', '')) : 0;

      let calculatedImpact = 0;
      if (inputUsd > 0 && outputUsd > 0) {
        calculatedImpact = Math.abs((inputUsd - outputUsd) / inputUsd * 100);
        if (calculatedImpact < 0.01) calculatedImpact = 0.01;
      } else {
        calculatedImpact = bestProtocol.includes('v3') ? 0.1 : 0.5;
      }
      const priceImpactStr = calculatedImpact.toFixed(2);
      setPriceImpact(priceImpactStr);

      if (currentRequestId !== quoteRequestIdRef.current) return;
      setAmountOut(formatted);
      setIsLoadingQuote(false);

      quoteCacheRef.current = {
        key: cacheKey,
        amountOut: formatted,
        bestProtocol,
        bestRoutePlan: freshQuote.routePlan,
        routePlans: freshQuote.routePlans,
        splitRoutePreview: null,
        bestV3Fee,
        priceImpact: priceImpactStr,
        v3Available: bestProtocol === 'uniswap-v3',
        v2Available: bestProtocol === 'uniswap-v2',
        timestamp: Date.now()
      };

      const splitPreview = await getSplitRoutePreview(amountInWei, tokenInAddr, tokenOutAddr, freshQuote.routePlans);
      if (currentRequestId !== quoteRequestIdRef.current || !splitPreview) return;

      const splitFormatted = formatUnits(splitPreview.netOutput, tokenOut.decimals);
      setSplitRoutePreview(splitPreview);
      setAmountOut(splitFormatted);
      quoteCacheRef.current = {
        key: cacheKey,
        amountOut: splitFormatted,
        bestProtocol,
        bestRoutePlan: freshQuote.routePlan,
        routePlans: freshQuote.routePlans,
        splitRoutePreview: splitPreview,
        bestV3Fee,
        priceImpact: priceImpactStr,
        v3Available: bestProtocol === 'uniswap-v3',
        v2Available: bestProtocol === 'uniswap-v2',
        timestamp: Date.now()
      };
      console.log(
        '🧭 Split route preview:',
        splitPreview.parts.map((part) => `${part.shareBps / 100}% ${part.candidate.label}`).join(' + '),
        '=>',
        splitFormatted,
        tokenOut.symbol,
        `(+${(splitPreview.improvementBps / 100).toFixed(2)}%)`
      );
    };

    const timer = setTimeout(fetchQuote, 400);
    return () => clearTimeout(timer);
  }, [amountIn, tokenIn, tokenOut, selectedFeeTier, swapClient, quoteRetryTrigger]);

  // Reset swap state when tokens change
  const resetSwapState = () => {
    setTransactionStep('idle');
    setNeedsApproval(true); // Will be recalculated by useEffect
    setErrorMessage(null);
    setAmountOut('0');
    setAllRoutePlans([]);
    setSplitRoutePreview(null);
    setSelectedRoutePlan(null);
    // Refetch allowance for the new tokenIn
    setTimeout(() => refetchAllowance(), 100);
  };

  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn('');
    resetSwapState();
  };

  const formatRouteNetOutput = (plan: SwapRoutePlan) => {
    const feeBps = getProtocolFeeBps();
    const feeMultiplier = 10000n - BigInt(feeBps);
    const netAmount = (plan.rawQuote * feeMultiplier) / 10000n;
    return `${formatNumber(parseFloat(formatUnits(netAmount, tokenOut.decimals)))} ${tokenOut.symbol}`;
  };

  const formatSplitRouteParts = (preview: SplitRoutePreview) => {
    return preview.parts
      .map((part) => `${formatNumber(part.shareBps / 100, 2)}% ${part.candidate.label}`)
      .join(' + ');
  };

  const getRouteHopLabel = (plan: SwapRoutePlan) => {
    if (!plan.hopCount || plan.hopCount <= 1) return 'Direct';
    return `${plan.hopCount} hops`;
  };

  const getRoutePathLabel = (plan: SwapRoutePlan) => {
    if (plan.path && plan.path.length > 1) {
      return plan.path
        .map((addressValue) => getKnownTokenByQuoteAddress(addressValue)?.symbol || shortAddress(addressValue))
        .join(' → ');
    }
    if (plan.hopCount && plan.hopCount > 1) return `${tokenIn.symbol} → … → ${tokenOut.symbol}`;
    return `${tokenIn.symbol} → ${tokenOut.symbol}`;
  };

  const getSplitSummaryParts = (preview: SplitRoutePreview) => {
    return preview.parts.map((part) => ({
      label: part.candidate.label,
      share: `${formatNumber(part.shareBps / 100, 0)}%`,
      output: `${formatNumber(parseFloat(formatUnits(part.estimatedRawOut, tokenOut.decimals)))} ${tokenOut.symbol}`
    }));
  };

  const getErrorText = (error: any) => {
    return [
      error?.shortMessage,
      error?.message,
      error?.details,
      error?.cause?.shortMessage,
      error?.cause?.message,
      error?.cause?.details
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  };

  const isAllowanceOrBalanceError = (message: string) => {
    return message.includes('insufficient allowance') ||
      message.includes('erc20insufficientallowance') ||
      message.includes('transfer amount exceeds allowance') ||
      message.includes('stf') ||
      message.includes('safetransferfrom') ||
      message.includes('insufficient balance') ||
      message.includes('erc20insufficientbalance');
  };

  const isSlippageError = (message: string) => {
    return message.includes('insufficientoutput') ||
      message.includes('too little received') ||
      message.includes('amountoutminimum') ||
      message.includes('minimum output') ||
      message.includes('insufficient output') ||
      message.includes('output amount');
  };

  const getRouteDeltaLabel = (plan: SwapRoutePlan) => {
    const bestPlan = allRoutePlans[0];
    if (!bestPlan) return '';
    const bestScore = GAS_ADJUSTED_ROUTE_SCORING ? (bestPlan.gasAdjustedQuote ?? bestPlan.rawQuote) : bestPlan.rawQuote;
    const routeScore = GAS_ADJUSTED_ROUTE_SCORING ? (plan.gasAdjustedQuote ?? plan.rawQuote) : plan.rawQuote;
    if (routeScore === bestScore) return 'Best';
    const bestNumber = parseFloat(formatUnits(bestScore, tokenOut.decimals));
    const routeNumber = parseFloat(formatUnits(routeScore, tokenOut.decimals));
    if (!bestNumber || !routeNumber) return '';
    const diff = ((bestNumber - routeNumber) / bestNumber) * 100;
    return `-${diff.toFixed(diff < 0.1 ? 2 : 1)}%`;
  };

  // Handle token selection with proper state reset
  const handleTokenSelect = (token: AppToken, side: 'in' | 'out') => {
    // Check if BHUB is selected (not deployed yet)
    if (token.symbol === 'BHUB') {
      alert('Soon\n\nBHUB token is coming soon! We haven\'t deployed it yet and liquidity hasn\'t been added.');
      setShowTokenSelect(null);
      setTokenSearchQuery('');
      return;
    }
    
    if (side === 'in') {
      if (token.symbol === tokenOut.symbol) {
        switchTokens();
      } else {
        setTokenIn(token);
        resetSwapState();
      }
    } else {
      if (token.symbol === tokenIn.symbol) {
        switchTokens();
      } else {
        setTokenOut(token);
        resetSwapState();
      }
    }
    setShowTokenSelect(null);
    setTokenSearchQuery('');
  };

  const handleApprove = async () => {
    if (!amountIn) return;

    setErrorMessage(null);
    setTransactionStep('approving');
    
    // MAX APPROVE: One-time unlimited approval like Uniswap
    // User only needs to approve once per token, never again
    console.log('🔓 Step 1: Max Approving Aggregator:', SWAP_AGGREGATOR);

    try {
      // Use writeContractAsync (same as GM/GN) so ERC-8021 dataSuffix is applied correctly
      await writeContractAsync({
        address: tokenIn.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_AGGREGATOR, maxUint256], // Unlimited approval
        chainId: base.id,
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      });
    } catch (error: any) {
      setTransactionStep('idle');
      if (error.code === 4001) {
        setErrorMessage('Transaction rejected');
      } else {
        setErrorMessage('An error occurred');
      }
    }
  };

  // Helper function to convert scientific notation to decimal string
  const parseScientificNotation = (value: string, decimals: number = 18): string => {
    // If it's already a normal number, limit to token decimals
    if (!value.includes('e') && !value.includes('E')) {
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      // Limit to token's decimal precision to avoid parseUnits errors
      return num.toFixed(decimals);
    }
    
    try {
      // Parse scientific notation to number
      const num = parseFloat(value);
      if (isNaN(num) || num === 0) {
        return '0';
      }
      
      // Convert to fixed decimal string with token's decimal precision
      // CRITICAL: parseUnits will fail if decimals exceed token decimals
      // USDC has 6 decimals, so "1.19" should become "1.190000" not "1.19000000000000000000"
      return num.toFixed(decimals);
    } catch (e) {
      console.warn('Failed to parse scientific notation:', value, e);
      return value;
    }
  };

  const handleSwap = async () => {
    if (!amountIn || !amountOut || !address) {
      console.error('❌ Swap validation failed:', {
        amountIn,
        amountOut,
        address,
        hasAddress: !!address
      });
      setErrorMessage('Please enter a valid amount');
      return;
    }

    // Parse amountOut to check if it's valid (allow very small values)
    const amountOutNum = parseFloat(amountOut);
    if (isNaN(amountOutNum) || amountOutNum <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    setErrorMessage(null);
    setTransactionStep('swapping');

    // Convert scientific notation to decimal string before parsing
    const amountInNormalized = parseScientificNotation(amountIn, tokenIn.decimals);
    const amountOutNormalized = parseScientificNotation(amountOut, tokenOut.decimals);

    let amountInWei: bigint;
    try {
      amountInWei = parseUnits(amountInNormalized, tokenIn.decimals);
      // Check if amount is too small (less than 1 wei)
      if (amountInWei === BigInt(0)) {
        setErrorMessage('Amount is too small to swap');
        setTransactionStep('idle');
        return;
      }
    } catch (error: any) {
      console.error('❌ Failed to parse amountIn:', error);
      setErrorMessage(`Invalid input amount: ${error.message || 'Number format error'}`);
      setTransactionStep('idle');
      return;
    }

    if (!tokenIn.isNative && !isWrapOperation) {
      try {
        const freshAllowanceResult = await refetchAllowance();
        const freshAllowance = freshAllowanceResult.data ?? allowance ?? 0n;
        const allowanceBigInt = typeof freshAllowance === 'bigint' ? freshAllowance : BigInt(freshAllowance.toString());
        if (allowanceBigInt < amountInWei) {
          setNeedsApproval(true);
          setTransactionStep('idle');
          setErrorMessage(`Please approve ${tokenIn.symbol} for the new SwapHub aggregator first.`);
          return;
        }
      } catch (allowanceError) {
        console.warn('Could not refresh allowance before swap:', allowanceError);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // SPECIAL CASE: Wrap/Unwrap (ETH↔WETH) - Direct WETH contract call
    // No swap needed, no fees, 1:1 conversion
    // ═══════════════════════════════════════════════════════════════
    if (isWrapOperation) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(isWrap ? '🔄 WRAP: ETH → WETH' : '🔄 UNWRAP: WETH → ETH');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   Amount:', amountIn, tokenIn.symbol, '→', amountIn, tokenOut.symbol);
      console.log('   Rate: 1:1 (no fees)');
      
      try {
        if (isWrap) {
          // ETH → WETH: Call deposit() with ETH value (writeContractAsync = same path as GM/GN for 8021)
          await writeContractAsync({
            address: WETH_ADDRESS as `0x${string}`,
            abi: WETH_ABI,
            functionName: 'deposit',
            args: [],
            value: amountInWei,
            chainId: base.id,
            dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
          });
        } else {
          // WETH → ETH: Call withdraw() with amount
          await writeContractAsync({
            address: WETH_ADDRESS as `0x${string}`,
            abi: WETH_ABI,
            functionName: 'withdraw',
            args: [amountInWei],
            chainId: base.id,
            dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
          });
        }
        console.log('✅ Wrap/Unwrap request sent to wallet!');
        return;
      } catch (error: any) {
        console.error('❌ Wrap/Unwrap error:', error);
        setTransactionStep('idle');
        if (error.message?.includes('decimal') || error.message?.includes('Number')) {
          setErrorMessage('Invalid amount format. Please check your input.');
        } else {
          setErrorMessage(error.message || 'Wrap/Unwrap failed');
        }
        return;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // NORMAL SWAP via AGGREGATOR V4
    // ═══════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 SWAP via AGGREGATOR V4 (Adapter-validated routes)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Fresh quote before swap so we don't use stale price
      setIsConfirmingPrice(true);
      const quoteTokenInAddr = tokenIn.isNative ? WETH_ADDRESS : tokenIn.address;
      const quoteTokenOutAddr = tokenOut.isNative ? WETH_ADDRESS : tokenOut.address;
      const freshQuote = await getFreshQuote(amountInWei, quoteTokenInAddr, quoteTokenOutAddr, tokenOut.decimals);
      setIsConfirmingPrice(false);
      if (!freshQuote) {
        setErrorMessage('Could not get current price. Try again.');
        setTransactionStep('idle');
        return;
      }
      // Apply slippage to get minAmountOut
      // Use BigInt arithmetic to avoid precision loss for small amounts
      // slippage is in percentage (e.g., 0.5 means 0.5%)
      // multiplier = (10000 - slippage * 100) / 10000 (to avoid floating point issues)
      const slippageBps = BigInt(Math.round(slippage * 100)); // Convert to basis points (0.5% = 50 bps)
      const slippageMultiplier = BigInt(10000) - slippageBps; // e.g., 10000 - 50 = 9950
      
      // Native ETH uses address(0) in our aggregator
      const inputIsNativeETH = tokenIn.isNative === true;
      const outputIsNativeETH = tokenOut.isNative === true;
      
      // For aggregator: address(0) = native ETH, otherwise use token address
      const tokenInAddr = inputIsNativeETH ? ZERO_ADDRESS : tokenIn.address;
      const tokenOutAddr = outputIsNativeETH ? ZERO_ADDRESS : tokenOut.address;

      console.log('📋 Aggregator V4 Swap Parameters:');
      console.log('   Aggregator Contract:', SWAP_AGGREGATOR);
      console.log('   Adapter Contract:', SWAP_AGGREGATOR_ADAPTER);
      console.log('   User Address:', address);
      console.log('   Token In:', tokenIn.symbol, inputIsNativeETH ? '(Native ETH → 0x0)' : `→ ${tokenInAddr}`);
      console.log('   Token Out:', tokenOut.symbol, outputIsNativeETH ? '(Native ETH → 0x0)' : `→ ${tokenOutAddr}`);
      console.log('   Amount In (wei):', amountInWei.toString());
      console.log('   Slippage:', slippage, '%');
      console.log('   Protocol Fee:', `${getProtocolFeeBps() / 100}%`);
      console.log('   Input is Native ETH:', inputIsNativeETH);
      console.log('   Output is Native ETH:', outputIsNativeETH);

      // ═══════════════════════════════════════════════════════════════
      // ALL SWAPS GO THROUGH AGGREGATOR V4 executeSplit (Including Native ETH!)
      // ═══════════════════════════════════════════════════════════════
      
      let txConfig: any;

      const GAS_FALLBACK = BigInt(900000);
      const GAS_BUFFER_BPS = 120n; // 20% buffer = 120/100
      const feeBps = BigInt(getProtocolFeeBps());
      const candidatePlans = freshQuote.routePlans.length > 0 ? freshQuote.routePlans : [freshQuote.routePlan];
      let selectedExecutionPlan: SwapRoutePlan | null = null;
      let selectedExecutionLabel = '';
      let selectedUserOutWei = 0n;
      let selectedMinAmountOut = 0n;
      let lastGasError: any = null;

      const buildTxConfigForSteps = (steps: any[], minAmountOutWei: bigint) => {
        const config: any = {
          address: SWAP_AGGREGATOR as `0x${string}`,
          abi: AGGREGATOR_ABI,
          functionName: 'executeSplit',
          args: [
            tokenInAddr,
            tokenOutAddr,
            amountInWei,
            minAmountOutWei,
            steps
          ],
          chainId: base.id,
          gas: GAS_FALLBACK
        };
        if (inputIsNativeETH) config.value = amountInWei;
        return config;
      };

      const buildSingleRouteStep = (plan: SwapRoutePlan, stepAmountIn: bigint = amountInWei) => ({
        adapter: SWAP_AGGREGATOR_ADAPTER,
        router: plan.router,
        tokenIn: tokenInAddr,
        tokenOut: tokenOutAddr,
        amountIn: stepAmountIn,
        routerCalldata: plan.routerCalldata,
        dexId: DEX_IDS[plan.protocol]
      });

      const buildTxConfigForPlan = (plan: SwapRoutePlan, minAmountOutWei: bigint) => {
        return buildTxConfigForSteps([buildSingleRouteStep(plan)], minAmountOutWei);
      };

      const buildExecutableSplit = async (preview: SplitRoutePreview) => {
        const steps: any[] = [];
        let rawOutput = 0n;
        let totalInput = 0n;

        for (const part of preview.parts) {
          const partPlans = await getRoutePlansForAmount(part.amountIn, quoteTokenInAddr, quoteTokenOutAddr);
          const partPlan = partPlans.find((plan) => plan.protocol === part.candidate.protocol && plan.label === part.candidate.label)
            ?? partPlans.find((plan) => plan.protocol === part.candidate.protocol);
          if (!partPlan) return null;
          steps.push(buildSingleRouteStep(partPlan, part.amountIn));
          rawOutput += partPlan.rawQuote;
          totalInput += part.amountIn;
        }

        if (steps.length < 2 || totalInput !== amountInWei || rawOutput <= 0n) return null;
        const userOutWei = (rawOutput * (10_000n - feeBps)) / 10_000n;
        const minAmountOut = (userOutWei * slippageMultiplier) / 10_000n;
        return {
          steps,
          userOutWei,
          minAmountOutWei: minAmountOut > 1n ? minAmountOut : 1n,
          label: `Split route: ${preview.parts.map((part) => `${formatNumber(part.shareBps / 100, 2)}% ${part.candidate.label}`).join(' + ')}`
        };
      };

      const freshSplitPreview = await getSplitRoutePreview(amountInWei, quoteTokenInAddr, quoteTokenOutAddr, freshQuote.routePlans);
      const splitExecution = freshSplitPreview ? await buildExecutableSplit(freshSplitPreview) : null;

      if (splitExecution && swapClient && address) {
        const splitConfig = buildTxConfigForSteps(splitExecution.steps, splitExecution.minAmountOutWei);
        try {
          const estimated = await swapClient.estimateContractGas({
            address: splitConfig.address,
            abi: splitConfig.abi,
            functionName: splitConfig.functionName,
            args: splitConfig.args,
            value: splitConfig.value,
            account: address as `0x${string}`
          });
          const withBuffer = (estimated * GAS_BUFFER_BPS) / 100n;
          splitConfig.gas = withBuffer > GAS_FALLBACK ? withBuffer : GAS_FALLBACK;
          txConfig = splitConfig;
          selectedExecutionPlan = freshQuote.routePlan;
          selectedExecutionLabel = splitExecution.label;
          selectedUserOutWei = splitExecution.userOutWei;
          selectedMinAmountOut = splitExecution.minAmountOutWei;
          console.log('⛽ Split route gas estimated:', estimated.toString(), '+20% →', txConfig.gas.toString());
        } catch (gasErr: any) {
          lastGasError = gasErr;
          console.warn('⚠️ Split route simulation failed, falling back to single-route execution:', gasErr?.shortMessage || gasErr?.message);
        }
      }

      // Dynamic gas estimation + 20% buffer
      // If estimation reverts the swap would also revert on-chain, so warn user
      if (!txConfig && swapClient && address) {
        for (const plan of candidatePlans) {
          const userOutWei = (plan.rawQuote * (10_000n - feeBps)) / 10_000n;
          if (userOutWei <= 0n) continue;
          const minAmountOut = (userOutWei * slippageMultiplier) / 10_000n;
          const finalMinAmountOut = minAmountOut > 1n ? minAmountOut : 1n;
          const candidateConfig = buildTxConfigForPlan(plan, finalMinAmountOut);

          try {
            const estimated = await swapClient.estimateContractGas({
              address: candidateConfig.address,
              abi: candidateConfig.abi,
              functionName: candidateConfig.functionName,
              args: candidateConfig.args,
              value: candidateConfig.value,
              account: address as `0x${string}`
            });
            const withBuffer = (estimated * GAS_BUFFER_BPS) / 100n;
            candidateConfig.gas = withBuffer > GAS_FALLBACK ? withBuffer : GAS_FALLBACK;
            txConfig = candidateConfig;
            selectedExecutionPlan = plan;
            selectedExecutionLabel = plan.label;
            selectedUserOutWei = userOutWei;
            selectedMinAmountOut = finalMinAmountOut;
            console.log('⛽ Gas estimated:', estimated.toString(), '+20% →', txConfig.gas.toString());
            break;
          } catch (gasErr: any) {
            lastGasError = gasErr;
            console.warn(`⚠️ Route simulation failed for ${plan.label}:`, gasErr?.shortMessage || gasErr?.message);
          }
        }

        if (!txConfig || !selectedExecutionPlan) {
          const gasErr = lastGasError;
          const msg = getErrorText(gasErr);
          if (isAllowanceOrBalanceError(msg)) {
            setNeedsApproval(!inputIsNativeETH);
            setErrorMessage(inputIsNativeETH
              ? 'Insufficient ETH balance for this swap.'
              : `Approval or balance is not enough for ${tokenIn.symbol}. Approve ${tokenIn.symbol} again, then try the swap.`);
          } else if (isSlippageError(msg) && slippage < 5) {
            setErrorMessage(`Swap will fail: price moved beyond ${slippage}% slippage. Try increasing slippage to 3-5% for this token.`);
          } else {
            setErrorMessage('Swap simulation failed. The transaction would revert on-chain. Try increasing slippage or reducing amount.');
          }
          console.error('⛽ Gas estimation reverted - swap would fail:', gasErr?.shortMessage || gasErr?.message);
          setTransactionStep('idle');
          return;
        }
      } else {
        const plan = freshQuote.routePlan;
        const userOutWei = (plan.rawQuote * (10_000n - feeBps)) / 10_000n;
        const minAmountOut = (userOutWei * slippageMultiplier) / 10_000n;
        txConfig = buildTxConfigForPlan(plan, minAmountOut > 1n ? minAmountOut : 1n);
        selectedExecutionPlan = plan;
        selectedExecutionLabel = plan.label;
        selectedUserOutWei = userOutWei;
        selectedMinAmountOut = minAmountOut > 1n ? minAmountOut : 1n;
      }

      if (!selectedExecutionPlan) {
        setErrorMessage('Could not select an executable route. Try again.');
        setTransactionStep('idle');
        return;
      }

      const amountOutNormalizedForSwap = formatUnits(selectedUserOutWei, tokenOut.decimals);
      console.log('🔀 Using Aggregator V4 executeSplit');
      console.log('   Route:', selectedExecutionLabel || selectedExecutionPlan.label);
      console.log('   Router:', selectedExecutionPlan.router);
      console.log('   User output (wei):', selectedUserOutWei.toString());
      console.log('   Min output (wei):', selectedMinAmountOut.toString());
      if (selectedExecutionPlan.bestFeeTier) {
        console.log('   Fee Tier:', selectedExecutionPlan.bestFeeTier, `(${selectedExecutionPlan.bestFeeTier / 10000}%)`);
      }
      if (inputIsNativeETH) {
        console.log('💰 Adding msg.value for native ETH:', amountInWei.toString());
      }

      console.log('📤 Sending swap via Aggregator V4...');
      console.log('   Function:', txConfig.functionName);
      console.log('   Args:', txConfig.args.map((a: any) => a.toString()));
      console.log('   Value:', txConfig.value?.toString() || '0');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Store swap amount in USD for volume tracking (used when tx confirms)
      let swapAmountUSD = 0;
      const amountInNum = parseFloat(amountInNormalized);
      if (!isNaN(amountInNum) && amountInNum > 0) {
        if (tokenIn.isNative || tokenIn.symbol === 'ETH' || tokenIn.symbol === 'WETH') {
          swapAmountUSD = amountInNum * ethPriceUsd;
        } else if (tokenIn.symbol === 'USDC' || tokenIn.symbol === 'USDT' || tokenIn.symbol === 'USDbC' || tokenIn.symbol === 'DAI') {
          swapAmountUSD = amountInNum;
        } else if (tokenOut.symbol === 'USDC' || tokenOut.symbol === 'USDT' || tokenOut.symbol === 'USDbC') {
          swapAmountUSD = parseFloat(amountOutNormalizedForSwap) || amountInNum * ethPriceUsd;
        } else {
          swapAmountUSD = amountInNum * ethPriceUsd;
        }
      }
      if (swapAmountUSD <= 0 && !isNaN(amountInNum) && amountInNum > 0 && ethPriceUsd > 0) {
        swapAmountUSD = Math.max(0.01, amountInNum * ethPriceUsd);
      }
      pendingSwapVolumeRef.current = { swapAmountUSD };

      // Use writeContractAsync (same as GM/GN) so ERC-8021 dataSuffix is applied correctly
      const txHash = await writeContractAsync({
        address: txConfig.address,
        abi: txConfig.abi,
        functionName: txConfig.functionName,
        args: txConfig.args,
        value: txConfig.value,
        gas: txConfig.gas,
        chainId: txConfig.chainId,
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      });
      
      console.log('✅ Swap tx sent:', txHash?.slice(0, 12) + '...');

      if (txHash && swapClient) {
        try {
          const receipt = await swapClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1, timeout: 60_000 });
          console.log('✅ Swap confirmed via Alchemy! Block:', receipt.blockNumber);
          
          void queryClient.invalidateQueries({ queryKey: ['balance'] });
          refetchBalanceIn();
          refetchBalanceOut();
          setTransactionStep('success');

          const t2 = setTimeout(() => { refetchBalanceIn(); refetchBalanceOut(); }, 2000);
          const t5 = setTimeout(() => { refetchBalanceIn(); refetchBalanceOut(); }, 5000);

          const swapAmountUSD = pendingSwapVolumeRef.current?.swapAmountUSD ?? 0;
          if (swapAmountUSD > 0 && address) {
            pendingSwapVolumeRef.current = null;
            lastRecordedHashRef.current = txHash;
            recordSentForHashRef.current = txHash;
            swapToRecordRef.current = { hash: txHash, amount: swapAmountUSD };
            console.log('🎉 Recording swap volume:', { swapAmountUSD, hash: txHash.slice(0, 12) + '...' });
            updateQuestProgress?.('swapsCompleted', 1);
            setTimeout(() => {
              recordSwapTransaction(address, swapAmountUSD, txHash)
                .then((awarded) => {
                  const from100 = awarded?.xpFromPer100 ?? 0;
                  const fromMilestones = awarded?.xpFromMilestones ?? 0;
                  console.log('✅ Swap volume recorded to Supabase');
                  if (typeof window !== 'undefined') {
                    setTimeout(() => window.dispatchEvent(new CustomEvent('basehub-swap-recorded')), 400);
                    setTimeout(() => window.dispatchEvent(new CustomEvent('basehub-swap-recorded')), 2500);
                  }
                  const total = from100 + fromMilestones;
                  if (total > 0) {
                    const msg = from100 > 0 && fromMilestones > 0
                      ? `$100 threshold + milestone bonus!`
                      : from100 > 0 ? `$100 volume threshold reached!` : `Milestone bonus earned!`;
                    setXpSuccessToast({ xp: total, message: msg });
                  }
                })
                .catch(err => {
                  console.error('❌ Error recording swap volume:', err);
                  setTimeout(() => {
                    recordSwapTransaction(address, swapAmountUSD, txHash).catch(() => {});
                  }, 4000);
                });
            }, 1500);
          }
        } catch (receiptErr) {
          console.warn('⚠️ Receipt wait timed out, wagmi hook will handle:', receiptErr);
        }
      }

    } catch (error: any) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ TRANSACTION ERROR:');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('   Error object:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      
      if (error.cause) console.error('   Error cause:', error.cause);
      if (error.details) console.error('   Error details:', error.details);
      if (error.shortMessage) console.error('   Short message:', error.shortMessage);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // IMPORTANT: Reset transaction step on error
      setTransactionStep('idle');
      setIsConfirmingPrice(false);

      const errMsg = getErrorText(error);
      if (error.code === 4001 || errMsg.includes('user rejected') || errMsg.includes('rejected') || errMsg.includes('denied')) {
        setErrorMessage('Transaction rejected');
      } else if (isAllowanceOrBalanceError(errMsg) || errMsg.includes('insufficient funds')) {
        setNeedsApproval(!tokenIn.isNative);
        setErrorMessage(tokenIn.isNative
          ? 'Insufficient ETH balance'
          : `Approval or balance is not enough for ${tokenIn.symbol}. Approve ${tokenIn.symbol} again, then try the swap.`);
      } else if (isSlippageError(errMsg)) {
        setErrorMessage(`Swap reverted: price moved beyond ${slippage}% slippage. Increase slippage to 3-5% for volatile tokens.`);
      } else if (errMsg.includes('nonce')) {
        setErrorMessage('Nonce error - Please try again');
      } else if (errMsg.includes('network') || errMsg.includes('timeout')) {
        setErrorMessage('Network error - Check RPC connection');
      } else {
        setErrorMessage(`Transaction failed: ${error.shortMessage || error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle approval tx success only — swap success is handled inline in handleSwap via swapClient
  useEffect(() => {
    if (isSuccess && hash && !isConfirming && transactionStep === 'approving') {
      refetchAllowance();
      setErrorMessage(null);
      console.log('✅ Approval confirmed! Ready for swap...');
      setTransactionStep('approved');
      setApprovalSuccess(true);
      setNeedsApproval(false);
      
      const swapTimer = setTimeout(() => {
        setApprovalSuccess(false);
        setTransactionStep('swapping');
      }, 1500);
      return () => clearTimeout(swapTimer);
    }
  }, [isSuccess, hash, isConfirming, transactionStep, refetchAllowance]);

  // IMPORTANT: Reset swapping state when transaction completes (success or failure)
  useEffect(() => {
    // If confirming is done (either success or failure) and we have a hash
    if (!isConfirming && hash) {
      // If we're still in swapping state but transaction is done
      if (transactionStep === 'swapping') {
        if (isSuccess) {
          // Success already handled above, but ensure we're not stuck
          console.log('✅ Transaction completed successfully');
        } else if (txError) {
          // Error already handled by txError effect, but ensure reset
          console.log('❌ Transaction failed');
          setTransactionStep('idle');
        } else {
          // Transaction completed but we're still in swapping state
          // This shouldn't happen, but reset just in case
          console.log('⚠️ Transaction completed, resetting state');
          setTransactionStep('idle');
        }
      }
    }
  }, [isConfirming, isSuccess, txError, hash, transactionStep]);

  // Handle write errors (user rejection, simulation failure, etc.)
  useEffect(() => {
    if (writeError) {
      console.error('❌ Write Contract Error:', writeError);
      console.error('   Error name:', writeError.name);
      console.error('   Error message:', writeError.message);
      
      // IMPORTANT: Reset transaction step on ANY error
      setTransactionStep('idle');
      
      if (writeError.message?.includes('User rejected') || 
          writeError.message?.includes('rejected') ||
          writeError.message?.includes('denied')) {
        setErrorMessage('Transaction rejected by user');
      } else if (writeError.message?.includes('likely to fail')) {
        setErrorMessage('Transaction is likely to fail - check parameters');
      } else {
        setErrorMessage(`Error: ${writeError.message || 'Unknown error'}`);
      }
    }
  }, [writeError]);

  // Handle transaction errors (on-chain failures)
  useEffect(() => {
    if (txError) {
      console.error('❌ Transaction Error:', txError);
      // IMPORTANT: Reset transaction step on tx error
      setTransactionStep('idle');
      setErrorMessage(`Transaction failed: ${txError.message}`);
    }
  }, [txError]);

  // Reset UI when user rejects transaction (isPending becomes false without hash)
  useEffect(() => {
    // If we're in a pending state but isPending becomes false and there's no hash
    // This means user rejected or something went wrong
    if (!isPending && !hash && (transactionStep === 'swapping' || transactionStep === 'approving')) {
      // Give a small delay to allow writeError to be set first
      const timer = setTimeout(() => {
        // Only reset if still in that state (writeError handler might have already handled it)
        if (transactionStep === 'swapping' || transactionStep === 'approving') {
          console.log('⚠️ Transaction cancelled or failed - resetting UI');
          setTransactionStep('idle');
          setErrorMessage(null);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isPending, hash, transactionStep]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Mobile responsive styles helper
  const getStyle = (desktopStyle: React.CSSProperties, mobileStyle?: React.CSSProperties) => {
    return isMobile && mobileStyle ? { ...desktopStyle, ...mobileStyle } : desktopStyle;
  };

  // Mobile style overrides
  const mobileOverrides = isMobile ? {
    header: { padding: '8px 12px', flexWrap: 'wrap' as const },
    headerLeft: { gap: '12px', width: '100%' },
    logo: { gap: '6px' },
    logoImage: { width: '40px', height: '40px' },
    logoText: { fontSize: '18px' },
    nav: { gap: '4px' },
    navLink: { padding: '6px 12px', fontSize: '14px' },
    navLinkActive: { padding: '6px 12px', fontSize: '14px' },
    headerRight: { 
      position: 'absolute' as const,
      top: '12px',
      right: '12px',
      gap: '8px',
      marginTop: 0,
      width: 'auto',
      justifyContent: 'flex-end'
    },
    searchBar: { padding: '8px 12px', flex: 1, maxWidth: 'calc(100% - 120px)' },
    searchInput: { width: '100%', fontSize: '12px' },
    mainContent: { padding: '12px' },
    card: { padding: '8px', borderRadius: '16px' },
    tokenSection: { padding: '12px' },
    tokenLabel: { fontSize: '12px' },
    amountInput: { fontSize: '28px' },
    tokenButton: { padding: '6px 10px', fontSize: '14px' },
    tokenButtonLogo: { width: '20px', height: '20px' },
    usdValue: { fontSize: '12px' },
    balanceText: { fontSize: '12px' },
    percentageButtons: { gap: '4px', marginBottom: '6px' },
    percentButton: { padding: '3px 8px', fontSize: '10px' },
    swapButton: { padding: '14px', fontSize: '16px' },
    infoBox: { padding: '10px' },
    infoRow: { fontSize: '12px', marginBottom: '6px' },
    slippageModal: { width: '95%', padding: '20px', maxWidth: 'none' },
    statisticsModal: { 
      width: '95%', 
      padding: '12px', 
      minWidth: 'auto',
      maxWidth: '100%',
      maxHeight: '90vh',
      overflow: 'auto' as const
    },
    modalContent: {
      width: '95%',
      maxWidth: '420px',
      padding: '12px'
    },
    tokenLogo: {
      width: '20px',
      height: '20px'
    },
    tokenSymbol: {
      fontSize: '14px'
    },
    tokenName: {
      fontSize: '11px',
      maxWidth: '120px'
    },
    tokenOption: {
      padding: '8px 6px',
      fontSize: '14px'
    },
    tokenBalanceAmount: {
      fontSize: '12px'
    },
    tokenBalanceUsd: {
      fontSize: '11px'
    },
    popularToken: {
      padding: '5px 8px',
      fontSize: '12px'
    },
    sectionTitle: {
      fontSize: '11px',
      padding: '6px 8px 3px'
    }
  } : {};

  // Show Base-only warning if not on Base network
  if (isConnected && !isOnBase) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#fff',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderRadius: '20px',
        border: '2px solid rgba(239, 68, 68, 0.3)',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '20px' }} />
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          color: '#ef4444', 
          marginBottom: '16px' 
        }}>
          Base Network Required
        </h2>
        <p style={{ 
          fontSize: '16px', 
          color: '#9ca3af', 
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          SwapHub DEX Aggregator only works on Base network.
          <br />
          Please switch to Base network using RainbowKit's network selector to use SwapHub.
        </p>
        <div style={{
          padding: '12px 20px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          color: '#60a5fa',
          fontSize: '14px'
        }}>
          Current Network: {chainId === NETWORKS.INKCHAIN.chainId ? 'InkChain' : `Unknown (Chain ID: ${chainId})`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.pageContainer, ...(isMobile ? { minHeight: 'auto' } : {}) }}>
      {/* Header */}
      <header style={getStyle(styles.header, mobileOverrides.header)}>
        <div style={getStyle(styles.headerLeft, mobileOverrides.headerLeft)}>
          <div style={getStyle(styles.logo, mobileOverrides.logo)}>
            <img src={swaphubLogo} alt="SwapHub" style={getStyle(styles.logoImage, mobileOverrides.logoImage)} />
            <span style={getStyle(styles.logoText, mobileOverrides.logoText)}>SwapHub</span>
          </div>
          {!isMobile && (
            <nav style={getStyle(styles.nav, mobileOverrides.nav)}>
              <a href="#" style={getStyle(styles.navLinkActive, mobileOverrides.navLinkActive)}>Swap</a>
              <button 
                onClick={() => setShowStatistics(true)}
                style={getStyle(styles.navLink, mobileOverrides.navLink)}
              >
                Statistics
              </button>
            </nav>
          )}
        </div>
        {isMobile && (
          <nav style={getStyle(styles.nav, mobileOverrides.nav)}>
            <a href="#" style={getStyle(styles.navLinkActive, mobileOverrides.navLinkActive)}>Swap</a>
            <button 
              onClick={() => setShowStatistics(true)}
              style={getStyle(styles.navLink, mobileOverrides.navLink)}
            >
              Statistics
            </button>
          </nav>
        )}
        {!isMobile && (
          <div style={getStyle(styles.headerRight, mobileOverrides.headerRight)}>
            <div style={getStyle(styles.searchBar, mobileOverrides.searchBar)}>
              <span style={styles.searchIcon}>🔍</span>
              <input 
                type="text" 
                placeholder="Search tokens" 
                style={getStyle(styles.searchInput, mobileOverrides.searchInput)}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div style={getStyle(styles.mainContent, mobileOverrides.mainContent)}>
        <div style={getStyle(styles.card, mobileOverrides.card)}>

        {/* Token In */}
        <div style={getStyle(styles.tokenSection, mobileOverrides.tokenSection)}>
          <div style={styles.sectionHeader}>
            <div style={getStyle(styles.tokenLabel, mobileOverrides.tokenLabel)}>Sell</div>
            <button 
              onClick={() => setShowTokenSelect('in')}
              style={getStyle(styles.tokenButton, mobileOverrides.tokenButton)}
            >
              {(tokenIn.logoURI || tokenLogos[tokenIn.symbol]) && (
                <img
                  src={tokenIn.logoURI || tokenLogos[tokenIn.symbol]}
                  alt={tokenIn.symbol}
                  style={getStyle(styles.tokenButtonLogo, mobileOverrides.tokenButtonLogo)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              {tokenIn.symbol}
              <span style={styles.chevron}>▼</span>
            </button>
          </div>
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0"
            style={getStyle(styles.amountInput, mobileOverrides.amountInput)}
          />
          {/* Percentage buttons */}
          <div style={getStyle(styles.percentageButtons, mobileOverrides.percentageButtons)}>
            {[10, 25, 50, 100].map((percent) => (
              <button
                key={percent}
                onClick={() => {
                  if (displayBalance) {
                    // Use original balance value (not formatted) to avoid scientific notation issues
                    const maxAmount = parseFloat(formatUnits(displayBalance.value, displayBalance.decimals));
                    
                    // For Max (100%), leave a tiny amount in wallet to avoid errors
                    // Calculate a small buffer based on token decimals
                    let calculatedAmount: number;
                    if (percent === 100) {
                      const decimals = displayBalance.decimals || 18;
                      // Leave a small buffer to avoid rounding errors and transaction failures
                      // For USDC (6 decimals): leave 0.01 USDC (10000 micro-units)
                      // For ETH (18 decimals): leave 0.0001 ETH (100000000000000 wei)
                      // For other tokens: leave 0.01% of balance or a minimum amount
                      let buffer: number;
                      if (decimals === 6) {
                        // USDC/USDT: leave 0.01 (10000 micro-units)
                        buffer = 0.01;
                      } else if (decimals === 18) {
                        // ETH/WETH: leave 0.0001 ETH
                        buffer = 0.0001;
                      } else if (decimals === 8) {
                        // BTC-like: leave 0.00001
                        buffer = 0.00001;
                      } else {
                        // Other tokens: leave 0.01% of balance or minimum 0.0001
                        buffer = Math.max(maxAmount * 0.0001, 0.0001);
                      }
                      // Ensure buffer doesn't exceed 1% of balance
                      const maxBuffer = maxAmount * 0.01;
                      const finalBuffer = Math.min(buffer, maxBuffer);
                      calculatedAmount = Math.max(0, maxAmount - finalBuffer);
                    } else {
                      calculatedAmount = maxAmount * percent / 100;
                    }
                    
                    // Convert to string with proper precision (avoid scientific notation)
                    // Use enough decimals to preserve precision
                    const decimals = displayBalance.decimals || 18;
                    const precision = Math.max(decimals, 20);
                    let newAmount: string;
                    
                    if (calculatedAmount === 0) {
                      newAmount = '0';
                    } else {
                      // Always use toFixed with full precision to avoid rounding errors
                      // Don't use formatNumber as it may truncate decimals
                      // This ensures we use the exact calculated amount
                      newAmount = calculatedAmount.toFixed(precision);
                      // Remove trailing zeros manually (don't use parseFloat to avoid scientific notation)
                      newAmount = newAmount.replace(/\.?0+$/, '');
                    }
                    
                    setAmountIn(newAmount);
                  }
                }}
                style={getStyle(styles.percentButton, mobileOverrides.percentButton)}
              >
                {percent === 100 ? 'Max' : `${percent}%`}
              </button>
            ))}
          </div>
          <div style={styles.bottomRow}>
            <div style={getStyle(styles.usdValue, mobileOverrides.usdValue)}>
              {calculateUsdValue(amountIn, tokenIn, amountOut, tokenOut, ethPriceUsd)}
            </div>
            <div style={getStyle(styles.balanceText, mobileOverrides.balanceText)}>
              {displayBalance 
                ? `${formatNumber(parseFloat(formatUnits(displayBalance.value, displayBalance.decimals)))} ${tokenIn.symbol}`
                : `- ${tokenIn.symbol}`
              }
            </div>
          </div>
        </div>

        {/* Switch Button */}
        <div style={styles.switchContainer}>
        <button onClick={switchTokens} style={styles.switchButton}>
          ↓
        </button>
        </div>

        {/* Token Out */}
        <div style={getStyle(styles.tokenSection, mobileOverrides.tokenSection)}>
          <div style={styles.sectionHeader}>
            <div style={getStyle(styles.tokenLabel, mobileOverrides.tokenLabel)}>Buy</div>
            <button 
              onClick={() => setShowTokenSelect('out')}
              style={getStyle(styles.tokenButton, mobileOverrides.tokenButton)}
            >
              {(tokenOut.logoURI || tokenLogos[tokenOut.symbol]) && (
                <img
                  src={tokenOut.logoURI || tokenLogos[tokenOut.symbol]}
                  alt={tokenOut.symbol}
                  style={getStyle(styles.tokenButtonLogo, mobileOverrides.tokenButtonLogo)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              {tokenOut.symbol}
              <span style={styles.chevron}>▼</span>
            </button>
          </div>
          <div style={styles.amountRow}>
            {isLoadingQuote ? (
              <div style={styles.loadingSpinner}></div>
            ) : null}
            <input
              type="text"
              value={isLoadingQuote ? '' : (amountOut && parseFloat(amountOut) > 0 ? formatNumber(parseFloat(amountOut)) : amountOut)}
              readOnly
              placeholder="0"
              style={{
                ...getStyle(styles.amountInput, mobileOverrides.amountInput),
                paddingLeft: isLoadingQuote ? (isMobile ? '30px' : '40px') : '0'
              }}
            />
          </div>
          <div style={styles.bottomRow}>
            <div style={getStyle(styles.usdValue, mobileOverrides.usdValue)}>
              {calculateUsdValue(amountOut, tokenOut, amountIn, tokenIn, ethPriceUsd)}
            </div>
            <div style={getStyle(styles.balanceText, mobileOverrides.balanceText)}>
              {tokenOutBalance 
                ? `${formatNumber(parseFloat(formatUnits(tokenOutBalance.value, tokenOutBalance.decimals)))} ${tokenOut.symbol}`
                : `- ${tokenOut.symbol}`
              }
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={
            transactionStep === 'approved'
              ? handleSwap
              : (needsApproval && !tokenIn.isNative && !isWrapOperation ? handleApprove : handleSwap)
          }
          disabled={!amountIn || parseFloat(amountOut) === 0 || isPending || isConfirming || isConfirmingPrice || noLiquidityError || transactionStep === 'success'}
          style={{
            ...getStyle(styles.swapButton, mobileOverrides.swapButton),
            opacity: (!amountIn || parseFloat(amountOut) === 0 || isPending || isConfirming || isConfirmingPrice || noLiquidityError) ? 0.5 : 1,
            cursor: (!amountIn || parseFloat(amountOut) === 0 || isPending || isConfirming || isConfirmingPrice || noLiquidityError) ? 'not-allowed' : 'pointer'
          }}
        >
          {isConfirmingPrice
            ? 'Confirming price...'
            : isPending
            ? (transactionStep === 'approving' ? 'Approving...' : 'Swapping...')
            : isConfirming
            ? (transactionStep === 'approving' ? 'Confirming approval...' : isWrapOperation ? (isWrap ? 'Wrapping...' : 'Unwrapping...') : 'Confirming swap...')
            : transactionStep === 'approved'
            ? 'Proceed to Swap'
            : isWrapOperation
            ? (isWrap ? 'Wrap ETH → WETH' : 'Unwrap WETH → ETH')
            : needsApproval && !tokenIn.isNative
            ? `1. Approve ${tokenIn.symbol}`
            : 'Swap'
          }
        </button>

        {/* No Liquidity Warning */}
        {noLiquidityError && (
          <div style={{ ...styles.noLiquidityWarning, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span>⚠️ No liquidity pool found for this pair</span>
            <button
              onClick={() => {
                setNoLiquidityError(false);
                setQuoteRetryTrigger(t => t + 1);
              }}
              style={{ padding: '4px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'background 0.15s', whiteSpace: 'nowrap' as const }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            >
              Retry
            </button>
          </div>
        )}

        {/* Protocol Badge */}
        {parseFloat(amountOut) > 0 && !noLiquidityError && (
          <div style={styles.protocolBadge}>
            {splitRoutePreview
              ? `Split route: ${formatSplitRouteParts(splitRoutePreview)}`
              : `100% via ${selectedRoutePlan?.label || getProtocolLabel(selectedProtocol)}`}
          </div>
        )}

        {/* Share on Farcaster Button - After protocol badge */}

        {(isPending || isConfirming) && (
          <div style={styles.pendingMessage}>
            <div style={styles.spinner}></div>
            {transactionStep === 'approving' 
              ? (isPending ? 'Step 1/2: Approve in wallet...' : 'Confirming approval...')
              : (isPending ? 'Step 2/2: Confirm swap in wallet...' : 'Confirming swap...')
            }
          </div>
        )}

        {/* Approval Success Toast */}
        {transactionStep === 'approved' && (
          <div 
            style={styles.toastOverlay}
            onClick={() => setTransactionStep('idle')}
          >
            <div style={styles.toastCard} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setTransactionStep('idle')}
                style={styles.toastCloseBtn}
              >
                ×
              </button>
              <div style={styles.toastIconSuccess}>✓</div>
              <div style={styles.toastTitle}>Approval Confirmed!</div>
              <div style={styles.toastText}>
                {tokenIn.symbol} approved successfully
              </div>
              <button 
                onClick={handleSwap}
                style={styles.toastButton}
              >
                Continue to Swap →
              </button>
            </div>
          </div>
        )}

        {/* Swap Success Toast */}
        {transactionStep === 'success' && hash && (
          <div 
            style={styles.toastOverlay}
            onClick={() => {
              setTransactionStep('idle');
              setAmountIn('');
              setAmountOut('0');
            }}
          >
            <div style={styles.toastCard} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => {
                  setTransactionStep('idle');
                  setAmountIn('');
                  setAmountOut('0');
                }}
                style={styles.toastCloseBtn}
              >
                ×
              </button>
              <div style={styles.toastIconSuccess}>✓</div>
              <div style={styles.toastTitle}>Swap Complete!</div>
              <div style={styles.toastText}>
                {amountIn} {tokenIn.symbol} → {tokenOut.symbol}
              </div>
              <div style={{ 
                marginTop: '12px',
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center' as const
              }}>
                Volume recorded — earn XP at $100, $1k, $10k, $100k, $1M milestones
              </div>
              <a 
                href={`https://basescan.org/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.toastLink}
              >
                View on Basescan ↗
              </a>
            </div>
          </div>
        )}

        {/* XP milestone success toast — auto-dismiss after 4s */}
        {xpSuccessToast && (
          <div
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1001,
              padding: '14px 24px',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))',
              borderRadius: '14px',
              boxShadow: '0 10px 40px rgba(34, 197, 94, 0.4)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.3s ease-out',
              maxWidth: '90vw'
            }}
          >
            <span style={{ fontSize: '28px' }}>🎉</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{xpSuccessToast.message}</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                +{xpSuccessToast.xp.toLocaleString()} XP
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div style={styles.errorMessage}>
            ⚠️ {errorMessage}
            </div>
        )}

        {/* Info */}
        {amountOut !== '0' && !isPending && !isConfirming && (
          <div style={styles.infoBox}>
            {allRoutePlans.length > 0 && (
              <div style={styles.routeQuotes}>
                <div style={styles.routePanelHeader}>
                  <span>{splitRoutePreview ? 'Optimized route' : 'Best route'}</span>
                  <span>{splitRoutePreview ? `+${(splitRoutePreview.improvementBps / 100).toFixed(2)}%` : 'Gas adjusted'}</span>
                </div>

                <div style={styles.bestRouteCard}>
                  <div style={styles.bestRouteTop}>
                    <div style={styles.bestRouteTitleBlock}>
                      <span style={styles.bestRouteLabel}>
                        {splitRoutePreview ? 'Split route' : (selectedRoutePlan?.label || getProtocolLabel(selectedProtocol))}
                      </span>
                      <span style={styles.bestRoutePath}>
                        {splitRoutePreview ? formatSplitRouteParts(splitRoutePreview) : (selectedRoutePlan ? getRoutePathLabel(selectedRoutePlan) : `${tokenIn.symbol} → ${tokenOut.symbol}`)}
                      </span>
                    </div>
                    <div style={styles.bestRouteOutputBlock}>
                      <span style={styles.bestRouteOutput}>{formatNumber(parseFloat(amountOut))} {tokenOut.symbol}</span>
                      <span style={styles.bestRouteMeta}>{splitRoutePreview ? 'after fee' : getRouteHopLabel(selectedRoutePlan || allRoutePlans[0])}</span>
                    </div>
                  </div>

                  {splitRoutePreview ? (
                    <div style={styles.routeAllocationGrid}>
                      {getSplitSummaryParts(splitRoutePreview).map((part) => (
                        <div key={`${part.label}-${part.share}`} style={styles.routeAllocationItem}>
                          <span style={styles.routeSharePill}>{part.share}</span>
                          <span style={styles.routeAllocationDex}>{part.label}</span>
                          <span style={styles.routeAllocationOut}>{part.output}</span>
                        </div>
                      ))}
                    </div>
                  ) : selectedRoutePlan ? (
                    <div style={styles.routeChipRow}>
                      <span style={styles.routeChip}>{getRouteHopLabel(selectedRoutePlan)}</span>
                      <span style={styles.routeChip}>{getRoutePathLabel(selectedRoutePlan)}</span>
                    </div>
                  ) : null}
                </div>

                <div style={styles.routeQuotesHeader}>
                  <span>Market check</span>
                  <span>{allRoutePlans.length} routes</span>
                </div>
                {allRoutePlans.slice(0, 4).map((plan) => {
                  const isBest = selectedRoutePlan?.label === plan.label
                    && selectedRoutePlan?.router === plan.router
                    && selectedRoutePlan?.routerCalldata === plan.routerCalldata;
                  return (
                    <div key={`${plan.protocol}-${plan.label}-${plan.routerCalldata.slice(0, 18)}`} style={{ ...styles.routeQuoteRow, ...(isBest ? styles.routeQuoteRowBest : {}) }}>
                      <span style={styles.routeQuoteDex}>
                        <span style={styles.routeDexName}>{plan.label}</span>
                        <span style={styles.routeHopBadge}>{getRouteHopLabel(plan)}</span>
                      </span>
                      <span style={styles.routeQuoteAmount}>
                        {formatRouteNetOutput(plan)}
                        {isBest ? <span style={styles.routeBestBadge}>Best</span> : <span style={styles.routeDelta}>{getRouteDeltaLabel(plan)}</span>}
                      </span>
                    </div>
                  );
                })}
                {allRoutePlans.length > 4 && (
                  <div style={styles.routeMoreNote}>
                    +{allRoutePlans.length - 4} more checked routes hidden for readability
                  </div>
                )}
              </div>
            )}
            <div style={getStyle(styles.infoRow, mobileOverrides.infoRow)}>
              <span>Minimum received:</span>
              <span>{formatNumber(parseFloat(amountOut) * (1 - slippage / 100))} {tokenOut.symbol}</span>
            </div>
            <div style={getStyle(styles.infoRow, mobileOverrides.infoRow)}>
              <span>Price Impact:</span>
              <span style={{
                color: parseFloat(priceImpact) > 5 ? '#ff6b6b' : parseFloat(priceImpact) > 2 ? '#ffa500' : '#4ade80'
              }}>
                {priceImpact}%
              </span>
            </div>
            <div style={getStyle(styles.infoRow, mobileOverrides.infoRow)}>
              <span>Slippage:</span>
              <button 
                onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                style={styles.slippageButton}
              >
                {slippage}% ⚙️
              </button>
            </div>
            {getProtocolFeeBps() > 0 && (
              <div style={getStyle(styles.infoRow, mobileOverrides.infoRow)}>
                <span>Protocol Fee:</span>
                <span style={{ color: '#666' }}>{getProtocolFeeBps() / 100}%</span>
              </div>
            )}
          </div>
        )}

        {/* Slippage Settings Modal - Modern Design */}
        {showSlippageSettings && (
          <>
            <div 
              style={styles.modalOverlay} 
              onClick={() => setShowSlippageSettings(false)}
            />
            <div style={getStyle(styles.slippageModal, mobileOverrides.slippageModal)}>
              <div style={styles.slippageModalHeader}>
                <span style={styles.slippageModalTitle}>Slippage Settings</span>
                <button 
                  onClick={() => setShowSlippageSettings(false)} 
                  style={styles.slippageCloseBtn}
                >
                  ×
                </button>
              </div>
              <p style={styles.slippageDescription}>
                Your transaction will revert if the price changes unfavorably by more than this percentage.
              </p>
              <div style={styles.slippagePresets}>
                {[0.1, 0.5, 1.0, 3.0].map(value => (
                  <button
                    key={value}
                    onClick={() => {
                      setSlippage(value);
                      localStorage.setItem('swapSlippage', value.toString());
                    }}
                    style={{
                      ...styles.slippagePresetBtn,
                      backgroundColor: slippage === value ? 'transparent' : 'rgba(255,255,255,0.05)',
                      background: slippage === value ? 'linear-gradient(135deg, #ff1cf7, #00d4ff)' : 'none',
                      color: slippage === value ? '#fff' : '#888',
                      border: slippage === value ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {value}%
                  </button>
                ))}
              </div>
              <div style={styles.slippageCustom}>
                <span style={styles.slippageCustomLabel}>Custom</span>
                <div style={styles.slippageInputWrapper}>
                  <input
                    type="number"
                    value={slippage}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0.01 && val <= 50) {
                        setSlippage(val);
                        localStorage.setItem('swapSlippage', val.toString());
                      }
                    }}
                    step="0.1"
                    min="0.01"
                    max="50"
                    style={styles.slippageCustomInput}
                  />
                  <span style={styles.slippagePercent}>%</span>
                </div>
              </div>
              {slippage > 5 && (
                <div style={styles.slippageWarning}>
                  ⚠️ High slippage increases risk of frontrunning
                </div>
              )}
              {slippage < 0.1 && (
                <div style={styles.slippageWarning}>
                  ⚠️ Very low slippage may cause transaction to fail
                </div>
              )}
            </div>
          </>
        )}

        {/* Statistics Modal */}
        {showStatistics && (
          <>
            <div 
              style={styles.modalOverlay} 
              onClick={() => setShowStatistics(false)}
            />
            <div style={getStyle({ ...styles.statisticsModal, position: 'relative' as const }, mobileOverrides.statisticsModal)}>
              <button 
                onClick={() => setShowStatistics(false)} 
                style={{
                  position: 'absolute' as const,
                  top: '20px',
                  right: '20px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '20px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1,
                  zIndex: 10
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                }}
              >
                ×
              </button>
              <StatsPanel isMobile={isMobile} />
            </div>
          </>
        )}

        {hash && isConfirming && (
          <div style={styles.txLinkBox}>
            <a 
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.txLink}
            >
              View on Basescan →
            </a>
          </div>
        )}

        {/* Token Select Modal */}
        {showTokenSelect && (
          <div style={styles.modal} onClick={() => {
            setShowTokenSelect(null);
            setTokenSearchQuery('');
          }}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Select Token</h3>
                <button 
                  onClick={() => {
                    setShowTokenSelect(null);
                    setTokenSearchQuery('');
                  }} 
                  style={styles.closeButton}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#888888';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >×</button>
              </div>
              
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search name, symbol or address..."
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                style={styles.modalSearchInput}
                autoFocus
              />

              {/* Meme Tokens Category */}
              {!tokenSearchQuery && (
                <div style={styles.popularTokens}>
                  <button
                    onClick={() => setShowMemeTokens(!showMemeTokens)}
                    style={{
                      ...styles.popularLabel,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      marginBottom: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: '#666666',
                      width: '100%'
                    }}
                  >
                    <span>Meme Tokens</span>
                    <span style={{ fontSize: '12px' }}>{showMemeTokens ? '▼' : '▶'}</span>
                  </button>
                  {showMemeTokens && (
                    <div style={styles.popularList}>
                      {MEME_TOKENS.map(symbol => {
                        const token = DEFAULT_TOKENS[symbol];
                        if (!token) return null;
                        const logoURI = token.logoURI || tokenLogos[symbol];
                        return (
                          <button
                            key={symbol}
                            onClick={() => handleTokenSelect(token, showTokenSelect!)}
                            style={getStyle(styles.popularToken, mobileOverrides.popularToken)}
                          >
                            {logoURI && (
                              <img src={logoURI} alt={token.symbol} style={getStyle(styles.tokenLogo, mobileOverrides.tokenLogo)} />
                            )}
                            {token.symbol}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Popular Tokens */}
              {!tokenSearchQuery && (
                <div style={styles.popularTokens}>
                  <div style={styles.popularLabel}>Popular</div>
                  <div style={styles.popularList}>
                    {POPULAR_TOKENS.map(symbol => {
                      const token = DEFAULT_TOKENS[symbol];
                      const logoURI = token.logoURI || tokenLogos[symbol];
                      return (
                        <button
                          key={symbol}
                          onClick={() => handleTokenSelect(token, showTokenSelect!)}
                          style={getStyle(styles.popularToken, mobileOverrides.popularToken)}
                        >
                          {logoURI && (
                            <img src={logoURI} alt={token.symbol} style={getStyle(styles.tokenLogo, mobileOverrides.tokenLogo)} />
                          )}
                          {token.symbol}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Loading Custom Token */}
              {isLoadingCustomToken && (
                <div style={styles.customTokenLoading}>
                  <div style={styles.spinner}></div>
                  <span>Loading token info...</span>
                </div>
              )}

              {/* Custom Token Error */}
              {customTokenError && (
                <div style={styles.customTokenError}>
                  {customTokenError}
                </div>
              )}

              {/* Found Token - Import UI */}
              {foundToken && !showImportWarning && (
                <div style={styles.foundTokenCard}>
                  <div style={styles.foundTokenInfo}>
                    {foundToken.logoURI ? (
                      <img 
                        src={foundToken.logoURI} 
                        alt={foundToken.symbol}
                        style={styles.foundTokenLogo}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div style={styles.foundTokenLogoPlaceholder}>
                        {foundToken.symbol.charAt(0)}
                      </div>
                    )}
                    <div style={styles.foundTokenDetails}>
                      <div style={styles.foundTokenSymbol}>{foundToken.symbol}</div>
                      <div style={styles.foundTokenName}>{foundToken.name}</div>
                      <div style={styles.foundTokenAddress}>
                        {foundToken.address.slice(0, 6)}...{foundToken.address.slice(-4)}
                      </div>
                    </div>
                  </div>
                  <button 
                    style={styles.importButton}
                    onClick={handleImportToken}
                  >
                    Import
                  </button>
                </div>
              )}

              {/* Import Warning Modal */}
              {showImportWarning && foundToken && (
                <div style={styles.importWarning}>
                  <div style={styles.warningIcon}>⚠️</div>
                  <h3 style={styles.warningTitle}>Trade at your own risk!</h3>
                  <p style={styles.warningText}>
                    Anyone can create a token, including fake versions of existing tokens. 
                    This token isn't traded on leading U.S. centralized exchanges.
                  </p>
                  <div style={styles.warningTokenInfo}>
                    {foundToken.logoURI && (
                      <img 
                        src={foundToken.logoURI} 
                        alt={foundToken.symbol}
                        style={styles.warningTokenLogo}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div style={styles.warningTokenSymbol}>{foundToken.symbol}</div>
                      <div style={styles.warningTokenAddress}>
                        {foundToken.address}
                      </div>
                    </div>
                  </div>
                  <label style={styles.warningCheckbox}>
                    <input 
                      type="checkbox" 
                      checked={dontShowWarning}
                      onChange={(e) => setDontShowWarning(e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span>Don't show me this warning again</span>
                  </label>
                  <div style={styles.warningButtons}>
                    <button 
                      style={styles.cancelButton}
                      onClick={handleCancelImport}
                    >
                      Cancel
                    </button>
                    <button 
                      style={styles.continueButton}
                      onClick={handleImportToken}
                    >
                      I understand, import
                    </button>
                  </div>
                </div>
              )}

              {/* Combined Token List (Popular + Custom) */}
              {!tokenSearchQuery && (
                <div style={getStyle(styles.sectionTitle, mobileOverrides.sectionTitle)}>Tokens</div>
              )}
              
              {/* Token List */}
              <div style={styles.tokenList} className="token-list-scrollbar">
                {(tokenSearchQuery ? searchTokens(tokenSearchQuery) : Object.values(getAllTokens()))
                  .map((token) => {
                    const isCurrentToken = showTokenSelect === 'in' 
                      ? token.symbol === tokenIn.symbol 
                      : token.symbol === tokenOut.symbol;
                    
                    const isOtherToken = showTokenSelect === 'in'
                      ? token.symbol === tokenOut.symbol
                      : token.symbol === tokenIn.symbol;

                    if (isCurrentToken) return null;

                    // Check if it's a custom token (not in DEFAULT_TOKENS)
                    const isCustomToken = !DEFAULT_TOKENS[token.symbol];
                    
                    if (isCustomToken) {
                      const handleRemove = (e: React.MouseEvent) => {
                        e.stopPropagation(); // Prevent token selection when clicking remove
                        removeCustomToken(token.symbol);
                        setCustomTokens(prev => {
                          const updated = { ...prev };
                          delete updated[token.symbol];
                          return updated;
                        });
                      };

                      return (
                        <CustomTokenItemWithRemove
                          key={`custom-${token.symbol}`}
                          token={token}
                          isOtherToken={isOtherToken}
                          onSelect={() => handleTokenSelect(token, showTokenSelect!)}
                          onRemove={handleRemove}
                          ethPrice={ethPriceUsd}
                        />
                      );
                    }

                    return (
                      <TokenListItem
                        key={token.symbol}
                        token={token}
                        isDisabled={isOtherToken}
                        onClick={() => handleTokenSelect(token, showTokenSelect!)}
                        ethPrice={ethPriceUsd}
                        tokenLogos={tokenLogos}
                      />
                    );
                  })}

                {/* Import Token hint when searching with address */}
                {tokenSearchQuery && /^0x[a-fA-F0-9]{40}$/.test(tokenSearchQuery) && !isLoadingCustomToken && !customTokenError && (
                  <div style={styles.importTokenHint}>
                    <span>⏳ Searching for token...</span>
                  </div>
                )}

                {/* No results message */}
                {tokenSearchQuery && searchTokens(tokenSearchQuery).length === 0 && !/^0x[a-fA-F0-9]{40}$/.test(tokenSearchQuery) && (
                  <div style={styles.noResults}>
                    <span>No tokens found. Try pasting a token address.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#0f172a'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer'
  },
  logoImage: {
    width: '56px',
    height: '56px',
    objectFit: 'contain',
    backgroundColor: 'transparent',
    background: 'none',
    mixBlendMode: 'normal',
    // Blue theme filter to match site colors
    filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(200deg) brightness(98%) contrast(96%)',
    transition: 'filter 0.3s ease'
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.5px'
  },
  nav: {
    display: 'flex',
    gap: '8px'
  },
  navLink: {
    padding: '8px 16px',
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500',
    borderRadius: '12px',
    transition: 'all 0.2s',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit'
  },
  navLinkActive: {
    padding: '8px 16px',
    color: '#ffffff',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500',
    borderRadius: '12px',
    cursor: 'pointer'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  searchIcon: {
    fontSize: '14px',
    opacity: 0.5
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '14px',
    width: '180px'
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    padding: '20px 20px 24px'
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#0f172a'
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: '20px',
    padding: '12px',
    width: '100%',
    maxWidth: '420px',
    minHeight: 'auto',
    boxShadow: '0 4px 24px rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '8px'
  },
  tokenSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '4px',
    border: '1px solid rgba(59, 130, 246, 0.1)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  tokenLabel: {
    fontSize: '13px',
    color: '#9ca3af'
  },
  amountInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    fontSize: '36px',
    fontWeight: '500',
    color: '#ffffff',
    outline: 'none',
    padding: 0,
    marginBottom: '8px'
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tokenButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '20px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tokenButtonLogo: {
    width: '24px',
    height: '24px',
    borderRadius: '50%'
  },
  tokenSelectButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    border: 'none',
    borderRadius: '20px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
  },
  tokenIcon: {
    fontSize: '24px'
  },
  chevron: {
    fontSize: '12px',
    marginLeft: '4px'
  },
  usdValue: {
    fontSize: '14px',
    color: '#9ca3af'
  },
  balanceText: {
    fontSize: '14px',
    color: '#9ca3af'
  },
  percentageButtons: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px'
  },
  percentButton: {
    padding: '4px 10px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '6px',
    color: '#9ca3af',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  amountRow: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center'
  },
  loadingSpinner: {
    position: 'absolute' as const,
    left: '0',
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTop: '3px solid',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))'
  },
  switchContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '-8px 0',
    position: 'relative' as const,
    zIndex: 10
  },
  switchButton: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '3px solid rgba(30, 41, 59, 0.95)',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  swapButton: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: '600',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
  },
  infoBox: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.1)'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#9ca3af',
    marginBottom: '8px'
  },
  slippageControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  settingsButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px'
  },
  // Modern Slippage Modal Styles
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 999
  },
  slippageModal: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderRadius: '20px',
    padding: '24px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3)',
    zIndex: 1000,
    maxWidth: '500px',
    width: '90%'
  },
  statisticsModal: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderRadius: '24px',
    padding: '24px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.1)',
    zIndex: 1000,
    maxWidth: '1200px',
    width: '95%',
    maxHeight: '85vh',
    overflow: 'auto' as const,
    minWidth: '600px',
    animation: 'slideUp 0.2s ease-out',
    backdropFilter: 'blur(20px)',
    display: 'flex' as const,
    flexDirection: 'column' as const
  },
  slippageModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  slippageModalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff'
  },
  slippageCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '28px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    transition: 'color 0.2s'
  },
  slippageDescription: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '20px',
    lineHeight: 1.5
  },
  slippagePresets: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  slippagePresetBtn: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  slippageCustom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px'
  },
  slippageCustomLabel: {
    fontSize: '14px',
    color: '#9ca3af'
  },
  slippageInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '8px 12px'
  },
  slippageCustomInput: {
    width: '60px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '500',
    outline: 'none',
    textAlign: 'right' as const
  },
  slippagePercent: {
    color: '#9ca3af',
    fontSize: '14px',
    marginLeft: '4px'
  },
  slippageWarning: {
    padding: '12px',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: '10px',
    color: '#ff9800',
    fontSize: '12px',
    textAlign: 'center' as const,
    border: '1px solid rgba(255, 152, 0, 0.2)'
  },
  slippageButton: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  successMessage: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#0a4d2a',
    borderRadius: '12px',
    color: '#4ade80',
    textAlign: 'center',
    fontSize: '14px'
  },
  // Toast Overlay & Card (Modern Glassmorphism)
  toastOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '18vh',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease-out'
  },
  toastCard: {
    position: 'relative' as const,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: '20px',
    padding: '32px 40px',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
    animation: 'slideUp 0.3s ease-out',
    minWidth: '300px'
  },
  toastIconSuccess: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '32px',
    fontWeight: 'bold',
    boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)'
  },
  toastTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '-0.5px'
  },
  toastText: {
    fontSize: '14px',
    color: '#888888',
    maxWidth: '280px'
  },
  toastButton: {
    marginTop: '8px',
    padding: '14px 36px',
    background: 'linear-gradient(135deg, #ff1cf7, #00d4ff)',
    border: 'none',
    borderRadius: '14px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(255, 28, 247, 0.4)'
  },
  toastLink: {
    marginTop: '8px',
    padding: '12px 28px',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: '12px',
    color: '#22c55e',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    transition: 'all 0.2s'
  },
  toastCloseBtn: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    transition: 'color 0.2s',
    borderRadius: '8px'
  },
  errorMessage: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#4d0a0a',
    borderRadius: '12px',
    color: '#ff6b6b',
    textAlign: 'center',
    fontSize: '14px'
  },
  pendingMessage: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    color: '#ffa500',
    textAlign: 'center',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px'
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #333',
    borderTop: '2px solid #ffa500',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  txLinkBox: {
    marginTop: '12px',
    textAlign: 'center'
  },
  txLink: {
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'opacity 0.2s'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderRadius: '20px',
    padding: '16px',
    width: '420px',
    maxWidth: '95%',
    maxHeight: '90vh',
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexShrink: 0
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: '600',
    margin: 0
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '28px',
    fontWeight: '300',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    transition: 'all 0.2s',
    lineHeight: 1
  },
  modalSearchInput: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    marginBottom: '12px',
    flexShrink: 0
  },
  popularTokens: {
    marginBottom: '12px',
    flexShrink: 0
  },
  popularLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  popularList: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  popularToken: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tokenList: {
    overflowY: 'auto',
    overflowX: 'hidden',
    flex: 1,
    minHeight: '400px',
    maxHeight: '450px',
    paddingRight: '8px',
    // Custom scrollbar styles
    scrollbarWidth: 'thin' as const,
    scrollbarColor: 'rgba(148, 163, 184, 0.28) transparent'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#9ca3af',
    padding: '8px 8px 4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  tokenInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0
  },
  tokenLogo: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    flexShrink: 0
  },
  tokenDetails: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0
  },
  tokenSymbol: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff'
  },
  tokenName: {
    fontSize: '12px',
    color: '#9ca3af',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px'
  },
  tokenOption: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background 0.15s'
  },
  tokenBalance: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexShrink: 0
  },
  tokenBalanceAmount: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ffffff'
  },
  tokenBalanceUsd: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  customTokenLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    color: '#9ca3af',
    fontSize: '14px'
  },
  customTokenError: {
    padding: '12px 16px',
    margin: '8px',
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    borderRadius: '10px',
    color: '#ff6b6b',
    fontSize: '13px',
    textAlign: 'center' as const
  },
  importTokenHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    color: '#9ca3af',
    fontSize: '14px'
  },
  noResults: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    color: '#9ca3af',
    fontSize: '14px',
    textAlign: 'center' as const
  },
  // Found Token Card styles
  foundTokenCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    margin: '8px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  foundTokenInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  foundTokenLogo: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.15)'
  },
  foundTokenLogoPlaceholder: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  foundTokenDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px'
  },
  foundTokenSymbol: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff'
  },
  foundTokenName: {
    fontSize: '13px',
    color: '#9ca3af'
  },
  foundTokenAddress: {
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: 'monospace'
  },
  importButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
  },
  // Import Warning styles
  importWarning: {
    padding: '20px',
    margin: '8px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '16px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    textAlign: 'center' as const
  },
  warningIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  warningTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
    margin: '0 0 12px 0'
  },
  warningText: {
    fontSize: '14px',
    color: '#9ca3af',
    lineHeight: 1.5,
    marginBottom: '16px'
  },
  warningTokenInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    borderRadius: '10px',
    marginBottom: '16px',
    textAlign: 'left' as const
  },
  warningTokenLogo: {
    width: '36px',
    height: '36px',
    borderRadius: '50%'
  },
  warningTokenSymbol: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff'
  },
  warningTokenAddress: {
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const
  },
  warningCheckbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#9ca3af',
    cursor: 'pointer'
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  warningButtons: {
    display: 'flex',
    gap: '12px'
  },
  cancelButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  continueButton: {
    flex: 1,
    padding: '14px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
  },
  // No Liquidity Warning
  noLiquidityWarning: {
    marginTop: '12px',
    padding: '14px',
    backgroundColor: 'rgba(255, 77, 77, 0.15)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    borderRadius: '12px',
    color: '#ff6b6b',
    fontSize: '14px',
    textAlign: 'center' as const,
    fontWeight: '500'
  },
  // Protocol Badge
  protocolBadge: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '10px',
    color: '#9ca3af',
    fontSize: '13px',
    textAlign: 'center' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px'
  },
  routeQuotes: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    paddingBottom: '12px',
    marginBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  routePanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase' as const
  },
  bestRouteCard: {
    padding: '12px',
    borderRadius: '8px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(96, 165, 250, 0.28)'
  },
  bestRouteTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start'
  },
  bestRouteTitleBlock: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  bestRouteLabel: {
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: '700',
    lineHeight: '18px'
  },
  bestRoutePath: {
    color: '#94a3b8',
    fontSize: '12px',
    lineHeight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '320px'
  },
  bestRouteOutputBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '3px',
    flexShrink: 0
  },
  bestRouteOutput: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '800',
    lineHeight: '18px',
    whiteSpace: 'nowrap' as const
  },
  bestRouteMeta: {
    color: '#7f8797',
    fontSize: '11px',
    fontWeight: '600'
  },
  routeAllocationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
    gap: '6px',
    marginTop: '10px'
  },
  routeAllocationItem: {
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr)',
    gridTemplateRows: 'auto auto',
    columnGap: '8px',
    rowGap: '2px',
    alignItems: 'center',
    padding: '7px 8px',
    borderRadius: '8px',
    background: 'rgba(15, 23, 42, 0.42)',
    border: '1px solid rgba(148, 163, 184, 0.12)'
  },
  routeSharePill: {
    gridRow: '1 / span 2',
    padding: '3px 6px',
    borderRadius: '999px',
    background: 'rgba(34, 197, 94, 0.16)',
    color: '#4ade80',
    fontSize: '11px',
    fontWeight: '800',
    textAlign: 'center' as const
  },
  routeAllocationDex: {
    color: '#e5e7eb',
    fontSize: '12px',
    fontWeight: '700',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  routeAllocationOut: {
    color: '#94a3b8',
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  routeChipRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
    marginTop: '10px'
  },
  routeChip: {
    padding: '4px 8px',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: '700'
  },
  routeQuotesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#7f8797',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: 0,
    textTransform: 'uppercase' as const
  },
  routeQuoteRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    minHeight: '30px',
    padding: '6px 8px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.045)',
    color: '#cbd5e1',
    fontSize: '12px'
  },
  routeQuoteRowBest: {
    background: 'rgba(59,130,246,0.08)',
    border: '1px solid rgba(96,165,250,0.2)'
  },
  splitRouteRow: {
    flexWrap: 'wrap' as const,
    alignItems: 'flex-start',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(74,222,128,0.24)'
  },
  routeQuoteDex: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    whiteSpace: 'nowrap' as const
  },
  routeDexName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '190px'
  },
  routeHopBadge: {
    padding: '2px 6px',
    borderRadius: '999px',
    background: 'rgba(148, 163, 184, 0.1)',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: '800',
    flexShrink: 0
  },
  routeBestBadge: {
    padding: '2px 5px',
    borderRadius: '999px',
    background: 'rgba(74,222,128,0.16)',
    color: '#4ade80',
    fontSize: '10px',
    fontWeight: '700'
  },
  routeQuoteAmount: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    minWidth: 0,
    textAlign: 'right' as const,
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: '12px',
    whiteSpace: 'nowrap' as const
  },
  routeDelta: {
    color: '#f59e0b',
    fontSize: '10px',
    fontWeight: '700'
  },
  routeMoreNote: {
    color: '#7f8797',
    fontSize: '11px',
    lineHeight: '16px',
    textAlign: 'center' as const,
    padding: '2px 0'
  },
  splitRouteParts: {
    flexBasis: '100%',
    color: '#9ca3af',
    fontSize: '11px',
    lineHeight: '16px'
  },
  protocolOptions: {
    color: '#9ca3af'
  },
  switchProtocolBtn: {
    background: 'none',
    border: 'none',
    backgroundImage: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline'
  }
};
