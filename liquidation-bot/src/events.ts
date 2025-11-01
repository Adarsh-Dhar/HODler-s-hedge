/**
 * Event listeners and backfill service for position tracking
 */

import type { PublicClient, WatchContractEventReturnType } from 'viem'
import { TradingEngineABI } from './clients.js'
import type { BotConfig } from './types.js'

export class PositionTracker {
  private activePositions = new Set<string>()
  private listeners: WatchContractEventReturnType[] = []

  constructor(
    private publicClient: PublicClient,
    private tradingEngineAddress: `0x${string}`,
  ) {}

  /**
   * Start listening to contract events for real-time position tracking
   */
  startEventListeners(): void {
    console.log('🔍 Starting event listeners...')

    // Listen for new positions
    const positionOpenedListener = this.publicClient.watchContractEvent({
      address: this.tradingEngineAddress,
      abi: TradingEngineABI,
      eventName: 'PositionOpened',
      onLogs: (logs) => {
        logs.forEach((log) => {
          const user = (log.args.user as `0x${string}`).toLowerCase()
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
        logs.forEach((log) => {
          const user = (log.args.user as `0x${string}`).toLowerCase()
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
        logs.forEach((log) => {
          const user = (log.args.user as `0x${string}`).toLowerCase()
          const liquidator = log.args.liquidator as `0x${string}`
          this.activePositions.delete(user)
          console.log(`⚡ Position liquidated: ${user} by ${liquidator}`)
        })
      },
    })

    this.listeners = [positionOpenedListener, positionClosedListener, liquidatedListener]
  }

  /**
   * Stop all event listeners
   */
  stopEventListeners(): void {
    this.listeners.forEach((listener) => listener())
    this.listeners = []
    console.log('🛑 Event listeners stopped')
  }

  /**
   * Backfill positions from historical events
   */
  async backfillPositions(config: BotConfig): Promise<void> {
    console.log('📚 Backfilling positions from historical events...')

    try {
      const currentBlock = await this.publicClient.getBlockNumber()
      const fromBlock = currentBlock - BigInt(config.backfillBlockRange)

      console.log(`   Fetching events from block ${fromBlock} to ${currentBlock}`)

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
   * Get count of active positions
   */
  getPositionCount(): number {
    return this.activePositions.size
  }
}

