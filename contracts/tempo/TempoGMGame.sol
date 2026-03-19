// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TempoGMGame {
    address public owner;
    IFeeToken public feeToken;
    // 0.044 USD, assuming 6-decimal USD token units.
    uint256 public constant GAME_FEE_USD6 = 44_000;

    mapping(address => uint256) public playerGMCount;

    event GMSent(address indexed player, string message);

    constructor() {
        owner = msg.sender;
    }

    function sendGM(string memory message) external {
        require(bytes(message).length > 0, "Message cannot be empty");

        playerGMCount[msg.sender]++;

        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, GAME_FEE_USD6);
        require(ok, "Fee token transfer failed");

        emit GMSent(msg.sender, message);
    }

    function getPlayerStats(address player) external view returns (uint256 gmCount) {
        return playerGMCount[player];
    }

    function setOwner(address newOwner) external {
        require(msg.sender == owner, "Only owner");
        owner = newOwner;
    }

    function setFeeToken(address feeToken_) external {
        require(msg.sender == owner, "Only owner");
        feeToken = IFeeToken(feeToken_);
    }
}

interface IFeeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

