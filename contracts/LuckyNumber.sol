// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LuckyNumber {
    address public owner;
    
    uint256 public constant GAME_FEE = 0.00002 ether; // 0.00002 ETH fee
    uint256 public constant BASE_XP = 10; // Base XP for playing
    uint256 public constant WIN_BONUS_XP = 1000; // Massive bonus XP for winning
    
    mapping(address => uint256) public playerLuckyCount;
    event LuckyNumberGuessed(address indexed player, uint256 guess, uint256 result, bool won, uint256 xpEarned);
    
    constructor() {
        owner = msg.sender;
    }
    
    // Guess a lucky number (1-10) and earn tokens
    function guessLuckyNumber(uint256 guess) external payable {
        require(msg.value >= GAME_FEE, "Insufficient fee");
        require(guess >= 1 && guess <= 10, "Guess must be between 1 and 10");
        
        // Generate random number (1-10)
        uint256 result = (uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            block.number
        ))) % 10) + 1;
        
        bool won = (guess == result);
        uint256 xpEarned = BASE_XP;
        
        if (won) {
            // Add bonus XP for winning
            xpEarned += WIN_BONUS_XP;
        }
        
        // Update player stats
        playerLuckyCount[msg.sender]++;
        
        // Send fee to owner
        payable(owner).transfer(GAME_FEE);
        
        // Refund excess ETH
        if (msg.value > GAME_FEE) {
            payable(msg.sender).transfer(msg.value - GAME_FEE);
        }
        
        emit LuckyNumberGuessed(msg.sender, guess, result, won, xpEarned);
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 luckyCount
    ) {
        return playerLuckyCount[player];
    }
    
    // Withdraw contract balance (only owner)
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
}
