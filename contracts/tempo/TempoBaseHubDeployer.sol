// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * Tempo version of BaseHubDeployer.
 * Original ETH fees converted with fixed 2200 USD/ETH:
 * - 0.00025 ETH => 0.55 USD
 * - 0.002 ETH   => 4.4 USD
 */
contract TempoBaseHubDeployer {
    address public owner;
    IFeeToken public feeToken;
    // USD fees in 6-decimal token units
    uint256 public constant FEE_USD6 = 550_000; // 0.55 USD
    uint256 public constant FEE_NFT_COLLECTION_USD6 = 4_400_000; // 4.4 USD

    event Deployed(address indexed deployedAddress, uint8 tokenType);

    error FeeRequired();
    error FeeTransferFailed();
    error DeployFailed();

    constructor() {
        owner = msg.sender;
    }

    function deployERC20(bytes calldata initCode) external returns (address) {
        _sendFee();
        address deployed = _deploy(initCode);
        _forwardERC20Balance(deployed, tx.origin);
        emit Deployed(deployed, 0);
        return deployed;
    }

    function deployERC721(bytes calldata initCode) external returns (address) {
        _sendFee();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 1);
        return deployed;
    }

    function deployERC1155(bytes calldata initCode) external returns (address) {
        _sendFee();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 2);
        return deployed;
    }

    function deployNFTCollection(bytes calldata initCode) external returns (address) {
        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, FEE_NFT_COLLECTION_USD6);
        if (!ok) revert FeeTransferFailed();
        address deployed = _deploy(initCode);
        emit Deployed(deployed, 3);
        return deployed;
    }

    function _sendFee() internal {
        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, FEE_USD6);
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

    function _forwardERC20Balance(address token, address to) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            (bool ok, ) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, balance));
            if (!ok) { }
        }
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

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IFeeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

