// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PumpHubToken is ERC20 {
    constructor(string memory n, string memory s, uint256 t, address r) ERC20(n, s) { _mint(r, t); }
}

contract PumpHubFactory is Ownable, ReentrancyGuard {
    uint256 constant TS = 1e27;
    uint256 constant CF = 1e15;
    uint256 constant GT = 5e18;
    uint256 constant TF = 60; // 0.6% total trading fee (0.3% platform + 0.3% creator)
    uint256 constant MA = 1000;
    uint256 constant BP = 10000;
    uint256 constant IVE = 1e18;
    
    address constant ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public totalTokensCreated;
    uint256 public totalVolumeETH;
    uint256 public totalGraduated;
    bool public paused;
    
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
    
    struct TokenStats { uint256 buys; uint256 sells; uint256 vol; uint256 holders; uint256 gradAt; }
    struct TokenMeta { string name; string symbol; string desc; string img; }
    
    mapping(address => TokenCore) public tokenCore;
    mapping(address => TokenMeta) internal _meta;
    mapping(address => TokenStats) public tokenStats;
    mapping(address => mapping(address => bool)) internal _hold;
    address[] public allTokens;
    mapping(address => address[]) public creatorTokens;
    mapping(address => uint256) public fees;
    mapping(address => uint256) public refunds;
    
    event TC(address indexed t, address indexed c, string n, string s, uint256 a);
    event TB(address indexed t, address indexed b, uint256 e, uint256 o, uint256 f);
    event TS2(address indexed t, address indexed s, uint256 i, uint256 o, uint256 f);
    event TG(address indexed t, address indexed p, uint256 e, uint256 tk);
    
    error E();
    modifier notPaused() { if(paused) revert E(); _; }
    
    constructor() Ownable(msg.sender) {}
    
    function setPaused(bool p) external onlyOwner { paused = p; }
    
    function createToken(string calldata n, string calldata s, string calldata d, string calldata img, uint256 a) external payable nonReentrant notPaused returns (address) {
        if (msg.value < CF || a > MA || bytes(n).length == 0 || bytes(n).length > 32 || bytes(s).length == 0 || bytes(s).length > 10) revert E();
        
        _snd(owner(), CF);
        if (msg.value > CF) refunds[msg.sender] += msg.value - CF;
        
        address t = address(new PumpHubToken(n, s, TS, address(this)));
        uint256 ca = (TS * a) / BP;
        
        if (ca > 0) ERC20(t).transfer(msg.sender, ca);
        
        tokenCore[t] = TokenCore(msg.sender, IVE, TS - ca, 0, a, block.timestamp, address(0), false);
        _meta[t] = TokenMeta(n, s, d, img);
        
        allTokens.push(t);
        creatorTokens[msg.sender].push(t);
        unchecked { ++totalTokensCreated; }
        
        emit TC(t, msg.sender, n, s, a);
        return t;
    }
    
    function buy(address t, uint256 min) external payable nonReentrant notPaused {
        TokenCore storage c = tokenCore[t];
        if (c.creator == address(0) || msg.value == 0) revert E();
        
        if (c.graduated) { _buyUni(t, min); return; }
        
        uint256 fee = (msg.value * TF) / BP;
        uint256 platformFee = fee / 2; // 50% to platform
        uint256 creatorFee = fee - platformFee; // 50% to creator
        uint256 eth = msg.value - fee;
        uint256 out = (c.virtualTokens * eth) / (c.virtualETH + eth);
        
        if (out < min || out > c.virtualTokens) revert E();
        
        c.virtualETH += eth;
        c.virtualTokens -= out;
        c.realETH += eth;
        
        TokenStats storage st = tokenStats[t];
        st.buys++;
        st.vol += msg.value;
        totalVolumeETH += msg.value;
        
        if (!_hold[t][msg.sender]) { _hold[t][msg.sender] = true; st.holders++; }
        
        // Split fee: 50% to platform, 50% to creator
        if (platformFee > 0) _snd(owner(), platformFee);
        if (creatorFee > 0) fees[c.creator] += creatorFee;
        ERC20(t).transfer(msg.sender, out);
        emit TB(t, msg.sender, msg.value, out, fee);
        
        if (c.realETH >= GT && !c.graduated) _grad(t);
    }
    
    function sell(address t, uint256 amt, uint256 min) external nonReentrant notPaused {
        TokenCore storage c = tokenCore[t];
        if (c.creator == address(0) || amt == 0) revert E();
        
        if (c.graduated) { _sellUni(t, amt, min); return; }
        
        uint256 eth = (c.virtualETH * amt) / (c.virtualTokens + amt);
        if (eth > c.realETH) revert E();
        
        uint256 fee = (eth * TF) / BP;
        uint256 platformFee = fee / 2; // 50% to platform
        uint256 creatorFee = fee - platformFee; // 50% to creator
        uint256 out = eth - fee;
        if (out < min) revert E();
        
        ERC20(t).transferFrom(msg.sender, address(this), amt);
        c.virtualETH -= eth;
        c.virtualTokens += amt;
        c.realETH -= eth;
        
        TokenStats storage st = tokenStats[t];
        st.sells++;
        st.vol += eth;
        totalVolumeETH += eth;
        
        if (ERC20(t).balanceOf(msg.sender) == 0 && _hold[t][msg.sender]) {
            _hold[t][msg.sender] = false;
            if (st.holders > 0) st.holders--;
        }
        
        // Split fee: 50% to platform, 50% to creator
        if (platformFee > 0) _snd(owner(), platformFee);
        if (creatorFee > 0) fees[c.creator] += creatorFee;
        _snd(msg.sender, out);
        emit TS2(t, msg.sender, amt, out, fee);
    }
    
    function _buyUni(address t, uint256 min) internal {
        address[] memory p = new address[](2);
        p[0] = WETH; p[1] = t;
        IRouter(ROUTER).swapExactETHForTokens{value: msg.value}(min, p, msg.sender, block.timestamp + 300);
    }
    
    function _sellUni(address t, uint256 amt, uint256 min) internal {
        ERC20(t).transferFrom(msg.sender, address(this), amt);
        ERC20(t).approve(ROUTER, amt);
        address[] memory p = new address[](2);
        p[0] = t; p[1] = WETH;
        IRouter(ROUTER).swapExactTokensForETH(amt, min, p, msg.sender, block.timestamp + 300);
    }
    
    function claimFees() external nonReentrant {
        uint256 a = fees[msg.sender];
        if (a == 0) revert E();
        fees[msg.sender] = 0;
        _snd(msg.sender, a);
    }
    
    function claimRefund() external nonReentrant {
        uint256 a = refunds[msg.sender];
        if (a == 0) revert E();
        refunds[msg.sender] = 0;
        _snd(msg.sender, a);
    }
    
    // Emergency withdrawal - Owner can withdraw all ETH for security purposes
    // Use this only in case of exploit/hack to protect user funds
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert E();
        _snd(owner(), balance);
    }
    
    function _snd(address to, uint256 a) internal {
        (bool ok, ) = payable(to).call{value: a}("");
        if (!ok) revert E();
    }
    
    function _grad(address t) internal {
        TokenCore storage c = tokenCore[t];
        uint256 eth = c.realETH;
        uint256 tok = c.virtualTokens;
        uint256 b = ERC20(t).balanceOf(address(this));
        if (b < tok) tok = b;
        if (tok == 0 || eth == 0) revert E();
        
        c.graduated = true;
        tokenStats[t].gradAt = block.timestamp;
        totalGraduated++;
        
        ERC20(t).approve(ROUTER, tok);
        
        (uint256 aT, uint256 aE, ) = IRouter(ROUTER).addLiquidityETH{value: eth}(t, tok, 0, 0, DEAD, block.timestamp + 600);
        
        if (eth > aE) refunds[c.creator] += eth - aE;
        if (tok > aT) ERC20(t).transfer(DEAD, tok - aT);
        
        c.uniswapPair = IFactory(IRouter(ROUTER).factory()).getPair(t, WETH);
        c.realETH = 0;
        c.virtualTokens = 0;
        emit TG(t, c.uniswapPair, aE, aT);
    }
    
    function getTokensForETH(address t, uint256 e) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return (c.virtualTokens * e) / (c.virtualETH + e);
    }
    
    function getETHForTokens(address t, uint256 tok) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return (c.virtualETH * tok) / (c.virtualTokens + tok);
    }
    
    function getPrice(address t) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return c.virtualTokens == 0 ? 0 : (c.virtualETH * 1e18) / c.virtualTokens;
    }
    
    function getMarketCap(address t) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return c.virtualTokens == 0 ? 0 : ((c.virtualETH * 1e18) / c.virtualTokens * TS) / 1e18;
    }
    
    function getGraduationProgress(address t) external view returns (uint256) {
        TokenCore storage c = tokenCore[t];
        return c.graduated ? 100 : c.realETH == 0 ? 0 : (c.realETH * 100) / GT;
    }
    
    function getAllTokensCount() external view returns (uint256) { return allTokens.length; }
    
    function getTokens(uint256 o, uint256 l) external view returns (address[] memory r) {
        uint256 n = allTokens.length;
        if (o >= n) return r;
        uint256 e = o + l > n ? n : o + l;
        r = new address[](e - o);
        for (uint256 i = o; i < e;) { r[i - o] = allTokens[i]; unchecked { ++i; } }
    }
    
    function getTokenMeta(address t) external view returns (string memory, string memory, string memory, string memory) {
        TokenMeta storage m = _meta[t];
        return (m.name, m.symbol, m.desc, m.img);
    }
    
    function getCreatorTokens(address c) external view returns (address[] memory) { return creatorTokens[c]; }
    
    function getTokenStats(address t) external view returns (uint256, uint256, uint256, uint256, uint256) {
        TokenStats storage s = tokenStats[t];
        return (s.buys, s.sells, s.vol, s.holders, s.gradAt);
    }
    
    function getPlatformStats() external view returns (uint256, uint256, uint256) {
        return (totalTokensCreated, totalGraduated, totalVolumeETH);
    }
    
    function isGraduationReady(address t) external view returns (bool) {
        TokenCore storage c = tokenCore[t];
        return c.creator != address(0) && !c.graduated && c.realETH >= GT;
    }
    
    receive() external payable {}
}

interface IRouter {
    function factory() external view returns (address);
    function addLiquidityETH(address t, uint d, uint minT, uint minE, address to, uint dl) external payable returns (uint, uint, uint);
    function swapExactETHForTokens(uint min, address[] calldata p, address to, uint dl) external payable returns (uint[] memory);
    function swapExactTokensForETH(uint a, uint min, address[] calldata p, address to, uint dl) external returns (uint[] memory);
}

interface IFactory {
    function getPair(address a, address b) external view returns (address);
}
