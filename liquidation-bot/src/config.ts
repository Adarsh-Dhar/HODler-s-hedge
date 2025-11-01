/**
 * Configuration module for loading and validating environment variables
 */

import dotenv from 'dotenv'
import type { BotConfig } from './types.js'

// Default TradingEngine address from lib/address.ts
const DEFAULT_TRADING_ENGINE_ADDRESS = '0xc1e04Adfa33cb46D3A9852188d97dE3C2FFF236F' as const

dotenv.config()

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${name}: ${value}`)
  }
  return parsed
}

function validatePrivateKey(key: string): asserts key is `0x${string}` {
  if (!key.startsWith('0x') || key.length !== 66) {
    throw new Error('Invalid private key format. Must start with 0x and be 66 characters long')
  }
}

function validateAddress(address: string): asserts address is `0x${string}` {
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new Error(`Invalid address format: ${address}`)
  }
}

export function loadConfig(): BotConfig {
  const privateKey = getEnvVar('LIQUIDATOR_PRIVATE_KEY')
  validatePrivateKey(privateKey)

  const contractAddress = process.env.TRADING_ENGINE_ADDRESS || DEFAULT_TRADING_ENGINE_ADDRESS
  validateAddress(contractAddress)

  const rpcUrl = getEnvVar('RPC_URL', 'https://rpc.test.mezo.org')
  const chainId = getEnvNumber('CHAIN_ID', 31611)
  const monitorIntervalMs = getEnvNumber('MONITOR_INTERVAL_MS', 15000)
  const maxGasPriceGwei = process.env.MAX_GAS_PRICE_GWEI
    ? parseInt(process.env.MAX_GAS_PRICE_GWEI, 10)
    : undefined
  const backfillBlockRange = getEnvNumber('BACKFILL_BLOCK_RANGE', 6000)

  return {
    liquidatorPrivateKey: privateKey,
    rpcUrl,
    tradingEngineAddress: contractAddress as `0x${string}`,
    monitorIntervalMs,
    chainId,
    maxGasPriceGwei,
    backfillBlockRange,
  }
}

export function logConfig(config: BotConfig): void {
  console.log('📋 Bot Configuration:')
  console.log(`   RPC URL: ${config.rpcUrl}`)
  console.log(`   Trading Engine: ${config.tradingEngineAddress}`)
  console.log(`   Chain ID: ${config.chainId}`)
  console.log(`   Monitor Interval: ${config.monitorIntervalMs}ms`)
  console.log(`   Backfill Range: ${config.backfillBlockRange} blocks`)
  if (config.maxGasPriceGwei) {
    console.log(`   Max Gas Price: ${config.maxGasPriceGwei} gwei`)
  }
  const address = config.liquidatorPrivateKey.slice(0, 6) + '...' + config.liquidatorPrivateKey.slice(-4)
  console.log(`   Liquidator Address: ${address}`)
}

