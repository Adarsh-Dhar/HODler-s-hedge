/**
 * Monitoring service that checks positions for liquidation status
 * Supports both single execution (serverless) and interval-based (traditional server)
 */

import type { PublicClient } from 'viem'
import { TradingEngineABI } from './clients.js'
import type { PositionTracker } from './events.js'
import type { BotConfig } from './types.js'

export class MonitorService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(
    private publicClient: PublicClient,
    private positionTracker: PositionTracker,
    private tradingEngineAddress: `0x${string}`,
    private onLiquidatableFound: (userAddress: string) => Promise<void>,
    private config?: BotConfig,
  ) {}

  /**
   * Start the monitoring loop (traditional server mode only)
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Monitor is already running')
      return
    }

    if (!this.config) {
      console.log('⚠️ Cannot start interval-based monitoring without config (use executeCheck() for serverless)')
      return
    }

    console.log(`🔄 Starting monitoring loop (interval: ${this.config.monitorIntervalMs || 15000}ms)`)
    this.isRunning = true

    // Initial check
    this.checkPositions()

    // Set up interval
    const intervalMs = this.config.monitorIntervalMs || 15000
    this.intervalId = setInterval(() => {
      this.checkPositions()
    }, intervalMs)
  }

  /**
   * Stop the monitoring loop (traditional server mode only)
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
   * Internal method for interval-based checking (traditional server mode)
   */
  private async checkPositions(): Promise<void> {
    await this.executeCheck()
  }

  /**
   * Execute a single check of all positions for liquidation status
   * Call this method from cron function or other single-execution contexts
   */
  async executeCheck(): Promise<void> {
    const activePositions = this.positionTracker.getActivePositions()
    
    if (activePositions.length === 0) {
      console.log('👀 No active positions to monitor')
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
              // Sync to KV after removing position
              await this.positionTracker.syncToKV()
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

