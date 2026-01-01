// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapAggregatorV2
 * @notice Production-ready Uniswap V3 + V2 aggregator with NATIVE ETH support
 * @dev 
 *   - Supports both Uniswap V3 and V2 swaps
 *   - Supports NATIVE ETH as input or output (use address(0))
 *   - Takes protocol fee from OUTPUT token (pull model)
 *   - Single atomic transaction per swap
 *   - Deadline validation at contract level for MEV protection
 * 
 * @custom:security-contact security@basedex.io
 * @author Base DEX Team
 */

/* ═══════════════════════════════════════════════════════════════════════════
                              EXTERNAL INTERFACES
   ═══════════════════════════════════════════════════════════════════════════ */

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @dev Uniswap V2 Router02 interface
 * @notice Only includes functions we actually use
 */
interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @dev Uniswap V3 SwapRouter02 interface
 * @notice Only includes functions we actually use
 */
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/* ═══════════════════════════════════════════════════════════════════════════
                              MAIN CONTRACT
   ═══════════════════════════════════════════════════════════════════════════ */

contract SwapAggregatorV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ═══════════════════════════════════════════════════════════════
                              STATE VARIABLES
       ═══════════════════════════════════════════════════════════════ */

    /// @notice Uniswap V3 SwapRouter02 address (immutable for gas savings)
    address public immutable swapRouterV3;

    /// @notice Uniswap V2 Router02 address (immutable for gas savings)
    address public immutable swapRouterV2;

    /// @notice WETH address on this chain (immutable for gas savings)
    address public immutable WETH;

    /// @notice Protocol fee in basis points (100 = 1%, max 500 = 5%)
    uint16 public feeBps;

    /// @notice Address that receives protocol fees
    address public feeRecipient;

    /// @notice Maximum fee in basis points (5%)
    uint16 public constant MAX_FEE_BPS = 500;

    /* ═══════════════════════════════════════════════════════════════
                              STATISTICS
       ═══════════════════════════════════════════════════════════════ */

    /// @notice Total number of swaps executed
    uint256 public totalSwaps;

    /// @notice Total fees collected in ETH (only ETH output swaps count)
    /// @dev Fees from other tokens are not included to avoid mixing different token decimals
    uint256 public totalFeesCollected;

    /// @notice Number of unique users who have swapped
    uint256 public uniqueUsers;

    /// @notice Track if user has swapped before (for unique count)
    mapping(address => bool) public hasSwapped;

    /// @notice Swap count per protocol (V2 or V3)
    mapping(string => uint256) public protocolSwapCount;

    /// @notice Total volume per token (input + output)
    mapping(address => uint256) public tokenVolume;

    /// @notice Total volume in native ETH (for USD conversion)
    uint256 public totalVolumeETH;

    /* ═══════════════════════════════════════════════════════════════
                                  EVENTS
       ═══════════════════════════════════════════════════════════════ */

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount,
        string protocol
    );

    event FeeUpdated(uint16 oldFee, uint16 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    /* ═══════════════════════════════════════════════════════════════
                                  ERRORS
       ═══════════════════════════════════════════════════════════════ */

    error InvalidRouter();
    error InvalidFeeRecipient();
    error InvalidWETH();
    error FeeTooHigh();
    error InvalidAmount();
    error SameToken();
    error InvalidPoolFee();
    error InsufficientOutput();
    error ETHTransferFailed();
    error DeadlineExpired();

    /* ═══════════════════════════════════════════════════════════════
                              CONSTRUCTOR
       ═══════════════════════════════════════════════════════════════ */

    /**
     * @notice Initialize the swap aggregator
     * @param _swapRouterV3 Uniswap V3 SwapRouter02 address
     * @param _swapRouterV2 Uniswap V2 Router02 address
     * @param _weth WETH token address on this chain
     * @param _feeBps Initial protocol fee in basis points
     * @param _feeRecipient Address to receive protocol fees
     */
    constructor(
        address _swapRouterV3,
        address _swapRouterV2,
        address _weth,
        uint16 _feeBps,
        address _feeRecipient
    ) Ownable(msg.sender) {
        if (_swapRouterV3 == address(0)) revert InvalidRouter();
        if (_swapRouterV2 == address(0)) revert InvalidRouter();
        if (_weth == address(0)) revert InvalidWETH();
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        swapRouterV3 = _swapRouterV3;
        swapRouterV2 = _swapRouterV2;
        WETH = _weth;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    /* ═══════════════════════════════════════════════════════════════
                         V3 SWAP WITH ETH SUPPORT
       ═══════════════════════════════════════════════════════════════ */

    /**
     * @notice Execute Uniswap V3 swap with native ETH support
     * @dev 
     *   - Use address(0) for tokenIn to swap FROM native ETH
     *   - Use address(0) for tokenOut to swap TO native ETH
     *   - Deadline is validated at contract level for MEV protection
     *   - Slippage is checked AFTER fee deduction (not at router level)
     * 
     * @param tokenIn Input token address (use address(0) for native ETH)
     * @param tokenOut Output token address (use address(0) for native ETH)
     * @param poolFee V3 pool fee tier (500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
     * @param amountIn Amount of input tokens (must match msg.value if ETH)
     * @param amountOutMinimum Minimum output amount AFTER protocol fee deduction
     * @param deadline Transaction deadline timestamp (reverts if block.timestamp > deadline)
     * @return amountOut Actual output amount received by user (after fees)
     */
    function swapV3(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 amountOut) {
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Validations
        // ═══════════════════════════════════════════════════════════
        
        // Deadline check at contract level - protects against MEV and stale transactions
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        if (amountIn == 0) revert InvalidAmount();
        if (tokenIn == tokenOut) revert SameToken();
        if (poolFee != 500 && poolFee != 3000 && poolFee != 10000) revert InvalidPoolFee();

        bool inputIsETH = tokenIn == address(0);
        bool outputIsETH = tokenOut == address(0);
        
        // Convert address(0) to WETH for actual swap
        address actualTokenIn = inputIsETH ? WETH : tokenIn;
        address actualTokenOut = outputIsETH ? WETH : tokenOut;

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Handle Input Token/ETH
        // ═══════════════════════════════════════════════════════════
        
        if (inputIsETH) {
            require(msg.value == amountIn, "Bad ETH amount");
            IWETH(WETH).deposit{value: amountIn}();
        } else {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Approve Router
        // ═══════════════════════════════════════════════════════════
        
        // IMPORTANT: Reset approval to 0 first, then set to amountIn
        // Some tokens (USDT, USDC on some chains) require allowance to be 0
        // before setting a new allowance. This pattern ensures compatibility.
        IERC20(actualTokenIn).forceApprove(swapRouterV3, 0);
        IERC20(actualTokenIn).forceApprove(swapRouterV3, amountIn);

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Execute V3 Swap
        // ═══════════════════════════════════════════════════════════
        
        uint256 rawAmountOut = _executeV3Swap(
            actualTokenIn,
            actualTokenOut,
            poolFee,
            amountIn
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Calculate & Distribute Fee
        // ═══════════════════════════════════════════════════════════
        
        (uint256 userAmount, uint256 feeAmount) = _distributeFee(
            actualTokenOut,
            rawAmountOut,
            amountOutMinimum,
            outputIsETH
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Transfer Output to User
        // ═══════════════════════════════════════════════════════════
        
        if (outputIsETH) {
            IWETH(WETH).withdraw(userAmount);
            (bool success, ) = msg.sender.call{value: userAmount}("");
            if (!success) revert ETHTransferFailed();
        } else {
            IERC20(tokenOut).safeTransfer(msg.sender, userAmount);
        }

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            userAmount,
            feeAmount,
            "V3"
        );

        // Update statistics
        _updateStats(msg.sender, tokenIn, tokenOut, amountIn, userAmount, feeAmount, inputIsETH, outputIsETH, "V3");

        return userAmount;
    }

    /* ═══════════════════════════════════════════════════════════════
                         V2 SWAP WITH ETH SUPPORT
       ═══════════════════════════════════════════════════════════════ */

    /**
     * @notice Execute Uniswap V2 swap with native ETH support
     * @dev 
     *   - Use address(0) for tokenIn to swap FROM native ETH
     *   - Use address(0) for tokenOut to swap TO native ETH
     *   - Deadline is validated at BOTH contract and router level
     *   - Slippage is checked AFTER fee deduction (not at router level)
     * 
     * @param tokenIn Input token address (use address(0) for native ETH)
     * @param tokenOut Output token address (use address(0) for native ETH)
     * @param amountIn Amount of input tokens (must match msg.value if ETH)
     * @param amountOutMinimum Minimum output amount AFTER protocol fee deduction
     * @param deadline Transaction deadline timestamp
     * @return amountOut Actual output amount received by user (after fees)
     */
    function swapV2(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 amountOut) {
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Validations
        // ═══════════════════════════════════════════════════════════
        
        // Deadline check at contract level - additional protection layer
        // V2 router also checks deadline, but we validate first for clear error
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        if (amountIn == 0) revert InvalidAmount();
        if (tokenIn == tokenOut) revert SameToken();

        bool inputIsETH = tokenIn == address(0);
        bool outputIsETH = tokenOut == address(0);
        
        // Convert address(0) to WETH for actual swap
        address actualTokenIn = inputIsETH ? WETH : tokenIn;
        address actualTokenOut = outputIsETH ? WETH : tokenOut;

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Handle Input Token/ETH
        // ═══════════════════════════════════════════════════════════
        
        if (inputIsETH) {
            require(msg.value == amountIn, "Bad ETH amount");
            IWETH(WETH).deposit{value: amountIn}();
        } else {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Approve Router
        // ═══════════════════════════════════════════════════════════
        
        // IMPORTANT: Reset approval to 0 first, then set to amountIn
        // Some tokens (USDT, USDC on some chains) require allowance to be 0
        // before setting a new allowance. This pattern ensures compatibility.
        IERC20(actualTokenIn).forceApprove(swapRouterV2, 0);
        IERC20(actualTokenIn).forceApprove(swapRouterV2, amountIn);

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Execute V2 Swap
        // ═══════════════════════════════════════════════════════════
        
        uint256 rawAmountOut = _executeV2Swap(
            actualTokenIn,
            actualTokenOut,
            amountIn,
            deadline
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Calculate & Distribute Fee
        // ═══════════════════════════════════════════════════════════
        
        (uint256 userAmount, uint256 feeAmount) = _distributeFee(
            actualTokenOut,
            rawAmountOut,
            amountOutMinimum,
            outputIsETH
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Transfer Output to User
        // ═══════════════════════════════════════════════════════════
        
        if (outputIsETH) {
            IWETH(WETH).withdraw(userAmount);
            (bool success, ) = msg.sender.call{value: userAmount}("");
            if (!success) revert ETHTransferFailed();
        } else {
            IERC20(tokenOut).safeTransfer(msg.sender, userAmount);
        }

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            userAmount,
            feeAmount,
            "V2"
        );

        // Update statistics
        _updateStats(msg.sender, tokenIn, tokenOut, amountIn, userAmount, feeAmount, inputIsETH, outputIsETH, "V2");

        return userAmount;
    }

    /* ═══════════════════════════════════════════════════════════════
                          INTERNAL FUNCTIONS
       ═══════════════════════════════════════════════════════════════ */

    /**
     * @dev Execute V3 swap via interface call (NOT low-level call)
     * @notice Uses direct interface call for:
     *   - Compile-time ABI validation
     *   - Better wallet simulation compatibility
     *   - Cleaner error handling
     * 
     * IMPORTANT: amountOutMinimum is set to 0 intentionally!
     * Slippage protection is handled AFTER the swap in _distributeFee()
     * where we check: userAmount >= amountOutMinimum (after fee deduction)
     * This allows accurate slippage calculation including protocol fee.
     */
    function _executeV3Swap(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn
    ) internal returns (uint256) {
        ISwapRouter02.ExactInputSingleParams memory params = ISwapRouter02.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: poolFee,
            recipient: address(this),
            amountIn: amountIn,
            // NOTE: amountOutMinimum = 0 is INTENTIONAL
            // Slippage check happens in _distributeFee() after fee calculation
            // This ensures user's minOut is compared against their actual received amount
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        return ISwapRouter02(swapRouterV3).exactInputSingle(params);
    }

    /**
     * @dev Execute V2 swap via interface call (NOT low-level call)
     * @notice Uses direct interface call for:
     *   - Compile-time ABI validation
     *   - Better wallet simulation compatibility
     *   - Cleaner error handling
     * 
     * IMPORTANT: amountOutMin is set to 0 intentionally!
     * Slippage protection is handled AFTER the swap in _distributeFee()
     * where we check: userAmount >= amountOutMinimum (after fee deduction)
     * This allows accurate slippage calculation including protocol fee.
     */
    function _executeV2Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 deadline
    ) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = IUniswapV2Router02(swapRouterV2).swapExactTokensForTokens(
            amountIn,
            // NOTE: amountOutMin = 0 is INTENTIONAL
            // Slippage check happens in _distributeFee() after fee calculation
            // This ensures user's minOut is compared against their actual received amount
            0,
            path,
            address(this),
            deadline
        );

        return amounts[amounts.length - 1];
    }

    /**
     * @dev Calculate fee and distribute to fee recipient
     * @notice This is where slippage protection is enforced
     * @param tokenOut The output token address
     * @param rawAmountOut Total amount received from router
     * @param amountOutMinimum User's minimum acceptable amount (AFTER fees)
     * @param outputIsETH Whether output should be native ETH
     * @return userAmount Amount user will receive
     * @return feeAmount Amount sent to fee recipient
     */
    function _distributeFee(
        address tokenOut,
        uint256 rawAmountOut,
        uint256 amountOutMinimum,
        bool outputIsETH
    ) internal returns (uint256 userAmount, uint256 feeAmount) {
        // Calculate fee from raw output
        feeAmount = (rawAmountOut * feeBps) / 10000;
        userAmount = rawAmountOut - feeAmount;

        // SLIPPAGE PROTECTION: Enforced here, after fee calculation
        // This ensures amountOutMinimum represents actual user-received amount
        if (userAmount < amountOutMinimum) revert InsufficientOutput();

        // Transfer fee to recipient
        if (feeAmount > 0 && feeRecipient != address(0)) {
            if (outputIsETH) {
                // For ETH output: withdraw WETH to ETH, send to fee recipient
                IWETH(WETH).withdraw(feeAmount);
                (bool success, ) = feeRecipient.call{value: feeAmount}("");
                if (!success) revert ETHTransferFailed();
            } else {
                IERC20(tokenOut).safeTransfer(feeRecipient, feeAmount);
            }
        }

        return (userAmount, feeAmount);
    }

    /**
     * @dev Update platform statistics after a swap
     * @notice Separated into its own function to reduce stack depth
     * @param user Address of the user who swapped
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param userAmount Output amount received by user
     * @param feeAmount Fee amount collected
     * @param inputIsETH Whether input was native ETH
     * @param outputIsETH Whether output is native ETH
     * @param protocol Protocol used ("V2" or "V3")
     */
    function _updateStats(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 userAmount,
        uint256 feeAmount,
        bool inputIsETH,
        bool outputIsETH,
        string memory protocol
    ) internal {
        totalSwaps++;
        protocolSwapCount[protocol]++;
        
        // IMPORTANT: Only count fees from ETH output swaps
        // This prevents mixing different token decimals (USDC 6, ETH 18, DAI 18, etc.)
        // Fees from other tokens are not included in totalFeesCollected
        if (outputIsETH) {
            totalFeesCollected += feeAmount;
        }
        
        // Track unique users
        if (!hasSwapped[user]) {
            hasSwapped[user] = true;
            uniqueUsers++;
        }
        
        // Track volume per token
        tokenVolume[tokenIn] += amountIn;
        tokenVolume[tokenOut] += userAmount;
        
        // Track ETH volume
        if (inputIsETH) {
            totalVolumeETH += amountIn;
        } else if (outputIsETH) {
            totalVolumeETH += userAmount;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
                            ADMIN FUNCTIONS
       ═══════════════════════════════════════════════════════════════ */

    /**
     * @notice Update protocol fee (onlyOwner)
     * @param newFeeBps New fee in basis points (max 500 = 5%)
     */
    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint16 oldFee = feeBps;
        feeBps = newFeeBps;
        emit FeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update fee recipient address (onlyOwner)
     * @param newFeeRecipient New address to receive fees
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert InvalidFeeRecipient();
        address oldRecipient = feeRecipient;
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(oldRecipient, newFeeRecipient);
    }

    /**
     * @notice Rescue stuck ERC20 tokens (onlyOwner)
     * @dev Emergency function in case tokens get stuck
     * @param token Token address to rescue
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Rescue stuck ETH (onlyOwner)
     * @dev Emergency function in case ETH gets stuck
     */
    function rescueETH() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "ETH rescue failed");
    }

    /* ═══════════════════════════════════════════════════════════════
                            VIEW FUNCTIONS
       ═══════════════════════════════════════════════════════════════ */

    /**
     * @notice Calculate fee for a given output amount
     * @param outputAmount Raw output amount from router
     * @return feeAmount Amount that would go to fee recipient
     * @return userAmount Amount that would go to user
     */
    function calculateFee(uint256 outputAmount) external view returns (uint256 feeAmount, uint256 userAmount) {
        feeAmount = (outputAmount * feeBps) / 10000;
        userAmount = outputAmount - feeAmount;
    }

    /**
     * @notice Get platform statistics
     * @return _totalSwaps Total number of swaps
     * @return _totalFeesCollected Total fees collected in ETH (only ETH output swaps)
     * @return _uniqueUsers Number of unique users
     * @return _v2Swaps Number of V2 swaps
     * @return _v3Swaps Number of V3 swaps
     * @return _totalVolumeETH Total volume in native ETH
     */
    function getStats() external view returns (
        uint256 _totalSwaps,
        uint256 _totalFeesCollected,
        uint256 _uniqueUsers,
        uint256 _v2Swaps,
        uint256 _v3Swaps,
        uint256 _totalVolumeETH
    ) {
        return (
            totalSwaps,
            totalFeesCollected,
            uniqueUsers,
            protocolSwapCount["V2"],
            protocolSwapCount["V3"],
            totalVolumeETH
        );
    }

    /**
     * @notice Get volume for a specific token
     * @param token Token address
     * @return Volume in token units
     */
    function getTokenVolume(address token) external view returns (uint256) {
        return tokenVolume[token];
    }

    /* ═══════════════════════════════════════════════════════════════
                            RECEIVE FUNCTION
       ═══════════════════════════════════════════════════════════════ */

    /// @dev Allow contract to receive ETH (required for WETH unwrap)
    receive() external payable {}
}
