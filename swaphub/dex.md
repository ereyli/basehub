You are an elite senior Web3 engineer with deep production experience in:
- Uniswap V3 internals
- Base L2 specifics
- Secure, auditable Solidity contracts
- Minimalistic, fee-generating DEX aggregators

You MUST strictly follow the instructions below.
Do NOT add unnecessary abstractions, patterns, or features.
Do NOT deviate from Uniswap V3 canonical usage.

====================================================
PROJECT OVERVIEW
====================================================

We are building a Uniswap-only mini DEX aggregator.

This is NOT a general-purpose aggregator.
This is NOT competing with 1inch or 0x.

This contract is a SIMPLE, SAFE, MONETIZED execution layer that:
- Uses Uniswap V3 ONLY
- Wraps SwapRouter
- Charges a protocol fee from INPUT tokens
- Runs on Base network
- Is optimized for Farcaster Mini App usage

====================================================
TECH STACK (STRICT)
====================================================

Smart Contracts:
- Solidity ^0.8.20
- OpenZeppelin:
  - IERC20
  - SafeERC20
  - Ownable
- Uniswap V3:
  - ISwapRouter (SwapRouter02 compatible)

Frontend:
- React
- wagmi
- viem
- No backend
- Wallet-only interaction

Network:
- Base (Ethereum L2)

====================================================
PART 1 — SMART CONTRACT
====================================================

Create ONE Solidity file named:

  UniMiniAggregator.sol

----------------------------------------------------
CONTRACT CONSTRAINTS (MANDATORY)
----------------------------------------------------

- Single contract only
- No inheritance other than Ownable
- No libraries besides SafeERC20
- No delegatecall
- No external calls except ERC20 + SwapRouter
- No on-chain price math
- No oracle usage
- No callbacks
- No permit
- No multicall
- No storage writes during swap except events

----------------------------------------------------
IMMUTABLE ADDRESSES
----------------------------------------------------

Declare the following as immutable:

- ISwapRouter public immutable swapRouter;

The address MUST be provided via constructor.

----------------------------------------------------
STATE VARIABLES
----------------------------------------------------

- uint256 public feeBps;
- address public feeRecipient;

feeBps rules:
- Expressed in basis points
- 1 = 0.01%
- Max allowed: 500 (5%)
- Revert if above max

----------------------------------------------------
EVENTS
----------------------------------------------------

Emit the following event after every successful swap:

event SwapExecuted(
    address indexed user,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 feeAmount
);

----------------------------------------------------
ADMIN FUNCTIONS
----------------------------------------------------

Owner-only functions:

1. setFeeBps(uint256 newFeeBps)
   - revert if newFeeBps > 500
   - emit FeeUpdated

2. setFeeRecipient(address newRecipient)
   - revert if zero address
   - emit FeeRecipientUpdated

----------------------------------------------------
CORE USER FUNCTIONS
----------------------------------------------------

You MUST implement EXACTLY these two public functions.

-------------------------
1) exactInputSingle
-------------------------

function exactInputSingle(
    address tokenIn,
    address tokenOut,
    uint24 fee,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint160 sqrtPriceLimitX96,
    address recipient,
    uint256 deadline
) external returns (uint256 amountOut);

LOGIC (STRICT ORDER):

1. Revert if amountIn == 0
2. Pull amountIn from msg.sender
3. Calculate protocolFee = (amountIn * feeBps) / 10_000
4. amountToSwap = amountIn - protocolFee
5. Transfer protocolFee to feeRecipient
6. Approve swapRouter for amountToSwap
7. Call ISwapRouter.exactInputSingle with:
   - recipient = recipient (NOT address(this))
8. Emit SwapExecuted
9. Return amountOut

-------------------------
2) exactInput (MULTIHOP)
-------------------------

function exactInput(
    bytes calldata path,
    address tokenIn,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    uint256 deadline
) external returns (uint256 amountOut);

LOGIC:
- Same fee logic as above
- Use ISwapRouter.exactInput
- recipient MUST be the user

----------------------------------------------------
SECURITY PATTERNS
----------------------------------------------------

- Checks → Effects → Interactions
- Use SafeERC20 everywhere
- Reset allowance to zero after swap
- Revert bubbling enabled
- No reentrancy possible by design

====================================================
PART 2 — FRONTEND (MINIMAL BUT REAL)
====================================================

Create a minimal React example that:

FEATURES:
- Wallet connect (wagmi)
- TokenIn / TokenOut selector
- Amount input
- Slippage input (%)
- Quote fetch using Uniswap V3 QuoterV2 (read-only)
- Display:
  - Estimated output
  - Protocol fee amount
- Swap button calling UniMiniAggregator

CONSTRAINTS:
- No backend
- No server
- No price caching
- No analytics
- Mobile-first layout
- Ready for Farcaster iframe embedding

----------------------------------------------------
QUOTE LOGIC (IMPORTANT)
----------------------------------------------------

- Quote MUST come from Uniswap V3 QuoterV2
- The contract itself MUST NOT quote
- Frontend calculates:
  - fee
  - amountToSwap
  - minOut using slippage

====================================================
PART 3 — DEPLOYMENT NOTES
====================================================

Provide:
- Base deployment steps
- Example constructor args
- Gas considerations
- Approval flow explanation

====================================================
PART 4 — FEE FLOW EXPLANATION
====================================================

Explain in simple steps:
- Where fee is taken
- Why it is safe
- Why users can trust execution

====================================================
FINAL OUTPUT FORMAT
====================================================

Return EXACTLY in this order:

1. Full Solidity contract (complete, compilable)
2. Deployment notes (Base-specific)
3. Frontend React example (single component is enough)
4. Fee flow explanation

DO NOT include:
- Marketing text
- Emojis
- Commentary
- Alternatives
- Extra features

ONLY deliver the implementation.
