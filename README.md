# HODler-s-hedge

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
