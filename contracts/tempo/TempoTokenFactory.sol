// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../ERC20Template.sol";

/**
 * Tempo version of TokenFactory.
 * 0.00001 ETH => 0.022 USD (at 2200 USD/ETH)
 */
contract TempoTokenFactory {
    address public owner;
    IFeeToken public feeToken;
    // 0.022 USD, assuming 6-decimal token.
    uint256 public deployFeeUsd6 = 22_000;

    event TokenDeployed(address indexed token, address indexed creator, string name, string symbol);

    constructor() {
        owner = msg.sender;
    }

    function deployToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 decimals
    ) external returns (address) {
        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, deployFeeUsd6);
        require(ok, "Fee transfer failed");

        ERC20Template newToken = new ERC20Template(
            name,
            symbol,
            initialSupply,
            decimals
        );

        newToken.transferOwnership(msg.sender);

        emit TokenDeployed(address(newToken), msg.sender, name, symbol);

        return address(newToken);
    }

    function setDeployFeeUsd6(uint256 _feeUsd6) external {
        require(msg.sender == owner, "Only owner");
        deployFeeUsd6 = _feeUsd6;
    }

    function setFeeToken(address feeToken_) external {
        require(msg.sender == owner, "Only owner");
        feeToken = IFeeToken(feeToken_);
    }
}

interface IFeeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

