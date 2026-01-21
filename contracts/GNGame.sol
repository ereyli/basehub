// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GNGame {
    address public owner;
    
    uint256 public constant GAME_FEE = 0.00002 ether; // 0.00002 ETH fee
    
    mapping(address => uint256) public playerGNCount;
    
    event GNSent(address indexed player, string message);
    
    constructor() {
        owner = msg.sender;
    }
    
    // Send GN message and earn tokens
    function sendGN(string memory message) external payable {
        require(msg.value >= GAME_FEE, "Insufficient fee");
        require(bytes(message).length > 0, "Message cannot be empty");
        
        
        // Update player stats
        playerGNCount[msg.sender]++;
        
        // Send fee to owner
        payable(owner).transfer(GAME_FEE);
        
        // Refund excess ETH
        if (msg.value > GAME_FEE) {
            payable(msg.sender).transfer(msg.value - GAME_FEE);
        }
        
        emit GNSent(msg.sender, message);
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 gnCount
    ) {
        return playerGNCount[player];
    }
    
    // Withdraw contract balance (only owner)
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
}
