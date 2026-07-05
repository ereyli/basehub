// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IB20Factory {
    function createB20(uint8 variant, bytes32 salt, bytes calldata params, bytes[] calldata initCalls)
        external
        payable
        returns (address token);

    function getB20Address(uint8 variant, address sender, bytes32 salt) external view returns (address token);
}

/**
 * @title BaseHubB20Launcher
 * @notice Atomic BaseHub fee wrapper around Base's B20 factory precompile.
 */
contract BaseHubB20Launcher {
    address public constant B20_FACTORY = 0xB20f000000000000000000000000000000000000;

    address public owner;
    address public feeWallet;
    uint256 public feeWei = 0.0008 ether;

    event B20Launched(
        address indexed user,
        address indexed token,
        uint8 indexed variant,
        bytes32 userSalt,
        bytes32 factorySalt,
        uint256 feePaid
    );
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event FeeWeiUpdated(uint256 oldFeeWei, uint256 newFeeWei);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event EmergencyWithdraw(address indexed recipient, uint256 amount);

    error NotOwner();
    error InvalidAddress();
    error InvalidVariant();
    error FeeRequired();
    error FeeTransferFailed();
    error RefundFailed();

    constructor(address feeWallet_) {
        if (feeWallet_ == address(0)) revert InvalidAddress();
        owner = msg.sender;
        feeWallet = feeWallet_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeWalletUpdated(address(0), feeWallet_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function createB20(uint8 variant, bytes32 userSalt, bytes calldata params, bytes[] calldata initCalls)
        external
        payable
        returns (address token)
    {
        if (variant > 1) revert InvalidVariant();
        if (msg.value < feeWei) revert FeeRequired();

        bytes32 factorySalt = deriveSalt(msg.sender, userSalt);
        token = IB20Factory(B20_FACTORY).createB20(variant, factorySalt, params, initCalls);

        (bool feeOk,) = payable(feeWallet).call{value: feeWei}("");
        if (!feeOk) revert FeeTransferFailed();

        uint256 excess = msg.value - feeWei;
        if (excess > 0) {
            (bool refundOk,) = payable(msg.sender).call{value: excess}("");
            if (!refundOk) revert RefundFailed();
        }

        emit B20Launched(msg.sender, token, variant, userSalt, factorySalt, feeWei);
    }

    function getB20Address(uint8 variant, address user, bytes32 userSalt) external view returns (address) {
        if (variant > 1) revert InvalidVariant();
        return IB20Factory(B20_FACTORY).getB20Address(variant, address(this), deriveSalt(user, userSalt));
    }

    function deriveSalt(address user, bytes32 userSalt) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, userSalt));
    }

    function setFeeWallet(address newFeeWallet) external onlyOwner {
        if (newFeeWallet == address(0)) revert InvalidAddress();
        emit FeeWalletUpdated(feeWallet, newFeeWallet);
        feeWallet = newFeeWallet;
    }

    function setFeeWei(uint256 newFeeWei) external onlyOwner {
        emit FeeWeiUpdated(feeWei, newFeeWei);
        feeWei = newFeeWei;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert FeeRequired();
        (bool ok,) = payable(owner).call{value: balance}("");
        if (!ok) revert RefundFailed();
        emit EmergencyWithdraw(owner, balance);
    }
}
