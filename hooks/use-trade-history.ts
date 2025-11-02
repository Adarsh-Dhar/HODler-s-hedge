import { useState, useEffect, useCallback } from 'react'
import { useWatchContractEvent, usePublicClient } from 'wagmi'
import { tradingEngineAddress } from '@/lib/address'
import { TradingEngineABI } from '@/lib/abi/TradingEngine'

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface PositionOpenedEvent {
  user: string
  isLong: boolean
  margin: bigint
  leverage: bigint
  entryPrice: bigint
  positionSize: bigint
  blockNumber: bigint
  transactionHash: string
  timestamp: number
  eventType: 'opened'
}

export interface PositionClosedEvent {
  user: string
  pnl: bigint
  exitPrice: bigint
  fundingPayment: bigint
  blockNumber: bigint
  transactionHash: string
  timestamp: number
  eventType: 'closed'
}

export interface LiquidatedEvent {
  user: string
  liquidator: string
  reward: bigint
  blockNumber: bigint
  transactionHash: string
  timestamp: number
  eventType: 'liquidated'
}

export type TradeEvent = PositionOpenedEvent | PositionClosedEvent | LiquidatedEvent

// ============================================================================
// EVENT MONITORING HOOKS
// ============================================================================

export function usePositionOpenedEvents() {
  const [events, setEvents] = useState<PositionOpenedEvent[]>([])
  
  useWatchContractEvent({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    eventName: 'PositionOpened',
    onLogs(logs) {
      const newEvents = logs.map(log => ({
        user: log.args.user as string,
        isLong: log.args.isLong as boolean,
        margin: log.args.margin as bigint,
        leverage: log.args.leverage as bigint,
        entryPrice: log.args.entryPrice as bigint,
        positionSize: log.args.positionSize as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
        eventType: 'opened' as const,
      }))
      
      setEvents(prev => [...prev, ...newEvents])
    },
  })
  
  return events
}

export function usePositionClosedEvents() {
  const [events, setEvents] = useState<PositionClosedEvent[]>([])
  
  useWatchContractEvent({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    eventName: 'PositionClosed',
    onLogs(logs) {
      const newEvents = logs.map(log => ({
        user: log.args.user as string,
        pnl: log.args.pnl as bigint,
        exitPrice: log.args.exitPrice as bigint,
        fundingPayment: log.args.fundingPayment as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
        eventType: 'closed' as const,
      }))
      
      setEvents(prev => [...prev, ...newEvents])
    },
  })
  
  return events
}

export function useLiquidatedEvents() {
  const [events, setEvents] = useState<LiquidatedEvent[]>([])
  
  useWatchContractEvent({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    eventName: 'Liquidated',
    onLogs(logs) {
      const newEvents = logs.map(log => ({
        user: log.args.user as string,
        liquidator: log.args.liquidator as string,
        reward: log.args.reward as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
        eventType: 'liquidated' as const,
      }))
      
      setEvents(prev => [...prev, ...newEvents])
    },
  })
  
  return events
}

export function useTradeEvents() {
  const openedEvents = usePositionOpenedEvents()
  const closedEvents = usePositionClosedEvents()
  const liquidatedEvents = useLiquidatedEvents()
  
  const allEvents = [...openedEvents, ...closedEvents, ...liquidatedEvents].sort((a, b) => 
    Number(b.blockNumber) - Number(a.blockNumber)
  )
  
  return {
    opened: openedEvents,
    closed: closedEvents,
    liquidated: liquidatedEvents,
    all: allEvents,
  }
}

// ============================================================================
// HISTORICAL BACKFILL HOOK
// ============================================================================

export function useTradeHistoryBackfill(options?: { fromBlock?: bigint; userAddress?: string }) {
  const publicClient = usePublicClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backfilledEvents, setBackfilledEvents] = useState<TradeEvent[]>([])
  
  const backfill = useCallback(async () => {
    if (!publicClient) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = options?.fromBlock || currentBlock - BigInt(10000)
      
      // Fetch all events in parallel
      const [openedLogs, closedLogs, liquidatedLogs] = await Promise.all([
        publicClient.getLogs({
          address: tradingEngineAddress,
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
        publicClient.getLogs({
          address: tradingEngineAddress,
          event: {
            type: 'event',
            name: 'PositionClosed',
            inputs: [
              { indexed: true, name: 'user', type: 'address' },
              { indexed: false, name: 'pnl', type: 'int256' },
              { indexed: false, name: 'exitPrice', type: 'uint256' },
              { indexed: false, name: 'fundingPayment', type: 'int256' },
            ],
          },
          fromBlock,
          toBlock: currentBlock,
        }),
        publicClient.getLogs({
          address: tradingEngineAddress,
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
      
      // Helper function to fetch block timestamps
      const fetchBlockTimestamps = async (blockNumbers: Set<bigint>) => {
        const timestampMap = new Map<bigint, number>()
        
        // Fetch timestamps in batches (to avoid overwhelming RPC)
        const blocks = Array.from(blockNumbers)
        const batchSize = 20
        
        for (let i = 0; i < blocks.length; i += batchSize) {
          const batch = blocks.slice(i, i + batchSize)
          const promises = batch.map(blockNum => 
            publicClient.getBlock({ blockNumber: blockNum }).then(block => ({
              blockNumber: blockNum,
              timestamp: Number(block.timestamp) * 1000 // Convert to milliseconds
            }))
          )
          
          const results = await Promise.all(promises)
          results.forEach(({ blockNumber, timestamp }) => {
            timestampMap.set(blockNumber, timestamp)
          })
        }
        
        return timestampMap
      }
      
      // Transform logs to events with accurate timestamps
      const blockNumbers = new Set<bigint>()
      openedLogs.forEach(log => blockNumbers.add(log.blockNumber))
      closedLogs.forEach(log => blockNumbers.add(log.blockNumber))
      liquidatedLogs.forEach(log => blockNumbers.add(log.blockNumber))
      
      // Fetch all block timestamps
      const timestampMap = await fetchBlockTimestamps(blockNumbers)
      
      const opened: PositionOpenedEvent[] = openedLogs.map(log => ({
        user: (log.args.user as string).toLowerCase(),
        isLong: log.args.isLong as boolean,
        margin: log.args.margin as bigint,
        leverage: log.args.leverage as bigint,
        entryPrice: log.args.entryPrice as bigint,
        positionSize: log.args.positionSize as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: timestampMap.get(log.blockNumber) || Date.now(), // Use block timestamp
        eventType: 'opened' as const,
      }))
      
      const closed: PositionClosedEvent[] = closedLogs.map(log => ({
        user: (log.args.user as string).toLowerCase(),
        pnl: log.args.pnl as bigint,
        exitPrice: log.args.exitPrice as bigint,
        fundingPayment: log.args.fundingPayment as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: timestampMap.get(log.blockNumber) || Date.now(), // Use block timestamp
        eventType: 'closed' as const,
      }))
      
      const liquidated: LiquidatedEvent[] = liquidatedLogs.map(log => ({
        user: (log.args.user as string).toLowerCase(),
        liquidator: (log.args.liquidator as string).toLowerCase(),
        reward: log.args.reward as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: timestampMap.get(log.blockNumber) || Date.now(), // Use block timestamp
        eventType: 'liquidated' as const,
      }))
      
      let allEvents = [...opened, ...closed, ...liquidated]
      
      // Filter by user address if provided
      if (options?.userAddress) {
        const userLower = options.userAddress.toLowerCase()
        allEvents = allEvents.filter(event => event.user === userLower)
      }
      
      // Sort by block number (newest first)
      allEvents.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
      
      setBackfilledEvents(allEvents)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to backfill trade history'
      setError(errorMessage)
      console.error('Error backfilling trade history:', err)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, options?.fromBlock, options?.userAddress])
  
  return {
    backfill,
    isLoading,
    error,
    events: backfilledEvents,
  }
}

// ============================================================================
// EVENT FILTERING HOOKS
// ============================================================================

export function useFilteredTradeEvents(
  events: TradeEvent[],
  filters: {
    userAddress?: string
    eventType?: 'opened' | 'closed' | 'liquidated' | 'all'
    direction?: 'long' | 'short' | 'all'
    timeRange?: { start: Date; end: Date }
    pnlRange?: 'profit' | 'loss' | 'all'
    transactionHash?: string
  }
) {
  const [filteredEvents, setFilteredEvents] = useState<TradeEvent[]>([])
  
  useEffect(() => {
    let filtered = events
    
    // Filter by user address
    if (filters.userAddress) {
      filtered = filtered.filter(event => 
        event.user.toLowerCase() === filters.userAddress!.toLowerCase()
      )
    }
    
    // Filter by event type
    if (filters.eventType && filters.eventType !== 'all') {
      filtered = filtered.filter(event => event.eventType === filters.eventType)
    }
    
    // Filter by direction (only applies to opened events)
    if (filters.direction && filters.direction !== 'all') {
      filtered = filtered.filter(event => {
        if (event.eventType === 'opened') {
          return filters.direction === 'long' ? event.isLong : !event.isLong
        }
        return true // Closed/liquidated events don't have direction
      })
    }
    
    // Filter by time range
    if (filters.timeRange) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.timestamp)
        return eventDate >= filters.timeRange!.start && eventDate <= filters.timeRange!.end
      })
    }
    
    // Filter by PnL range (only applies to closed/liquidated events)
    if (filters.pnlRange && filters.pnlRange !== 'all') {
      filtered = filtered.filter(event => {
        if (event.eventType === 'closed') {
          const isProfit = Number(event.pnl) >= 0
          return filters.pnlRange === 'profit' ? isProfit : !isProfit
        }
        // Liquidated events are always losses (from user's perspective)
        if (event.eventType === 'liquidated') {
          return filters.pnlRange === 'loss'
        }
        return true
      })
    }
    
    // Filter by transaction hash
    if (filters.transactionHash) {
      filtered = filtered.filter(event =>
        event.transactionHash.toLowerCase().includes(filters.transactionHash!.toLowerCase())
      )
    }
    
    setFilteredEvents(filtered)
  }, [events, filters])
  
  return filteredEvents
}

// ============================================================================
// EVENT STATISTICS HOOKS
// ============================================================================

export function useTradeEventStats(events: TradeEvent[]) {
  const [stats, setStats] = useState({
    totalEvents: 0,
    openedCount: 0,
    closedCount: 0,
    liquidatedCount: 0,
    totalPnL: BigInt(0),
    totalMargin: BigInt(0),
    uniqueUsers: 0,
    averageMargin: BigInt(0),
  })
  
  useEffect(() => {
    const openedEvents = events.filter(e => e.eventType === 'opened') as PositionOpenedEvent[]
    const closedEvents = events.filter(e => e.eventType === 'closed') as PositionClosedEvent[]
    const liquidatedEvents = events.filter(e => e.eventType === 'liquidated') as LiquidatedEvent[]
    
    const totalPnL = closedEvents.reduce((sum, event) => sum + event.pnl, BigInt(0))
    const totalMargin = openedEvents.reduce((sum, event) => sum + event.margin, BigInt(0))
    const uniqueUsers = new Set(events.map(event => event.user)).size
    
    const averageMargin = openedEvents.length > 0 
      ? totalMargin / BigInt(openedEvents.length) 
      : BigInt(0)
    
    setStats({
      totalEvents: events.length,
      openedCount: openedEvents.length,
      closedCount: closedEvents.length,
      liquidatedCount: liquidatedEvents.length,
      totalPnL,
      totalMargin,
      uniqueUsers,
      averageMargin,
    })
  }, [events])
  
  return stats
}

