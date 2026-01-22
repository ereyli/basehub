// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FlipGame {
    address public owner;
    
    uint256 public constant GAME_FEE = 0.00002 ether; // 0.00002 ETH fee
    uint256 public constant BASE_XP = 10; // Base XP for playing
    uint256 public constant WIN_BONUS_XP = 500; // Massive bonus XP for winning
    
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
    
    event GamePlayed(
        address indexed player,
        Side choice,
        Side result,
        bool won,
        uint256 xpEarned
    );
    
    constructor() {
        owner = msg.sender;
    }
    
    // Play coin flip game
    function playFlip(Side choice) external payable {
        require(msg.value >= GAME_FEE, "Insufficient ETH for game fee");
        
        // Generate random result
        Side result = Side(uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            block.number
        ))) % 2);
        
        bool won = (choice == result);
        uint256 xpEarned = BASE_XP;
        
        if (won) {
            // Add bonus XP for winning
            xpEarned += WIN_BONUS_XP;
        }
        
        // Record game result
        GameResult memory gameResult = GameResult({
            playerChoice: choice,
            result: result,
            won: won,
            xpEarned: xpEarned,
            timestamp: block.timestamp
        });
        
        playerGames[msg.sender].push(gameResult);
        playerStats[msg.sender]++;
        
        // Send game fee to owner
        (bool success, ) = payable(owner).call{value: GAME_FEE}("");
        require(success, "Fee transfer failed");
        
        emit GamePlayed(msg.sender, choice, result, won, xpEarned);
    }
    
    // Get player game history
    function getPlayerGames(address player) external view returns (GameResult[] memory) {
        return playerGames[player];
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 totalGames,
        uint256 wins,
        uint256 totalXPEarned
    ) {
        GameResult[] memory games = playerGames[player];
        uint256 winCount = 0;
        uint256 totalXP = 0;
        
        for (uint256 i = 0; i < games.length; i++) {
            if (games[i].won) {
                winCount++;
            }
            totalXP += games[i].xpEarned;
        }
        
        return (
            games.length,
            winCount,
            totalXP
        );
    }
    
    // Withdraw contract balance (only owner)
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
