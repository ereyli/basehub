// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GMGame {
    address public owner;
    
    uint256 public constant GAME_FEE = 0.000005 ether; // 0.000005 ETH fee
    
    mapping(address => uint256) public playerGMCount;
    
    event GMSent(address indexed player, string message);
    
    constructor() {
        owner = msg.sender;
    }
    
    // Send GM message and earn tokens
    function sendGM(string memory message) external payable {
        require(msg.value >= GAME_FEE, "Insufficient fee");
        require(bytes(message).length > 0, "Message cannot be empty");
        
        
        // Update player stats
        playerGMCount[msg.sender]++;
        
        // Send fee to owner
        payable(owner).transfer(GAME_FEE);
        
        // Refund excess ETH
        if (msg.value > GAME_FEE) {
            payable(msg.sender).transfer(msg.value - GAME_FEE);
        }
        
        emit GMSent(msg.sender, message);
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 gmCount
    ) {
        return playerGMCount[player];
    }
    
    // Withdraw contract balance (only owner)
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
}
