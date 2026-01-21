// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SlotGame {
    address public owner;
    
    // Game constants
    uint256 public constant CREDIT_PRICE = 0.00005 ether; // 0.00005 ETH per credit
    uint256 public constant CREDITS_PER_SPIN = 1; // 1 credit per spin
    uint256 public constant BASE_XP = 10; // Base XP for playing
    uint256 public constant WIN_XP_2_MATCH = 100; // XP for 2 matching symbols
    uint256 public constant WIN_XP_3_MATCH = 500; // XP for 3 matching symbols  
    uint256 public constant WIN_XP_4_MATCH = 2000; // XP for 4 matching symbols (combo)
    
    // Symbol types (0-3 for different crypto symbols)
    uint256 public constant SYMBOL_COUNT = 4;
    
    // Player data
    mapping(address => uint256) public playerCredits;
    mapping(address => uint256) public playerSpinCount;
    mapping(address => uint256) public playerTotalWins;
    
    // Events
    event CreditsPurchased(address indexed player, uint256 amount, uint256 totalCredits);
    event SlotSpun(address indexed player, uint256[4] symbols, bool won, uint256 xpEarned);
    event CreditsWithdrawn(address indexed player, uint256 amount);
    
    constructor() {
        owner = msg.sender;
    }
    
    // Purchase credits with ETH
    function purchaseCredits(uint256 amount) external payable {
        require(amount > 0, "Amount must be greater than 0");
        uint256 totalCost = amount * CREDIT_PRICE;
        require(msg.value >= totalCost, "Insufficient ETH for credits");
        
        playerCredits[msg.sender] += amount;
        
        // Send ETH directly to owner
        payable(owner).transfer(totalCost);
        
        // Refund excess ETH
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit CreditsPurchased(msg.sender, amount, playerCredits[msg.sender]);
    }
    
    // Spin the slot machine
    function spinSlot() external {
        require(playerCredits[msg.sender] >= CREDITS_PER_SPIN, "Insufficient credits");
        
        // Deduct credit
        playerCredits[msg.sender] -= CREDITS_PER_SPIN;
        
        // Generate 4 random symbols
        uint256[4] memory symbols;
        for (uint256 i = 0; i < 4; i++) {
            symbols[i] = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                block.number,
                i
            ))) % SYMBOL_COUNT;
        }
        
        // Check for wins
        bool won = false;
        uint256 xpEarned = BASE_XP;
        
        // Count symbol occurrences
        uint256[7] memory symbolCounts;
        for (uint256 i = 0; i < 4; i++) {
            symbolCounts[symbols[i]]++;
        }
        
        // Check for matches
        for (uint256 i = 0; i < SYMBOL_COUNT; i++) {
            if (symbolCounts[i] >= 2) {
                won = true;
                if (symbolCounts[i] == 2) {
                    xpEarned += WIN_XP_2_MATCH;
                } else if (symbolCounts[i] == 3) {
                    xpEarned += WIN_XP_3_MATCH;
                } else if (symbolCounts[i] == 4) {
                    xpEarned += WIN_XP_4_MATCH; // Combo!
                }
            }
        }
        
        // Update player stats
        playerSpinCount[msg.sender]++;
        if (won) {
            playerTotalWins[msg.sender]++;
        }
        
        emit SlotSpun(msg.sender, symbols, won, xpEarned);
    }
    
    // Get player stats
    function getPlayerStats(address player) external view returns (
        uint256 credits,
        uint256 spinCount,
        uint256 totalWins
    ) {
        return (
            playerCredits[player],
            playerSpinCount[player],
            playerTotalWins[player]
        );
    }
    
    // Get symbol names for frontend
    function getSymbolName(uint256 symbolId) external pure returns (string memory) {
        string[4] memory symbolNames = [
            "ETH",  // Ethereum
            "BTC",  // Bitcoin
            "USDC", // USD Coin
            "USDT"  // Tether
        ];
        
        require(symbolId < SYMBOL_COUNT, "Invalid symbol ID");
        return symbolNames[symbolId];
    }
    
    // Withdraw any stuck ETH to owner (only owner) - for emergency use only
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner).transfer(balance);
    }
    
    // Get contract balance (for owner to check)
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Emergency function to withdraw credits (only owner) - for stuck credits
    function emergencyWithdrawCredits(address player) external {
        require(msg.sender == owner, "Only owner");
        uint256 credits = playerCredits[player];
        if (credits > 0) {
            playerCredits[player] = 0;
            emit CreditsWithdrawn(player, credits);
        }
    }
}
