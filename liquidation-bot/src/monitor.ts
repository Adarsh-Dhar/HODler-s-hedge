/**
 * Monitoring loop that checks positions for liquidation status
 */

import type { PublicClient } from 'viem'
import { TradingEngineABI } from './clients.js'
import type { PositionTracker } from './events.js'
import type { BotConfig } from './types.js'

export class MonitorService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private lastLogTime: number | null = null

  constructor(
    private publicClient: PublicClient,
    private positionTracker: PositionTracker,
    private tradingEngineAddress: `0x${string}`,
    private config: BotConfig,
    private onLiquidatableFound: (userAddress: string) => Promise<void>,
  ) {}

  /**
   * Start the monitoring loop
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Monitor is already running')
      return
    }

    console.log(`🔄 Starting monitoring loop (interval: ${this.config.monitorIntervalMs}ms)`)
    this.isRunning = true

    // Initial check
    this.checkPositions()

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkPositions()
    }, this.config.monitorIntervalMs)
  }

  /**
   * Stop the monitoring loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('🛑 Monitoring loop stopped')
  }

  /**
   * Check all positions for liquidation status
   */
  private async checkPositions(): Promise<void> {
    const activePositions = this.positionTracker.getActivePositions()
    
    if (activePositions.length === 0) {
      // Log periodically so we know the bot is running but just no positions
      const now = Date.now()
      if (!this.lastLogTime || now - this.lastLogTime > 60000) {
        // Log every minute when no positions
        console.log('👀 No active positions to monitor')
        this.lastLogTime = now
      }
      return // No positions to check
    }

    console.log(`🔍 Checking ${activePositions.length} position(s) for liquidation...`)

    const liquidatablePositions: string[] = []

    // Check all positions in parallel (up to a reasonable batch size)
    const batchSize = 10
    for (let i = 0; i < activePositions.length; i += batchSize) {
      const batch = activePositions.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (userAddress) => {
          try {
            // First verify position still exists
            const position = await this.publicClient.readContract({
              address: this.tradingEngineAddress,
              abi: TradingEngineABI,
              functionName: 'getPosition',
              args: [userAddress as `0x${string}`],
            })

            if (!(position as any).exists) {
              // Position no longer exists, remove from tracking
              this.positionTracker.removePosition(userAddress)
              return
            }

            // Check if liquidatable
            const isLiquidatable = await this.publicClient.readContract({
              address: this.tradingEngineAddress,
              abi: TradingEngineABI,
              functionName: 'isLiquidatable',
              args: [userAddress as `0x${string}`],
            })

            if (isLiquidatable) {
              liquidatablePositions.push(userAddress)
            }
          } catch (error) {
            console.error(`❌ Error checking position ${userAddress}:`, error)
          }
        })
      )
    }

    // Execute liquidations for all liquidatable positions
    if (liquidatablePositions.length > 0) {
      console.log(`⚡ Found ${liquidatablePositions.length} liquidatable positions`)
      
      // Execute with small delays to avoid race conditions
      for (const userAddress of liquidatablePositions) {
        await this.onLiquidatableFound(userAddress)
        // Small delay between liquidations
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }
}

