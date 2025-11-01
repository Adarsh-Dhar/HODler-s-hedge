/**
 * Main entry point for the liquidation bot
 */

import { loadConfig, logConfig } from './config.js'
import { createClients } from './clients.js'
import { PositionTracker } from './events.js'
import { MonitorService } from './monitor.js'
import { LiquidationService } from './liquidation.js'

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

  // Create monitor service
  const monitorService = new MonitorService(
    publicClient,
    positionTracker,
    config.tradingEngineAddress,
    config,
    async (userAddress: string) => {
      const result = await liquidationService.executeLiquidation(userAddress)
      if (!result.success) {
        console.warn(`⚠️ Liquidation failed for ${userAddress}: ${result.error}`)
      }
    },
  )

  // Start event listeners
  positionTracker.startEventListeners()

  // Start monitoring loop
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

// Run the bot
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

