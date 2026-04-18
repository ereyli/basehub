// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TempoPumpHubFactory
 * @notice PumpHub-style bonding curve + graduation, collateralized in PUSD (or any 6-decimal fee token).
 * @dev Mirrors `PumpHubFactory` economics but:
 *      - No native ETH: creation fee, buys, sells, fees use `feeToken` (approve + transferFrom / transfer).
 *      - User-facing amounts for `buy` / views use **6-decimal** units (same as other Tempo contracts: `TempoBaseHubDeployer`, `TempoTokenFactory`).
 *      - Internal curve math uses 18-decimal "quote wei" = `usd6 * 1e12` so the same formulas as the ETH factory apply.
 *      - Graduation uses Uniswap V2-style `addLiquidity` + `swapExactTokensForTokens` (set `router` + `quoteToken` at deploy; `quoteToken` should match `feeToken` for a single PUSD pool).
 *
 * Deploy: new TempoPumpHubFactory(router, quoteToken, feeToken) then `setFeeToken` if you prefer to wire fee token post-deploy (constructor sets both quote + fee to same address if you pass one addr twice).
 */
contract TempoPumpHubToken is ERC20 {
    constructor(string memory n, string memory s, uint256 t, address r) ERC20(n, s) {
        _mint(r, t);
    }
}

contract TempoPumpHubFactory is Ownable, ReentrancyGuard {
    uint256 constant TS = 1e27;
    /// @dev Minimum creation payment: 0.001 PUSD in raw usd6 (= 1000). Internal = 1e15.
    uint256 constant CF_USD6 = 1000;
    uint256 constant CF_INTERNAL = 1e15;

    uint256 constant TF = 60;
    uint256 constant MA = 1000;
    uint256 constant BP = 10000;
    uint256 constant IVE = 1e18;

    /// @dev Graduation when `realCollateral` >= 5 PUSD internal (5e18).
    uint256 constant GT_INTERNAL = 5e18;

    /// @dev usd6 (1e6 = 1 USD) -> internal 18-dec quote units
    uint256 constant SCALE = 1e12;

    address public immutable ROUTER;
    /// @dev PUSD (or quote asset paired on DEX with launched tokens)
    address public immutable QUOTE;

    IERC20 public feeToken;

    uint256 public totalTokensCreated;
    /// @dev Sum of volume in **raw usd6** (not wei).
    uint256 public totalVolumeUsd6;
    uint256 public totalGraduated;
    bool public paused;

    struct TokenCore {
        address creator;
        uint256 virtualCollateral;
        uint256 virtualTokens;
        uint256 realCollateral;
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
    mapping(address => TokenMeta) internal _meta;
    mapping(address => TokenStats) public tokenStats;
    mapping(address => mapping(address => bool)) internal _hold;
    address[] public allTokens;
    mapping(address => address[]) public creatorTokens;
    /// @dev Creator-claimable fees in **raw usd6**
    mapping(address => uint256) public fees;
    mapping(address => uint256) public refunds;

    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    event TC(address indexed t, address indexed c, string n, string s, uint256 a);
    event TB(address indexed t, address indexed b, uint256 quoteIn, uint256 out, uint256 fee);
    event TS2(address indexed t, address indexed s, uint256 amtIn, uint256 quoteOut, uint256 fee);
    event TG(address indexed t, address indexed p, uint256 quoteAdded, uint256 tk);

    error E();

    modifier notPaused() {
        if (paused) revert E();
        _;
    }

    constructor(address router_, address quote_, address feeToken_) Ownable(msg.sender) {
        if (router_ == address(0) || quote_ == address(0) || feeToken_ == address(0)) revert E();
        ROUTER = router_;
        QUOTE = quote_;
        feeToken = IERC20(feeToken_);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
    }

    function setFeeToken(address t) external onlyOwner {
        if (t == address(0)) revert E();
        feeToken = IERC20(t);
    }

    /**
     * @param a Creator allocation 0-1000 (same as Base factory).
     * @notice Pulls exactly `CF_USD6` from msg.sender; requires prior `approve`.
     */
    function createToken(
        string calldata n,
        string calldata s,
        string calldata d,
        string calldata img,
        uint256 a
    ) external nonReentrant notPaused returns (address) {
        if (
            a > MA || bytes(n).length == 0 || bytes(n).length > 32 || bytes(s).length == 0 || bytes(s).length > 10
        ) revert E();

        _pullFee(msg.sender, owner(), CF_USD6);

        address t = address(new TempoPumpHubToken(n, s, TS, address(this)));
        uint256 ca = (TS * a) / BP;

        if (ca > 0) ERC20(t).transfer(msg.sender, ca);

        tokenCore[t] = TokenCore(
            msg.sender,
            IVE,
            TS - ca,
            0,
            a,
            block.timestamp,
            address(0),
            false
        );
        _meta[t] = TokenMeta(n, s, d, img);

        allTokens.push(t);
        creatorTokens[msg.sender].push(t);
        unchecked {
            ++totalTokensCreated;
        }

        emit TC(t, msg.sender, n, s, a);
        return t;
    }

    /**
     * @param usdAmountIn Raw 6-decimal PUSD amount pulled from msg.sender.
     */
    function buy(address t, uint256 usdAmountIn, uint256 min) external nonReentrant notPaused {
        TokenCore storage c = tokenCore[t];
        if (c.creator == address(0) || usdAmountIn == 0) revert E();

        _pullFee(msg.sender, address(this), usdAmountIn);

        if (c.graduated) {
            _buyUni(t, usdAmountIn, min);
            return;
        }

        uint256 feeUsd = (usdAmountIn * TF) / BP;
        uint256 platformFeeUsd = feeUsd / 2;
        uint256 creatorFeeUsd = feeUsd - platformFeeUsd;
        uint256 toCurveUsd = usdAmountIn - feeUsd;
        uint256 col = toCurveUsd * SCALE;

        uint256 out = (c.virtualTokens * col) / (c.virtualCollateral + col);
        if (out < min || out > c.virtualTokens) revert E();

        c.virtualCollateral += col;
        c.virtualTokens -= out;
        c.realCollateral += col;

        TokenStats storage st = tokenStats[t];
        st.buys++;
        st.vol += usdAmountIn;
        totalVolumeUsd6 += usdAmountIn;

        if (!_hold[t][msg.sender]) {
            _hold[t][msg.sender] = true;
            st.holders++;
        }

        if (platformFeeUsd > 0) _push(owner(), platformFeeUsd);
        if (creatorFeeUsd > 0) fees[c.creator] += creatorFeeUsd;

        ERC20(t).transfer(msg.sender, out);
        emit TB(t, msg.sender, usdAmountIn, out, feeUsd);

        if (c.realCollateral >= GT_INTERNAL && !c.graduated) _grad(t);
    }

    function sell(address t, uint256 amt, uint256 minUsdOut) external nonReentrant notPaused {
        TokenCore storage c = tokenCore[t];
        if (c.creator == address(0) || amt == 0) revert E();

        if (c.graduated) {
            _sellUni(t, amt, minUsdOut);
            return;
        }

        uint256 col = (c.virtualCollateral * amt) / (c.virtualTokens + amt);
        if (col > c.realCollateral) revert E();

        uint256 feeInternal = (col * TF) / BP;
        uint256 platformFeeInternal = feeInternal / 2;
        uint256 creatorFeeInternal = feeInternal - platformFeeInternal;
        uint256 outInternal = col - feeInternal;
        uint256 colUsd = col / SCALE;
        uint256 outUsd = outInternal / SCALE;
        if (outInternal == 0 || outUsd < minUsdOut) revert E();

        ERC20(t).transferFrom(msg.sender, address(this), amt);
        c.virtualCollateral -= col;
        c.virtualTokens += amt;
        c.realCollateral -= col;

        TokenStats storage st = tokenStats[t];
        st.sells++;
        st.vol += colUsd;
        totalVolumeUsd6 += colUsd;

        if (ERC20(t).balanceOf(msg.sender) == 0 && _hold[t][msg.sender]) {
            _hold[t][msg.sender] = false;
            if (st.holders > 0) st.holders--;
        }

        uint256 platformFeeUsd = platformFeeInternal / SCALE;
        uint256 creatorFeeUsd = creatorFeeInternal / SCALE;
        if (platformFeeUsd > 0) _push(owner(), platformFeeUsd);
        if (creatorFeeUsd > 0) fees[c.creator] += creatorFeeUsd;
        _push(msg.sender, outUsd);
        emit TS2(t, msg.sender, amt, outUsd, feeInternal / SCALE);
    }

    function _buyUni(address t, uint256 usdAmountIn, uint256 min) internal {
        feeToken.approve(ROUTER, usdAmountIn);
        address[] memory p = new address[](2);
        p[0] = QUOTE;
        p[1] = t;
        IRouter(ROUTER).swapExactTokensForTokens(
            usdAmountIn,
            min,
            p,
            msg.sender,
            block.timestamp + 300
        );
    }

    function _sellUni(address t, uint256 amt, uint256 minUsdOut) internal {
        ERC20(t).transferFrom(msg.sender, address(this), amt);
        ERC20(t).approve(ROUTER, amt);
        address[] memory p = new address[](2);
        p[0] = t;
        p[1] = QUOTE;
        IRouter(ROUTER).swapExactTokensForTokens(amt, minUsdOut, p, msg.sender, block.timestamp + 300);
    }

    function claimFees() external nonReentrant {
        uint256 a = fees[msg.sender];
        if (a == 0) revert E();
        fees[msg.sender] = 0;
        _push(msg.sender, a);
    }

    function claimRefund() external nonReentrant {
        uint256 a = refunds[msg.sender];
        if (a == 0) revert E();
        refunds[msg.sender] = 0;
        _push(msg.sender, a);
    }

    function emergencyWithdrawToken(address tok, uint256 amount) external onlyOwner {
        IERC20(tok).transfer(owner(), amount);
    }

    function _grad(address t) internal {
        TokenCore storage c = tokenCore[t];
        uint256 col = c.realCollateral;
        uint256 tok = c.virtualTokens;
        uint256 b = ERC20(t).balanceOf(address(this));
        if (b < tok) tok = b;
        if (tok == 0 || col == 0) revert E();

        c.graduated = true;
        tokenStats[t].gradAt = block.timestamp;
        unchecked {
            ++totalGraduated;
        }

        uint256 quoteAmt = col / SCALE;
        IERC20(QUOTE).approve(ROUTER, quoteAmt);
        ERC20(t).approve(ROUTER, tok);

        (uint256 usedQuote, uint256 usedTok, ) = IRouter(ROUTER).addLiquidity(
            QUOTE,
            t,
            quoteAmt,
            tok,
            0,
            0,
            DEAD,
            block.timestamp + 600
        );

        if (quoteAmt > usedQuote) refunds[c.creator] += quoteAmt - usedQuote;
        if (tok > usedTok) ERC20(t).transfer(DEAD, tok - usedTok);

        c.uniswapPair = IFactory(IRouter(ROUTER).factory()).getPair(t, QUOTE);
        c.realCollateral = 0;
        c.virtualTokens = 0;
        emit TG(t, c.uniswapPair, usedQuote, usedTok);
    }

    /// @param e Raw **usd6** amount going into curve (same units as `buy`).
    function getTokensForETH(address t, uint256 e) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        uint256 col = e * SCALE;
        return (c.virtualTokens * col) / (c.virtualCollateral + col);
    }

    function getETHForTokens(address t, uint256 tokAmt) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        uint256 col = (c.virtualCollateral * tokAmt) / (c.virtualTokens + tokAmt);
        return col / SCALE;
    }

    function getPrice(address t) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return c.virtualTokens == 0 ? 0 : (c.virtualCollateral * 1e18) / c.virtualTokens;
    }

    function getMarketCap(address t) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return c.virtualTokens == 0 ? 0 : ((c.virtualCollateral * 1e18) / c.virtualTokens * TS) / 1e18;
    }

    function getGraduationProgress(address t) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return c.graduated
            ? 100
            : c.realCollateral == 0 ? 0 : (c.realCollateral * 100) / GT_INTERNAL;
    }

    function getAllTokensCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getTokens(uint256 o, uint256 l) external view returns (address[] memory r) {
        uint256 n = allTokens.length;
        if (o >= n) return r;
        uint256 e = o + l > n ? n : o + l;
        r = new address[](e - o);
        for (uint256 i = o; i < e; ) {
            r[i - o] = allTokens[i];
            unchecked {
                ++i;
            }
        }
    }

    function getTokenMeta(address t) external view returns (string memory, string memory, string memory, string memory) {
        TokenMeta storage m = _meta[t];
        return (m.name, m.symbol, m.desc, m.img);
    }

    function getCreatorTokens(address c_) external view returns (address[] memory) {
        return creatorTokens[c_];
    }

    function getTokenStats(address t) external view returns (uint256, uint256, uint256, uint256, uint256) {
        TokenStats storage s = tokenStats[t];
        return (s.buys, s.sells, s.vol, s.holders, s.gradAt);
    }

    function getPlatformStats() external view returns (uint256, uint256, uint256) {
        return (totalTokensCreated, totalGraduated, totalVolumeUsd6);
    }

    function isGraduationReady(address t) external view returns (bool) {
        TokenCore storage c = tokenCore[t];
        return c.creator != address(0) && !c.graduated && c.realCollateral >= GT_INTERNAL;
    }

    function _pullFee(address from, address to, uint256 usd6) internal {
        if (!feeToken.transferFrom(from, to, usd6)) revert E();
    }

    function _push(address to, uint256 usd6) internal {
        if (!feeToken.transfer(to, usd6)) revert E();
    }
}

interface IRouter {
    function factory() external view returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IFactory {
    function getPair(address a, address b) external view returns (address);
}
