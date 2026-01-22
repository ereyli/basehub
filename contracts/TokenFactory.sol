// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ERC20Template.sol";

contract TokenFactory {
    address public owner;
    uint256 public deployFee = 0.00001 ether;
    
    event TokenDeployed(address indexed token, address indexed creator, string name, string symbol);
    
    constructor() {
        owner = msg.sender;
    }
    
    function deployToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 decimals
    ) external payable returns (address) {
        require(msg.value >= deployFee, "Insufficient fee");
        
        // Send fee to owner
        (bool success, ) = payable(owner).call{value: deployFee}("");
        require(success, "Fee transfer failed");
        
        // Deploy new token
        ERC20Template newToken = new ERC20Template(
            name,
            symbol,
            initialSupply,
            decimals
        );
        
        // Transfer ownership to deployer
        newToken.transferOwnership(msg.sender);
        
        emit TokenDeployed(address(newToken), msg.sender, name, symbol);
        
        return address(newToken);
    }
    
    function setDeployFee(uint256 _fee) external {
        require(msg.sender == owner, "Only owner");
        deployFee = _fee;
    }
}
