# Liquidation Bot

Automated liquidation bot for Hodlers Hedge TradingEngine that monitors all positions and automatically executes liquidations when positions become liquidatable.

## Features

- **Dual Deployment Modes**: Supports both traditional long-running server and Vercel serverless cron deployment
- **Persistent Position Tracking**: Uses Vercel KV storage (serverless) or in-memory tracking (traditional server)
- **Automatic Detection**: Uses the contract's `isLiquidatable()` function for reliable liquidation detection
- **Fast Execution**: Executes liquidations with sequential processing to avoid race conditions
- **Robust Error Handling**: Gracefully handles race conditions, network errors, gas issues, and position state changes
- **Position Backfill**: Rebuilds position list from historical events with incremental backfill support
- **Gas Management**: Optional gas price limits to prevent overpaying during network congestion
- **Shared Configuration**: Automatically syncs with frontend using shared contract addresses and ABIs from `lib/` directory

## Prerequisites

- **Node.js 20+** (recommended: Node.js 20.x or higher)
- **Package Manager**: npm, pnpm, or yarn
- **Wallet**: A wallet with BTC balance for gas fees on Mezo Testnet
- **Private Key**: Private key for the liquidator wallet (never use your main wallet)

## Setup

1. **Install dependencies**:
   ```bash
   cd liquidation-bot
   npm install
   # or
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   ```

3. **Edit `.env` file** with your configuration:
   ```env
   # Required: Your liquidator wallet private key (0x-prefixed, 66 chars)
   LIQUIDATOR_PRIVATE_KEY=0x...
   
   # Optional overrides (defaults shown)
   RPC_URL=https://rpc.test.mezo.org
   TRADING_ENGINE_ADDRESS=0x304B0E3DFC3701F5907dcb955E93a9D7c8b78b7F
   CHAIN_ID=31611
   MAX_GAS_PRICE_GWEI=0
   BACKFILL_BLOCK_RANGE=6000
   ```
   
   **Note**: `MONITOR_INTERVAL_MS` is no longer used - the bot now runs on a schedule (Vercel cron) or continuously (traditional server).

   **Note**: The `TRADING_ENGINE_ADDRESS` is automatically loaded from `lib/address.ts` if not set. Only override if using a different deployment.

4. **Fund your liquidator wallet**:
   - The wallet needs BTC (Mezo Testnet) for gas fees
   - Get testnet BTC from the [Mezo Testnet faucet](https://faucet.test.mezo.org) (if available)
   - The bot will display a warning if the wallet balance is 0

## Running the Bot

### Development Mode (with auto-reload):
```bash
npm run dev
# or
pnpm dev
```

### Production Mode:
```bash
npm start
# or
pnpm start
```

### Build and Run (TypeScript):
```bash
npm run build
node dist/index.js
```

### Test Script:
```bash
npm test
# or
pnpm test
```

## Deployment Options

### Option 1: Vercel Serverless (Recommended for Production)

The bot can run as a Vercel Cron function that executes on a schedule (minimum 1 minute intervals).

#### Prerequisites:
- Vercel account (free tier supports cron jobs)
- Vercel KV database (free tier available)
- Environment variables configured in Vercel dashboard

#### Setup Steps:

1. **Create Vercel KV Database**:
   - Go to your Vercel project dashboard
   - Navigate to Storage → Create → KV
   - Create a new KV database (or use existing one)
   - Note the connection details (auto-configured if in same project)

2. **Set Environment Variables in Vercel**:
   - Go to Project Settings → Environment Variables
   - Add all required variables:
     - `LIQUIDATOR_PRIVATE_KEY` (required)
     - `RPC_URL` (optional, defaults to Mezo Testnet)
     - `TRADING_ENGINE_ADDRESS` (optional, auto-loaded from lib)
     - `CHAIN_ID` (optional, defaults to 31611)
     - `MAX_GAS_PRICE_GWEI` (optional)
     - `BACKFILL_BLOCK_RANGE` (optional, defaults to 6000)
     - `CRON_SECRET` (optional, for securing the cron endpoint)

3. **Deploy to Vercel**:
   ```bash
   # From project root (not liquidation-bot directory)
   vercel deploy
   ```

4. **Cron Configuration**:
   - The cron job is configured in `vercel.json` at the project root
   - Default schedule: Every 1 minute (`*/1 * * * *`)
   - To change the schedule, edit `vercel.json`:
     ```json
     {
       "crons": [
         {
           "path": "/api/cron/check-liquidations",
           "schedule": "*/1 * * * *"
         }
       ]
     }
     ```
   - Cron schedule format: https://crontab.guru/

5. **Verify Deployment**:
   - Check Vercel dashboard → Functions → Cron Jobs
   - The cron job should appear and run automatically
   - Check function logs for execution status

#### How Vercel Deployment Works:

- **No Continuous Server**: Each cron invocation runs independently (serverless)
- **Persistent Storage**: Position data stored in Vercel KV (survives between invocations)
- **Incremental Backfill**: Backfill runs on first execution, then incrementally every hour
- **Timeout Limits**: 
  - Hobby plan: 60 seconds max execution time
  - Pro plan: 300 seconds max execution time
  - If timeout is exceeded, consider reducing `BACKFILL_BLOCK_RANGE`

#### Monitoring:
- View logs in Vercel dashboard → Functions → Logs
- Check `/api/cron/check-liquidations` endpoint response
- KV database stores position state between executions

### Option 2: Traditional Server (Development/Local)

For local development or traditional server deployment, the bot can run as a continuously-running process.

**Note**: The traditional server mode maintains real-time event listeners (not available in serverless mode).

```bash
cd liquidation-bot
npm start
# or
pnpm start
```

This mode:
- Runs continuously with event listeners
- Uses in-memory position tracking
- Runs monitoring loop every 15 seconds (configurable)
- Requires a server that runs 24/7

## How It Works

### Startup Sequence

1. **Configuration Loading**:
   - Loads environment variables from `.env` file
   - Validates required configuration (private key, addresses, etc.)
   - Automatically imports contract address from `lib/address.ts` (if not overridden)
   - Automatically imports contract ABI from `lib/abi/TradingEngine.ts`

2. **Network Connection**:
   - Creates viem `PublicClient` and `WalletClient` for Mezo Testnet
   - Displays wallet address and balance (warns if balance is 0)
   - Connects to RPC endpoint (default: `https://rpc.test.mezo.org`)

3. **Position Backfill**:
   - Fetches historical events from the last `BACKFILL_BLOCK_RANGE` blocks (~7 days by default)
   - Processes `PositionOpened`, `PositionClosed`, and `Liquidated` events
   - Rebuilds the active position list from historical data
   - Logs the number of active positions found

### Runtime Operation

#### Traditional Server Mode:
4. **Event Listeners** (Real-time):
   - **`PositionOpened`**: Adds new position addresses to the tracking set
   - **`PositionClosed`**: Removes closed position addresses from tracking
   - **`Liquidated`**: Removes liquidated positions (whether by this bot or another)

5. **Monitoring Loop** (continuous):
   - Retrieves all active positions from the tracker
   - For each position:
     - Verifies position still exists via `getPosition()` call
     - Checks liquidation status via `isLiquidatable()` call
   - Batches checks (up to 10 positions at a time) for efficiency
   - Queues liquidatable positions for execution

#### Vercel Serverless Mode:
4. **Position Loading**:
   - Loads active positions from Vercel KV storage
   - Positions persist between cron invocations

5. **Backfill Check**:
   - Runs backfill if first execution or >1 hour since last backfill
   - Incremental backfill from last known block to current block
   - Full backfill on first run or if no previous backfill exists

6. **Monitoring Check** (single execution per cron):
   - Retrieves all active positions from KV
   - For each position:
     - Verifies position still exists via `getPosition()` call
     - Checks liquidation status via `isLiquidatable()` call
   - Batches checks (up to 10 positions at a time) for efficiency
   - Executes liquidations sequentially
   - Saves updated positions back to KV

6. **Liquidation Execution**:
   - For each liquidatable position:
     - Checks gas price against `MAX_GAS_PRICE_GWEI` limit (if set)
     - Calls `liquidate(userAddress)` on TradingEngine contract
     - Waits for transaction receipt (2 minute timeout)
     - Parses `Liquidated` event to extract reward amount
     - Removes position from tracking on success
     - Handles errors gracefully (race conditions, position changes, etc.)
   - Adds 1 second delay between liquidations to avoid congestion

### Graceful Shutdown

- Handles `SIGINT` (Ctrl+C) and `SIGTERM` signals
- Stops event listeners and monitoring loop cleanly
- Exits gracefully with status messages

## Configuration Options

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `LIQUIDATOR_PRIVATE_KEY` | ✅ Yes | Private key of liquidator wallet (0x-prefixed, 66 chars) | - |
| `RPC_URL` | ❌ No | RPC endpoint URL for Mezo Testnet | `https://rpc.test.mezo.org` |
| `TRADING_ENGINE_ADDRESS` | ❌ No | TradingEngine contract address | Auto-imported from `lib/address.ts` |
| `CHAIN_ID` | ❌ No | Network chain ID (Mezo Testnet) | `31611` |
| `MAX_GAS_PRICE_GWEI` | ❌ No | Maximum gas price in gwei (0 = no limit) | `0` (no limit) |
| `BACKFILL_BLOCK_RANGE` | ❌ No | Number of blocks to look back for position backfill | `6000` (~7 days) |
| `CRON_SECRET` | ❌ No | Secret for securing cron endpoint (Vercel only) | - |

**Note**: `MONITOR_INTERVAL_MS` has been removed. In traditional server mode, the bot runs continuously. In Vercel serverless mode, the cron schedule is configured in `vercel.json`.

### Shared Configuration

The bot automatically imports contract addresses and ABIs from the shared `lib/` directory at the repository root:

- **Contract Address**: Automatically read from `../../lib/address.ts` at runtime
  - Parses the exported `tradingEngineAddress` constant
  - Falls back to default if file read fails
  - Can be overridden with `TRADING_ENGINE_ADDRESS` env var

- **Contract ABI**: Automatically read from `../../lib/abi/TradingEngine.ts` at runtime
  - Parses the exported `TradingEngineABI` constant
  - Falls back to minimal ABI if file read fails

**Benefits**:
- ✅ Always synchronized with frontend - no manual updates needed
- ✅ Same contract address and ABI across all parts of the application
- ✅ Automatic updates when contracts are redeployed (just update `lib/address.ts`)

**Overriding the Address**:
Set the `TRADING_ENGINE_ADDRESS` environment variable to override the auto-imported address. This is useful for:
- Testing against different deployments
- Using a local test contract
- Quick configuration without modifying shared files

## Monitoring & Logging

The bot provides detailed console logging with emoji indicators for easy identification:

### Event Logs
- `📈` **New position opened** - A new position was detected via event listener
- `✅` **Position closed** - A position was closed normally
- `⚡` **Position liquidated** - A position was liquidated (by this bot or another)
- `🔍` **Checking positions** - Monitoring loop is checking active positions
- `💰` **Liquidation reward received** - Successfully liquidated and received reward
- `⚠️` **Warnings** - Non-fatal issues (race conditions, position state changes, etc.)
- `❌` **Errors** - Fatal errors requiring attention

### Startup Logs
- Configuration summary (RPC URL, contract address, chain ID, etc.)
- Liquidator wallet address and balance check
- Backfill progress and results
- Active position count after backfill

### Runtime Logs
- Periodic position checks (logs every minute when no positions)
- Liquidation attempts with transaction hashes
- Success/failure status for each liquidation
- Transaction confirmations and reward parsing

### Example Output
```
🤖 Liquidation Bot Starting...
==================================================
📋 Bot Configuration:
   RPC URL: https://rpc.test.mezo.org
   Trading Engine: 0x304B0E3DFC3701F5907dcb955E93a9D7c8b78b7F
   Chain ID: 31611
   Monitor Interval: 15000ms
   Backfill Range: 6000 blocks
   Liquidator Address: 0x1234...
👛 Liquidator Address: 0x1234...
==================================================
💰 Wallet Balance: 0.5 BTC
📚 Backfilling positions from historical events...
📊 Backfilled 3 active positions
🔍 Starting event listeners...
🔄 Starting monitoring loop (interval: 15000ms)
✅ Bot is running! Press Ctrl+C to stop.
```

## Troubleshooting

### Configuration Issues

**"Missing required environment variable"**
- ✅ Ensure `.env` file exists in the `liquidation-bot/` directory
- ✅ Check that `LIQUIDATOR_PRIVATE_KEY` is set and properly formatted (0x-prefixed, 66 chars)
- ✅ Verify the private key is not empty or commented out

**"Invalid private key format"**
- ✅ Private key must start with `0x` and be exactly 66 characters long
- ✅ Ensure there are no extra spaces or newlines in the `.env` file

**"Invalid address format"**
- ✅ Contract address must start with `0x` and be exactly 42 characters long
- ✅ Verify `TRADING_ENGINE_ADDRESS` if manually set

### Funding Issues

**"Insufficient funds for gas" / Wallet balance is 0**
- ✅ Fund the liquidator wallet with BTC on Mezo Testnet
- ✅ Check wallet balance on [Mezo Testnet Explorer](https://explorer.test.mezo.org)
- ✅ Obtain testnet BTC from faucet (if available)
- ✅ The bot requires BTC for transaction gas fees (not MUSD)

### Execution Issues

**"Position not liquidatable" (during execution)**
- ℹ️ This is normal and indicates a race condition
- ✅ Another bot or user may have liquidated the position first
- ✅ The position is automatically removed from tracking
- ✅ No action needed - the bot will continue monitoring

**"Gas price too high"**
- ✅ The current gas price exceeds `MAX_GAS_PRICE_GWEI` limit
- ✅ Increase `MAX_GAS_PRICE_GWEI` or set to `0` for no limit
- ✅ Wait for network congestion to subside

### Connection Issues

**Bot not detecting positions**
- ✅ Check RPC connection: Verify `RPC_URL` is correct and accessible
- ✅ Test RPC endpoint manually: `curl https://rpc.test.mezo.org`
- ✅ Verify contract address matches deployed contract
- ✅ Check that events are being emitted (use [block explorer](https://explorer.test.mezo.org))
- ✅ Increase `BACKFILL_BLOCK_RANGE` if positions were opened long ago

**Network timeouts or RPC errors**
- ✅ Check internet connection
- ✅ Verify RPC endpoint is not rate-limited
- ✅ Consider using a different RPC provider
- ✅ Check Mezo Testnet status

### Performance Issues

**High gas prices**
- ✅ Set `MAX_GAS_PRICE_GWEI` to limit spending (e.g., `MAX_GAS_PRICE_GWEI=100`)
- ✅ Monitor gas prices during network congestion
- ✅ The bot will skip liquidations if gas exceeds limit

**Slow position detection**
- ✅ Reduce `MONITOR_INTERVAL_MS` for faster checks (minimum ~5 seconds recommended)
- ✅ Note: More frequent checks = more RPC calls = potentially higher costs
- ✅ Default 15 seconds is a good balance

**Backfill taking too long**
- ✅ Reduce `BACKFILL_BLOCK_RANGE` for faster startup
- ✅ Trade-off: May miss older positions (they'll be detected via events)
- ✅ Default 6000 blocks (~7 days) is recommended

## Security Notes

⚠️ **CRITICAL SECURITY GUIDELINES**

- **Never commit `.env` file** - It contains your private key and must be in `.gitignore`
- **Use a dedicated wallet** - Never use your main wallet's private key for the bot
- **Keep private key secure**:
  - Store only in environment variables or secure key management systems
  - Never log or print private keys in code
  - Use secrets management for production (AWS Secrets Manager, HashiCorp Vault, etc.)
- **Test on testnet first** - Always verify everything works on testnet before using real funds
- **Monitor wallet balance** - Regularly check that the liquidator wallet has sufficient funds
- **Review transaction logs** - Regularly audit liquidation transactions for unexpected behavior
- **Limit gas spending** - Set `MAX_GAS_PRICE_GWEI` to prevent unexpected high costs
- **Run in secure environment** - Deploy bot on secure servers with proper access controls

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Startup & Initialization                   │
│  • Load config from .env                                     │
│  • Import contract address & ABI from lib/                   │
│  • Create viem clients (PublicClient, WalletClient)          │
│  • Check wallet balance                                      │
│  • Backfill positions from historical events                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Runtime Components                       │
└─────────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────┐         ┌──────────────────┐
│ Event Listeners  │         │  Monitor Service │
│ (Real-time)      │         │  (Periodic)      │
│                  │         │                  │
│ • PositionOpened │         │ • Check every    │
│ • PositionClosed │         │   15s (default)  │
│ • Liquidated     │         │ • Batch checks   │
└────────┬─────────┘         │   (10 at a time) │
         │                   └──────────┬───────┘
         │                              │
         │                              │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │ Position Tracker │
         │                  │
         │ • In-memory Set  │
         │ • Add/Remove     │
         │ • Get Active     │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ Liquidation Exec │
         │                  │
         │ • Check gas      │
         │ • Execute tx     │
         │ • Parse reward   │
         │ • Remove pos.    │
         └──────────────────┘
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| **Main Entry** | `index.ts` | Orchestrates startup, creates services, handles shutdown |
| **Configuration** | `config.ts` | Loads and validates environment variables, imports shared config |
| **Clients** | `clients.ts` | Sets up viem PublicClient and WalletClient, loads ABIs |
| **Events** | `events.ts` | Manages event listeners and position backfill logic |
| **Monitor** | `monitor.ts` | Periodic checking loop for liquidatable positions |
| **Liquidation** | `liquidation.ts` | Executes liquidation transactions and handles results |
| **Types** | `types.ts` | TypeScript type definitions |

## Development

### Project Structure
```
liquidation-bot/
├── src/
│   ├── index.ts           # Main entry point & orchestration
│   ├── config.ts          # Environment configuration & validation
│   ├── clients.ts         # viem client setup & ABI loading
│   ├── events.ts          # Event listeners & position backfill
│   ├── monitor.ts         # Monitoring loop service
│   ├── liquidation.ts    # Liquidation execution service
│   ├── types.ts          # TypeScript type definitions
│   └── test.ts           # Test utilities (optional)
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
├── env.example           # Example environment file
└── README.md            # This file
```

### Technology Stack

- **TypeScript**: Type-safe development
- **viem**: Ethereum client library (v2.x)
- **dotenv**: Environment variable management
- **tsx**: TypeScript execution for development

### Development Workflow

1. **Make changes** to source files in `src/`
2. **Test locally** with `npm run dev` (auto-reloads on changes)
3. **Build** with `npm run build` to check for TypeScript errors
4. **Run tests** with `npm test` (if test suite exists)

### Adding Features

#### Persistent Storage
- Extend `PositionTracker` in `events.ts` to use a database (PostgreSQL, MongoDB, etc.)
- Store position history for analytics
- Enable bot restart without backfill

#### Notifications
- Add Discord/Slack webhook integration
- Send alerts for:
  - Successful liquidations with reward amounts
  - Failed liquidation attempts
  - Wallet balance warnings
  - Bot health status

#### Gas Optimization
- Implement dynamic gas price strategies:
  - EIP-1559 fee estimation
  - Gas price bidding algorithms
  - Transaction speed optimization

#### Monitoring & Metrics
- Add metrics collection (Prometheus, StatsD, etc.)
- Track:
  - Liquidation success rate
  - Average time to liquidate
  - Gas costs per liquidation
  - Position count over time
- Create dashboards (Grafana, etc.)

#### Error Recovery
- Add retry logic with exponential backoff
- Implement circuit breakers for RPC failures
- Add health check endpoints for monitoring services

### Code Style

- Use TypeScript strict mode
- Follow functional programming patterns where appropriate
- Use async/await for all async operations
- Include JSDoc comments for public functions
- Use descriptive variable and function names

## License

MIT

