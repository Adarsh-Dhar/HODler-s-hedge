# Shared Configuration Library

This directory contains shared configuration, ABIs, and utilities used by both the frontend application and the liquidation bot.

## Structure

```
lib/
├── abi/              # Contract ABIs (auto-generated from contracts)
│   ├── TradingEngine.ts
│   ├── Vault.ts
│   ├── FundingRate.ts
│   └── ...
├── address.ts        # Contract addresses (single source of truth)
├── utils.ts          # Shared utility functions
└── pyth.ts           # Pyth oracle utilities
```

## Usage

### Frontend
```typescript
import { tradingEngineAddress } from '@/lib/address'
import { TradingEngineABI } from '@/lib/abi/TradingEngine'
```

### Liquidation Bot
```typescript
import { tradingEngineAddress } from '../../lib/address.js'
import { TradingEngineABI } from '../../lib/abi/TradingEngine.js'
```

## Adding New Contracts

1. Deploy the contract and get the address
2. Add the address to `address.ts`:
   ```typescript
   export const myNewContractAddress = "0x..." as const
   ```
3. Generate/update the ABI file in `abi/`
4. Both frontend and bot can now use the shared address and ABI

## Contract Addresses

All contract addresses are stored in `address.ts`. When updating:
- Update the address in `address.ts`
- Both frontend and bot will automatically use the new address
- No need to update multiple files

## ABIs

Contract ABIs are stored in `abi/`. These should be:
- Generated from contract compilation artifacts
- Kept in sync with deployed contracts
- Used by both frontend (wagmi) and bot (viem)

