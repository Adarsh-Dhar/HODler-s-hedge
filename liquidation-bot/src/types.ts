/**
 * Type definitions for the liquidation bot
 */

export interface BotConfig {
  liquidatorPrivateKey: `0x${string}`
  rpcUrl: string
  tradingEngineAddress: `0x${string}`
  chainId: number
  maxGasPriceGwei?: number
  backfillBlockRange: number
  monitorIntervalMs?: number // Optional: only used in traditional server mode
}

export interface Position {
  user: `0x${string}`
  isLong: boolean
  entryPrice: bigint
  size: bigint
  margin: bigint
  leverage: bigint
  openTimestamp: bigint
  exists: boolean
}

export interface LiquidationResult {
  success: boolean
  user: `0x${string}`
  txHash?: `0x${string}`
  reward?: bigint
  error?: string
}

