// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TempoFlipGame {
    address public owner;
    IFeeToken public feeToken;
    uint256 public constant GAME_FEE_USD6 = 44_000; // 0.044 USD (6 decimals)
    uint256 public constant BASE_XP = 10;
    uint256 public constant WIN_BONUS_XP = 500;

    enum Side { Heads, Tails }

    struct GameResult {
        Side playerChoice;
        Side result;
        bool won;
        uint256 xpEarned;
        uint256 timestamp;
    }

    mapping(address => GameResult[]) public playerGames;
    mapping(address => uint256) public playerStats;

    event GamePlayed(address indexed player, Side choice, Side result, bool won, uint256 xpEarned);

    constructor() {
        owner = msg.sender;
    }

    function playFlip(Side choice) external {

        Side result = Side(uint256(keccak256(abi.encodePacked(
            block.timestamp, block.prevrandao, msg.sender, block.number
        ))) % 2);

        bool won = (choice == result);
        uint256 xpEarned = BASE_XP;
        if (won) xpEarned += WIN_BONUS_XP;

        GameResult memory gameResult = GameResult({
            playerChoice: choice,
            result: result,
            won: won,
            xpEarned: xpEarned,
            timestamp: block.timestamp
        });

        playerGames[msg.sender].push(gameResult);
        playerStats[msg.sender]++;

        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, GAME_FEE_USD6);
        require(ok, "Fee token transfer failed");

        emit GamePlayed(msg.sender, choice, result, won, xpEarned);
    }

    function getPlayerGames(address player) external view returns (GameResult[] memory) {
        return playerGames[player];
    }

    function getPlayerStats(address player) external view returns (uint256 totalGames, uint256 wins, uint256 totalXPEarned) {
        GameResult[] memory games = playerGames[player];
        uint256 winCount = 0;
        uint256 totalXP = 0;
        for (uint256 i = 0; i < games.length; i++) {
            if (games[i].won) winCount++;
            totalXP += games[i].xpEarned;
        }
        return (games.length, winCount, totalXP);
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

