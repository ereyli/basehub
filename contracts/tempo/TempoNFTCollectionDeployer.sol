// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * Tempo version of NFTCollectionDeployer.
 * Converted with fixed 2200 USD/ETH:
 * - 0.002 ETH => 4.4 USD
 */
contract TempoNFTCollectionDeployer {
    address public owner;
    IFeeToken public feeToken;

    uint256 public constant FEE_NFT_COLLECTION_USD6 = 4_400_000;

    event Deployed(address indexed deployedAddress, uint8 tokenType);

    error FeeRequired();
    error FeeTransferFailed();
    error DeployFailed();

    constructor() {
        owner = msg.sender;
    }

    function deployNFTCollection(bytes calldata initCode) external returns (address) {
        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, FEE_NFT_COLLECTION_USD6);
        if (!ok) revert FeeTransferFailed();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 3);
        return deployed;
    }

    function _deploy(bytes calldata initCode) internal returns (address deployed) {
        assembly {
            let size := initCode.length
            let ptr := mload(0x40)
            calldatacopy(ptr, initCode.offset, size)
            deployed := create(0, ptr, size)
        }
        if (deployed == address(0)) revert DeployFailed();
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

