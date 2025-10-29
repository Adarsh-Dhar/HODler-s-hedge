import { useState, useEffect } from 'react'
import { useWatchContractEvent } from 'wagmi'
import { vaultAddress } from '@/lib/address'
import { VaultABI } from '@/lib/abi/Vault'

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface MarginLockedEvent {
  user: string
  amount: bigint
  blockNumber: bigint
  transactionHash: string
  timestamp: number
}

export interface MarginUnlockedEvent {
  user: string
  amount: bigint
  pnl: bigint
  blockNumber: bigint
  transactionHash: string
  timestamp: number
}

export type MarginEvent = MarginLockedEvent | MarginUnlockedEvent

// ============================================================================
// EVENT MONITORING HOOKS
// ============================================================================

export function useMarginLockedEvents() {
  const [events, setEvents] = useState<MarginLockedEvent[]>([])
  
  useWatchContractEvent({
    address: vaultAddress,
    abi: VaultABI,
    eventName: 'MarginLocked',
    onLogs(logs) {
      const newEvents = logs.map(log => ({
        user: log.args.user as string,
        amount: log.args.amount as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
      }))
      
      setEvents(prev => [...prev, ...newEvents])
    },
  })
  
  return events
}

export function useMarginUnlockedEvents() {
  const [events, setEvents] = useState<MarginUnlockedEvent[]>([])
  
  useWatchContractEvent({
    address: vaultAddress,
    abi: VaultABI,
    eventName: 'MarginUnlocked',
    onLogs(logs) {
      const newEvents = logs.map(log => ({
        user: log.args.user as string,
        amount: log.args.amount as bigint,
        pnl: log.args.pnl as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
      }))
      
      setEvents(prev => [...prev, ...newEvents])
    },
  })
  
  return events
}

export function useMarginEvents() {
  const lockedEvents = useMarginLockedEvents()
  const unlockedEvents = useMarginUnlockedEvents()
  
  const allEvents = [...lockedEvents, ...unlockedEvents].sort((a, b) => 
    Number(b.blockNumber) - Number(a.blockNumber)
  )
  
  return {
    locked: lockedEvents,
    unlocked: unlockedEvents,
    all: allEvents,
    totalLocked: lockedEvents.reduce((sum, event) => sum + event.amount, BigInt(0)),
    totalUnlocked: unlockedEvents.reduce((sum, event) => sum + event.amount, BigInt(0)),
    totalPnL: unlockedEvents.reduce((sum, event) => sum + event.pnl, BigInt(0)),
  }
}

// ============================================================================
// EVENT FILTERING HOOKS
// ============================================================================

export function useFilteredMarginEvents(
  events: MarginEvent[],
  filters: {
    userAddress?: string
    eventType?: 'locked' | 'unlocked' | 'all'
    timeRange?: { start: Date; end: Date }
  }
) {
  const [filteredEvents, setFilteredEvents] = useState<MarginEvent[]>([])
  
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
      filtered = filtered.filter(event => {
        if (filters.eventType === 'locked') {
          return 'amount' in event && !('pnl' in event)
        } else if (filters.eventType === 'unlocked') {
          return 'pnl' in event
        }
        return true
      })
    }
    
    // Filter by time range
    if (filters.timeRange) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.timestamp)
        return eventDate >= filters.timeRange!.start && eventDate <= filters.timeRange!.end
      })
    }
    
    setFilteredEvents(filtered)
  }, [events, filters])
  
  return filteredEvents
}

// ============================================================================
// EVENT STATISTICS HOOKS
// ============================================================================

export function useMarginEventStats(events: MarginEvent[]) {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalLocked: BigInt(0),
    totalUnlocked: BigInt(0),
    totalPnL: BigInt(0),
    uniqueUsers: 0,
    averageLockAmount: BigInt(0),
    averageUnlockAmount: BigInt(0),
  })
  
  useEffect(() => {
    const lockedEvents = events.filter(event => 'amount' in event && !('pnl' in event)) as MarginLockedEvent[]
    const unlockedEvents = events.filter(event => 'pnl' in event) as MarginUnlockedEvent[]
    
    const totalLocked = lockedEvents.reduce((sum, event) => sum + event.amount, BigInt(0))
    const totalUnlocked = unlockedEvents.reduce((sum, event) => sum + event.amount, BigInt(0))
    const totalPnL = unlockedEvents.reduce((sum, event) => sum + event.pnl, BigInt(0))
    
    const uniqueUsers = new Set(events.map(event => event.user)).size
    
    const averageLockAmount = lockedEvents.length > 0 ? totalLocked / BigInt(lockedEvents.length) : BigInt(0)
    const averageUnlockAmount = unlockedEvents.length > 0 ? totalUnlocked / BigInt(unlockedEvents.length) : BigInt(0)
    
    setStats({
      totalEvents: events.length,
      totalLocked,
      totalUnlocked,
      totalPnL,
      uniqueUsers,
      averageLockAmount,
      averageUnlockAmount,
    })
  }, [events])
  
  return stats
}
