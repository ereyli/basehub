// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GMGame {
    address public owner;
    
    uint256 public constant GAME_FEE = 0.00002 ether; // 0.00002 ETH fee
    
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
        (bool success1, ) = payable(owner).call{value: GAME_FEE}("");
        require(success1, "Fee transfer failed");
        
        // Refund excess ETH
        if (msg.value > GAME_FEE) {
            (bool success2, ) = payable(msg.sender).call{value: msg.value - GAME_FEE}("");
            require(success2, "Refund transfer failed");
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
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
