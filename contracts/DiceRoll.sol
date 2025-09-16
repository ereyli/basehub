// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GameToken.sol";

contract DiceRoll {
    GameToken public gameToken;
    address public owner;
    
    uint256 public constant GAME_FEE = 0.000005 ether; // 0.000005 ETH fee
    uint256 public constant BASE_XP = 10; // Base XP for playing
    uint256 public constant WIN_BONUS_XP = 1500; // Massive bonus XP for winning
    
    mapping(address => uint256) public playerDiceCount;
    event DiceRolled(address indexed player, uint256 guess, uint256 result, bool won, uint256 xpEarned);
    
    constructor(address _gameToken) {
        gameToken = GameToken(_gameToken);
        owner = msg.sender;
    }
    
    // Roll dice and guess the result (1-6)
    function rollDice(uint256 guess) external payable {
        require(msg.value >= GAME_FEE, "Insufficient fee");
        require(guess >= 1 && guess <= 6, "Guess must be between 1 and 6");
        
        // Generate random dice roll (1-6)
        uint256 result = (uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            block.number
        ))) % 6) + 1;
        
        bool won = (guess == result);
        uint256 xpEarned = BASE_XP;
        
        if (won) {
            // Add bonus XP for winning
            xpEarned += WIN_BONUS_XP;
        }
        
        // Update player stats
        playerDiceCount[msg.sender]++;
        
        // Send fee to owner
        payable(owner).transfer(GAME_FEE);
        
        // Refund excess ETH
        if (msg.value > GAME_FEE) {
            payable(msg.sender).transfer(msg.value - GAME_FEE);
        }
        
        emit DiceRolled(msg.sender, guess, result, won, xpEarned);
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 diceCount,
        uint256 tokenBalance
    ) {
        return (
            playerDiceCount[player],
            gameToken.balanceOf(player)
        );
    }
    
    // Withdraw contract balance (only owner)
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
}
