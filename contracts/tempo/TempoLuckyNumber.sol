// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TempoLuckyNumber {
    address public owner;
    IFeeToken public feeToken;
    uint256 public constant GAME_FEE_USD6 = 44_000; // 0.044 USD (6 decimals)
    uint256 public constant BASE_XP = 10;
    uint256 public constant WIN_BONUS_XP = 1000;

    mapping(address => uint256) public playerLuckyCount;
    event LuckyNumberGuessed(address indexed player, uint256 guess, uint256 result, bool won, uint256 xpEarned);

    constructor() {
        owner = msg.sender;
    }

    function guessLuckyNumber(uint256 guess) external {
        require(guess >= 1 && guess <= 10, "Guess must be between 1 and 10");

        uint256 result = (uint256(keccak256(abi.encodePacked(
            block.timestamp, block.prevrandao, msg.sender, block.number
        ))) % 10) + 1;

        bool won = (guess == result);
        uint256 xpEarned = BASE_XP;
        if (won) xpEarned += WIN_BONUS_XP;

        playerLuckyCount[msg.sender]++;

        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, GAME_FEE_USD6);
        require(ok, "Fee token transfer failed");

        emit LuckyNumberGuessed(msg.sender, guess, result, won, xpEarned);
    }

    function getPlayerStats(address player) external view returns (uint256 luckyCount) {
        return playerLuckyCount[player];
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

