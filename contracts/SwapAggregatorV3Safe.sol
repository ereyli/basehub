// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH9Safe {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/**
 * @title SwapAggregatorV3Safe
 * @notice Hardened multi-DEX execution layer for BaseHub swaps on Base.
 * @dev Accepts only allowlisted routers/selectors and validates router calldata
 *      against the public executeSwap params before making the router call.
 */
contract SwapAggregatorV3Safe is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum RouteKind {
        Unknown,
        UniV3ExactInputSingle,
        PancakeV3ExactInputSingle,
        UniV2SwapExactTokensForTokens,
        AerodromeSwapExactTokensForTokens
    }

    struct SwapContext {
        address router;
        address tokenIn;
        address tokenOut;
        address actualTokenIn;
        address actualTokenOut;
        uint256 amountIn;
        uint256 amountOutMinimum;
        bytes32 dexId;
        bool inputIsETH;
        bool outputIsETH;
    }

    address public immutable WETH;
    uint16 public feeBps;
    address public feeRecipient;
    uint16 public constant MAX_FEE_BPS = 500;

    mapping(address => bool) public allowedRouters;
    mapping(address => mapping(bytes4 => bool)) public allowedSelectors;
    mapping(address => mapping(bytes4 => RouteKind)) public routeKinds;

    bytes4 public constant UNI_V3_EXACT_INPUT_SINGLE = 0x04e45aaf;
    bytes4 public constant PANCAKE_V3_EXACT_INPUT_SINGLE = 0x414bf389;
    bytes4 public constant UNI_V2_SWAP_EXACT_TOKENS_FOR_TOKENS = 0x38ed1739;
    bytes4 public constant AERODROME_SWAP_EXACT_TOKENS_FOR_TOKENS = 0xcac88ea9;

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        address router,
        bytes32 dexId,
        uint256 amountIn,
        uint256 rawAmountOut,
        uint256 userAmountOut,
        uint256 feeAmount
    );
    event RouterUpdated(address indexed router, bool allowed);
    event RouterSelectorUpdated(address indexed router, bytes4 indexed selector, RouteKind routeKind, bool allowed);
    event FeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidFee();
    error InvalidRouter();
    error InvalidSelector();
    error InvalidRouteKind();
    error InvalidMsgValue();
    error SameToken();
    error InvalidCalldata();
    error InvalidRecipient();
    error InvalidPath();
    error InvalidRouterAmount();
    error InsufficientOutput();
    error RouterCallFailed(bytes reason);
    error ETHTransferFailed();

    constructor(address _weth, uint16 _feeBps, address _feeRecipient) Ownable(msg.sender) {
        if (_weth == address(0) || _feeRecipient == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert InvalidFee();

        WETH = _weth;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    receive() external payable {
        if (msg.sender != WETH) revert InvalidAddress();
    }

    function setRouter(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert InvalidAddress();
        allowedRouters[router] = allowed;
        emit RouterUpdated(router, allowed);
    }

    function setRouterSelector(
        address router,
        bytes4 selector,
        RouteKind routeKind,
        bool allowed
    ) external onlyOwner {
        if (router == address(0) || selector == bytes4(0)) revert InvalidAddress();
        if (allowed && routeKind == RouteKind.Unknown) revert InvalidRouteKind();
        allowedSelectors[router][selector] = allowed;
        routeKinds[router][selector] = allowed ? routeKind : RouteKind.Unknown;
        emit RouterSelectorUpdated(router, selector, routeKind, allowed);
    }

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();
        uint16 oldFeeBps = feeBps;
        feeBps = newFeeBps;
        emit FeeUpdated(oldFeeBps, newFeeBps);
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert InvalidAddress();
        address oldFeeRecipient = feeRecipient;
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(oldFeeRecipient, newFeeRecipient);
    }

    function executeSwap(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        bytes calldata routerCalldata,
        bytes32 dexId
    ) external payable nonReentrant returns (uint256 userAmountOut) {
        if (amountIn == 0) revert InvalidAmount();
        if (tokenIn == tokenOut) revert SameToken();
        if (!allowedRouters[router]) revert InvalidRouter();

        SwapContext memory context = _buildContext(router, tokenIn, tokenOut, amountIn, amountOutMinimum, dexId);
        _validateRouterCalldata(context, routerCalldata);
        _collectInput(context);

        uint256 rawAmountOut = _callRouter(context, routerCalldata);
        (userAmountOut, ) = _distributeOutput(context, rawAmountOut);

        return userAmountOut;
    }

    function _buildContext(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        bytes32 dexId
    ) internal view returns (SwapContext memory context) {
        bool inputIsETH = tokenIn == address(0);
        bool outputIsETH = tokenOut == address(0);
        context = SwapContext({
            router: router,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            actualTokenIn: inputIsETH ? WETH : tokenIn,
            actualTokenOut: outputIsETH ? WETH : tokenOut,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            dexId: dexId,
            inputIsETH: inputIsETH,
            outputIsETH: outputIsETH
        });
    }

    function _validateRouterCalldata(SwapContext memory context, bytes calldata data) internal view {
        bytes4 selector = _selector(data);
        if (!allowedSelectors[context.router][selector]) revert InvalidSelector();

        RouteKind kind = routeKinds[context.router][selector];
        if (kind == RouteKind.UniV3ExactInputSingle) {
            _validateUniV3(context, data);
        } else if (kind == RouteKind.PancakeV3ExactInputSingle) {
            _validatePancakeV3(context, data);
        } else if (kind == RouteKind.UniV2SwapExactTokensForTokens) {
            _validateUniV2(context, data);
        } else if (kind == RouteKind.AerodromeSwapExactTokensForTokens) {
            _validateAerodrome(context, data);
        } else {
            revert InvalidRouteKind();
        }
    }

    function _validateUniV3(SwapContext memory context, bytes calldata data) internal view {
        if (data.length != 4 + 32 * 7) revert InvalidCalldata();
        if (_addressAt(data, 4) != context.actualTokenIn) revert InvalidPath();
        if (_addressAt(data, 36) != context.actualTokenOut) revert InvalidPath();
        if (_addressAt(data, 100) != address(this)) revert InvalidRecipient();
        if (_uintAt(data, 132) != context.amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 164) != 0) revert InvalidCalldata();
    }

    function _validatePancakeV3(SwapContext memory context, bytes calldata data) internal view {
        if (data.length != 4 + 32 * 8) revert InvalidCalldata();
        if (_addressAt(data, 4) != context.actualTokenIn) revert InvalidPath();
        if (_addressAt(data, 36) != context.actualTokenOut) revert InvalidPath();
        if (_addressAt(data, 100) != address(this)) revert InvalidRecipient();
        if (_uintAt(data, 164) != context.amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 196) != 0) revert InvalidCalldata();
    }

    function _validateUniV2(SwapContext memory context, bytes calldata data) internal view {
        if (_uintAt(data, 4) != context.amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 36) != 0) revert InvalidCalldata();
        if (_addressAt(data, 100) != address(this)) revert InvalidRecipient();

        uint256 pathOffset = _uintAt(data, 68);
        uint256 pathStart = 4 + pathOffset;
        uint256 pathLength = _uintAt(data, pathStart);
        if (pathLength < 2) revert InvalidPath();
        if (_addressAt(data, pathStart + 32) != context.actualTokenIn) revert InvalidPath();
        if (_addressAt(data, pathStart + 32 * pathLength) != context.actualTokenOut) revert InvalidPath();
    }

    function _validateAerodrome(SwapContext memory context, bytes calldata data) internal view {
        if (_uintAt(data, 4) != context.amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 36) != 0) revert InvalidCalldata();
        if (_addressAt(data, 100) != address(this)) revert InvalidRecipient();

        uint256 routesOffset = _uintAt(data, 68);
        uint256 routesStart = 4 + routesOffset;
        uint256 routesLength = _uintAt(data, routesStart);
        if (routesLength < 1) revert InvalidPath();
        if (_addressAt(data, routesStart + 32) != context.actualTokenIn) revert InvalidPath();
        if (_addressAt(data, routesStart + 32 + 32) != context.actualTokenOut) revert InvalidPath();
    }

    function _collectInput(SwapContext memory context) internal {
        if (context.inputIsETH) {
            if (msg.value != context.amountIn) revert InvalidMsgValue();
            IWETH9Safe(WETH).deposit{value: context.amountIn}();
        } else {
            if (msg.value != 0) revert InvalidMsgValue();
            IERC20(context.tokenIn).safeTransferFrom(msg.sender, address(this), context.amountIn);
        }
    }

    function _callRouter(SwapContext memory context, bytes calldata routerCalldata) internal returns (uint256 rawAmountOut) {
        uint256 balanceBefore = IERC20(context.actualTokenOut).balanceOf(address(this));
        IERC20(context.actualTokenIn).forceApprove(context.router, 0);
        IERC20(context.actualTokenIn).forceApprove(context.router, context.amountIn);

        (bool success, bytes memory reason) = context.router.call(routerCalldata);

        IERC20(context.actualTokenIn).forceApprove(context.router, 0);
        if (!success) revert RouterCallFailed(reason);

        rawAmountOut = IERC20(context.actualTokenOut).balanceOf(address(this)) - balanceBefore;
    }

    function _distributeOutput(
        SwapContext memory context,
        uint256 rawAmountOut
    ) internal returns (uint256 userAmountOut, uint256 feeAmount) {
        feeAmount = (rawAmountOut * feeBps) / 10_000;
        userAmountOut = rawAmountOut - feeAmount;
        if (userAmountOut < context.amountOutMinimum) revert InsufficientOutput();

        if (context.outputIsETH) {
            if (feeAmount > 0) {
                IWETH9Safe(WETH).withdraw(feeAmount);
                (bool feeSent, ) = feeRecipient.call{value: feeAmount}("");
                if (!feeSent) revert ETHTransferFailed();
            }
            IWETH9Safe(WETH).withdraw(userAmountOut);
            (bool sent, ) = msg.sender.call{value: userAmountOut}("");
            if (!sent) revert ETHTransferFailed();
        } else {
            if (feeAmount > 0) {
                IERC20(context.actualTokenOut).safeTransfer(feeRecipient, feeAmount);
            }
            IERC20(context.tokenOut).safeTransfer(msg.sender, userAmountOut);
        }

        emit SwapExecuted(
            msg.sender,
            context.tokenIn,
            context.tokenOut,
            context.router,
            context.dexId,
            context.amountIn,
            rawAmountOut,
            userAmountOut,
            feeAmount
        );

        return (userAmountOut, feeAmount);
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function rescueETH(uint256 amount) external onlyOwner {
        (bool sent, ) = owner().call{value: amount}("");
        if (!sent) revert ETHTransferFailed();
    }

    function _selector(bytes calldata data) internal pure returns (bytes4 selector) {
        if (data.length < 4) revert InvalidSelector();
        assembly {
            selector := calldataload(data.offset)
        }
    }

    function _addressAt(bytes calldata data, uint256 offset) internal pure returns (address value) {
        if (data.length < offset + 32) revert InvalidCalldata();
        assembly {
            value := shr(96, calldataload(add(data.offset, offset)))
        }
    }

    function _uintAt(bytes calldata data, uint256 offset) internal pure returns (uint256 value) {
        if (data.length < offset + 32) revert InvalidCalldata();
        assembly {
            value := calldataload(add(data.offset, offset))
        }
    }
}
