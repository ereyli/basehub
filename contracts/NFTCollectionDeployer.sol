// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * NFTCollectionDeployer – Sadece NFT Launchpad için.
 * deployNFTCollection(initCode): BaseHub Early Access Pass sahipleri 0.0005 ETH,
 * diğerleri 0.002 ETH öder.
 */
interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

contract NFTCollectionDeployer {
    address public constant FEE_WALLET = 0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe;
    /// @notice Early Access Pass NFT (Base mainnet) – holder'lar indirimli fee öder
    address public constant EARLY_ACCESS_NFT = 0x2f2b186B666Dd58D80e0b062A65F6EBd43a3CEC1;

    uint256 public constant FEE_NFT_COLLECTION = 0.002 ether;       // non-holder
    uint256 public constant FEE_NFT_COLLECTION_HOLDER = 0.0005 ether; // Early Access Pass holder

    event Deployed(address indexed deployedAddress, uint8 tokenType);

    error FeeRequired();
    error FeeTransferFailed();
    error DeployFailed();

    function _requiredFee(address caller) internal view returns (uint256) {
        if (EARLY_ACCESS_NFT == address(0)) return FEE_NFT_COLLECTION;
        if (IERC721Balance(EARLY_ACCESS_NFT).balanceOf(caller) > 0) return FEE_NFT_COLLECTION_HOLDER;
        return FEE_NFT_COLLECTION;
    }

    function deployNFTCollection(bytes calldata initCode) external payable returns (address) {
        uint256 required = _requiredFee(msg.sender);
        if (msg.value < required) revert FeeRequired();
        (bool ok, ) = FEE_WALLET.call{value: required}("");
        if (!ok) revert FeeTransferFailed();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 3); // 3 = NFT Collection (Launchpad)
        uint256 excess = msg.value - required;
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
