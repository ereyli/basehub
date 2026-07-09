// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PumpHubFactoryMock {
    address public immutable pair;

    constructor(address pair_) {
        pair = pair_;
    }

    function getPair(address, address) external view returns (address) {
        return pair;
    }
}

contract PumpHubRouterMock {
    address public immutable factory;
    address public immutable WETH;
    address public lastLiquidityTo;
    uint256 public lastLiquidityETH;
    uint256 public lastLiquidityTokens;

    constructor(address factory_, address weth_) {
        factory = factory_;
        WETH = weth_;
    }

    function addLiquidityETH(
        address token,
        uint256 tokenDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external payable returns (uint256 tokenAmount, uint256 ethAmount, uint256 liquidity) {
        require(IERC20TransferFrom(token).transferFrom(msg.sender, address(this), tokenDesired), "TRANSFER");
        lastLiquidityTo = to;
        lastLiquidityETH = msg.value;
        lastLiquidityTokens = tokenDesired;
        return (tokenDesired, msg.value, 1);
    }

    function swapExactETHForTokens(
        uint256,
        address[] calldata,
        address,
        uint256
    ) external payable returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = msg.value;
    }

    function swapExactTokensForETH(
        uint256 amount,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = amount;
    }
}
