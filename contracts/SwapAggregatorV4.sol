// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH9V4 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

struct RouteStep {
    address adapter;
    address router;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    bytes routerCalldata;
    bytes32 dexId;
}

interface IRouteAdapter {
    function validateStep(address aggregator, address weth, RouteStep calldata step) external view;
}

/**
 * @title SwapAggregatorV4
 * @notice Split-route execution layer for BaseHub swaps.
 * @dev The aggregator is intentionally small. DEX-specific calldata validation lives
 *      in allowlisted adapters, so new DEX families can be added without redeploying
 *      this core contract.
 */
contract SwapAggregatorV4 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable WETH;
    uint16 public feeBps;
    address public feeRecipient;
    uint16 public constant MAX_FEE_BPS = 500;

    mapping(address => bool) public allowedAdapters;

    event AdapterUpdated(address indexed adapter, bool allowed);
    event FeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event SplitSwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 rawAmountOut,
        uint256 userAmountOut,
        uint256 feeAmount
    );
    event RouteStepExecuted(
        address indexed adapter,
        address indexed router,
        bytes32 dexId,
        uint256 amountIn,
        uint256 rawAmountOut
    );

    error InvalidAddress();
    error InvalidAmount();
    error InvalidFee();
    error InvalidMsgValue();
    error InvalidAdapter();
    error InvalidRoute();
    error SameToken();
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

    function setAdapter(address adapter, bool allowed) external onlyOwner {
        if (adapter == address(0)) revert InvalidAddress();
        allowedAdapters[adapter] = allowed;
        emit AdapterUpdated(adapter, allowed);
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

    function executeSplit(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        RouteStep[] calldata steps
    ) external payable nonReentrant returns (uint256 userAmountOut) {
        if (amountIn == 0 || steps.length == 0) revert InvalidAmount();
        if (tokenIn == tokenOut) revert SameToken();

        address actualTokenIn = tokenIn == address(0) ? WETH : tokenIn;
        address actualTokenOut = tokenOut == address(0) ? WETH : tokenOut;
        uint256 totalStepInput = _validateSteps(tokenIn, tokenOut, amountIn, steps);

        if (totalStepInput != amountIn) revert InvalidAmount();
        _collectInput(tokenIn, actualTokenIn, amountIn);

        uint256 balanceBefore = IERC20(actualTokenOut).balanceOf(address(this));
        for (uint256 i = 0; i < steps.length; i++) {
            _executeStep(actualTokenIn, actualTokenOut, steps[i]);
        }
        uint256 rawAmountOut = IERC20(actualTokenOut).balanceOf(address(this)) - balanceBefore;
        (userAmountOut, ) = _distributeOutput(tokenOut, actualTokenOut, rawAmountOut, amountOutMinimum);

        emit SplitSwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, rawAmountOut, userAmountOut, rawAmountOut - userAmountOut);
        return userAmountOut;
    }

    function _validateSteps(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        RouteStep[] calldata steps
    ) internal view returns (uint256 totalStepInput) {
        for (uint256 i = 0; i < steps.length; i++) {
            RouteStep calldata step = steps[i];
            if (!allowedAdapters[step.adapter]) revert InvalidAdapter();
            if (_normalize(step.tokenIn) != _normalize(tokenIn) || _normalize(step.tokenOut) != _normalize(tokenOut)) {
                revert InvalidRoute();
            }
            if (step.amountIn == 0 || step.amountIn > amountIn) revert InvalidAmount();
            IRouteAdapter(step.adapter).validateStep(address(this), WETH, step);
            totalStepInput += step.amountIn;
        }
    }

    function _collectInput(address tokenIn, address actualTokenIn, uint256 amountIn) internal {
        if (tokenIn == address(0)) {
            if (msg.value != amountIn) revert InvalidMsgValue();
            IWETH9V4(WETH).deposit{value: amountIn}();
        } else {
            if (msg.value != 0) revert InvalidMsgValue();
            IERC20(actualTokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }
    }

    function _executeStep(address actualTokenIn, address actualTokenOut, RouteStep calldata step) internal {
        uint256 balanceBefore = IERC20(actualTokenOut).balanceOf(address(this));
        IERC20(actualTokenIn).forceApprove(step.router, 0);
        IERC20(actualTokenIn).forceApprove(step.router, step.amountIn);

        (bool success, bytes memory reason) = step.router.call(step.routerCalldata);

        IERC20(actualTokenIn).forceApprove(step.router, 0);
        if (!success) revert RouterCallFailed(reason);

        uint256 rawAmountOut = IERC20(actualTokenOut).balanceOf(address(this)) - balanceBefore;
        emit RouteStepExecuted(step.adapter, step.router, step.dexId, step.amountIn, rawAmountOut);
    }

    function _distributeOutput(
        address tokenOut,
        address actualTokenOut,
        uint256 rawAmountOut,
        uint256 amountOutMinimum
    ) internal returns (uint256 userAmountOut, uint256 feeAmount) {
        feeAmount = (rawAmountOut * feeBps) / 10_000;
        userAmountOut = rawAmountOut - feeAmount;
        if (userAmountOut < amountOutMinimum) revert InsufficientOutput();

        if (tokenOut == address(0)) {
            if (feeAmount > 0) {
                IWETH9V4(WETH).withdraw(feeAmount);
                (bool feeSent, ) = feeRecipient.call{value: feeAmount}("");
                if (!feeSent) revert ETHTransferFailed();
            }
            IWETH9V4(WETH).withdraw(userAmountOut);
            (bool sent, ) = msg.sender.call{value: userAmountOut}("");
            if (!sent) revert ETHTransferFailed();
        } else {
            if (feeAmount > 0) {
                IERC20(actualTokenOut).safeTransfer(feeRecipient, feeAmount);
            }
            IERC20(actualTokenOut).safeTransfer(msg.sender, userAmountOut);
        }
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function rescueETH(uint256 amount) external onlyOwner {
        (bool sent, ) = owner().call{value: amount}("");
        if (!sent) revert ETHTransferFailed();
    }

    function _normalize(address token) internal view returns (address) {
        return token == address(0) ? WETH : token;
    }
}

/**
 * @title BaseHubDexAdapterV1
 * @notice Validator adapter for the current BaseHub DEX families.
 * @dev More DEX families can be added by deploying new adapters and allowlisting
 *      them in SwapAggregatorV4. Existing routers using these same calldata shapes
 *      can be added here without changing the V4 aggregator.
 */
contract BaseHubDexAdapterV1 is Ownable, IRouteAdapter {
    enum RouteKind {
        Unknown,
        UniV3ExactInputSingle,
        PancakeV3ExactInputSingle,
        UniV2SwapExactTokensForTokens,
        AerodromeSwapExactTokensForTokens
    }

    mapping(address => bool) public allowedRouters;
    mapping(address => mapping(bytes4 => RouteKind)) public routeKinds;

    bytes4 public constant UNI_V3_EXACT_INPUT_SINGLE = 0x04e45aaf;
    bytes4 public constant PANCAKE_V3_EXACT_INPUT_SINGLE = 0x414bf389;
    bytes4 public constant UNI_V2_SWAP_EXACT_TOKENS_FOR_TOKENS = 0x38ed1739;
    bytes4 public constant AERODROME_SWAP_EXACT_TOKENS_FOR_TOKENS = 0xcac88ea9;

    event RouterUpdated(address indexed router, bool allowed);
    event RouterSelectorUpdated(address indexed router, bytes4 indexed selector, RouteKind routeKind, bool allowed);

    error InvalidAddress();
    error InvalidRouter();
    error InvalidSelector();
    error InvalidRouteKind();
    error InvalidCalldata();
    error InvalidRecipient();
    error InvalidPath();
    error InvalidRouterAmount();

    constructor() Ownable(msg.sender) {}

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
        routeKinds[router][selector] = allowed ? routeKind : RouteKind.Unknown;
        emit RouterSelectorUpdated(router, selector, routeKind, allowed);
    }

    function validateStep(address aggregator, address weth, RouteStep calldata step) external view {
        if (!allowedRouters[step.router]) revert InvalidRouter();
        bytes4 selector = _selector(step.routerCalldata);
        RouteKind kind = routeKinds[step.router][selector];
        if (kind == RouteKind.Unknown) revert InvalidSelector();

        address actualTokenIn = step.tokenIn == address(0) ? weth : step.tokenIn;
        address actualTokenOut = step.tokenOut == address(0) ? weth : step.tokenOut;

        if (kind == RouteKind.UniV3ExactInputSingle) {
            _validateUniV3(aggregator, actualTokenIn, actualTokenOut, step.amountIn, step.routerCalldata);
        } else if (kind == RouteKind.PancakeV3ExactInputSingle) {
            _validatePancakeV3(aggregator, actualTokenIn, actualTokenOut, step.amountIn, step.routerCalldata);
        } else if (kind == RouteKind.UniV2SwapExactTokensForTokens) {
            _validateUniV2(aggregator, actualTokenIn, actualTokenOut, step.amountIn, step.routerCalldata);
        } else if (kind == RouteKind.AerodromeSwapExactTokensForTokens) {
            _validateAerodrome(aggregator, actualTokenIn, actualTokenOut, step.amountIn, step.routerCalldata);
        } else {
            revert InvalidRouteKind();
        }
    }

    function _validateUniV3(
        address aggregator,
        address actualTokenIn,
        address actualTokenOut,
        uint256 amountIn,
        bytes calldata data
    ) internal pure {
        if (data.length != 4 + 32 * 7) revert InvalidCalldata();
        if (_addressAt(data, 4) != actualTokenIn) revert InvalidPath();
        if (_addressAt(data, 36) != actualTokenOut) revert InvalidPath();
        if (_addressAt(data, 100) != aggregator) revert InvalidRecipient();
        if (_uintAt(data, 132) != amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 164) != 0) revert InvalidCalldata();
    }

    function _validatePancakeV3(
        address aggregator,
        address actualTokenIn,
        address actualTokenOut,
        uint256 amountIn,
        bytes calldata data
    ) internal pure {
        if (data.length != 4 + 32 * 8) revert InvalidCalldata();
        if (_addressAt(data, 4) != actualTokenIn) revert InvalidPath();
        if (_addressAt(data, 36) != actualTokenOut) revert InvalidPath();
        if (_addressAt(data, 100) != aggregator) revert InvalidRecipient();
        if (_uintAt(data, 164) != amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 196) != 0) revert InvalidCalldata();
    }

    function _validateUniV2(
        address aggregator,
        address actualTokenIn,
        address actualTokenOut,
        uint256 amountIn,
        bytes calldata data
    ) internal pure {
        if (_uintAt(data, 4) != amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 36) != 0) revert InvalidCalldata();
        if (_addressAt(data, 100) != aggregator) revert InvalidRecipient();

        uint256 pathOffset = _uintAt(data, 68);
        uint256 pathStart = 4 + pathOffset;
        uint256 pathLength = _uintAt(data, pathStart);
        if (pathLength < 2) revert InvalidPath();
        if (_addressAt(data, pathStart + 32) != actualTokenIn) revert InvalidPath();
        if (_addressAt(data, pathStart + 32 * pathLength) != actualTokenOut) revert InvalidPath();
    }

    function _validateAerodrome(
        address aggregator,
        address actualTokenIn,
        address actualTokenOut,
        uint256 amountIn,
        bytes calldata data
    ) internal pure {
        if (_uintAt(data, 4) != amountIn) revert InvalidRouterAmount();
        if (_uintAt(data, 36) != 0) revert InvalidCalldata();
        if (_addressAt(data, 100) != aggregator) revert InvalidRecipient();

        uint256 routesOffset = _uintAt(data, 68);
        uint256 routesStart = 4 + routesOffset;
        uint256 routesLength = _uintAt(data, routesStart);
        if (routesLength < 1) revert InvalidPath();
        if (_addressAt(data, routesStart + 32) != actualTokenIn) revert InvalidPath();
        if (_addressAt(data, routesStart + 32 + 32) != actualTokenOut) revert InvalidPath();
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
            value := calldataload(add(data.offset, offset))
        }
    }

    function _uintAt(bytes calldata data, uint256 offset) internal pure returns (uint256 value) {
        if (data.length < offset + 32) revert InvalidCalldata();
        assembly {
            value := calldataload(add(data.offset, offset))
        }
    }
}
