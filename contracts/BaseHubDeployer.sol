// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * BaseHubDeployer - Tek işlemde fee alır ve ERC20/ERC721/ERC1155 deploy eder.
 * Fee: 0.00025 ETH sabit. Frontend initCode (bytecode + constructor params) gönderir.
 */
contract BaseHubDeployer {
    address public constant FEE_WALLET = 0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe;
    uint256 public constant FEE = 0.00025 ether;

    event Deployed(address indexed deployedAddress, uint8 tokenType);

    error FeeRequired();
    error FeeTransferFailed();
    error DeployFailed();

    function deployERC20(bytes calldata initCode) external payable returns (address) {
        if (msg.value < FEE) revert FeeRequired();
        _sendFee();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 0);
        _refundExcess();
        return deployed;
    }

    function deployERC721(bytes calldata initCode) external payable returns (address) {
        if (msg.value < FEE) revert FeeRequired();
        _sendFee();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 1);
        _refundExcess();
        return deployed;
    }

    function deployERC1155(bytes calldata initCode) external payable returns (address) {
        if (msg.value < FEE) revert FeeRequired();
        _sendFee();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 2);
        _refundExcess();
        return deployed;
    }

    function _sendFee() internal {
        (bool ok, ) = FEE_WALLET.call{value: FEE}("");
        if (!ok) revert FeeTransferFailed();
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

    function _refundExcess() internal {
        uint256 excess = msg.value - FEE;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            if (!ok) {
                // Refund başarısız olsa bile deploy tamamlandı; excess kontratda kalır
            }
        }
    }
}
