# Testing Allowance Cleaner API

## Quick Test Guide

### 1. Local Testing

If you want to test the API locally before deploying:

```bash
# Install dependencies (if not already done)
npm install

# Set environment variables
export ALCHEMY_API_KEY="your_alchemy_key"
export BASESCAN_API_KEY="your_basescan_key"
export ETHERSCAN_API_KEY="your_etherscan_key"

# Start the API locally (adjust command based on your setup)
npm run dev
```

### 2. Test with cURL

Test the API endpoint with a wallet address:

```bash
# Test on Base network
curl -X POST http://localhost:3000/api/x402-allowance-cleaner \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "network": "base"
  }'

# Test on Ethereum network
curl -X POST http://localhost:3000/api/x402-allowance-cleaner \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "network": "ethereum"
  }'
```

### 3. Test with JavaScript

```javascript
async function testAllowanceCleaner() {
  const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
  const network = 'base'
  
  try {
    const response = await fetch('/api/x402-allowance-cleaner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        network,
      }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Error:', error)
      return
    }
    
    const result = await response.json()
    console.log('✅ Success:', result)
    console.log(`Found ${result.stats.totalFound} allowances`)
    console.log(`High risk: ${result.stats.highRisk}`)
    console.log(`Medium risk: ${result.stats.mediumRisk}`)
    console.log(`Low risk: ${result.stats.lowRisk}`)
    
    // Print first few allowances
    result.allowances.slice(0, 5).forEach(a => {
      console.log(`\n${a.tokenSymbol} (${a.tokenName})`)
      console.log(`  Spender: ${a.spenderAddress}`)
      console.log(`  Amount: ${a.amountFormatted}`)
      console.log(`  Risk: ${a.riskLevel} - ${a.reason}`)
    })
  } catch (error) {
    console.error('Failed:', error)
  }
}

testAllowanceCleaner()
```

### 4. Test Different Scenarios

#### Test with wallet that has many approvals (active DeFi user)
```bash
curl -X POST http://localhost:3000/api/x402-allowance-cleaner \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "network": "ethereum"
  }'
```

#### Test with wallet that has few/no approvals
```bash
curl -X POST http://localhost:3000/api/x402-allowance-cleaner \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x0000000000000000000000000000000000000001",
    "network": "base"
  }'
```

#### Test with invalid wallet address
```bash
curl -X POST http://localhost:3000/api/x402-allowance-cleaner \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "invalid",
    "network": "base"
  }'
```

#### Test with unsupported network
```bash
curl -X POST http://localhost:3000/api/x402-allowance-cleaner \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "network": "unsupported"
  }'
```

### 5. Expected Response Format

**Success Response:**
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

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid Ethereum address format"
}
```

### 6. Performance Benchmarks

Expected performance (approximate):

- **Empty wallet**: 2-5 seconds
- **Few tokens (1-5)**: 5-10 seconds
- **Active wallet (10-50 tokens)**: 10-20 seconds
- **Heavy DeFi user (50+ tokens)**: 20-40 seconds

Factors affecting speed:
- Number of tokens in wallet
- Number of historical approvals
- Network congestion
- API rate limits
- RPC provider speed

### 7. Debugging Tips

#### Check API logs
The API logs detailed information at each step:
```
🔍 Scanning: 0x... on base
📦 STEP 1: Fetching all tokens for address...
  📄 Fetching ERC20 token transfers...
    ✅ Page 1: 1000 ERC20 transactions, total 45 tokens
🔐 STEP 2: Fetching ALL approval events...
  📋 Fetching ERC20/ERC721 Approval events...
  ✅ Found 123 events via API
🎯 STEP 3: Adding common spenders...
✅ Will check 675 token-spender pairs
✅ STEP 4: Checking on-chain allowances...
  📊 [1/45] Checking USDC (0x833...)
    ✅ Found approval: USDC -> 0x4752... (Unlimited)
✅ Scan completed: Found 15 active allowances
   - High risk: 5
   - Medium risk: 3
   - Low risk: 7
```

#### Common issues

1. **"No transactions found"**
   - Wallet has no token history on this network
   - API will fallback to popular tokens

2. **"API returned NOTOK"**
   - API key issue or rate limit exceeded
   - Check your API keys in environment variables
   - System will try RPC fallback

3. **"RPC error: query returned more than X results"**
   - RPC provider limit exceeded
   - System will chunk requests into smaller blocks

4. **Slow performance**
   - Many tokens to check (expected)
   - Rate limiting in effect (respecting API limits)
   - Consider using cached results for repeat scans

### 8. Integration Testing

Test the frontend integration:

1. Open your app in browser
2. Navigate to Allowance Cleaner page
3. Connect wallet
4. Click "Scan Allowances"
5. Verify:
   - Payment prompt appears (0.01 USDC)
   - Scan completes successfully
   - Allowances are displayed
   - Risk levels are correct
   - Revoke buttons work

### 9. Load Testing

For production readiness:

```bash
# Install Apache Bench
brew install httpd  # macOS

# Test with 10 concurrent requests
ab -n 100 -c 10 -p payload.json -T application/json \
  http://localhost:3000/api/x402-allowance-cleaner

# payload.json:
# {"walletAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1","network":"base"}
```

### 10. Monitoring

Key metrics to monitor:

- **Response time**: Should be < 30s for most wallets
- **Error rate**: Should be < 5%
- **API call volume**: Track Etherscan/Alchemy usage
- **Payment success rate**: Track x402 payment completions
- **Scan success rate**: Percentage of successful scans

## Troubleshooting

### Issue: "insufficient_funds"
**Solution**: Ensure wallet has at least 0.01 USDC on Base network

### Issue: "Maximum rate limit reached"
**Solution**: Wait a moment or upgrade Etherscan API plan

### Issue: "Network not supported"
**Solution**: Check network name matches one of: base, ethereum, polygon, arbitrum, optimism, bsc, avalanche

### Issue: Scan takes too long
**Solution**: 
- Check if wallet has many tokens (expected)
- Verify API keys are set correctly
- Check RPC provider status

### Issue: No allowances found but wallet has approvals
**Solution**:
- Check if scanning correct network
- Verify wallet address is correct
- Check if approvals are on different network
- Some old approvals might be on tokens no longer tracked

## Next Steps

After testing:

1. ✅ Verify all networks work correctly
2. ✅ Test with different wallet types
3. ✅ Monitor API usage and costs
4. ✅ Set up production environment variables
5. ✅ Deploy to production
6. ✅ Set up monitoring/alerting
7. ✅ Document any issues or improvements needed

