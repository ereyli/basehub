import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { base } from 'wagmi/chains';
import { DEFAULT_TOKENS, POPULAR_TOKENS, MEME_TOKENS, FEE_TIERS, searchTokens, getAllTokens, saveCustomToken, removeCustomToken, getTokenByAddress, BASE_CHAIN_ID, type AppToken } from '../config/tokens';
import { Token } from '@uniswap/sdk-core';
import StatsPanel from './StatsPanel';
import swaphubLogo from '../assets/swaphub-logo.png';
import { addXP, recordSwapTransaction } from '../utils/xpUtils';

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
  if (value < 0.0001) return value.toExponential(2);
  
  // For values >= 1, use max 2 decimals
  if (value >= 1) {
    const formatted = value.toFixed(2);
    // Remove trailing zeros
    return parseFloat(formatted).toString();
  }
  
  // For values < 1, find first significant digit and limit decimals
  // Start with maxDecimals, but remove trailing zeros
  let formatted = value.toFixed(maxDecimals);
  // Remove trailing zeros
  formatted = parseFloat(formatted).toString();
  
  // If still has too many decimals, limit to reasonable amount
  const parts = formatted.split('.');
  if (parts[1] && parts[1].length > 4) {
    // Find first non-zero decimal position
    const str = value.toString();
    const dotIndex = str.indexOf('.');
    if (dotIndex !== -1) {
      const decimals = str.substring(dotIndex + 1);
      let firstNonZero = -1;
      for (let i = 0; i < decimals.length; i++) {
        if (decimals[i] !== '0') {
          firstNonZero = i;
          break;
        }
      }
      // Show first non-zero + 3 more decimals, max 4 total
      const decimalsToShow = Math.min(firstNonZero + 3, 4);
      formatted = value.toFixed(decimalsToShow);
      formatted = parseFloat(formatted).toString();
    }
  }
  
  return formatted;
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
    chainId: base.id
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
    chainId: base.id
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

// OUR SWAP AGGREGATOR V2 (Native ETH Support + Output-Fee Model + Deadline Protection)
const SWAP_AGGREGATOR = '0xbf579e68ba69de03ccec14476eb8d765ec558257';

// Aggregator V2 ABI - supports native ETH (address(0))
// Both swapV3 and swapV2 now have deadline parameter for MEV protection
const AGGREGATOR_ABI = [
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'poolFee', type: 'uint24' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapV3',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapV2',
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
  },
  {
    inputs: [{ name: 'outputAmount', type: 'uint256' }],
    name: 'calculateFee',
    outputs: [
      { name: 'feeAmount', type: 'uint256' },
      { name: 'userAmount', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

// Zero address represents native ETH in our aggregator
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


// Protocol type for swap routing
type SwapProtocol = 'v3' | 'v2';

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
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient();

  // ETH price state - updated from CoinGecko API
  const [ethPriceUsd, setEthPriceUsd] = useState<number>(2950);

  // Mobile responsive hook
  const [isMobile, setIsMobile] = useState(false);

  // Token and amount states - must be defined before useEffect hooks that use them
  const [tokenIn, setTokenIn] = useState<AppToken>(DEFAULT_TOKENS.ETH);
  const [tokenOut, setTokenOut] = useState<AppToken>(DEFAULT_TOKENS.USDC);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('0');

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

  // Award XP on successful swap
  useEffect(() => {
    if (isSuccess && address && hash && amountIn && tokenIn) {
      try {
        // Calculate swap amount in USD
        let swapAmountUSD = 0;
        const amountInNum = parseFloat(amountIn);
        
        if (!isNaN(amountInNum) && amountInNum > 0) {
          if (tokenIn.isNative || tokenIn.symbol === 'ETH' || tokenIn.symbol === 'WETH') {
            // ETH/WETH: amount * ETH price
            swapAmountUSD = amountInNum * ethPriceUsd;
          } else if (tokenIn.symbol === 'USDC' || tokenIn.symbol === 'USDT' || tokenIn.symbol === 'USDbC' || tokenIn.symbol === 'DAI') {
            // Stablecoins: amount is already in USD (for 18 decimals, divide by 1e12 for USDC/USDT with 6 decimals)
            if (tokenIn.decimals === 6) {
              swapAmountUSD = amountInNum;
            } else {
              swapAmountUSD = amountInNum;
            }
          } else {
            // Other tokens: use amountOut in USD if available (USDC/USDT), otherwise estimate with ETH price
            const amountOutNum = parseFloat(amountOut);
            if (!isNaN(amountOutNum) && amountOutNum > 0 && (tokenOut.symbol === 'USDC' || tokenOut.symbol === 'USDT' || tokenOut.symbol === 'USDbC')) {
              swapAmountUSD = amountOutNum;
            } else {
              // Fallback: estimate with ETH price (assume similar value to ETH)
              swapAmountUSD = amountInNum * ethPriceUsd;
            }
          }
        }

        console.log('🎉 Swap successful! Awarding 250 XP...');
        console.log('💵 Swap amount USD:', swapAmountUSD.toFixed(2));
        
        // Award base XP
        addXP(address, 250, 'SWAP')
          .then(() => {
            console.log('✅ XP awarded successfully for swap');
            
            // Record swap transaction with volume tracking
            recordSwapTransaction(address, swapAmountUSD, hash, 250)
              .then(() => {
                console.log('✅ Swap transaction recorded with volume tracking');
              })
              .catch(error => {
                console.error('❌ Error recording swap transaction:', error);
              });
          })
          .catch(error => {
            console.error('❌ Error awarding XP:', error);
          });
      } catch (error) {
        console.error('❌ Error in swap success handler:', error);
      }
    }
  }, [isSuccess, address, hash, amountIn, tokenIn, amountOut, tokenOut, ethPriceUsd]);
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
  const [selectedProtocol, setSelectedProtocol] = useState<SwapProtocol>('v3');
  const [v2Available, setV2Available] = useState(false);
  const [v3Available, setV3Available] = useState(false);
  const [noLiquidityError, setNoLiquidityError] = useState(false);
  const [dontShowWarning, setDontShowWarning] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'idle' | 'approving' | 'approved' | 'swapping' | 'success'>('idle');
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  const [showMemeTokens, setShowMemeTokens] = useState(false);


  // Get balance for tokenIn (native ETH or ERC20 token)
  const { data: displayBalance } = useBalance({
    address: address,
    token: tokenIn.isNative ? undefined : (tokenIn.address as `0x${string}`),
    chainId: base.id
  });

  // Get balance for tokenOut
  const { data: tokenOutBalance } = useBalance({
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
    if (!publicClient) return;
    
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
        publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name'
        }),
        publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }),
        publicClient.readContract({
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

  // Helper function for retry logic with exponential backoff
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    delay: number = 300
  ): Promise<T | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          console.warn(`⚠️ Failed after ${maxRetries + 1} attempts:`, error);
          return null;
        }
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries}...`);
      }
    }
    return null;
  };

  // Fetch quote from both Uniswap V3 and V2, use best available
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amountIn || parseFloat(amountIn) <= 0) {
        setAmountOut('0');
        setPriceImpact('0');
        setNoLiquidityError(false);
        return;
      }

      // Special case: Wrap/Unwrap (1:1 conversion, no swap needed)
      if (isWrapOperation) {
        console.log('🔄 Wrap/Unwrap operation detected (1:1 rate)');
        setAmountOut(amountIn); // 1:1 conversion
        setPriceImpact('0');
        setNoLiquidityError(false);
        setIsLoadingQuote(false);
        setSelectedProtocol('v3'); // Use v3 for display purposes
        setV3Available(true);
        setV2Available(false);
        return;
      }

      if (!publicClient) {
        console.log('⚠️ publicClient is undefined');
        return;
      }

      setIsLoadingQuote(true);
      setNoLiquidityError(false);
      console.log('🔄 Fetching quotes from Uniswap V3 and V2...');
      console.log('   Input:', amountIn, tokenIn.symbol);
      console.log('   Output token:', tokenOut.symbol);
      
      const amountInWei = parseUnits(amountIn, tokenIn.decimals);
      const tokenInAddr = tokenIn.isNative ? WETH_ADDRESS : tokenIn.address;
      const tokenOutAddr = tokenOut.isNative ? WETH_ADDRESS : tokenOut.address;
      
      let v3Quote: bigint | null = null;
      let v2Quote: bigint | null = null;
      let bestProtocol: SwapProtocol = 'v3';
      let bestQuote: bigint = BigInt(0);
      
      // Try V3 quote with retry and all fee tiers
      try {
        console.log('🔷 Trying Uniswap V3...');
        
        // Try all fee tiers, not just selectedFeeTier
        const feeTiersToTry = [FEE_TIERS.LOW, FEE_TIERS.MEDIUM, FEE_TIERS.HIGH];
        let bestV3Quote: bigint | null = null;
        let bestV3Fee = selectedFeeTier;
        
        for (const feeTier of feeTiersToTry) {
          const quote = await retryWithBackoff(async () => {
            const { result } = await publicClient.simulateContract({
              address: QUOTER_V2_ADDRESS as `0x${string}`,
              abi: QUOTER_ABI,
              functionName: 'quoteExactInputSingle',
              args: [{
                tokenIn: tokenInAddr as `0x${string}`,
                tokenOut: tokenOutAddr as `0x${string}`,
                amountIn: amountInWei,
                fee: feeTier,
                sqrtPriceLimitX96: BigInt(0)
              }]
            });
            return result[0] as bigint;
          });
          
          if (quote && (!bestV3Quote || quote > bestV3Quote)) {
            bestV3Quote = quote;
            bestV3Fee = feeTier;
          }
        }
        
        if (bestV3Quote) {
          v3Quote = bestV3Quote;
          console.log('✅ V3 Quote:', formatUnits(v3Quote, tokenOut.decimals), tokenOut.symbol, `(${bestV3Fee/10000}% fee)`);
          setV3Available(true);
          setSelectedFeeTier(bestV3Fee);
        } else {
          console.log('❌ V3 pool not found across all fee tiers');
          setV3Available(false);
        }
      } catch (error) {
        console.log('❌ V3 pool not found or error:', error);
        setV3Available(false);
      }

      // Try V2 quote (V2 doesn't have fee tiers, just one pool per pair)
      // Also try multi-hop routes via USDC for better liquidity
      try {
        console.log('🔶 Checking Uniswap V2...');
        
        // First check if V2 pair exists (direct route) with retry
        const pairAddress = await retryWithBackoff(async () => {
          return await publicClient.readContract({
            address: UNISWAP_V2_FACTORY as `0x${string}`,
            abi: V2_FACTORY_ABI,
            functionName: 'getPair',
            args: [tokenInAddr as `0x${string}`, tokenOutAddr as `0x${string}`]
          });
        });

        if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
          // Get V2 quote (direct route) with retry
          const amounts = await retryWithBackoff(async () => {
            return await publicClient.readContract({
              address: UNISWAP_V2_ROUTER as `0x${string}`,
              abi: V2_ROUTER_ABI,
              functionName: 'getAmountsOut',
              args: [amountInWei, [tokenInAddr as `0x${string}`, tokenOutAddr as `0x${string}`]]
            });
          });
          
          if (amounts) {
            v2Quote = (amounts as bigint[])[1];
            console.log('✅ V2 Quote (direct):', formatUnits(v2Quote, tokenOut.decimals), tokenOut.symbol);
            setV2Available(true);
          }
        } else {
          console.log('❌ V2 direct pair does not exist');
        }
        
        // Try multi-hop route via USDC ONLY if direct route doesn't exist
        // NOTE: Aggregator only supports direct routes, so multi-hop is only for quote comparison
        // CRITICAL: For ETH/USDC swaps, NEVER use multi-hop - always use direct route
        const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        
        // Check if this is ETH/USDC swap (both directions)
        const isETHUSDC_V2 = (
          (tokenIn.symbol === 'ETH' || tokenIn.symbol === 'WETH' || tokenIn.isNative) &&
          (tokenOut.symbol === 'USDC' || tokenOut.symbol === 'USDT')
        ) || (
          (tokenIn.symbol === 'USDC' || tokenIn.symbol === 'USDT') &&
          (tokenOut.symbol === 'ETH' || tokenOut.symbol === 'WETH' || tokenOut.isNative)
        );
        
        // Check if this is stablecoin-to-stablecoin swap
        const isStablecoinToStablecoin_V2 = (
          (tokenIn.symbol === 'USDC' || tokenIn.symbol === 'USDT' || tokenIn.symbol === 'DAI') &&
          (tokenOut.symbol === 'USDC' || tokenOut.symbol === 'USDT' || tokenOut.symbol === 'DAI')
        );
        
        // NEVER try multi-hop for ETH/USDC or stablecoin swaps
        // Only try multi-hop if direct route doesn't exist AND it's not ETH/USDC/stablecoin swap
        if (v2Quote === null && 
            !isETHUSDC_V2 && 
            !isStablecoinToStablecoin_V2 &&
            tokenInAddr.toLowerCase() !== USDC_ADDRESS.toLowerCase() && 
            tokenOutAddr.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
          try {
            console.log('🔄 Trying V2 multi-hop via USDC (direct route not available)...');
            const multiHopAmounts = await publicClient.readContract({
              address: UNISWAP_V2_ROUTER as `0x${string}`,
              abi: V2_ROUTER_ABI,
              functionName: 'getAmountsOut',
              args: [amountInWei, [
                tokenInAddr as `0x${string}`, 
                USDC_ADDRESS as `0x${string}`,
                tokenOutAddr as `0x${string}`
              ]]
            });
            
            const multiHopQuote = (multiHopAmounts as bigint[])[2];
            console.log('✅ V2 Quote (via USDC):', formatUnits(multiHopQuote, tokenOut.decimals), tokenOut.symbol);
            console.log('⚠️ Note: Aggregator only supports direct routes, multi-hop quote shown for reference only');
            // Don't use multi-hop quote - aggregator can't execute it
            // Keep v2Quote as null so V3 will be used instead
            setV2Available(false);
          } catch (error) {
            console.log('❌ V2 multi-hop route not available');
          }
        }
        
        if (v2Quote === null) {
          setV2Available(false);
        }
      } catch (error) {
        console.log('❌ V2 pool not found or error');
        setV2Available(false);
      }

      // Determine best quote
      if (v3Quote !== null && v2Quote !== null) {
        if (v2Quote > v3Quote) {
          bestQuote = v2Quote;
          bestProtocol = 'v2';
          console.log('🏆 Best: V2 (better rate)');
        } else {
          bestQuote = v3Quote;
          bestProtocol = 'v3';
          console.log('🏆 Best: V3 (better rate)');
        }
      } else if (v3Quote !== null) {
        bestQuote = v3Quote;
        bestProtocol = 'v3';
        console.log('🏆 Using V3 (only available)');
      } else if (v2Quote !== null) {
        bestQuote = v2Quote;
        bestProtocol = 'v2';
        console.log('🏆 Using V2 (only available)');
      } else {
        console.log('❌ No liquidity in V3 or V2');
        setAmountOut('0');
        setPriceImpact('0');
        setNoLiquidityError(true);
        setIsLoadingQuote(false);
        return;
      }

      setSelectedProtocol(bestProtocol);
      
      // Apply protocol fee to the output (output-fee model)
      // Fee is deducted from the output amount
      // Use BigInt arithmetic to avoid precision loss
      const feeBps = protocolFeeBps ? Number(protocolFeeBps) : 0;
      const feeBpsBigInt = BigInt(feeBps);
      const feeMultiplier = BigInt(10000) - feeBpsBigInt; // e.g., 10000 - 100 = 9900
      const userReceivesWei = (bestQuote * feeMultiplier) / BigInt(10000);
      const feeAmountWei = bestQuote - userReceivesWei;
      
      const formatted = formatUnits(userReceivesWei, tokenOut.decimals);
      const feeFormatted = formatUnits(feeAmountWei, tokenOut.decimals);
      console.log('💵 Raw output:', formatUnits(bestQuote, tokenOut.decimals), tokenOut.symbol);
      console.log('💰 Protocol fee:', feeFormatted, tokenOut.symbol, `(${feeBps / 100}% = ${feeBps} bps)`);
      console.log('✨ User receives:', formatted, tokenOut.symbol, `via ${bestProtocol.toUpperCase()}`);
      
      // Calculate price impact based on USD value difference
      // Price impact = (Expected USD - Actual USD) / Expected USD * 100
      const inputUsdStr = calculateUsdValue(amountIn, tokenIn, formatted, tokenOut, ethPriceUsd);
      const outputUsdStr = calculateUsdValue(formatted, tokenOut, amountIn, tokenIn, ethPriceUsd);
      
      // Extract numeric values from USD strings (e.g., "$25.37" -> 25.37)
      const inputUsd = inputUsdStr && inputUsdStr !== '-' ? parseFloat(inputUsdStr.replace('$', '').replace(',', '')) : 0;
      const outputUsd = outputUsdStr && outputUsdStr !== '-' ? parseFloat(outputUsdStr.replace('$', '').replace(',', '')) : 0;
      
      let calculatedImpact = 0;
      if (inputUsd > 0 && outputUsd > 0) {
        // Price impact = (input USD - output USD) / input USD * 100
        calculatedImpact = Math.abs((inputUsd - outputUsd) / inputUsd * 100);
        
        // For very small differences (< 0.01%), show 0.01% to indicate minimal impact
        if (calculatedImpact < 0.01) {
          calculatedImpact = 0.01;
        }
      } else {
        // If we can't calculate USD values, estimate based on protocol
        // V3 typically has lower price impact for normal trades
        calculatedImpact = bestProtocol === 'v3' ? 0.1 : 0.5;
      }
      
      setPriceImpact(calculatedImpact.toFixed(2));
      
      // Store the full precision value in amountOut for accurate calculations
      // formatNumber is only for display, not for storage
      setAmountOut(formatted);
      setIsLoadingQuote(false);
    };

    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [amountIn, tokenIn, tokenOut, selectedFeeTier, publicClient]);

  // Reset swap state when tokens change
  const resetSwapState = () => {
    setTransactionStep('idle');
    setNeedsApproval(true); // Will be recalculated by useEffect
    setErrorMessage(null);
    setAmountOut('0');
    // Refetch allowance for the new tokenIn
    setTimeout(() => refetchAllowance(), 100);
  };

  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn('');
    resetSwapState();
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
      writeContract({
        address: tokenIn.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_AGGREGATOR, maxUint256], // Unlimited approval
        chainId: base.id
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
          // ETH → WETH: Call deposit() with ETH value
          writeContract({
            address: WETH_ADDRESS as `0x${string}`,
            abi: WETH_ABI,
            functionName: 'deposit',
            args: [],
            value: amountInWei,
            chainId: base.id
          });
        } else {
          // WETH → ETH: Call withdraw() with amount
          writeContract({
            address: WETH_ADDRESS as `0x${string}`,
            abi: WETH_ABI,
            functionName: 'withdraw',
            args: [amountInWei],
            chainId: base.id
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
    // NORMAL SWAP via AGGREGATOR V2
    // ═══════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 SWAP via AGGREGATOR V2 (Native ETH Support!)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      let amountOutWei: bigint;
      try {
        amountOutWei = parseUnits(amountOutNormalized, tokenOut.decimals);
        // Check if output amount is too small
        if (amountOutWei === BigInt(0)) {
          setErrorMessage('Output amount is too small');
          setTransactionStep('idle');
          return;
        }
      } catch (error: any) {
        console.error('❌ Failed to parse amountOut:', error);
        setErrorMessage(`Invalid output amount: ${error.message || 'Number format error'}`);
        setTransactionStep('idle');
        return;
      }
      
      // Apply slippage to get minAmountOut
      // Use BigInt arithmetic to avoid precision loss for small amounts
      // slippage is in percentage (e.g., 0.5 means 0.5%)
      // multiplier = (10000 - slippage * 100) / 10000 (to avoid floating point issues)
      const slippageBps = BigInt(Math.round(slippage * 100)); // Convert to basis points (0.5% = 50 bps)
      const slippageMultiplier = BigInt(10000) - slippageBps; // e.g., 10000 - 50 = 9950
      const minAmountOut = (amountOutWei * slippageMultiplier) / BigInt(10000);
      
      console.log('🔢 Min Amount Out Calculation:');
      console.log('   amountOutWei:', amountOutWei.toString());
      console.log('   slippageBps:', slippageBps.toString());
      console.log('   slippageMultiplier:', slippageMultiplier.toString());
      console.log('   minAmountOut (before check):', minAmountOut.toString());
      
      // Ensure minimum output is reasonable
      // minAmountOut should never be less than the slippage-adjusted amount
      // If minAmountOut is somehow less than slippage tolerance allows, use minAmountOut directly
      // (This should not happen with correct slippage calculation, but acts as a safety check)
      // For very small amounts, ensure at least 1 wei minimum
      const minUnit = BigInt(1);
      const finalMinAmountOut = minAmountOut > minUnit ? minAmountOut : minUnit;
      
      console.log('   finalMinAmountOut:', finalMinAmountOut.toString());
      console.log('   finalMinAmountOut (formatted):', formatUnits(finalMinAmountOut, tokenOut.decimals));
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      // Native ETH uses address(0) in our aggregator
      const inputIsNativeETH = tokenIn.isNative === true;
      const outputIsNativeETH = tokenOut.isNative === true;
      
      // For aggregator: address(0) = native ETH, otherwise use token address
      const tokenInAddr = inputIsNativeETH ? ZERO_ADDRESS : tokenIn.address;
      const tokenOutAddr = outputIsNativeETH ? ZERO_ADDRESS : tokenOut.address;

      console.log('📋 Aggregator V2 Swap Parameters:');
      console.log('   Aggregator Contract:', SWAP_AGGREGATOR);
      console.log('   Protocol:', selectedProtocol.toUpperCase());
      console.log('   User Address:', address);
      console.log('   Token In:', tokenIn.symbol, inputIsNativeETH ? '(Native ETH → 0x0)' : `→ ${tokenInAddr}`);
      console.log('   Token Out:', tokenOut.symbol, outputIsNativeETH ? '(Native ETH → 0x0)' : `→ ${tokenOutAddr}`);
      console.log('   Amount In (wei):', amountInWei.toString());
      console.log('   Min Amount Out (wei):', finalMinAmountOut.toString());
      console.log('   Slippage:', slippage, '%');
      console.log('   Protocol Fee:', protocolFeeBps ? `${Number(protocolFeeBps) / 100}%` : 'Loading...');
      console.log('   Input is Native ETH:', inputIsNativeETH);
      console.log('   Output is Native ETH:', outputIsNativeETH);
      if (selectedProtocol === 'v3') {
        console.log('   Fee Tier:', selectedFeeTier, `(${selectedFeeTier / 10000}%)`);
      }

      // ═══════════════════════════════════════════════════════════════
      // ALL SWAPS GO THROUGH AGGREGATOR V2 (Including Native ETH!)
      // ═══════════════════════════════════════════════════════════════
      
      let txConfig: any;

      if (selectedProtocol === 'v2') {
        // V2 Swap via Aggregator
        console.log('🔶 Using Aggregator swapV2');
        txConfig = {
          address: SWAP_AGGREGATOR as `0x${string}`,
          abi: AGGREGATOR_ABI,
          functionName: 'swapV2',
          args: [
            tokenInAddr,    // tokenIn (address(0) for ETH)
            tokenOutAddr,   // tokenOut (address(0) for ETH)
            amountInWei,    // amountIn
            finalMinAmountOut,   // amountOutMinimum
            deadline        // deadline
          ],
          chainId: base.id,
          gas: BigInt(450000)
        };
      } else {
        // V3 Swap via Aggregator (now has deadline for MEV protection)
        console.log('🔷 Using Aggregator swapV3');
        txConfig = {
          address: SWAP_AGGREGATOR as `0x${string}`,
          abi: AGGREGATOR_ABI,
          functionName: 'swapV3',
          args: [
            tokenInAddr,      // tokenIn (address(0) for ETH)
            tokenOutAddr,     // tokenOut (address(0) for ETH)
            selectedFeeTier,  // poolFee
            amountInWei,      // amountIn
            finalMinAmountOut,     // amountOutMinimum
            deadline          // deadline (20 minutes)
          ],
          chainId: base.id,
          gas: BigInt(450000)
        };
      }

      // Add msg.value for native ETH input
      if (inputIsNativeETH) {
        txConfig.value = amountInWei;
        console.log('💰 Adding msg.value for native ETH:', amountInWei.toString());
      }

      console.log('📤 Sending swap via Aggregator V2...');
      console.log('   Function:', txConfig.functionName);
      console.log('   Args:', txConfig.args.map((a: any) => a.toString()));
      console.log('   Value:', txConfig.value?.toString() || '0');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      writeContract({
        address: txConfig.address,
        abi: txConfig.abi,
        functionName: txConfig.functionName,
        args: txConfig.args,
        value: txConfig.value,
        gas: txConfig.gas,
        chainId: txConfig.chainId
      });
      
      console.log('✅ Aggregator swap request sent to wallet!');

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

      if (error.code === 4001) {
        setErrorMessage('Transaction rejected');
      } else if (error.message?.includes('insufficient funds')) {
        setErrorMessage('Insufficient balance');
      } else if (error.message?.includes('nonce')) {
        setErrorMessage('Nonce error - Please try again');
      } else if (error.message?.includes('network')) {
        setErrorMessage('Network error - Check RPC connection');
      } else {
        setErrorMessage(`Transaction failed: ${error.shortMessage || error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle transaction success - differentiate between approval and swap
  useEffect(() => {
    if (isSuccess && hash && !isConfirming) {
      refetchAllowance();
      setErrorMessage(null);
      
      if (transactionStep === 'approving') {
        // Approval was successful - show approval success and trigger swap
        console.log('✅ Approval confirmed! Ready for swap...');
        setTransactionStep('approved');
        setApprovalSuccess(true);
        setNeedsApproval(false);
        
        // Auto-trigger swap after 1.5 seconds
        const swapTimer = setTimeout(() => {
          setApprovalSuccess(false);
          setTransactionStep('swapping');
          // Will be triggered by user clicking swap button in the UI
        }, 1500);
        return () => clearTimeout(swapTimer);
      } else if (transactionStep === 'swapping') {
        // Swap was successful
        console.log('✅ Swap confirmed!');
        setTransactionStep('success');
        
        // Clear after 3 seconds
        const timer = setTimeout(() => {
          setAmountIn('');
          setAmountOut('0');
          setTransactionStep('idle');
        }, 3000);
        return () => clearTimeout(timer);
      }
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
      width: '28px',
      height: '28px'
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

  return (
    <div style={styles.pageContainer}>
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
              {tokenIn.logoURI && <img src={tokenIn.logoURI} alt={tokenIn.symbol} style={getStyle(styles.tokenButtonLogo, mobileOverrides.tokenButtonLogo)} />}
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
                    const calculatedAmount = maxAmount * percent / 100;
                    
                    // Convert to string with proper precision (avoid scientific notation)
                    // Use enough decimals to preserve precision
                    const decimals = displayBalance.decimals || 18;
                    const precision = Math.max(decimals, 20);
                    let newAmount: string;
                    
                    if (calculatedAmount === 0) {
                      newAmount = '0';
                    } else if (calculatedAmount < 0.0001) {
                      // For very small numbers, use toFixed with enough precision
                      // Don't use parseFloat().toString() as it converts back to scientific notation
                      newAmount = calculatedAmount.toFixed(precision);
                      // Remove trailing zeros manually (don't use parseFloat)
                      newAmount = newAmount.replace(/\.?0+$/, '');
                    } else {
                      // For normal numbers, use formatNumber for display
                      newAmount = formatNumber(calculatedAmount);
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
              {tokenOut.logoURI && <img src={tokenOut.logoURI} alt={tokenOut.symbol} style={getStyle(styles.tokenButtonLogo, mobileOverrides.tokenButtonLogo)} />}
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
          disabled={!amountIn || parseFloat(amountOut) === 0 || isPending || isConfirming || noLiquidityError || transactionStep === 'success'}
          style={{
            ...getStyle(styles.swapButton, mobileOverrides.swapButton),
            opacity: (!amountIn || parseFloat(amountOut) === 0 || isPending || isConfirming || noLiquidityError) ? 0.5 : 1,
            cursor: (!amountIn || parseFloat(amountOut) === 0 || isPending || isConfirming || noLiquidityError) ? 'not-allowed' : 'pointer'
          }}
        >
          {isPending 
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
          <div style={styles.noLiquidityWarning}>
            ⚠️ No liquidity pool found for this pair
          </div>
        )}

        {/* Protocol Badge */}
        {parseFloat(amountOut) > 0 && !noLiquidityError && (
          <div style={styles.protocolBadge}>
            via Uniswap {selectedProtocol.toUpperCase()}
            {v3Available && v2Available && (
              <span style={styles.protocolOptions}>
                {' '}• 
                <button 
                  onClick={() => setSelectedProtocol(selectedProtocol === 'v3' ? 'v2' : 'v3')}
                  style={styles.switchProtocolBtn}
                >
                  Switch to {selectedProtocol === 'v3' ? 'V2' : 'V3'}
                </button>
              </span>
            )}
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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'white',
                textAlign: 'center' as const
              }}>
                🎉 +250 XP Earned!
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

        {errorMessage && (
          <div style={styles.errorMessage}>
            ⚠️ {errorMessage}
            </div>
        )}

        {/* Info */}
        {amountOut !== '0' && !isPending && !isConfirming && (
          <div style={styles.infoBox}>
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
            {typeof protocolFeeBps === 'bigint' && Number(protocolFeeBps) > 0 && (
              <div style={getStyle(styles.infoRow, mobileOverrides.infoRow)}>
                <span>Protocol Fee:</span>
                <span style={{ color: '#666' }}>{Number(protocolFeeBps) / 100}%</span>
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
    padding: '20px 20px 40px'
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
    minHeight: '650px',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: '6px',
    padding: '6px 10px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '16px',
    color: '#ffffff',
    fontSize: '13px',
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
    scrollbarColor: 'rgba(59, 130, 246, 0.3) rgba(30, 41, 59, 0.1)'
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
    width: '36px',
    height: '36px',
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
