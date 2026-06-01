# SwapHub Aggregator V3 Deploy Notes

## Constructor

Deploy `contracts/SwapAggregatorV3.sol` on Base mainnet with:

- `_weth`: `0x4200000000000000000000000000000000000006`
- `_feeBps`: current SwapHub fee in basis points, for example `30` for `0.30%` or `50` for `0.50%`
- `_feeRecipient`: BaseHub fee wallet

## Post-Deploy Router Allowlist

Call `setRouter(router, true)` for each router:

- Uniswap V3 SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Uniswap V2 Router02: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
- PancakeSwap V3 Router: `0x1b81D678ffb9C0263b24A97847620C99d213eB14`
- Aerodrome Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`

Call `setRouterSelector(router, selector, true)`:

- Uniswap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`: `0x04e45aaf`
- Uniswap V2 `swapExactTokensForTokens(uint256,uint256,address[],address,uint256)`: `0x38ed1739`
- PancakeSwap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))`: `0x414bf389`
- Aerodrome `swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)`: `0xcac88ea9`

## Frontend Env

After deploy, set:

```bash
VITE_SWAP_AGGREGATOR_ADDRESS=0xYourDeployedAggregatorV3
```

Then rebuild/redeploy the frontend.
