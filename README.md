# 🛡️ HODLer's Hedge

**A Complete Decentralized Perpetual Futures Trading Platform Built on Mezo Network**

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8-blue)](https://soliditylang.org/)
[![Wagmi](https://img.shields.io/badge/Wagmi-2.18-ff6b9d)](https://wagmi.sh/)
[![Mezo](https://img.shields.io/badge/Built%20on-Mezo-6B46C1)](https://mezo.org/)

---

## 🎯 Overview

**HODLer's Hedge** is a fully-featured perpetual futures trading platform that enables users to trade Bitcoin (BTC) with up to 20x leverage using tBTC as collateral. Built for the Mezo hackathon, this project demonstrates a complete DeFi trading system with smart contracts, a modern React frontend, admin controls, and an automated liquidation bot.

### The Problem We Solve

Traditional perpetual trading platforms are often:
- Centralized and custodial
- Limited in their collateral options
- Complex and intimidating for new traders
- Lacking transparent admin controls

**HODLer's Hedge** addresses these issues by providing:
- ✅ **Fully Decentralized** - Built on smart contracts with no centralized intermediaries
- ✅ **Native BTC Collateral** - Trade with tBTC (wrapped Bitcoin) directly
- ✅ **User-Friendly Interface** - Modern, intuitive UI with real-time data visualization
- ✅ **Transparent Governance** - Comprehensive admin panel with full system visibility
- ✅ **Automated Risk Management** - Liquidation bot ensures protocol safety

---

## ✨ Key Features

### 🎨 User Trading Interface
- **Real-Time Price Charts** - Interactive BTC price charts with mark price overlay
- **Leverage Trading** - Open long/short positions with up to 20x leverage
- **Position Management** - View real-time PnL, liquidation price, and funding costs
- **Wallet Integration** - Seamless wallet connection via Mezo Passport and RainbowKit
- **Live Market Data** - 24h volume, price change, funding rates, and market stats
- **Trade History** - Complete transaction history with real-time updates

### 📊 Admin Dashboard
- **System Health Monitoring** - Real-time protocol metrics and status
- **Emergency Controls** - Pause trading, emergency withdrawals, and circuit breakers
- **Oracle Configuration** - Manage Pyth oracle settings and price feeds
- **Risk Management** - Configure trading fees, leverage limits, and position limits
- **Insurance Fund** - Monitor and manage protocol insurance reserves
- **Internal Monitor** - Track margin lock/unlock events and PnL
- **mUSD Reserve** - Manage stablecoin reserve settings
- **Ownership Management** - Transfer protocol ownership with multi-sig support

### ⚙️ Smart Contract System
- **Modular Architecture** - Separate contracts for Vault, TradingEngine, and FundingRate
- **Liquidation System** - Automated liquidation with 5% bonus for liquidators
- **Funding Mechanism** - 8-hour funding intervals to maintain price parity
- **Insurance Fund** - Protocol-level risk mitigation
- **Pyth Oracle Integration** - Reliable price feeds from Pyth Network

### 🤖 Automated Liquidation Bot
- **Real-Time Monitoring** - Tracks all positions continuously
- **Automatic Execution** - Liquidates positions within seconds when they become liquidatable
- **Event-Driven Architecture** - Listens to on-chain events for position updates
- **Position Backfill** - Rebuilds position list from historical events on startup
- **Gas Optimization** - Configurable gas price limits
- **Error Resilience** - Handles race conditions and network issues gracefully
- **TypeScript** - Fully typed with comprehensive error handling

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Trading UI   │  │ Admin Panel  │  │ Charts & Data │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼─────────────────┼──────────────┘
          │                  │                 │
          └──────────────────┴─────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │        Wagmi + Viem (Ethers.js)      │
          └──────────────────┬───────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────┐
│         Mezo Testnet Blockchain                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Vault     │  │   Trading    │  │   Funding    │  │
│  │   Contract   │  │   Engine     │  │    Rate      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │           │
│         └─────────────────┴──────────────────┘           │
│                          │                               │
│                    ┌─────┴─────┐                         │
│                    │  Insurance │                         │
│                    │    Fund    │                         │
│                    └────────────┘                         │
│                          │                               │
│                    ┌─────┴─────┐                         │
│                    │   Pyth    │                         │
│                    │  Oracle   │                         │
│                    └───────────┘                         │
└──────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │     Liquidation Bot (Node.js)       │
          │  - Event Monitoring                 │
          │  - Position Tracking                │
          │  - Automatic Liquidations           │
          └─────────────────────────────────────┘
```

### Smart Contract Architecture

1. **Vault Contract** (`Vault.sol`)
   - Manages user collateral deposits and withdrawals
   - Tracks individual user balances
   - Locks/unlocks margin for active positions
   - Emergency withdrawal capabilities

2. **TradingEngine Contract** (`TradingEngine.sol`)
   - Core trading logic using vAMM (Virtual Automated Market Maker) model
   - Single position per user (simplified for hackathon)
   - Position management (open/close/liquidate)
   - Liquidation system with 5% bonus
   - Integration with Vault, FundingRate, and InsuranceFund

3. **FundingRate Contract** (`FundingRate.sol`)
   - Periodic funding payments (every 8 hours)
   - Calculates funding based on long/short imbalance
   - Admin-configurable funding rates
   - Automatic payment application

4. **InsuranceFund Contract** (`InsuranceFund.sol`)
   - Protocol-level risk mitigation
   - Covers losses during liquidations
   - Admin-managed reserves

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.2.4 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4.1.9
- **Components**: Radix UI primitives
- **Web3**: Wagmi 2.18.1 + Viem 2.x
- **Wallet**: RainbowKit 2.2.9 + Mezo Passport 0.11.0
- **Charts**: Recharts 2.15.4
- **Forms**: React Hook Form 7.60.0 + Zod 3.25.76
- **State Management**: TanStack Query 5.90.5
- **Toast Notifications**: Sonner 1.7.4

### Smart Contracts
- **Language**: Solidity 0.8.x
- **Framework**: Foundry
- **Testing**: Forge
- **Security**: OpenZeppelin Contracts
- **Oracle**: Pyth Network SDK

### Backend/Bot
- **Runtime**: Node.js 20+
- **Web3**: Viem 2.x
- **TypeScript**: 5.0+
- **Build Tool**: TSX 4.7.0 (TypeScript execution)
- **Event Processing**: Real-time event listeners

### Infrastructure
- **Network**: Mezo Testnet
- **RPC**: Mezo Testnet RPC (`https://rpc.test.mezo.org`)
- **Oracle**: Pyth Network (Mezo Testnet)
- **Token**: tBTC (Testnet)

---

## 📁 Project Structure

```
hodlers-hedge/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard page
│   ├── api/               # API routes (price feeds)
│   ├── page.tsx           # Main trading interface
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── admin/             # Admin panel components
│   │   ├── admin-panel.tsx
│   │   ├── emergency-controls.tsx
│   │   ├── insurance-fund.tsx
│   │   ├── internal-monitor.tsx
│   │   ├── musd-reserve.tsx
│   │   ├── oracle-config.tsx
│   │   ├── ownership-management.tsx
│   │   └── risk-and-fees.tsx
│   ├── system/            # System components
│   │   └── system-health.tsx
│   ├── user/              # User components
│   │   └── musd-wallet.tsx
│   ├── chart-panel.tsx    # Price charts
│   ├── trade-panel.tsx    # Trading interface
│   ├── position-panel.tsx # Position management
│   ├── trade-history.tsx  # Trade history
│   ├── header.tsx         # App header
│   └── ui/                # Reusable UI components (Radix UI)
├── hooks/                 # Custom React hooks
│   ├── use-trading.ts     # Trading operations & contract setup
│   ├── use-vault.ts       # Vault operations & balance
│   ├── use-funding.ts     # Funding rate hooks
│   ├── use-vault-admin.ts # Admin vault operations
│   ├── use-vault-events.ts # Vault event tracking
│   ├── use-trade-history.ts # Trade history & events
│   ├── use-btc-price.ts   # BTC price fetching
│   ├── use-oracle-refresh.ts # Auto price refresh
│   ├── use-mobile.ts      # Mobile detection
│   ├── use-toast.ts       # Toast notifications
│   └── index.ts           # Hook exports
├── lib/                   # Shared utilities
│   ├── abi/               # Contract ABIs
│   │   ├── TradingEngine.ts
│   │   ├── Vault.ts
│   │   ├── FundingRate.ts
│   │   ├── InsuranceFund.ts
│   │   └── ERC20.ts
│   ├── address.ts         # Contract addresses (single source of truth)
│   ├── pyth.ts            # Pyth oracle integration & utilities
│   ├── admin-utils.ts     # Admin utility functions
│   ├── utils.ts           # General utility functions
│   └── README.md          # Library documentation
├── contract/              # Smart contracts
│   ├── src/
│   │   ├── Vault.sol
│   │   ├── TradingEngine.sol
│   │   ├── FundingRate.sol
│   │   └── InsuranceFund.sol
│   ├── script/            # Deployment scripts
│   └── test/              # Contract tests
└── liquidation-bot/       # Automated liquidation bot
    ├── src/
    │   ├── index.ts       # Main entry point
    │   ├── config.ts      # Configuration management
    │   ├── clients.ts     # Viem client setup
    │   ├── events.ts      # Event listeners & backfill
    │   ├── monitor.ts     # Position monitoring loop
    │   ├── liquidation.ts # Liquidation execution
    │   ├── test.ts        # Test utilities
    │   └── types.ts       # TypeScript types
    ├── package.json
    ├── tsconfig.json
    └── README.md          # Bot documentation
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** - Required for frontend and liquidation bot
- **pnpm 9.10.0+** - Package manager (configured in package.json)
- **Foundry** - Required for smart contract development and deployment
- **Wallet** - With Mezo Testnet BTC for gas fees
- **CoinGecko API Key** (optional) - For higher rate limits on price API

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hodlers-hedge
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your CoinGecko API key (optional, for price data):
   ```env
   COINGECKO_API_KEY=your_api_key_here
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Deploy Smart Contracts

1. **Navigate to contract directory**
   ```bash
   cd contract
   ```

2. **Set up Foundry** (if not already installed)
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

3. **Set environment variables**
   ```bash
   export PRIVATE_KEY=your_private_key
   export RPC_URL=https://rpc.test.mezo.org
   ```

4. **Deploy contracts**
   ```bash
   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
   ```

5. **Update contract addresses**
   After deployment, update `lib/address.ts` with the new contract addresses.

### Run Liquidation Bot

1. **Navigate to bot directory**
   ```bash
   cd liquidation-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env`:
   ```env
   LIQUIDATOR_PRIVATE_KEY=your_private_key
   RPC_URL=https://rpc.test.mezo.org
   TRADING_ENGINE_ADDRESS=0x...
   ```

4. **Run the bot**
   ```bash
   npm run dev    # Development mode (with auto-reload via tsx watch)
   npm start      # Production mode (tsx execution)
   npm run build  # Build TypeScript
   npm test       # Run test utilities
   ```

---

## 📍 Live Deployment

### Contract Addresses (Mezo Testnet)

All addresses are managed in `lib/address.ts` (single source of truth):

```
Vault:           0x54800fC968E95a3AF2e75D2E50c8124f338527c4
TradingEngine:    0x725cc08897FA715dBbE73Cca980059CF26A01A23
FundingRate:      0x39C6474BDBB5350645991214dB0d931d6CbEAde3
InsuranceFund:    0x2fE6793089aD4b8CEB45e051a5c7db237D3e6147
tBTC Token:       0xe9C41d7c80f75C131B5d18b13046D4FBEab0EedA
Pyth Oracle:      0x2880aB155794e7179c9eE2e38200202908C17B43
Pyth BTC/USD Price ID: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
```

> **Note**: These addresses are shared between the frontend and liquidation bot via the `lib/address.ts` file, ensuring consistency across all components.

### Frontend
- **Live URL**: [Add your deployed URL here]
- **Network**: Mezo Testnet (Chain ID: 31611)

### Explorer Links
- **Mezo Testnet Explorer**: [Add explorer URL]
- **Pyth Network**: [Add Pyth dashboard URL]

---

## 🎮 How to Use

### For Traders

1. **Connect Wallet**
   - Click "Connect Wallet" in the header
   - Choose Mezo Passport or any WalletConnect-compatible wallet
   - Approve connection

2. **Deposit Collateral**
   - Ensure you have tBTC tokens in your wallet
   - Enter the amount you want to deposit
   - Click "Deposit" and approve the transaction

3. **Open a Position**
   - Select Long or Short
   - Choose leverage (1x to 20x)
   - Enter margin amount
   - Review estimated position size and fees
   - Click "Open Position" and approve transaction

4. **Monitor Position**
   - View real-time PnL in the Position Panel
   - Track liquidation price
   - Monitor funding costs
   - See unrealized profit/loss updates

5. **Close Position**
   - Click "Close Position" in the Position Panel
   - Review closing details
   - Approve transaction
   - Receive remaining margin + profit (or remaining margin - loss)

### For Administrators

1. **Access Admin Panel**
   - Navigate to `/admin`
   - Ensure your wallet is connected
   - Must be the vault owner

2. **Monitor System Health**
   - View protocol metrics
   - Check insurance fund balance
   - Monitor open interest
   - Track funding rate status

3. **Configure Oracle**
   - Update Pyth oracle settings
   - Set price feed parameters
   - Configure price update intervals

4. **Manage Risk**
   - Adjust trading fees
   - Set leverage limits
   - Configure position limits
   - Update maintenance margin

5. **Emergency Controls**
   - Pause trading if needed
   - Execute emergency withdrawals
   - Trigger circuit breakers

---

## 🔒 Security Features

- ✅ **Reentrancy Protection** - All state-changing functions protected
- ✅ **Access Control** - Owner-only functions for critical operations
- ✅ **Input Validation** - Comprehensive parameter checks
- ✅ **Emergency Pause** - Ability to pause trading in emergencies
- ✅ **Safe Math** - Solidity 0.8+ built-in overflow protection
- ✅ **Oracle Price Bounds** - Sanity checks on oracle price updates
- ✅ **Liquidation Thresholds** - 5% maintenance margin requirement
- ✅ **Insurance Fund** - Protocol-level risk mitigation

---

## 📊 Key Metrics & Specifications

### Trading Parameters
- **Maximum Leverage**: 20x
- **Trading Fee**: 0.1% (1000 basis points)
- **Maintenance Margin**: 70.6% (5% liquidation threshold)
- **Liquidation Bonus**: 5%
- **Position Type**: Single position per user

### Funding Mechanism
- **Funding Interval**: 8 hours
- **Funding Calculation**: Based on long/short open interest imbalance
- **Payment Direction**: Longs pay shorts (or vice versa) based on imbalance

### Oracle
- **Provider**: Pyth Network
- **Price Feed**: BTC/USD
- **Update Frequency**: Real-time (on-chain)
- **Price Format**: 18-decimal precision

---

## 🤝 Integration & Shared Configuration

This project uses a **shared configuration system** to ensure consistency across all components:

### Shared Resources (`lib/` directory)
- **Contract ABIs**: All contract interfaces in `lib/abi/`
  - TradingEngine, Vault, FundingRate, InsuranceFund, ERC20
- **Contract Addresses**: Centralized in `lib/address.ts`
- **Pyth Integration**: Oracle utilities in `lib/pyth.ts`
- **Admin Utilities**: Helper functions in `lib/admin-utils.ts`
- **General Utils**: Shared functions in `lib/utils.ts`

### Component Integration
- **Frontend**: Uses `@/lib/*` imports via Next.js path aliases
- **Liquidation Bot**: Uses relative imports `../../lib/*`
- **Single Source of Truth**: Both frontend and bot always use the same contracts and ABIs

### Benefits
- ✅ No manual synchronization needed between frontend and bot
- ✅ Automatic updates when contracts are redeployed (just update `lib/address.ts`)
- ✅ Consistent contract interactions across all components
- ✅ Reduced configuration errors and type mismatches
- ✅ Type-safe contract interactions via generated ABIs

See `lib/README.md` for detailed documentation on the shared library structure.

---

## 🧪 Testing

### Smart Contracts
```bash
cd contract
forge test
```

Tests cover:
- Full trading flow (deposit → open → close)
- Liquidation scenarios
- Funding rate calculations
- Oracle price updates
- Edge cases and error handling

### Frontend
```bash
pnpm lint      # Run ESLint
pnpm build     # Build production bundle
pnpm dev       # Run development server
pnpm start     # Start production server
```

### Bot
```bash
cd liquidation-bot
npm test  # If test suite exists
```

---

## 🚧 Future Enhancements

Potential improvements for production deployment:

- [ ] **Multi-Position Support** - Allow multiple positions per user
- [ ] **Order Types** - Limit orders, stop-loss, take-profit
- [ ] **More Collateral Types** - Support additional tokens
- [ ] **Cross-Margin** - Shared margin across positions
- [ ] **Advanced Charts** - TradingView integration
- [ ] **Mobile App** - React Native mobile application
- [ ] **Analytics Dashboard** - Advanced trading analytics
- [ ] **Social Features** - Copy trading, leaderboards
- [ ] **Insurance Fund Governance** - DAO for fund management
- [ ] **Multi-Chain Deployment** - Support multiple networks

---

## 📝 API Endpoints

### BTC Price API

The frontend includes Next.js API routes for fetching BTC price data:

**Current Price:**
```
GET /api/price
```
Returns current BTC price from CoinGecko API with market data.

**Mark Price:**
```
GET /api/mark-price
```
Returns the current mark price from the TradingEngine contract.

**Response Format (Price):**
```json
{
  "success": true,
  "data": {
    "price": 42074.71,
    "market_cap": 825000000000,
    "volume_24h": 15000000000,
    "change_24h": 2.5,
    "last_updated": "2024-01-15T10:30:00Z",
    "currency": "USD",
    "symbol": "BTC",
    "name": "Bitcoin"
  }
}
```

> **Note**: CoinGecko API key is optional. Set `COINGECKO_API_KEY` in your `.env.local` for higher rate limits.

---

## 👥 Team & Contributors

Built for the **Mezo Network Hackathon**

---

## 📄 License

MIT License - See individual contract files for details.

---

## 🔗 Resources

- [Mezo Network](https://mezo.org/)
- [Pyth Network](https://pyth.network/)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Wagmi Documentation](https://wagmi.sh/)

---

## 🎉 Hackathon Highlights

### What Makes This Special

1. **Complete System** - Not just a frontend or contracts, but a full-stack DeFi platform
2. **Production-Ready Code** - Clean architecture, error handling, and security best practices
3. **Real Trading Mechanics** - Implements actual perpetual futures trading logic
4. **Admin Tools** - Comprehensive admin panel demonstrates governance capabilities
5. **Automated Infrastructure** - Liquidation bot shows understanding of protocol maintenance
6. **Modern Tech Stack** - Latest versions of Next.js, React, Wagmi, and Foundry
7. **Great UX** - Intuitive interface with real-time data visualization
8. **Shared Configuration** - Smart architecture for maintainability

### Technical Achievements

- ✅ **Modular Smart Contract Architecture** - Clean separation of concerns (Vault, TradingEngine, FundingRate, InsuranceFund)
- ✅ **Real-Time Oracle Integration** - Pyth Network integration with automatic price updates
- ✅ **Automated Liquidation System** - Event-driven bot with position backfilling
- ✅ **Funding Rate Mechanism** - 8-hour intervals with admin configuration
- ✅ **Comprehensive Admin Dashboard** - Full protocol control and monitoring
- ✅ **Shared Configuration System** - Single source of truth for addresses and ABIs
- ✅ **Type-Safe TypeScript** - Fully typed across frontend and bot
- ✅ **Modern React Patterns** - Custom hooks, React Query, and optimized re-renders
- ✅ **Responsive UI** - Tailwind CSS 4 with mobile-first design
- ✅ **Event Tracking** - Complete trade history with real-time updates

---

**Built with ❤️ for the Mezo Network Hackathon**
