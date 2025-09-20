// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ERC721Template.sol";

contract NFTFactory {
    address public owner;
    uint256 public deployFee = 0.0001 ether;
    
    event NFTCollectionDeployed(address indexed collection, address indexed creator, string name, string symbol);
    
    constructor() {
        owner = msg.sender;
    }
    
    function deployNFTCollection(
        string memory name,
        string memory symbol,
        string memory baseTokenURI,
        uint256 maxSupply,
        uint256 mintPrice
    ) external payable returns (address) {
        require(msg.value >= deployFee, "Insufficient fee");
        
        // Send fee to owner
        payable(owner).transfer(deployFee);
        
        // Deploy new NFT collection
        ERC721Template newCollection = new ERC721Template(
            name,
            symbol,
            baseTokenURI,
            maxSupply,
            mintPrice
        );
        
        // Transfer ownership to deployer
        newCollection.transferOwnership(msg.sender);
        
        emit NFTCollectionDeployed(address(newCollection), msg.sender, name, symbol);
        
        return address(newCollection);
    }
    
    function setDeployFee(uint256 _fee) external {
        require(msg.sender == owner, "Only owner");
        deployFee = _fee;
    }
}
