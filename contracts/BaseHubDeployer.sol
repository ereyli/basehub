// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * BaseHubDeployer - Tek işlemde fee alır ve ERC20/ERC721/ERC1155 deploy eder.
 * Fee: 0.00025 ETH sabit. Frontend initCode (bytecode + constructor params) gönderir.
 * ERC20: Constructor'da mint msg.sender'a (yani bu kontrata) gider; hemen tx.origin'e (çağıran kullanıcıya) transfer edilir.
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
        // Token arzı constructor'da bu kontrata mint edildi; kullanıcıya (tx.origin) aktar
        _forwardERC20Balance(deployed, tx.origin);
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

    /// @dev Deploy edilen ERC20'nin bu kontrattaki bakiyesini hedef adrese (genelde tx.origin) gönderir.
    function _forwardERC20Balance(address token, address to) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            (bool ok, ) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, balance));
            if (!ok) {
                // Transfer başarısız olsa bile deploy tamamlandı; token deployer'da kalır
            }
        }
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

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
