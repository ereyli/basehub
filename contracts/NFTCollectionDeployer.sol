// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * NFTCollectionDeployer – Sadece NFT Launchpad için.
 * Tek fonksiyon: deployNFTCollection(initCode). Fee: 0.002 ETH.
 * ERC20/ERC721/ERC1155 deployer (BaseHubDeployer) ile karıştırılmaz.
 */
contract NFTCollectionDeployer {
    address public constant FEE_WALLET = 0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe;
    uint256 public constant FEE_NFT_COLLECTION = 0.002 ether;

    event Deployed(address indexed deployedAddress, uint8 tokenType);

    error FeeRequired();
    error FeeTransferFailed();
    error DeployFailed();

    function deployNFTCollection(bytes calldata initCode) external payable returns (address) {
        if (msg.value < FEE_NFT_COLLECTION) revert FeeRequired();
        (bool ok, ) = FEE_WALLET.call{value: FEE_NFT_COLLECTION}("");
        if (!ok) revert FeeTransferFailed();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 3); // 3 = NFT Collection (Launchpad)
        uint256 excess = msg.value - FEE_NFT_COLLECTION;
        if (excess > 0) {
            (bool refundOk, ) = msg.sender.call{value: excess}("");
            if (!refundOk) { /* excess stays in contract */ }
        }
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
}
