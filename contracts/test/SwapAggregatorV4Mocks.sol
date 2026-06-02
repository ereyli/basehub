// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ALLOWANCE");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract MockWETH9 is MockERC20("Wrapped ETH", "WETH", 18) {
    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "BALANCE");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "ETH_SEND");
    }
}

contract MockDexRouter {
    struct UniV3ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct PancakeV3ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct AerodromeRoute {
        address from;
        address to;
        bool stable;
        address factory;
    }

    mapping(address => mapping(address => uint256)) public rateNum;
    mapping(address => mapping(address => uint256)) public rateDen;
    address public weth;

    function setWETH(address _weth) external {
        weth = _weth;
    }

    function setRate(address tokenIn, address tokenOut, uint256 numerator, uint256 denominator) external {
        require(numerator > 0 && denominator > 0, "RATE");
        rateNum[tokenIn][tokenOut] = numerator;
        rateDen[tokenIn][tokenOut] = denominator;
    }

    function exactInputSingle(UniV3ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        amountOut = _swap(params.tokenIn, params.tokenOut, params.amountIn, params.recipient);
        require(amountOut >= params.amountOutMinimum, "MIN_OUT");
    }

    function exactInputSingle(PancakeV3ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        amountOut = _swap(params.tokenIn, params.tokenOut, params.amountIn, params.recipient);
        require(amountOut >= params.amountOutMinimum, "MIN_OUT");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "PATH");
        uint256 amountOut = _swap(path[0], path[path.length - 1], amountIn, to);
        require(amountOut >= amountOutMin, "MIN_OUT");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        AerodromeRoute[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        require(routes.length >= 1, "ROUTE");
        uint256 amountOut = _swap(routes[0].from, routes[routes.length - 1].to, amountIn, to);
        require(amountOut >= amountOutMin, "MIN_OUT");
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        amounts[routes.length] = amountOut;
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, address recipient) internal returns (uint256 amountOut) {
        uint256 numerator = rateNum[tokenIn][tokenOut];
        uint256 denominator = rateDen[tokenIn][tokenOut];
        require(numerator > 0 && denominator > 0, "NO_RATE");
        amountOut = (amountIn * numerator) / denominator;
        require(MockERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TRANSFER_IN");
        if (tokenOut == weth && address(this).balance >= amountOut) {
            IWETHLike(weth).deposit{value: amountOut}();
        }
        require(MockERC20(tokenOut).transfer(recipient, amountOut), "TRANSFER_OUT");
    }

    receive() external payable {}
}

interface IWETHLike {
    function deposit() external payable;
}
