# SwapHub Aggregator V3 Safe Deploy Notes

## Constructor

Deploy `contracts/SwapAggregatorV3Safe.sol` on Base mainnet with:

- `_weth`: `0x4200000000000000000000000000000000000006`
- `_feeBps`: current SwapHub fee in basis points, for example `30` for `0.30%` or `50` for `0.50%`
- `_feeRecipient`: BaseHub fee wallet

## Post-Deploy Router Allowlist

Call `setRouter(router, true)` for each router:

- Uniswap V3 SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Uniswap V2 Router02: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
- PancakeSwap V3 Router: `0x1b81D678ffb9C0263b24A97847620C99d213eB14`
- Aerodrome Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`

Call `setRouterSelector(router, selector, routeKind, true)`:

- Uniswap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`: selector `0x04e45aaf`, routeKind `1`
- PancakeSwap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))`: selector `0x414bf389`, routeKind `2`
- Uniswap V2 `swapExactTokensForTokens(uint256,uint256,address[],address,uint256)`: selector `0x38ed1739`, routeKind `3`
- Aerodrome `swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)`: selector `0xcac88ea9`, routeKind `4`

`routeKind` enum values:

- `0`: Unknown
- `1`: UniV3ExactInputSingle
- `2`: PancakeV3ExactInputSingle
- `3`: UniV2SwapExactTokensForTokens
- `4`: AerodromeSwapExactTokensForTokens

## Safety Notes

`SwapAggregatorV3Safe` validates router calldata before the external router call:

- Router must be allowlisted.
- Function selector must be allowlisted for that router.
- Route kind must match the selector.
- Router calldata tokenIn/tokenOut must match `executeSwap` params.
- Router recipient must be the aggregator contract.
- Router amountIn must match `executeSwap.amountIn`.
- Router amountOutMin must be `0`; final slippage is enforced after protocol fee deduction.

If assets ever get stuck, owner can use:

- `rescueToken(token, amount)`
- `rescueETH(amount)`

## Frontend Env

After deploy, set:

```bash
VITE_SWAP_AGGREGATOR_ADDRESS=0xYourDeployedAggregatorV3Safe
```

Then rebuild/redeploy the frontend.

## Supabase XP Verification

After deploying a new Safe contract, add its address to the Edge Function secret and redeploy `record-swap`:

```bash
supabase secrets set SWAPHUB_AGGREGATOR_ADDRESSES=0xYourDeployedAggregatorV3Safe
supabase functions deploy record-swap
```
