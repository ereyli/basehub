# SwapHub Aggregator V3 Safe Deploy Notes

## Constructor

Deploy `contracts/SwapAggregatorV3Safe.sol` on Base mainnet with:

- `_weth`: `0x4200000000000000000000000000000000000006`
- `_feeBps`: `50`
- `_feeRecipient`: `0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe`

Do not use this previous Safe deployment; it has an address decoding validation bug and rejects valid routes with `InvalidPath()`:

```bash
0x2bc0D802889dE33823495D42e9A7E85285F5a047
```

Current fixed Safe deployment:

```bash
0x1bBF38869bD581693aeB8E1cdD0B3C2e6a5fBe5A
```

## Post-Deploy Router Allowlist

Call `setRouter(router, true)` for each router:

- Uniswap V3 SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Uniswap V2 Router02: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
- PancakeSwap V3 Router: `0x1b81D678ffb9C0263b24A97847620C99d213eB14`
- Aerodrome Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`

Call `setRouterSelector(router, selector, routeKind, true)`.

Route kind values:

- `1`: Uniswap V3 exactInputSingle
- `2`: PancakeSwap V3 exactInputSingle
- `3`: Uniswap V2 swapExactTokensForTokens
- `4`: Aerodrome swapExactTokensForTokens

Selector allowlist:

- Uniswap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`: `0x04e45aaf`, routeKind `1`
- Uniswap V2 `swapExactTokensForTokens(uint256,uint256,address[],address,uint256)`: `0x38ed1739`, routeKind `3`
- PancakeSwap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))`: `0x414bf389`, routeKind `2`
- Aerodrome `swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)`: `0xcac88ea9`, routeKind `4`

## Frontend Env

After deploy, set:

```bash
VITE_SWAP_AGGREGATOR_ADDRESS=0x1bBF38869bD581693aeB8E1cdD0B3C2e6a5fBe5A
```

Then rebuild/redeploy the frontend.
