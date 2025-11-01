# HODler-s-hedge

## Shared Configuration

This project uses a shared configuration system located in the `lib/` directory. This ensures consistency across the frontend application and the liquidation bot.

### Shared Resources

The `lib/` directory contains:

- **`lib/abi/`** - Contract ABIs (TradingEngine, Vault, FundingRate, etc.)
- **`lib/address.ts`** - Contract addresses deployed on Mezo Testnet
- **`lib/utils.ts`** - Shared utility functions

### Integration

Both the frontend and liquidation bot import from these shared resources:

- **Frontend** (`app/`, `hooks/`, `components/`): Uses `@/lib/*` imports (via Next.js path aliases)
- **Liquidation Bot** (`liquidation-bot/`): Uses relative imports `../../lib/*`

This ensures:
- ✅ Same contract addresses across frontend and bot
- ✅ Same ABIs across frontend and bot  
- ✅ Single source of truth for contract configuration

### Updating Contract Addresses

When deploying new contracts, update `lib/address.ts` and both the frontend and bot will automatically use the new addresses.

### Updating ABIs

When contracts are updated, regenerate ABIs and update `lib/abi/*.ts`. The bot imports directly from these files, ensuring compatibility.

## Environment Setup

### CoinGecko API Configuration

To use the BTC price API endpoints, you need to configure the CoinGecko API key:

1. Get your API key from [CoinGecko API](https://www.coingecko.com/en/api)
2. Create a `.env.local` file in the root directory
3. Add the following environment variable:

```bash
COINGECKO_API_KEY=your_coingecko_api_key_here
```

## API Endpoints

### BTC Price API

**Current Price:**
```
GET /api/price
```

**Historical Price:**
```
GET /api/price?type=historical&date=2024-01-15
```

**Response Format:**
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
