// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockB20Token {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address initialAdmin, uint256 initialSupply) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        _mint(initialAdmin, initialSupply);
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
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}

contract MockB20Factory {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    mapping(bytes32 => address) public created;

    struct B20AssetCreateParams {
        uint8 version;
        string name;
        string symbol;
        address initialAdmin;
        uint8 decimals;
    }

    event B20Created(address indexed token, uint8 indexed variant, string name, string symbol, uint8 decimals);

    function createB20(uint8 variant, bytes32 salt, bytes calldata params, bytes[] calldata)
        external
        payable
        returns (address token)
    {
        if (created[salt] != address(0)) return created[salt];
        B20AssetCreateParams memory decoded = abi.decode(params, (B20AssetCreateParams));
        token = address(new MockB20Token{salt: salt}(
            decoded.name,
            decoded.symbol,
            decoded.decimals,
            decoded.initialAdmin,
            TOTAL_SUPPLY
        ));
        created[salt] = token;
        emit B20Created(token, variant, decoded.name, decoded.symbol, decoded.decimals);
    }

    function getB20Address(uint8, address, bytes32 salt) external view returns (address token) {
        return created[salt];
    }
}
