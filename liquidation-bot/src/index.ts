/**
 * Main entry point for the liquidation bot
 */

import type { Redis } from '@upstash/redis'
import { loadConfig, logConfig } from './config.js'
import { createClients } from './clients.js'
import { PositionTracker } from './events.js'
import { MonitorService } from './monitor.js'
import { LiquidationService } from './liquidation.js'

type KVClient = Redis | null

async function main() {
  console.log('🤖 Liquidation Bot Starting...')
  console.log('='.repeat(50))

  // Load configuration
  let config
  try {
    config = loadConfig()
    logConfig(config)
  } catch (error: any) {
    console.error('❌ Configuration error:', error.message)
    process.exit(1)
  }

  // Create viem clients
  const { publicClient, walletClient, account } = createClients(config)
  console.log(`👛 Liquidator Address: ${account.address}`)
  console.log('='.repeat(50))

  // Check wallet balance
  try {
    const balance = await publicClient.getBalance({ address: account.address })
    const balanceFormatted = Number(balance) / 1e18
    console.log(`💰 Wallet Balance: ${balanceFormatted} BTC`)
    
    if (balance === 0n) {
      console.warn('⚠️ WARNING: Wallet balance is 0. Bot needs BTC for gas fees!')
    }
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error)
  }

  // Create position tracker
  const positionTracker = new PositionTracker(publicClient, config.tradingEngineAddress)

  // Backfill positions from historical events
  try {
    await positionTracker.backfillPositions(config)
  } catch (error) {
    console.error('❌ Error during backfill, continuing with empty position list:', error)
  }

  // Create liquidation service
  const liquidationService = new LiquidationService(
    publicClient,
    walletClient,
    positionTracker,
    config.tradingEngineAddress,
    config,
  )

  // Create monitor service (traditional server mode - add default interval)
  const monitorService = new MonitorService(
    publicClient,
    positionTracker,
    config.tradingEngineAddress,
    async (userAddress: string) => {
      const result = await liquidationService.executeLiquidation(userAddress)
      if (!result.success) {
        console.warn(`⚠️ Liquidation failed for ${userAddress}: ${result.error}`)
      }
    },
    { ...config, monitorIntervalMs: 15000 }, // Add default interval for traditional mode
  )

  // Start event listeners (only works in traditional server mode, not serverless)
  positionTracker.startEventListeners()

  // Start monitoring loop (only works in traditional server mode)
  monitorService.start()

  console.log('✅ Bot is running! Press Ctrl+C to stop.')
  console.log('='.repeat(50))

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('\n🛑 Shutting down liquidation bot...')
    
    monitorService.stop()
    positionTracker.stopEventListeners()
    
    console.log('👋 Bot stopped. Goodbye!')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error)
})

// Run the bot (for traditional server usage)
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

/**
 * Serverless-friendly function for Vercel Cron
 * This function runs once per cron invocation
 */
export async function runLiquidationCheck(kvClient: KVClient | null = null): Promise<void> {
  console.log('🤖 Liquidation Bot Check Starting...')
  console.log('='.repeat(50))

  // Load configuration
  let config
  try {
    config = loadConfig()
    logConfig(config)
  } catch (error: any) {
    console.error('❌ Configuration error:', error.message)
    throw error
  }

  // Create viem clients
  const { publicClient, walletClient, account } = createClients(config)
  console.log(`👛 Liquidator Address: ${account.address}`)
  console.log('='.repeat(50))

  // Check wallet balance
  try {
    const balance = await publicClient.getBalance({ address: account.address })
    const balanceFormatted = Number(balance) / 1e18
    console.log(`💰 Wallet Balance: ${balanceFormatted} BTC`)
    
    if (balance === 0n) {
      console.warn('⚠️ WARNING: Wallet balance is 0. Bot needs BTC for gas fees!')
    }
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error)
  }

  // Create position tracker with KV
  const positionTracker = new PositionTracker(publicClient, config.tradingEngineAddress, kvClient)

  // Load positions from KV
  await positionTracker.loadFromKV()

  // Check if we need to run backfill
  const lastBackfillTime = await positionTracker.getLastBackfillTime()
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const shouldBackfill = !lastBackfillTime || lastBackfillTime < oneHourAgo

  if (shouldBackfill) {
    console.log('📚 Running backfill (first run or >1 hour since last backfill)')
    try {
      await positionTracker.backfillPositions(config, !lastBackfillTime)
    } catch (error) {
      console.error('❌ Error during backfill, continuing with existing positions:', error)
    }
  } else {
    console.log('⏭️ Skipping backfill (recently updated)')
  }

  // Create liquidation service
  const liquidationService = new LiquidationService(
    publicClient,
    walletClient,
    positionTracker,
    config.tradingEngineAddress,
    config,
  )

  // Create monitor service
  const monitorService = new MonitorService(
    publicClient,
    positionTracker,
    config.tradingEngineAddress,
    async (userAddress: string) => {
      const result = await liquidationService.executeLiquidation(userAddress)
      if (!result.success) {
        console.warn(`⚠️ Liquidation failed for ${userAddress}: ${result.error}`)
      }
      // Sync to KV after liquidation attempt
      await positionTracker.syncToKV()
    },
  )

  // Execute single monitoring check
  await monitorService.executeCheck()

  // Save positions to KV
  await positionTracker.saveToKV()

  console.log('✅ Liquidation check completed!')
  console.log('='.repeat(50))
}

