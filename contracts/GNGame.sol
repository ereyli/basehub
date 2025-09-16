// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GameToken.sol";

contract GNGame {
    GameToken public gameToken;
    address public owner;
    
    uint256 public constant GN_REWARD = 1 * 10**18; // 1 token
    uint256 public constant GAME_FEE = 0.000005 ether; // 0.000005 ETH fee
    
    mapping(address => uint256) public playerGNCount;
    mapping(address => uint256) public lastGNTime;
    
    event GNSent(address indexed player, string message, uint256 reward);
    
    constructor(address _gameToken) {
        gameToken = GameToken(_gameToken);
        owner = msg.sender;
    }
    
    // Send GN message and earn tokens
    function sendGN(string memory message) external payable {
        require(msg.value >= GAME_FEE, "Insufficient fee");
        require(bytes(message).length > 0, "Message cannot be empty");
        
        // Prevent spam (1 GN per minute)
        require(
            block.timestamp >= lastGNTime[msg.sender] + 60,
            "Wait 1 minute between GNs"
        );
        
        // Update player stats
        playerGNCount[msg.sender]++;
        lastGNTime[msg.sender] = block.timestamp;
        
        // Send fee to owner
        payable(owner).transfer(GAME_FEE);
        
        // Refund excess ETH
        if (msg.value > GAME_FEE) {
            payable(msg.sender).transfer(msg.value - GAME_FEE);
        }
        
        emit GNSent(msg.sender, message, 0); // No token reward, only XP
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 gnCount,
        uint256 lastGN,
        uint256 tokenBalance
    ) {
        return (
            playerGNCount[player],
            lastGNTime[player],
            gameToken.balanceOf(player)
        );
    }
    
    // Withdraw contract balance (only owner)
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
}
