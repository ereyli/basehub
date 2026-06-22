// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC8004IdentityRegistry {
    function register(string calldata agentURI) external returns (uint256 agentId);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/**
 * @title BaseHubERC8004Registrar
 * @notice Collects a BaseHub fee and registers ERC-8004 agent identities through
 * the canonical Identity Registry. The agent NFT is transferred to the user in
 * the same transaction.
 */
contract BaseHubERC8004Registrar {
    IERC8004IdentityRegistry public identityRegistry;
    address public owner;
    address public feeWallet;
    uint256 public feeWei;
    bool private locked;

    event AgentRegistered(
        address indexed user,
        uint256 indexed agentId,
        string agentURI,
        uint256 feePaid
    );
    event FeeUpdated(uint256 feeWei);
    event FeeWalletUpdated(address indexed feeWallet);
    event IdentityRegistryUpdated(address indexed identityRegistry);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ReentrantCall();
    error InvalidAddress();
    error FeeRequired();
    error FeeTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    constructor(address identityRegistry_, address feeWallet_, uint256 feeWei_) {
        if (identityRegistry_ == address(0) || feeWallet_ == address(0)) revert InvalidAddress();
        identityRegistry = IERC8004IdentityRegistry(identityRegistry_);
        feeWallet = feeWallet_;
        feeWei = feeWei_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        emit IdentityRegistryUpdated(identityRegistry_);
        emit FeeWalletUpdated(feeWallet_);
        emit FeeUpdated(feeWei_);
    }

    function registerAgent(string calldata agentURI) external payable nonReentrant returns (uint256 agentId) {
        if (msg.value < feeWei) revert FeeRequired();

        agentId = identityRegistry.register(agentURI);
        identityRegistry.transferFrom(address(this), msg.sender, agentId);

        (bool feeOk, ) = feeWallet.call{value: feeWei}("");
        if (!feeOk) revert FeeTransferFailed();

        uint256 refund = msg.value - feeWei;
        if (refund > 0) {
            (bool refundOk, ) = msg.sender.call{value: refund}("");
            if (!refundOk) {
                // Refund failures do not block a successful registration.
            }
        }

        emit AgentRegistered(msg.sender, agentId, agentURI, feeWei);
    }

    function setFeeWei(uint256 feeWei_) external onlyOwner {
        feeWei = feeWei_;
        emit FeeUpdated(feeWei_);
    }

    function setFeeWallet(address feeWallet_) external onlyOwner {
        if (feeWallet_ == address(0)) revert InvalidAddress();
        feeWallet = feeWallet_;
        emit FeeWalletUpdated(feeWallet_);
    }

    function setIdentityRegistry(address identityRegistry_) external onlyOwner {
        if (identityRegistry_ == address(0)) revert InvalidAddress();
        identityRegistry = IERC8004IdentityRegistry(identityRegistry_);
        emit IdentityRegistryUpdated(identityRegistry_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function withdrawStuckETH(address payable to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        (bool ok, ) = to.call{value: address(this).balance}("");
        if (!ok) revert FeeTransferFailed();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
