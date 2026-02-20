// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PredictionArena is Ownable, ReentrancyGuard {
    enum Side {
        Unresolved,
        Yes,
        No,
        Tie
    }

    struct Market {
        string question;
        address creator;
        uint64 endTime;
        uint256 totalYes;
        uint256 totalNo;
        bool resolved;
        Side winningSide;
        uint256 feeAmount;
        uint256 distributablePool;
    }

    uint256 public marketCount;

    uint256 public createFeeEth;
    uint256 public platformFeeBps;
    uint256 public maxBetPerUser;
    uint256 public lockWindowSeconds;
    uint256 public minDurationSeconds;
    uint256 public maxDurationSeconds;
    uint256 public spreadWarningBps;

    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000; // 10%
    uint256 public constant MIN_DURATION_FLOOR = 1 hours;
    uint256 public constant MAX_DURATION_CEILING = 1 days;

    mapping(uint256 => Market) private markets;
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    mapping(uint256 => mapping(address => uint256)) public noBets;
    mapping(uint256 => mapping(address => bool)) public claimed;

    error InvalidQuestion();
    error InvalidMarket();
    error InvalidAmount();
    error InvalidDuration();
    error InvalidFeeBps();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error MarketNotEnded();
    error MarketEnded();
    error BettingLocked();
    error MaxBetExceeded();
    error NoBetsPlaced();
    error NoClaimableAmount();
    error AlreadyClaimed();
    error TransferFailed();
    error InvalidLockWindow();
    error InvalidBounds();

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        uint256 endTime
    );
    event BetPlaced(
        uint256 indexed marketId,
        address indexed user,
        bool forYes,
        uint256 amount
    );
    event MarketResolved(
        uint256 indexed marketId,
        Side winningSide,
        uint256 totalPool,
        uint256 feeAmount
    );
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount);

    event CreateFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformFeeUpdated(uint256 oldBps, uint256 newBps);
    event MaxBetUpdated(uint256 oldMaxBet, uint256 newMaxBet);
    event LockWindowUpdated(uint256 oldWindow, uint256 newWindow);
    event DurationBoundsUpdated(uint256 oldMin, uint256 newMin, uint256 oldMax, uint256 newMax);
    event SpreadWarningUpdated(uint256 oldBps, uint256 newBps);

    constructor() Ownable(msg.sender) {
        // Defaults are embedded for one-click deploy from explorer UIs.
        uint256 initialPlatformFeeBps = 500; // 5%
        uint256 initialMaxBetPerUser = 0.05 ether; // owner can update anytime
        uint256 initialLockWindowMinutes = 5;
        uint256 initialMinDurationSeconds = 1 hours;
        uint256 initialMaxDurationSeconds = 1 days;

        if (initialPlatformFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps();
        if (initialMaxBetPerUser == 0) revert InvalidAmount();
        _validateDurationBounds(initialMinDurationSeconds, initialMaxDurationSeconds);

        uint256 lockWindow = initialLockWindowMinutes * 1 minutes;
        if (lockWindow >= initialMinDurationSeconds) revert InvalidLockWindow();

        createFeeEth = 0.001 ether;
        platformFeeBps = initialPlatformFeeBps;
        maxBetPerUser = initialMaxBetPerUser;
        lockWindowSeconds = lockWindow;
        minDurationSeconds = initialMinDurationSeconds;
        maxDurationSeconds = initialMaxDurationSeconds;
        spreadWarningBps = 9000; // 90%
    }

    function createMarket(string calldata question, uint256 endTime) external payable nonReentrant returns (uint256 marketId) {
        if (bytes(question).length == 0 || bytes(question).length > 200) revert InvalidQuestion();
        if (msg.value != createFeeEth) revert InvalidAmount();

        uint256 duration = endTime - block.timestamp;
        if (duration < minDurationSeconds || duration > maxDurationSeconds) revert InvalidDuration();

        marketId = ++marketCount;
        markets[marketId] = Market({
            question: question,
            creator: msg.sender,
            endTime: uint64(endTime),
            totalYes: 0,
            totalNo: 0,
            resolved: false,
            winningSide: Side.Unresolved,
            feeAmount: 0,
            distributablePool: 0
        });

        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        if (!sent) revert TransferFailed();

        emit MarketCreated(marketId, msg.sender, question, endTime);
    }

    function bet(uint256 marketId, bool forYes) external payable nonReentrant {
        uint256 amount = msg.value;
        if (amount == 0) revert InvalidAmount();

        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();
        if (m.resolved) revert MarketAlreadyResolved();
        if (block.timestamp >= m.endTime) revert MarketEnded();
        if (block.timestamp >= m.endTime - lockWindowSeconds) revert BettingLocked();

        if (forYes) {
            uint256 newTotalForUser = yesBets[marketId][msg.sender] + amount;
            if (newTotalForUser > maxBetPerUser) revert MaxBetExceeded();
            yesBets[marketId][msg.sender] = newTotalForUser;
            m.totalYes += amount;
        } else {
            uint256 newTotalForUser = noBets[marketId][msg.sender] + amount;
            if (newTotalForUser > maxBetPerUser) revert MaxBetExceeded();
            noBets[marketId][msg.sender] = newTotalForUser;
            m.totalNo += amount;
        }

        emit BetPlaced(marketId, msg.sender, forYes, amount);
    }

    function resolve(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();
        if (m.resolved) revert MarketAlreadyResolved();
        if (block.timestamp < m.endTime) revert MarketNotEnded();

        uint256 totalPool = m.totalYes + m.totalNo;
        if (totalPool == 0) revert NoBetsPlaced();

        m.resolved = true;
        if (m.totalYes == m.totalNo) {
            m.winningSide = Side.Tie;
        } else {
            m.winningSide = m.totalYes > m.totalNo ? Side.Yes : Side.No;
        }

        uint256 feeAmount = (totalPool * platformFeeBps) / 10_000;
        m.feeAmount = feeAmount;
        m.distributablePool = totalPool - feeAmount;

        if (feeAmount > 0) {
            (bool feeSent, ) = payable(owner()).call{value: feeAmount}("");
            if (!feeSent) revert TransferFailed();
        }

        emit MarketResolved(marketId, m.winningSide, totalPool, feeAmount);
    }

    function claim(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();
        if (!m.resolved) revert MarketNotResolved();
        if (claimed[marketId][msg.sender]) revert AlreadyClaimed();

        uint256 userStake;
        uint256 winningTotal;
        if (m.winningSide == Side.Yes) {
            userStake = yesBets[marketId][msg.sender];
            winningTotal = m.totalYes;
        } else if (m.winningSide == Side.No) {
            userStake = noBets[marketId][msg.sender];
            winningTotal = m.totalNo;
        } else if (m.winningSide == Side.Tie) {
            userStake = yesBets[marketId][msg.sender] + noBets[marketId][msg.sender];
            winningTotal = m.totalYes + m.totalNo;
        }

        if (userStake == 0 || winningTotal == 0) revert NoClaimableAmount();

        payout = (m.distributablePool * userStake) / winningTotal;
        if (payout == 0) revert NoClaimableAmount();

        claimed[marketId][msg.sender] = true;
        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        if (!sent) revert TransferFailed();

        emit Claimed(marketId, msg.sender, payout);
    }

    function setCreateFeeEth(uint256 newFee) external onlyOwner {
        uint256 oldFee = createFeeEth;
        createFeeEth = newFee;
        emit CreateFeeUpdated(oldFee, newFee);
    }

    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps();
        uint256 oldBps = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldBps, newFeeBps);
    }

    function setMaxBetPerUser(uint256 newMaxBet) external onlyOwner {
        if (newMaxBet == 0) revert InvalidAmount();
        uint256 oldMaxBet = maxBetPerUser;
        maxBetPerUser = newMaxBet;
        emit MaxBetUpdated(oldMaxBet, newMaxBet);
    }

    function setLockWindowMinutes(uint256 newLockWindowMinutes) external onlyOwner {
        uint256 newWindow = newLockWindowMinutes * 1 minutes;
        if (newWindow >= minDurationSeconds) revert InvalidLockWindow();
        uint256 oldWindow = lockWindowSeconds;
        lockWindowSeconds = newWindow;
        emit LockWindowUpdated(oldWindow, newWindow);
    }

    function setDurationBounds(uint256 newMinDurationSeconds, uint256 newMaxDurationSeconds) external onlyOwner {
        _validateDurationBounds(newMinDurationSeconds, newMaxDurationSeconds);
        if (lockWindowSeconds >= newMinDurationSeconds) revert InvalidLockWindow();

        uint256 oldMin = minDurationSeconds;
        uint256 oldMax = maxDurationSeconds;

        minDurationSeconds = newMinDurationSeconds;
        maxDurationSeconds = newMaxDurationSeconds;

        emit DurationBoundsUpdated(oldMin, newMinDurationSeconds, oldMax, newMaxDurationSeconds);
    }

    function setSpreadWarningBps(uint256 newSpreadWarningBps) external onlyOwner {
        if (newSpreadWarningBps > 10_000) revert InvalidFeeBps();
        uint256 oldBps = spreadWarningBps;
        spreadWarningBps = newSpreadWarningBps;
        emit SpreadWarningUpdated(oldBps, newSpreadWarningBps);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        Market memory m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();
        return m;
    }

    function getUserStakes(uint256 marketId, address user) external view returns (uint256 yesStake, uint256 noStake) {
        if (markets[marketId].creator == address(0)) revert InvalidMarket();
        yesStake = yesBets[marketId][user];
        noStake = noBets[marketId][user];
    }

    function isBetLocked(uint256 marketId) external view returns (bool) {
        Market memory m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();
        if (m.resolved || block.timestamp >= m.endTime) return true;
        return block.timestamp >= m.endTime - lockWindowSeconds;
    }

    function getClaimable(uint256 marketId, address user) external view returns (uint256) {
        Market memory m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();
        if (!m.resolved || claimed[marketId][user]) return 0;

        uint256 userStake;
        uint256 winningTotal;
        if (m.winningSide == Side.Yes) {
            userStake = yesBets[marketId][user];
            winningTotal = m.totalYes;
        } else if (m.winningSide == Side.No) {
            userStake = noBets[marketId][user];
            winningTotal = m.totalNo;
        } else if (m.winningSide == Side.Tie) {
            userStake = yesBets[marketId][user] + noBets[marketId][user];
            winningTotal = m.totalYes + m.totalNo;
        } else {
            return 0;
        }

        if (userStake == 0 || winningTotal == 0) return 0;
        return (m.distributablePool * userStake) / winningTotal;
    }

    function getMarketImbalance(uint256 marketId) external view returns (uint256 yesTotal, uint256 noTotal, uint256 imbalanceBps, bool isWarning) {
        Market memory m = markets[marketId];
        if (m.creator == address(0)) revert InvalidMarket();

        yesTotal = m.totalYes;
        noTotal = m.totalNo;
        uint256 total = yesTotal + noTotal;
        if (total == 0) return (yesTotal, noTotal, 0, false);

        uint256 dominant = yesTotal > noTotal ? yesTotal : noTotal;
        imbalanceBps = (dominant * 10_000) / total;
        isWarning = imbalanceBps >= spreadWarningBps;
    }

    receive() external payable {}

    function _validateDurationBounds(uint256 minSeconds, uint256 maxSeconds) internal pure {
        if (
            minSeconds < MIN_DURATION_FLOOR ||
            maxSeconds > MAX_DURATION_CEILING ||
            minSeconds >= maxSeconds
        ) {
            revert InvalidBounds();
        }
    }
}
