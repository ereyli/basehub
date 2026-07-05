// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IB20FactoryPrecompile {
    function createB20(uint8 variant, bytes32 salt, bytes calldata params, bytes[] calldata initCalls)
        external
        payable
        returns (address token);

    function getB20Address(uint8 variant, address sender, bytes32 salt) external view returns (address token);
}

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniV2RouterLike {
    function factory() external view returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);

    function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts);
}

interface IUniV2FactoryLike {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

struct B20AssetCreateParams {
    uint8 version;
    string name;
    string symbol;
    address initialAdmin;
    uint8 decimals;
}

/**
 * @title BaseHubB20BondingLaunchpad
 * @notice B20-native bonding curve launchpad for Base Sepolia testing and future Base mainnet activation.
 * @dev Creates B20 Asset tokens through the B20 factory precompile, mints supply to this launchpad,
 *      trades against virtual reserves, and locks graduation liquidity at the 5 ETH threshold.
 */
contract BaseHubB20BondingLaunchpad {
    uint8 public constant B20_ASSET_VARIANT = 0;
    address public constant B20_FACTORY = 0xB20f000000000000000000000000000000000000;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant MAX_CREATOR_ALLOCATION_BPS = 1_000; // 10%

    uint256 public createFeeWei = 0.001 ether;
    uint256 public tradingFeeBps = 60; // 0.6% total, split 50/50 platform/creator.
    uint256 public graduationThresholdWei = 5 ether;
    uint256 public initialVirtualEth = 1 ether;

    address public owner;
    address public feeWallet;
    address public router;
    address public weth;
    bool public paused;
    bool private locked;

    uint256 public totalTokensCreated;
    uint256 public totalVolumeETH;
    uint256 public totalGraduated;

    struct TokenCore {
        address creator;
        uint256 virtualETH;
        uint256 virtualTokens;
        uint256 realETH;
        uint256 creatorAllocation;
        uint256 createdAt;
        address uniswapPair;
        bool graduated;
    }

    struct TokenStats {
        uint256 buys;
        uint256 sells;
        uint256 vol;
        uint256 holders;
        uint256 gradAt;
    }

    struct TokenMeta {
        string name;
        string symbol;
        string desc;
        string img;
    }

    mapping(address => TokenCore) public tokenCore;
    mapping(address => TokenStats) public tokenStats;
    mapping(address => mapping(address => bool)) private holderSeen;
    mapping(address => TokenMeta) private tokenMeta;
    mapping(address => address[]) public creatorTokens;
    mapping(address => uint256) public fees;
    mapping(address => uint256) public refunds;
    mapping(address => uint256) public lockedLiquidityETH;
    mapping(address => uint256) public lockedLiquidityTokens;
    address[] public allTokens;

    event TC(address indexed t, address indexed c, string n, string s, uint256 a);
    event TB(address indexed t, address indexed b, uint256 e, uint256 o, uint256 f);
    event TS2(address indexed t, address indexed s, uint256 i, uint256 o, uint256 f);
    event TG(address indexed t, address indexed p, uint256 e, uint256 tk);
    event B20CurveCreated(address indexed token, address indexed creator, bytes32 userSalt, bytes32 factorySalt);
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter, address indexed newWeth);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event PausedUpdated(bool paused);
    event EmergencyWithdraw(address indexed recipient, address indexed asset, uint256 amount);

    error NotOwner();
    error Reentrant();
    error Paused();
    error InvalidAddress();
    error InvalidInput();
    error FeeRequired();
    error TokenNotFound();
    error Slippage();
    error TransferFailed();
    error AlreadyGraduated();
    error NotGraduated();
    error NoFees();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrant();
        locked = true;
        _;
        locked = false;
    }

    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor(address feeWallet_, address router_, address weth_) {
        if (feeWallet_ == address(0)) revert InvalidAddress();
        owner = msg.sender;
        feeWallet = feeWallet_;
        router = router_;
        weth = weth_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeWalletUpdated(address(0), feeWallet_);
        emit RouterUpdated(address(0), router_, weth_);
    }

    function createCurveB20(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata image,
        uint256 creatorAllocationBps,
        bytes32 userSalt
    ) external payable nonReentrant notPaused returns (address token) {
        if (msg.value < createFeeWei) revert FeeRequired();
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidInput();
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert InvalidInput();
        if (creatorAllocationBps > MAX_CREATOR_ALLOCATION_BPS) revert InvalidInput();

        _send(feeWallet, createFeeWei);
        if (msg.value > createFeeWei) refunds[msg.sender] += msg.value - createFeeWei;

        bytes32 factorySalt = deriveSalt(msg.sender, userSalt);
        bytes memory params = abi.encode(B20AssetCreateParams({
            version: 1,
            name: name,
            symbol: symbol,
            initialAdmin: address(this),
            decimals: 18
        }));
        bytes[] memory initCalls = _buildInitialCalls();

        token = IB20FactoryPrecompile(B20_FACTORY).createB20(B20_ASSET_VARIANT, factorySalt, params, initCalls);
        if (token == address(0)) revert InvalidAddress();

        uint256 creatorAmount = (TOTAL_SUPPLY * creatorAllocationBps) / BASIS_POINTS;
        if (creatorAmount > 0) _safeTokenTransfer(token, msg.sender, creatorAmount);

        uint256 curveTokens = TOTAL_SUPPLY - creatorAmount;
        tokenCore[token] = TokenCore({
            creator: msg.sender,
            virtualETH: initialVirtualEth,
            virtualTokens: curveTokens,
            realETH: 0,
            creatorAllocation: creatorAllocationBps,
            createdAt: block.timestamp,
            uniswapPair: address(0),
            graduated: false
        });
        tokenMeta[token] = TokenMeta(name, symbol, description, image);
        allTokens.push(token);
        creatorTokens[msg.sender].push(token);
        totalTokensCreated++;

        emit TC(token, msg.sender, name, symbol, creatorAllocationBps);
        emit B20CurveCreated(token, msg.sender, userSalt, factorySalt);
    }

    function buy(address token, uint256 minTokensOut) external payable nonReentrant notPaused {
        TokenCore storage core = tokenCore[token];
        if (core.creator == address(0)) revert TokenNotFound();
        if (msg.value == 0) revert InvalidInput();

        if (core.graduated) {
            if (router == address(0) || weth == address(0)) revert AlreadyGraduated();
            _buyExternal(token, minTokensOut);
            return;
        }

        uint256 fee = (msg.value * tradingFeeBps) / BASIS_POINTS;
        uint256 netEth = msg.value - fee;
        uint256 out = (core.virtualTokens * netEth) / (core.virtualETH + netEth);
        if (out < minTokensOut || out == 0 || out > core.virtualTokens) revert Slippage();

        core.virtualETH += netEth;
        core.virtualTokens -= out;
        core.realETH += netEth;

        TokenStats storage stats = tokenStats[token];
        stats.buys++;
        stats.vol += msg.value;
        totalVolumeETH += msg.value;

        if (!holderSeen[token][msg.sender]) {
            holderSeen[token][msg.sender] = true;
            stats.holders++;
        }

        _splitTradeFee(core.creator, fee);
        _safeTokenTransfer(token, msg.sender, out);
        emit TB(token, msg.sender, msg.value, out, fee);

        if (core.realETH >= graduationThresholdWei) _graduate(token);
    }

    function sell(address token, uint256 tokenAmount, uint256 minEthOut) external nonReentrant notPaused {
        TokenCore storage core = tokenCore[token];
        if (core.creator == address(0)) revert TokenNotFound();
        if (tokenAmount == 0) revert InvalidInput();

        if (core.graduated) {
            if (router == address(0) || weth == address(0)) revert AlreadyGraduated();
            _sellExternal(token, tokenAmount, minEthOut);
            return;
        }

        uint256 eth = (core.virtualETH * tokenAmount) / (core.virtualTokens + tokenAmount);
        if (eth == 0 || eth > core.realETH) revert Slippage();

        uint256 fee = (eth * tradingFeeBps) / BASIS_POINTS;
        uint256 out = eth - fee;
        if (out < minEthOut) revert Slippage();

        _safeTokenTransferFrom(token, msg.sender, address(this), tokenAmount);
        core.virtualETH -= eth;
        core.virtualTokens += tokenAmount;
        core.realETH -= eth;

        TokenStats storage stats = tokenStats[token];
        stats.sells++;
        stats.vol += eth;
        totalVolumeETH += eth;

        if (IERC20Like(token).balanceOf(msg.sender) == 0 && holderSeen[token][msg.sender]) {
            holderSeen[token][msg.sender] = false;
            if (stats.holders > 0) stats.holders--;
        }

        _splitTradeFee(core.creator, fee);
        _send(msg.sender, out);
        emit TS2(token, msg.sender, tokenAmount, out, fee);
    }

    function claimFees() external nonReentrant {
        uint256 amount = fees[msg.sender];
        if (amount == 0) revert NoFees();
        fees[msg.sender] = 0;
        _send(msg.sender, amount);
    }

    function claimRefund() external nonReentrant {
        uint256 amount = refunds[msg.sender];
        if (amount == 0) revert NoFees();
        refunds[msg.sender] = 0;
        _send(msg.sender, amount);
    }

    function getTokensForETH(address token, uint256 ethAmount) external view returns (uint256) {
        TokenCore storage core = tokenCore[token];
        if (core.creator == address(0) || core.graduated) return 0;
        uint256 fee = (ethAmount * tradingFeeBps) / BASIS_POINTS;
        uint256 netEth = ethAmount - fee;
        return (core.virtualTokens * netEth) / (core.virtualETH + netEth);
    }

    function getETHForTokens(address token, uint256 tokenAmount) external view returns (uint256) {
        TokenCore storage core = tokenCore[token];
        if (core.creator == address(0) || core.graduated) return 0;
        uint256 eth = (core.virtualETH * tokenAmount) / (core.virtualTokens + tokenAmount);
        uint256 fee = (eth * tradingFeeBps) / BASIS_POINTS;
        return eth - fee;
    }

    function getPrice(address token) external view returns (uint256) {
        TokenCore storage core = tokenCore[token];
        return core.virtualTokens == 0 ? 0 : (core.virtualETH * 1e18) / core.virtualTokens;
    }

    function getMarketCap(address token) external view returns (uint256) {
        TokenCore storage core = tokenCore[token];
        return core.virtualTokens == 0 ? 0 : (((core.virtualETH * 1e18) / core.virtualTokens) * TOTAL_SUPPLY) / 1e18;
    }

    function getGraduationProgress(address token) external view returns (uint256) {
        TokenCore storage core = tokenCore[token];
        if (core.creator == address(0)) return 0;
        if (core.graduated) return 100;
        return (core.realETH * 100) / graduationThresholdWei;
    }

    function getAllTokensCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getTokens(uint256 offset, uint256 limit) external view returns (address[] memory result) {
        uint256 n = allTokens.length;
        if (offset >= n) return result;
        uint256 end = offset + limit > n ? n : offset + limit;
        result = new address[](end - offset);
        for (uint256 i = offset; i < end;) {
            result[i - offset] = allTokens[i];
            unchecked { ++i; }
        }
    }

    function getTokenMeta(address token) external view returns (string memory, string memory, string memory, string memory) {
        TokenMeta storage meta = tokenMeta[token];
        return (meta.name, meta.symbol, meta.desc, meta.img);
    }

    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    function getTokenStats(address token) external view returns (uint256, uint256, uint256, uint256, uint256) {
        TokenStats storage stats = tokenStats[token];
        return (stats.buys, stats.sells, stats.vol, stats.holders, stats.gradAt);
    }

    function getPlatformStats() external view returns (uint256, uint256, uint256) {
        return (totalTokensCreated, totalGraduated, totalVolumeETH);
    }

    function isGraduationReady(address token) external view returns (bool) {
        TokenCore storage core = tokenCore[token];
        return core.creator != address(0) && !core.graduated && core.realETH >= graduationThresholdWei;
    }

    function deriveSalt(address user, bytes32 userSalt) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, userSalt));
    }

    function predictToken(address user, bytes32 userSalt) external view returns (address) {
        return IB20FactoryPrecompile(B20_FACTORY).getB20Address(B20_ASSET_VARIANT, address(this), deriveSalt(user, userSalt));
    }

    function setPaused(bool nextPaused) external onlyOwner {
        paused = nextPaused;
        emit PausedUpdated(nextPaused);
    }

    function setFeeWallet(address nextFeeWallet) external onlyOwner {
        if (nextFeeWallet == address(0)) revert InvalidAddress();
        emit FeeWalletUpdated(feeWallet, nextFeeWallet);
        feeWallet = nextFeeWallet;
    }

    function setRouter(address nextRouter, address nextWeth) external onlyOwner {
        if ((nextRouter == address(0)) != (nextWeth == address(0))) revert InvalidAddress();
        emit RouterUpdated(router, nextRouter, nextWeth);
        router = nextRouter;
        weth = nextWeth;
    }

    function setFees(uint256 nextCreateFeeWei, uint256 nextTradingFeeBps) external onlyOwner {
        if (nextTradingFeeBps > 300) revert InvalidInput();
        createFeeWei = nextCreateFeeWei;
        tradingFeeBps = nextTradingFeeBps;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function emergencyWithdrawAll() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoFees();
        _send(owner, amount);
        emit EmergencyWithdraw(owner, address(0), amount);
    }

    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0)) revert InvalidAddress();
        uint256 value = amount == 0 ? IERC20Like(token).balanceOf(address(this)) : amount;
        if (value == 0) revert NoFees();
        _safeTokenTransfer(token, owner, value);
        emit EmergencyWithdraw(owner, token, value);
    }

    function _buildInitialCalls() internal view returns (bytes[] memory calls) {
        calls = new bytes[](5);
        calls[0] = abi.encodeWithSignature("grantRole(bytes32,address)", MINT_ROLE, address(this));
        calls[1] = abi.encodeWithSignature("grantRole(bytes32,address)", METADATA_ROLE, address(this));
        calls[2] = abi.encodeWithSignature("grantRole(bytes32,address)", OPERATOR_ROLE, address(this));
        calls[3] = abi.encodeWithSignature("updateSupplyCap(uint256)", TOTAL_SUPPLY);

        address[] memory recipients = new address[](1);
        recipients[0] = address(this);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = TOTAL_SUPPLY;
        calls[4] = abi.encodeWithSignature("batchMint(address[],uint256[])", recipients, amounts);
    }

    function _splitTradeFee(address creator, uint256 fee) internal {
        if (fee == 0) return;
        uint256 platformFee = fee / 2;
        uint256 creatorFee = fee - platformFee;
        if (platformFee > 0) _send(feeWallet, platformFee);
        if (creatorFee > 0) fees[creator] += creatorFee;
    }

    function _graduate(address token) internal {
        TokenCore storage core = tokenCore[token];
        if (core.graduated) return;

        uint256 ethAmount = core.realETH;
        uint256 tokenAmount = core.virtualTokens;
        uint256 balance = IERC20Like(token).balanceOf(address(this));
        if (tokenAmount > balance) tokenAmount = balance;
        if (ethAmount == 0 || tokenAmount == 0) revert InvalidInput();

        core.graduated = true;
        tokenStats[token].gradAt = block.timestamp;
        totalGraduated++;

        if (router != address(0) && weth != address(0)) {
            _safeApprove(token, router, tokenAmount);
            (uint256 usedTokens, uint256 usedEth,) = IUniV2RouterLike(router).addLiquidityETH{value: ethAmount}(
                token,
                tokenAmount,
                0,
                0,
                DEAD,
                block.timestamp + 600
            );
            if (ethAmount > usedEth) refunds[core.creator] += ethAmount - usedEth;
            if (tokenAmount > usedTokens) _safeTokenTransfer(token, DEAD, tokenAmount - usedTokens);
            core.uniswapPair = IUniV2FactoryLike(IUniV2RouterLike(router).factory()).getPair(token, weth);
            lockedLiquidityETH[token] = usedEth;
            lockedLiquidityTokens[token] = usedTokens;
        } else {
            lockedLiquidityETH[token] = ethAmount;
            lockedLiquidityTokens[token] = tokenAmount;
        }

        core.realETH = 0;
        core.virtualTokens = 0;
        emit TG(token, core.uniswapPair, lockedLiquidityETH[token], lockedLiquidityTokens[token]);
    }

    function _buyExternal(address token, uint256 minTokensOut) internal {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = token;
        IUniV2RouterLike(router).swapExactETHForTokens{value: msg.value}(minTokensOut, path, msg.sender, block.timestamp + 300);
    }

    function _sellExternal(address token, uint256 tokenAmount, uint256 minEthOut) internal {
        _safeTokenTransferFrom(token, msg.sender, address(this), tokenAmount);
        _safeApprove(token, router, tokenAmount);
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = weth;
        IUniV2RouterLike(router).swapExactTokensForETH(tokenAmount, minEthOut, path, msg.sender, block.timestamp + 300);
    }

    function _safeTokenTransfer(address token, address to, uint256 amount) internal {
        bool ok = IERC20Like(token).transfer(to, amount);
        if (!ok) revert TransferFailed();
    }

    function _safeTokenTransferFrom(address token, address from, address to, uint256 amount) internal {
        bool ok = IERC20Like(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        bool ok = IERC20Like(token).approve(spender, amount);
        if (!ok) revert TransferFailed();
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {}
}
