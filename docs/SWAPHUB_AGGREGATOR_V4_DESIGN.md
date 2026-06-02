# SwapHub Aggregator V4 Design

## Goal

V4 is designed to support split routing while keeping the core aggregator stable.
New DEX families should not require redeploying the core aggregator. Instead,
new validation adapters can be deployed and allowlisted by the owner.

## Architecture

- `SwapAggregatorV4`: core execution contract.
- `BaseHubDexAdapterV1`: validator adapter for current DEX calldata shapes.
- Future adapters: one adapter per new DEX family or calldata family.

## Base Mainnet Deployment

- `SwapAggregatorV4`: `0x645A71B8E06c1979e0F140B1ceA68ffa5efBC497`
- `BaseHubDexAdapterV1`: `0xCB8409EE16c10c1460f1Fd07a27AC3D7b882dA5A`
- `WETH`: `0x4200000000000000000000000000000000000006`
- `feeBps`: `50`
- `feeRecipient`: `0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe`

The frontend/off-chain route engine is responsible for discovering prices,
splitting the order, and building router calldata. The contract is responsible
for validating and executing the final route atomically.

This follows the same high-level lesson used by major aggregators:

- route discovery is off-chain;
- execution is on-chain;
- DEX-specific behavior is modular rather than hardcoded forever in the core.

## Current V4 Execution Model

`executeSplit(tokenIn, tokenOut, amountIn, amountOutMinimum, steps)` accepts
multiple `RouteStep`s.

Each step:

- uses an allowlisted adapter;
- calls a router validated by that adapter;
- consumes a fixed slice of the original input amount;
- outputs the same final token.

Example:

```text
1000 USDC -> ETH

400 USDC via Aerodrome
350 USDC via Uniswap V3
250 USDC via PancakeSwap V3
```

The contract sums all final output, takes the protocol fee once from the final
output token, and sends the rest to the user.

## Why Adapters

The core aggregator does not know how every DEX calldata format works. An
adapter validates that a router call is safe:

- router is allowlisted inside the adapter;
- selector is recognized;
- calldata tokenIn/tokenOut match the public route;
- calldata recipient is the aggregator;
- calldata amountIn matches the step amount;
- router-level min output is zero, so final slippage is enforced once by V4.

If a future DEX needs a new calldata format, deploy a new adapter and call:

```solidity
setAdapter(newAdapter, true)
```

No core aggregator redeploy is required.

## Current Adapter Support

`BaseHubDexAdapterV1` supports:

- Uniswap V3 `exactInputSingle`
- PancakeSwap V3 `exactInputSingle`
- Uniswap V2 `swapExactTokensForTokens`
- Aerodrome `swapExactTokensForTokens`

Routers using the same calldata shape can be added to the same adapter. New
calldata shapes should get a new adapter.

## Current Limitations

This first V4 draft supports split routing across routes that all start with the
same input token and end with the same output token.

Multi-hop can still be supported when the router calldata itself handles the
path and the adapter validates the first and last token. For example:

- V2-style path arrays can already validate start/end.
- Aerodrome route arrays can already validate start/end.
- Uniswap V3 multi-hop `exactInput(bytes path, ...)` needs a new adapter.

## Rollout Plan

1. Deploy V4 core and the first adapter on Base.
2. Allowlist the adapter in the V4 core.
3. Allowlist the current Base routers/selectors in the adapter.
4. Switch single-route frontend execution to V4 `executeSplit`.
5. Keep split-route UI behind `VITE_ENABLE_SPLIT_ROUTE_PREVIEW` until live multi-step execution is enabled.
6. Add tests for V4:
   - invalid adapter;
   - invalid router;
   - invalid recipient;
   - invalid path;
   - split sum mismatch;
   - final output minimum;
   - ETH input and ETH output.

## Security Notes

- Core owner can allow or disable adapters.
- Adapter owner can allow or disable routers/selectors inside that adapter.
- Production ownership should use a multisig.
- Adding an adapter is a security-sensitive action because adapters approve
  which router calldata can execute.
- Keep router approvals per-step and reset to zero after each call.
