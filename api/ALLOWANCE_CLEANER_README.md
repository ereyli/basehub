# Allowance Cleaner API

A powerful API endpoint that scans blockchain wallets for risky token approvals across multiple chains. Inspired by RevokeCash's architecture and best practices.

## Features

- ✅ Multi-chain support (Base, Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche)
- ✅ Comprehensive token scanning (ERC20, ERC721, ERC1155)
- ✅ Full history scanning via Etherscan API + RPC fallback
- ✅ Risk analysis (high/medium/low based on allowance vs balance)
- ✅ Unlimited approval detection
- ✅ Rate limiting and retry logic
- ✅ Detailed logging and error handling

## API Endpoint

**URL**: `/api/x402-allowance-cleaner`

**Method**: `POST`

**Request Body**:
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "network": "base"
}
```

**Response**:
```json
{
  "success": true,
  "network": {
    "name": "Base Mainnet",
    "chainId": 8453,
    "slug": "base"
  },
  "allowances": [
    {
      "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "tokenSymbol": "USDC",
      "tokenName": "USD Coin",
      "tokenType": "ERC20",
      "decimals": 6,
      "spenderAddress": "0x...",
      "spenderName": null,
      "amount": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "amountFormatted": "Unlimited",
      "balance": "1000000000",
      "balanceFormatted": "1000.0",
      "isUnlimited": true,
      "riskLevel": "high",
      "reason": "Unlimited allowance"
    }
  ],
  "stats": {
    "totalFound": 15,
    "highRisk": 5,
    "mediumRisk": 3,
    "lowRisk": 7,
    "unlimitedApprovals": 5
  },
  "scannedAt": "2025-12-28T10:30:00.000Z",
  "scanDuration": "8.45s"
}
```

## Supported Networks

| Network | Chain ID | Slug |
|---------|----------|------|
| Base Mainnet | 8453 | `base` |
| Ethereum Mainnet | 1 | `ethereum` |
| Polygon | 137 | `polygon` |
| Arbitrum One | 42161 | `arbitrum` |
| Optimism | 10 | `optimism` |
| BNB Chain | 56 | `bsc` |
| Avalanche | 43114 | `avalanche` |

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Required for RPC access (Ethereum, Base, Polygon, Arbitrum, Optimism)
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Required for blockchain data fetching
BASESCAN_API_KEY=your_basescan_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional (will fallback to ETHERSCAN_API_KEY if not provided)
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
OPTIMISTIC_ETHERSCAN_API_KEY=your_optimistic_etherscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
SNOWTRACE_API_KEY=your_snowtrace_api_key
```

### Getting API Keys

1. **Alchemy API Key** (Required)
   - Sign up at https://alchemy.com
   - Create a new app
   - Copy your API key
   - Free tier: 300M compute units/month

2. **Etherscan API Keys** (Required)
   - **Etherscan** (Ethereum): https://etherscan.io/myapikey
   - **Basescan** (Base): https://basescan.org/myapikey
   - **Polygonscan** (Polygon): https://polygonscan.com/myapikey
   - **Arbiscan** (Arbitrum): https://arbiscan.io/myapikey
   - **Optimistic Etherscan** (Optimism): https://optimistic.etherscan.io/myapikey
   - **BscScan** (BSC): https://bscscan.com/myapikey
   - **SnowTrace** (Avalanche): https://snowtrace.io/myapikey
   - Free tier: 5 calls/second per API key

## How It Works

### 1. Token Discovery (STEP 1)
The API fetches all tokens that the wallet has interacted with using multiple Etherscan endpoints:

- **ERC20**: `tokentx` endpoint - Gets all ERC20 token transfers
- **ERC721**: `tokennfttx` endpoint - Gets all NFT transfers
- **ERC1155**: `token1155tx` endpoint - Gets all multi-token transfers

Each endpoint is paginated (up to 10 pages × 1000 records = 10,000 transactions per standard).

### 2. Approval Events (STEP 2)
Fetches all historical approval events using Etherscan's `getLogs` API:

- **ERC20/ERC721 Approval**: `0x8c5be1e5...` event signature
- **ERC721/ERC1155 ApprovalForAll**: `0x17307eab...` event signature

**Benefits over RPC**:
- No block range limitations (scans from genesis to latest)
- Faster than chunked RPC calls
- More reliable for historical data

**RPC Fallback**: If Etherscan API is unavailable, the system falls back to chunked RPC calls (last 100k blocks).

### 3. Common Spenders (STEP 3)
Adds known DEX and DeFi protocol addresses to check:
- Uniswap routers
- 1inch aggregator
- OpenSea marketplace
- And more...

### 4. On-Chain Verification (STEP 4)
For each token-spender pair:
1. Fetch token info (symbol, name, decimals)
2. Get wallet's token balance
3. Check current allowance via `allowance(owner, spender)` call
4. Analyze risk based on allowance vs balance
5. Return only active approvals (allowance > 0)

## Risk Levels

- **High Risk**
  - Unlimited allowance (`2^256 - 1`)
  - Allowance > 10× balance
  
- **Medium Risk**
  - Allowance > 2× balance
  - Allowance > balance
  
- **Low Risk**
  - Reasonable allowance (≤ balance)

## Rate Limiting

The API respects rate limits for each blockchain explorer:

- **Etherscan family**: 5 calls/second (free tier)
- Automatic retry with exponential backoff on failures
- Configurable rate limits per network

## Error Handling

- HTTP errors: Automatic retry up to 3 times
- Invalid responses: Graceful fallback to RPC
- Token read failures: Skips and continues
- Network errors: Returns partial results with error message

## Architecture (Inspired by RevokeCash)

```
┌─────────────────────────────────────────────────────────┐
│                   Client Request                        │
│              { walletAddress, network }                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                STEP 1: Token Discovery                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   tokentx    │  │ tokennfttx   │  │ token1155tx  │ │
│  │   (ERC20)    │  │  (ERC721)    │  │  (ERC1155)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                      │                                   │
│                Set<tokenAddresses>                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           STEP 2: Approval Event Discovery              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐│
│  │  Etherscan getLogs API (Full History)             ││
│  │  - Approval events (ERC20/721)                     ││
│  │  - ApprovalForAll events (ERC721/1155)             ││
│  └────────────────────────────────────────────────────┘│
│                      │                                   │
│                      ▼ (if API fails)                    │
│  ┌────────────────────────────────────────────────────┐│
│  │  RPC Fallback (Chunked: last 100k blocks)         ││
│  └────────────────────────────────────────────────────┘│
│                      │                                   │
│          Map<token, Set<spenders>>                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           STEP 3: Add Common Spenders                   │
│  (Uniswap, 1inch, OpenSea, etc.)                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         STEP 4: On-Chain Allowance Check                │
│                                                          │
│  For each token-spender pair:                           │
│  1. Get token info (symbol, name, decimals)             │
│  2. Get wallet balance                                  │
│  3. Check allowance(owner, spender)                     │
│  4. Analyze risk level                                  │
│  5. Format and return results                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Response to Client                     │
│  { allowances[], stats, network, duration }             │
└─────────────────────────────────────────────────────────┘
```

## Differences from RevokeCash

While inspired by RevokeCash's architecture, this implementation has some key differences:

1. **Simplified deployment**: Single API endpoint vs full Next.js app
2. **X402 payment integration**: Designed for micropayment model (0.01 USDC)
3. **Focused scope**: Token approvals only (no advanced features like batch revoke UI)
4. **Optimized for API usage**: Returns JSON data for integration with other apps

## Performance

- **Average scan time**: 5-15 seconds per wallet
- **Tokens scanned**: Up to 10,000 unique tokens
- **Approval events**: Unlimited history via Etherscan API
- **Concurrent checks**: Multiple token-spender pairs in parallel

## Limitations

- **Free API tier limits**: 5 calls/second per Etherscan API key
- **RPC rate limits**: May affect fallback performance
- **Historical data**: RPC fallback only scans last 100k blocks (~2 weeks)
- **Token metadata**: Some tokens may not expose name/symbol/decimals

## Future Enhancements

- [ ] Spender name resolution (contract name lookup)
- [ ] Token logo fetching
- [ ] Batch revoke transaction generation
- [ ] Spender risk scoring (known protocols vs unknown contracts)
- [ ] Token price integration for USD value
- [ ] Webhook notifications for new risky approvals
- [ ] Caching layer for faster repeat scans

## License

MIT

## Credits

- Inspired by [RevokeCash](https://revoke.cash) by Rosco Kalis
- Built for [BaseHub](https://basehub.app)

