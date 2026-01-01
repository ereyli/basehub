# 🚀 SwapHub - Multi-Chain DEX Aggregator

<div align="center">

![SwapHub Logo](./src/assets/swaphub-logo.png)

**A modern, user-friendly decentralized exchange aggregator supporting Uniswap V2 and V3 on Base network**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-blue)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Usage](#-usage)
- [Smart Contract](#-smart-contract)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

SwapHub is a production-ready decentralized exchange aggregator that provides seamless token swapping across Uniswap V2 and V3 pools on the Base network. It features a modern, Uniswap-inspired UI with advanced functionality including custom token support, real-time price quotes, and comprehensive statistics.

### Key Highlights

- ✅ **Native ETH Support** - Swap directly with native ETH (no WETH wrapping required)
- ✅ **Dual Protocol Support** - Automatically finds best prices across Uniswap V2 and V3
- ✅ **Custom Tokens** - Import and trade any token on Base network
- ✅ **Real-time Statistics** - Track total volume, users, and fees
- ✅ **MEV Protection** - Deadline validation and slippage protection
- ✅ **Output-Fee Model** - Fees collected from output tokens (user-friendly)

---

## ✨ Features

### 🔄 Swap Features
- **Multi-Protocol Routing**: Automatically selects the best price between Uniswap V2 and V3 pools
- **Native ETH Handling**: Direct ETH swaps without manual wrapping/unwrapping
- **Slippage Protection**: Configurable slippage tolerance with presets
- **Real-time Quotes**: Live price updates as you type
- **USD Value Display**: Real-time USD value calculations for all tokens

### 🎨 User Interface
- **Modern Design**: Clean, Uniswap-inspired interface
- **Token Search**: Fast token search with balance and USD value display
- **Custom Token Import**: Add any Base network token with automatic logo fetching
- **Transaction Status**: Clear approval and swap status indicators
- **Responsive Layout**: Optimized for all screen sizes

### 📊 Statistics & Analytics
- **Total Volume**: Track cumulative swap volume in ETH
- **Total Users**: Monitor unique wallet addresses
- **Total Fees**: View protocol fee collection
- **Visual Charts**: Line graphs showing trends over time

### 🔒 Security Features
- **Reentrancy Protection**: OpenZeppelin ReentrancyGuard
- **Deadline Validation**: MEV protection at contract level
- **Safe Token Transfers**: OpenZeppelin SafeERC20
- **Ownable Access Control**: Secure contract ownership

---

## 🛠 Tech Stack

### Frontend
- **React 18.2** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Wagmi** - Ethereum React hooks
- **Viem** - Ethereum utilities
- **RainbowKit** - Wallet connection UI
- **Uniswap SDK** - Price calculations and routing

### Smart Contracts
- **Solidity ^0.8.20** - Smart contract language
- **OpenZeppelin Contracts** - Security libraries
- **Hardhat** - Development environment

### Network
- **Base** - Ethereum L2 network

---

## 📦 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ereyli/SwapHub.git
   cd SwapHub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** (optional)
   ```bash
   # Create .env file if needed
   cp .env.example .env
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

---

## 🚀 Usage

### Basic Swap

1. **Connect Wallet**
   - Click "Connect Wallet" in the top right
   - Select your preferred wallet (MetaMask, Coinbase Wallet, etc.)
   - Approve connection

2. **Select Tokens**
   - Click on token selector (top for "Sell", bottom for "Buy")
   - Search or select from popular tokens
   - For custom tokens, paste contract address

3. **Enter Amount**
   - Type amount in the "Sell" field
   - Or use percentage buttons (10%, 25%, 50%, Max)
   - Receive amount will auto-calculate

4. **Review & Swap**
   - Check slippage settings (gear icon)
   - Review USD values
   - Click "Swap" button
   - Approve token if first time (one-time)
   - Confirm swap transaction

### Custom Token Import

1. Click token selector
2. Scroll to "Custom tokens" section
3. Paste token contract address
4. Review token details (auto-fetched)
5. Click "Import" to add
6. Token will be saved locally for future use

### Slippage Settings

1. Click gear icon (⚙️) next to swap button
2. Select preset (0.1%, 0.5%, 1%) or enter custom
3. Settings are saved automatically

---

## 📄 Smart Contract

### Contract Details

**Contract Name**: `SwapAggregatorV2`  
**Network**: Base Mainnet  
**License**: MIT

### Key Functions

#### `swapV3`
```solidity
function swapV3(
    address tokenIn,
    address tokenOut,
    uint24 poolFee,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint256 deadline
) external payable returns (uint256 amountOut)
```

Swaps tokens using Uniswap V3 pools.

#### `swapV2`
```solidity
function swapV2(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint256 deadline
) external payable returns (uint256 amountOut)
```

Swaps tokens using Uniswap V2 pools.

#### `getStats`
```solidity
function getStats() external view returns (
    uint256 _totalVolumeETH,
    uint256 _totalUsers,
    uint256 _totalFeesCollected
)
```

Returns platform statistics.

### Security Features

- ✅ ReentrancyGuard protection
- ✅ Deadline validation (MEV protection)
- ✅ SafeERC20 for token transfers
- ✅ Ownable access control
- ✅ Output-fee model (no front-running)

### Fee Structure

- Protocol fee: 0.3% (30 bps) of output amount
- Fee recipient: Configurable by owner
- Fees collected in output token (ETH for ETH swaps)

---

## 📁 Project Structure

```
SwapHub/
├── contracts/
│   └── SwapAggregatorV2.sol    # Main aggregator contract
├── scripts/
│   └── deploy.js                # Deployment script
├── src/
│   ├── components/
│   │   ├── SwapInterface.tsx    # Main swap UI component
│   │   └── StatsPanel.tsx       # Statistics panel component
│   ├── config/
│   │   └── tokens.ts            # Token configuration
│   ├── assets/
│   │   └── swaphub-logo.png     # Logo
│   ├── App.tsx                   # Root component
│   └── main.tsx                  # Entry point
├── public/
│   └── favicon.png              # Favicon
├── hardhat.config.cjs           # Hardhat configuration
├── vite.config.ts               # Vite configuration
└── package.json                 # Dependencies
```

---

## 🔧 Deployment

### Smart Contract Deployment

1. **Configure Hardhat**
   ```javascript
   // hardhat.config.cjs
   networks: {
     base: {
       url: process.env.BASE_RPC_URL,
       accounts: [process.env.PRIVATE_KEY]
     }
   }
   ```

2. **Deploy Contract**
   ```bash
   npm run deploy
   ```

3. **Verify Contract** (optional)
   ```bash
   npx hardhat verify --network base <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

### Frontend Deployment

#### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

#### Netlify

1. Build project: `npm run build`
2. Deploy `dist` folder to Netlify
3. Configure redirects for SPA routing

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting PR
- Update documentation if needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **GitHub**: [https://github.com/ereyli/SwapHub](https://github.com/ereyli/SwapHub)
- **Base Network**: [https://base.org](https://base.org)
- **Uniswap V3**: [https://uniswap.org](https://uniswap.org)

---

## ⚠️ Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always verify smart contract addresses and test with small amounts first.

---

## 🙏 Acknowledgments

- Uniswap for the amazing protocol and SDK
- OpenZeppelin for security libraries
- Base team for the excellent L2 network
- RainbowKit for wallet connection UI

---

<div align="center">

**Built with ❤️ for the Base ecosystem**

⭐ Star this repo if you find it useful!

</div>



