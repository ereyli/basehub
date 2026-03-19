// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TempoSlotGame {
    address public owner;
    IFeeToken public feeToken;

    // 0.044 USD per credit (6-decimal token units)
    uint256 public constant CREDIT_PRICE_USD6 = 44_000;
    uint256 public constant CREDITS_PER_SPIN = 1;
    uint256 public constant BASE_XP = 10;
    uint256 public constant WIN_XP_2_MATCH = 100;
    uint256 public constant WIN_XP_3_MATCH = 500;
    uint256 public constant WIN_XP_4_MATCH = 2000;
    uint256 public constant SYMBOL_COUNT = 4;

    mapping(address => uint256) public playerCredits;
    mapping(address => uint256) public playerSpinCount;
    mapping(address => uint256) public playerTotalWins;

    event CreditsPurchased(address indexed player, uint256 amount, uint256 totalCredits);
    event SlotSpun(address indexed player, uint256[4] symbols, bool won, uint256 xpEarned);
    event CreditsWithdrawn(address indexed player, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function purchaseCredits(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        uint256 totalCost = amount * CREDIT_PRICE_USD6;

        playerCredits[msg.sender] += amount;

        require(address(feeToken) != address(0), "Fee token not set");
        bool ok = feeToken.transferFrom(msg.sender, owner, totalCost);
        require(ok, "Payment transfer failed");

        emit CreditsPurchased(msg.sender, amount, playerCredits[msg.sender]);
    }

    function spinSlot() external {
        require(playerCredits[msg.sender] >= CREDITS_PER_SPIN, "Insufficient credits");
        playerCredits[msg.sender] -= CREDITS_PER_SPIN;

        uint256[4] memory symbols;
        for (uint256 i = 0; i < 4; i++) {
            symbols[i] = uint256(keccak256(abi.encodePacked(
                block.timestamp, block.prevrandao, msg.sender, block.number, i
            ))) % SYMBOL_COUNT;
        }

        bool won = false;
        uint256 xpEarned = BASE_XP;
        uint256[7] memory symbolCounts;
        for (uint256 i = 0; i < 4; i++) {
            symbolCounts[symbols[i]]++;
        }
        for (uint256 i = 0; i < SYMBOL_COUNT; i++) {
            if (symbolCounts[i] >= 2) {
                won = true;
                if (symbolCounts[i] == 2) xpEarned += WIN_XP_2_MATCH;
                else if (symbolCounts[i] == 3) xpEarned += WIN_XP_3_MATCH;
                else if (symbolCounts[i] == 4) xpEarned += WIN_XP_4_MATCH;
            }
        }

        playerSpinCount[msg.sender]++;
        if (won) playerTotalWins[msg.sender]++;

        emit SlotSpun(msg.sender, symbols, won, xpEarned);
    }

    function getPlayerStats(address player) external view returns (uint256 credits, uint256 spinCount, uint256 totalWins) {
        return (playerCredits[player], playerSpinCount[player], playerTotalWins[player]);
    }

    function getSymbolName(uint256 symbolId) external pure returns (string memory) {
        string[4] memory symbolNames = ["ETH", "BTC", "USDC", "USDT"];
        require(symbolId < SYMBOL_COUNT, "Invalid symbol ID");
        return symbolNames[symbolId];
    }

    function setOwner(address newOwner) external {
        require(msg.sender == owner, "Only owner");
        owner = newOwner;
    }

    function setFeeToken(address feeToken_) external {
        require(msg.sender == owner, "Only owner");
        feeToken = IFeeToken(feeToken_);
    }

    function getContractBalance() external view returns (uint256) {
        return feeToken.balanceOf(address(this));
    }

    function emergencyWithdrawCredits(address player) external {
        require(msg.sender == owner, "Only owner");
        uint256 credits = playerCredits[player];
        if (credits > 0) {
            playerCredits[player] = 0;
            emit CreditsWithdrawn(player, credits);
        }
    }
}

interface IFeeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

