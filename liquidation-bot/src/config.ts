/**
 * Configuration module for loading and validating environment variables
 */

import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { BotConfig } from './types.js'

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read the address from lib/address.ts at runtime
// This ensures the bot always uses the same address as the frontend
function getTradingEngineAddress(): `0x${string}` {
  try {
    const addressFile = join(__dirname, '../../lib/address.ts')
    const content = readFileSync(addressFile, 'utf-8')
    // Try both single and double quotes, and handle various whitespace
    const match = content.match(/export const tradingEngineAddress\s*=\s*["']([^"']+)["']/)
    if (match && match[1]) {
      const address = match[1] as `0x${string}`
      console.log(`✓ Loaded TradingEngine address from lib/address.ts: ${address}`)
      return address
    } else {
      console.warn('⚠️ Could not parse tradingEngineAddress from lib/address.ts, using fallback')
    }
  } catch (error: any) {
    console.warn(`⚠️ Could not read address from lib/address.ts: ${error?.message || error}`)
    console.warn('   Using fallback address. Set TRADING_ENGINE_ADDRESS env var to override.')
  }
  // Fallback to current correct address
  return '0x304B0E3DFC3701F5907dcb955E93a9D7c8b78b7F' as const
}

const DEFAULT_TRADING_ENGINE_ADDRESS = getTradingEngineAddress()

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
  validateAddress(contractAddress as string)

  const rpcUrl = getEnvVar('RPC_URL', 'https://rpc.test.mezo.org')
  const chainId = getEnvNumber('CHAIN_ID', 31611)
  const maxGasPriceGwei = process.env.MAX_GAS_PRICE_GWEI
    ? parseInt(process.env.MAX_GAS_PRICE_GWEI, 10)
    : undefined
  const backfillBlockRange = getEnvNumber('BACKFILL_BLOCK_RANGE', 6000)

  return {
    liquidatorPrivateKey: privateKey,
    rpcUrl,
    tradingEngineAddress: contractAddress as `0x${string}`,
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
  console.log(`   Backfill Range: ${config.backfillBlockRange} blocks`)
  if (config.maxGasPriceGwei) {
    console.log(`   Max Gas Price: ${config.maxGasPriceGwei} gwei`)
  }
  const address = config.liquidatorPrivateKey.slice(0, 6) + '...' + config.liquidatorPrivateKey.slice(-4)
  console.log(`   Liquidator Address: ${address}`)
}

