/**
 * Position tracking service with Vercel KV storage
 */

import type { PublicClient, WatchContractEventReturnType } from 'viem'
import type { Redis } from '@upstash/redis'
import { TradingEngineABI } from './clients.js'
import type { BotConfig } from './types.js'

type KVClient = Redis | null

export class PositionTracker {
  private activePositions = new Set<string>()
  private kv: KVClient | null = null
  private listeners: WatchContractEventReturnType[] = []

  constructor(
    private publicClient: PublicClient,
    private tradingEngineAddress: `0x${string}`,
    kv?: KVClient | null,
  ) {
    this.kv = kv || null
  }

  /**
   * Load active positions from Vercel KV storage
   */
  async loadFromKV(): Promise<void> {
    if (!this.kv) {
      console.log('⚠️ KV not configured, skipping load')
      return
    }

    try {
      const positions = await this.kv.get<string[]>('positions:active')
      if (positions && Array.isArray(positions)) {
        this.activePositions = new Set(positions.map((p) => p.toLowerCase()))
        console.log(`📥 Loaded ${this.activePositions.size} positions from KV`)
      } else {
        console.log('📥 No positions found in KV (first run)')
        this.activePositions = new Set()
      }
    } catch (error) {
      console.error('❌ Error loading positions from KV:', error)
      this.activePositions = new Set()
    }
  }

  /**
   * Save active positions to Vercel KV storage
   */
  async saveToKV(): Promise<void> {
    if (!this.kv) {
      console.log('⚠️ KV not configured, skipping save')
      return
    }

    try {
      const positions = Array.from(this.activePositions)
      await this.kv.set('positions:active', positions)
      console.log(`💾 Saved ${positions.length} positions to KV`)
    } catch (error) {
      console.error('❌ Error saving positions to KV:', error)
    }
  }

  /**
   * Get the last backfill timestamp from KV
   */
  async getLastBackfillTime(): Promise<number | null> {
    if (!this.kv) return null

    try {
      const timestamp = await this.kv.get<number>('positions:lastBackfill')
      return timestamp || null
    } catch (error) {
      console.error('❌ Error getting last backfill time:', error)
      return null
    }
  }

  /**
   * Get the last backfill block number from KV
   */
  async getLastBackfillBlock(): Promise<bigint | null> {
    if (!this.kv) return null

    try {
      const block = await this.kv.get<string>('positions:lastBackfillBlock')
      return block ? BigInt(block) : null
    } catch (error) {
      console.error('❌ Error getting last backfill block:', error)
      return null
    }
  }

  /**
   * Save backfill metadata to KV
   */
  async saveBackfillMetadata(blockNumber: bigint): Promise<void> {
    if (!this.kv) return

    try {
      await this.kv.set('positions:lastBackfill', Date.now())
      await this.kv.set('positions:lastBackfillBlock', blockNumber.toString())
    } catch (error) {
      console.error('❌ Error saving backfill metadata:', error)
    }
  }

  /**
   * Start listening to contract events for real-time position tracking
   * Only works in traditional server mode (not in serverless/Vercel cron)
   */
  startEventListeners(): void {
    if (this.kv) {
      console.log('⚠️ Event listeners not available in serverless mode (KV configured)')
      return
    }

    console.log('🔍 Starting event listeners...')

    // Listen for new positions
    const positionOpenedListener = this.publicClient.watchContractEvent({
      address: this.tradingEngineAddress,
      abi: TradingEngineABI,
      eventName: 'PositionOpened',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          const user = (log.args?.user as `0x${string}`).toLowerCase()
          this.activePositions.add(user)
          console.log(`📈 New position opened: ${user}`)
        })
      },
    })

    // Remove positions when closed
    const positionClosedListener = this.publicClient.watchContractEvent({
      address: this.tradingEngineAddress,
      abi: TradingEngineABI,
      eventName: 'PositionClosed',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          const user = (log.args?.user as `0x${string}`).toLowerCase()
          this.activePositions.delete(user)
          console.log(`✅ Position closed: ${user}`)
        })
      },
    })

    // Remove positions when liquidated (may be liquidated by another bot)
    const liquidatedListener = this.publicClient.watchContractEvent({
      address: this.tradingEngineAddress,
      abi: TradingEngineABI,
      eventName: 'Liquidated',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          const user = (log.args?.user as `0x${string}`).toLowerCase()
          const liquidator = log.args?.liquidator as `0x${string}`
          this.activePositions.delete(user)
          console.log(`⚡ Position liquidated: ${user} by ${liquidator}`)
        })
      },
    })

    this.listeners = [positionOpenedListener, positionClosedListener, liquidatedListener]
  }

  /**
   * Stop all event listeners
   * Only relevant in traditional server mode
   */
  stopEventListeners(): void {
    if (this.kv) {
      return // No-op in serverless mode
    }

    this.listeners.forEach((listener) => listener())
    this.listeners = []
    console.log('🛑 Event listeners stopped')
  }

  /**
   * Backfill positions from historical events
   * If KV is available, will backfill incrementally from last known block
   */
  async backfillPositions(config: BotConfig, forceFullBackfill: boolean = false): Promise<void> {
    console.log('📚 Backfilling positions from historical events...')

    try {
      const currentBlock = await this.publicClient.getBlockNumber()
      let fromBlock: bigint

      // Check if we should do incremental backfill
      if (!forceFullBackfill && this.kv) {
        const lastBackfillBlock = await this.getLastBackfillBlock()
        if (lastBackfillBlock && lastBackfillBlock < currentBlock) {
          // Incremental backfill from last known block
          fromBlock = lastBackfillBlock
          console.log(`   Incremental backfill from block ${fromBlock} to ${currentBlock}`)
        } else {
          // Full backfill
          fromBlock = currentBlock - BigInt(config.backfillBlockRange)
          console.log(`   Full backfill from block ${fromBlock} to ${currentBlock}`)
        }
      } else {
        // Full backfill
        fromBlock = currentBlock - BigInt(config.backfillBlockRange)
        console.log(`   Fetching events from block ${fromBlock} to ${currentBlock}`)
      }

      // Fetch all relevant events in parallel
      const [positionOpenedLogs, positionClosedLogs, liquidatedLogs] = await Promise.all([
        this.publicClient.getLogs({
          address: this.tradingEngineAddress,
          event: {
            type: 'event',
            name: 'PositionOpened',
            inputs: [
              { indexed: true, name: 'user', type: 'address' },
              { indexed: false, name: 'isLong', type: 'bool' },
              { indexed: false, name: 'margin', type: 'uint256' },
              { indexed: false, name: 'leverage', type: 'uint256' },
              { indexed: false, name: 'entryPrice', type: 'uint256' },
              { indexed: false, name: 'positionSize', type: 'uint256' },
            ],
          },
          fromBlock,
          toBlock: currentBlock,
        }),
        this.publicClient.getLogs({
          address: this.tradingEngineAddress,
          event: {
            type: 'event',
            name: 'PositionClosed',
            inputs: [{ indexed: true, name: 'user', type: 'address' }],
          },
          fromBlock,
          toBlock: currentBlock,
        }),
        this.publicClient.getLogs({
          address: this.tradingEngineAddress,
          event: {
            type: 'event',
            name: 'Liquidated',
            inputs: [
              { indexed: true, name: 'user', type: 'address' },
              { indexed: true, name: 'liquidator', type: 'address' },
              { indexed: false, name: 'reward', type: 'uint256' },
            ],
          },
          fromBlock,
          toBlock: currentBlock,
        }),
      ])

      // Build sets of addresses
      const opened = new Set(
        positionOpenedLogs.map((log: any) => (log.args.user as `0x${string}`).toLowerCase()),
      )
      const closed = new Set(
        positionClosedLogs.map((log: any) => (log.args.user as `0x${string}`).toLowerCase()),
      )
      const liquidated = new Set(
        liquidatedLogs.map((log: any) => (log.args.user as `0x${string}`).toLowerCase()),
      )

      // Add positions that were opened but not closed or liquidated
      opened.forEach((user) => {
        if (!closed.has(user) && !liquidated.has(user)) {
          this.activePositions.add(user)
        }
      })

      console.log(`📊 Backfilled ${this.activePositions.size} active positions`)
      console.log(`   Opened: ${opened.size}, Closed: ${closed.size}, Liquidated: ${liquidated.size}`)
      
      // Show active positions for debugging
      if (this.activePositions.size > 0) {
        console.log(`   Active position addresses:`)
        Array.from(this.activePositions).forEach((addr) => {
          console.log(`     - ${addr}`)
        })
      } else {
        console.log(`   ⚠️ No active positions found in the scanned blocks`)
        console.log(`   ℹ️  New positions will be detected on the next backfill`)
      }

      // Save backfill metadata
      await this.saveBackfillMetadata(currentBlock)
      // Save positions to KV
      await this.saveToKV()
    } catch (error) {
      console.error('❌ Error backfilling positions:', error)
      throw error
    }
  }

  /**
   * Get all active position addresses
   */
  getActivePositions(): string[] {
    return Array.from(this.activePositions)
  }

  /**
   * Add a position address (manually)
   */
  addPosition(user: string): void {
    this.activePositions.add(user.toLowerCase())
  }

  /**
   * Remove a position address
   */
  removePosition(user: string): void {
    this.activePositions.delete(user.toLowerCase())
  }

  /**
   * Sync changes to KV storage (call after modifying positions)
   */
  async syncToKV(): Promise<void> {
    await this.saveToKV()
  }

  /**
   * Get count of active positions
   */
  getPositionCount(): number {
    return this.activePositions.size
  }
}

