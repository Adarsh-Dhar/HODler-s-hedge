# Liquidation Bot

Automated liquidation bot for Hodlers Hedge TradingEngine that monitors all positions and automatically executes liquidations when positions become liquidatable.

## Features

- **Real-time Position Tracking**: Listens to contract events to track all active positions
- **Automatic Detection**: Uses the contract's `isLiquidatable()` function (no AI needed)
- **Fast Execution**: Executes liquidations within seconds of detection
- **Error Handling**: Gracefully handles race conditions, network errors, and gas issues
- **Position Backfill**: Rebuilds position list from historical events on startup
- **Gas Management**: Optional gas price limits to prevent overpaying

## Prerequisites

- Node.js 20+ 
- A wallet with BTC balance for gas fees (Mezo Testnet)
- Private key for the liquidator wallet

## Setup

1. **Install dependencies**:
   ```bash
   cd liquidation-bot
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   ```

3. **Edit `.env` file**:
   ```env
   # Required: Your liquidator wallet private key
   LIQUIDATOR_PRIVATE_KEY=0x...
   
   # Optional overrides (defaults shown)
   RPC_URL=https://rpc.test.mezo.org
   TRADING_ENGINE_ADDRESS=0xc1e04Adfa33cb46D3A9852188d97dE3C2FFF236F
   MONITOR_INTERVAL_MS=15000
   CHAIN_ID=31611
   MAX_GAS_PRICE_GWEI=0
   BACKFILL_BLOCK_RANGE=6000
   ```

4. **Fund your liquidator wallet**:
   - The wallet needs BTC (Mezo Testnet) for gas fees
   - Get testnet BTC from Mezo Testnet faucet

## Running the Bot

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

### Build and Run:
```bash
npm run build
node dist/index.js
```

## How It Works

1. **Startup**: 
   - Loads configuration from environment variables
   - Connects to Mezo Testnet via RPC
   - Backfills active positions from historical events (last ~7 days)

2. **Event Listening**:
   - Watches `PositionOpened` events → adds to tracking
   - Watches `PositionClosed` events → removes from tracking
   - Watches `Liquidated` events → removes from tracking

3. **Monitoring Loop** (every 15 seconds by default):
   - Checks all tracked positions with `isLiquidatable()`
   - Queues positions that are liquidatable
   - Executes liquidations sequentially with small delays

4. **Liquidation Execution**:
   - Calls `liquidate(userAddress)` on the TradingEngine contract
   - Waits for transaction confirmation
   - Parses reward from `Liquidated` event
   - Removes position from tracking on success

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `LIQUIDATOR_PRIVATE_KEY` | Private key of liquidator wallet | Required |
| `RPC_URL` | RPC endpoint URL | `https://rpc.test.mezo.org` |
| `TRADING_ENGINE_ADDRESS` | TradingEngine contract address | Imported from `lib/address.ts` |
| `MONITOR_INTERVAL_MS` | How often to check positions (ms) | `15000` (15s) |
| `CHAIN_ID` | Network chain ID | `31611` |
| `MAX_GAS_PRICE_GWEI` | Max gas price limit (0 = no limit) | `0` |
| `BACKFILL_BLOCK_RANGE` | Blocks to look back for events | `6000` (~7 days) |

### Shared Configuration

The bot automatically imports contract addresses and ABIs from the shared `lib/` directory:
- **Contract Address**: Imported from `lib/address.ts` (same source as frontend)
- **Contract ABI**: Imported from `lib/abi/TradingEngine.ts` (same source as frontend)

This ensures:
- ✅ The bot always uses the same contract address as the frontend
- ✅ The bot always uses the same ABI as the frontend
- ✅ No manual synchronization needed when contracts are updated

To override the default address, set the `TRADING_ENGINE_ADDRESS` environment variable.

## Monitoring

The bot logs key events:
- `📈` New position opened
- `✅` Position closed
- `⚡` Position liquidated
- `🔍` Checking positions
- `💰` Liquidation reward received
- `❌` Errors and warnings

## Troubleshooting

### "Missing required environment variable"
- Ensure `.env` file exists with all required variables
- Check that `LIQUIDATOR_PRIVATE_KEY` is set correctly

### "Insufficient funds for gas"
- Fund the liquidator wallet with BTC (Mezo Testnet)
- Check balance: The wallet needs BTC for transaction gas fees

### "Position not liquidatable" (during execution)
- This is normal - may be a race condition where another bot liquidated first
- The position will be automatically removed from tracking

### Bot not detecting positions
- Check RPC connection: Ensure `RPC_URL` is correct and accessible
- Verify contract address matches deployed contract
- Check that events are being emitted (use block explorer)

### High gas prices
- Set `MAX_GAS_PRICE_GWEI` to limit gas spending
- Monitor gas prices during network congestion

## Security Notes

- **Never commit `.env` file** - It contains your private key
- **Use a dedicated wallet** - Don't use your main wallet's private key
- **Keep private key secure** - Store in environment variables or secure key management
- **Test on testnet first** - Verify everything works before using real funds

## Architecture

```
┌─────────────────┐
│  Event Listener │ ──> PositionOpened/Closed/Liquidated
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Position Tracker│ ──> In-memory set of active positions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Monitor Loop    │ ──> Every 15s, check isLiquidatable()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Liquidation Exec│ ──> Call liquidate() when needed
└─────────────────┘
```

## Development

### Project Structure
```
liquidation-bot/
├── src/
│   ├── index.ts          # Main entry point
│   ├── config.ts          # Environment configuration
│   ├── clients.ts         # viem client setup
│   ├── events.ts          # Event listeners & backfill
│   ├── monitor.ts         # Monitoring loop
│   ├── liquidation.ts     # Liquidation execution
│   └── types.ts           # TypeScript types
├── package.json
├── tsconfig.json
└── README.md
```

### Adding Features
- Extend `PositionTracker` for persistent storage (database)
- Add Discord/Slack notifications for liquidations
- Implement gas price optimization strategies
- Add metrics and monitoring dashboards

## License

MIT

