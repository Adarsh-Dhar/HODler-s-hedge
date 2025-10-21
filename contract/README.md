# HODLer's Hedge - Perpetual Trading Contracts

A complete perpetual futures trading system built on Mezo testnet using tBTC as collateral for leveraged BTC trading.

## Architecture

The system consists of three modular contracts that work together:

### 1. Vault Contract (`Vault.sol`)
- **Purpose**: Manages user collateral (tBTC deposits/withdrawals)
- **Key Features**:
  - Secure tBTC token management
  - User balance tracking
  - Margin locking/unlocking for positions
  - Emergency withdrawal capabilities

### 2. TradingEngine Contract (`TradingEngine.sol`)
- **Purpose**: Core trading logic using vAMM model
- **Key Features**:
  - Single position per user (simplified for hackathon)
  - Leverage up to 20x
  - Position management (open/close/liquidate)
  - Admin-controlled price oracle
  - Liquidation system with 5% maintenance margin
  - Emergency pause functionality

### 3. FundingRate Contract (`FundingRate.sol`)
- **Purpose**: Stabilizes perpetual price via periodic funding payments
- **Key Features**:
  - 8-hour funding intervals
  - Admin-controlled funding rates
  - Automatic funding payment calculations

## Contract Addresses

**Mezo Testnet:**
- tBTC Token: `0x517f2982701695D4E52f1ECFBEf3ba31Df470161`
- Vault: `[To be deployed]`
- TradingEngine: `[To be deployed]`
- FundingRate: `[To be deployed]`

## Deployment

### Prerequisites
1. Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
2. Set up environment variables in `.env`:
   ```bash
   PRIVATE_KEY=your_private_key_here
   RPC_URL=https://rpc.test.mezo.org
   ```

### Deploy to Mezo Testnet
```bash
# Compile contracts
forge build

# Run tests
forge test

# Deploy to Mezo testnet
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

## Key Functions

### Vault Contract
```solidity
function deposit(uint256 amount) external
function withdraw(uint256 amount) external
function balanceOf(address user) external view returns (uint256)
```

### TradingEngine Contract
```solidity
function openPosition(bool isLong, uint256 marginAmount, uint256 leverage) external
function closePosition() external
function liquidate(address user) external
function getPosition(address user) external view returns (Position memory)
function getMarkPrice() external view returns (uint256)
function calculateLiquidationPrice(address user) external view returns (uint256)
```

### FundingRate Contract
```solidity
function updateFundingRate(int256 newRate) external
function getFundingRate() external view returns (int256)
function calculateFundingPayment(uint256 positionSize, bool isLong) external view returns (int256)
function getNextFundingTime() external view returns (uint256)
```

## Frontend Integration

The contracts are designed to integrate seamlessly with the existing React frontend:

### Trade Panel Integration
- **Available Balance**: Call `vault.balanceOf(userAddress)`
- **Execute Trade**: Call `tradingEngine.openPosition(isLong, marginAmount, leverage)`
- **Liquidation Price**: Call `tradingEngine.calculateLiquidationPrice(userAddress)`

### Position Panel Integration
- **Position Data**: Call `tradingEngine.getPosition(userAddress)`
- **Close Position**: Call `tradingEngine.closePosition()`

### Chart Panel Integration
- **Mark Price**: Call `tradingEngine.getMarkPrice()`
- **Funding Time**: Call `fundingRate.getNextFundingTime()`

## Security Features

- **Reentrancy Protection**: All state-changing functions use OpenZeppelin's ReentrancyGuard
- **Access Control**: Owner-only functions for critical operations
- **Input Validation**: Comprehensive parameter validation
- **Emergency Pause**: Ability to pause trading in emergencies
- **Safe Math**: Solidity 0.8+ built-in overflow protection

## Testing

Run the test suite:
```bash
forge test
```

The test suite includes:
- Integration tests for full trading flow
- Funding rate functionality tests
- Price update tests
- Contract interaction verification

## Gas Optimization

- Efficient storage layout
- Minimal external calls
- Optimized event emissions
- Gas-efficient liquidation logic

## License

MIT License - see individual contract files for details.

## Support

For questions or issues, please refer to the project documentation or create an issue in the repository.