"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  useTradeEvents, 
  useTradeHistoryBackfill, 
  useFilteredTradeEvents,
  useTradeEventStats,
  type TradeEvent,
  type PositionOpenedEvent,
  type PositionClosedEvent,
  type LiquidatedEvent,
} from "@/hooks/use-trade-history"

const BLOCK_EXPLORER_URL = "https://explorer.test.mezo.org"

export default function TradeHistory() {
  const { address: userAddress } = useAccount()
  
  // Get real-time events
  const { all: realTimeEvents } = useTradeEvents()
  
  // Backfill historical events
  const { backfill, isLoading: isBackfilling, events: backfilledEvents, error: backfillError } = useTradeHistoryBackfill({
    userAddress: userAddress || undefined,
  })
  
  // Combine real-time and backfilled events, removing duplicates
  const [allEvents, setAllEvents] = useState<TradeEvent[]>([])
  
  useEffect(() => {
    // Combine events, removing duplicates by transaction hash
    const combined = [...backfilledEvents, ...realTimeEvents]
    const unique = combined.filter((event, index, self) =>
      index === self.findIndex(e => 
        e.transactionHash === event.transactionHash && e.eventType === event.eventType
      )
    )
    // Sort by block number (newest first)
    unique.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
    setAllEvents(unique)
  }, [backfilledEvents, realTimeEvents])
  
  // Trigger backfill on mount
  useEffect(() => {
    if (userAddress && !isBackfilling && backfilledEvents.length === 0) {
      backfill()
    }
  }, [userAddress, isBackfilling, backfilledEvents.length, backfill])
  
  // Filters
  const [filters, setFilters] = useState({
    eventType: "all" as "opened" | "closed" | "liquidated" | "all",
    direction: "all" as "long" | "short" | "all",
    pnlRange: "all" as "profit" | "loss" | "all",
    transactionHash: "",
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  
  const filteredEvents = useFilteredTradeEvents(allEvents, {
    userAddress: userAddress || undefined,
    ...filters,
  })
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])
  
  const stats = useTradeEventStats(filteredEvents)
  
  // Format functions
  const formatAmount = (amount: bigint, decimals: number = 8) => {
    return (Number(amount) / 10 ** decimals).toFixed(4)
  }
  
  const formatPrice = (price: bigint) => {
    return `$${(Number(price) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  }
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }
  
  const getBlockExplorerUrl = (hash: string) => {
    return `${BLOCK_EXPLORER_URL}/tx/${hash}`
  }
  
  const getEventBadge = (event: TradeEvent) => {
    if (event.eventType === 'opened') {
      return (
        <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-primary/10 border border-primary/20 text-primary">
          Open {event.isLong ? 'Long' : 'Short'}
        </span>
      )
    } else if (event.eventType === 'closed') {
      return (
        <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-primary/10 border border-primary/20 text-primary">
          Closed
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-primary/10 border border-primary/20 text-primary">
          Liquidated
        </span>
      )
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Statistics Overview */}
      {stats.totalEvents > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted rounded p-3 border border-border">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Trades</p>
            <p className="text-foreground font-semibold text-lg">{stats.totalEvents}</p>
          </div>
          <div className="bg-muted rounded p-3 border border-border">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Opened</p>
            <p className="text-primary font-semibold text-lg">{stats.openedCount}</p>
          </div>
          <div className="bg-muted rounded p-3 border border-border">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Closed</p>
            <p className="text-primary font-semibold text-lg">{stats.closedCount}</p>
          </div>
          <div className="bg-muted rounded p-3 border border-border">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total PnL</p>
            <p className={`font-semibold text-lg ${Number(stats.totalPnL) >= 0 ? "text-primary" : "text-destructive"}`}>
              {Number(stats.totalPnL) >= 0 ? "+" : ""}{formatAmount(stats.totalPnL, 8)} tBTC
            </p>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="bg-muted rounded p-4 border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
              Type
            </label>
            <select
              value={filters.eventType}
              onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value as any }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value="opened">Opened</option>
              <option value="closed">Closed</option>
              <option value="liquidated">Liquidated</option>
            </select>
          </div>
          
          <div>
            <label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
              Direction
            </label>
            <select
              value={filters.direction}
              onChange={(e) => setFilters(prev => ({ ...prev, direction: e.target.value as any }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          
          <div>
            <label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
              PnL
            </label>
            <select
              value={filters.pnlRange}
              onChange={(e) => setFilters(prev => ({ ...prev, pnlRange: e.target.value as any }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value="profit">Profit</option>
              <option value="loss">Loss</option>
            </select>
          </div>
          
          <div>
            <label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
              TX Hash
            </label>
            <Input
              type="text"
              value={filters.transactionHash}
              onChange={(e) => setFilters(prev => ({ ...prev, transactionHash: e.target.value }))}
              placeholder="0x..."
              className="bg-background border-border font-mono text-sm"
            />
          </div>
        </div>
        
        <div className="mt-3 flex gap-2">
          <Button
            onClick={() => setFilters({ eventType: "all", direction: "all", pnlRange: "all", transactionHash: "" })}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Clear Filters
          </Button>
          <Button
            onClick={() => backfill()}
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={isBackfilling}
          >
            {isBackfilling ? "Loading..." : "Refresh"}
          </Button>
          <Button
            onClick={() => {
              try {
                // Escape CSV values to handle commas and quotes in data
                const escapeCsv = (value: string) => {
                  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`
                  }
                  return value
                }
                
                const csv = [
                  ['Type', 'User', 'Direction', 'Margin', 'Leverage', 'Entry Price', 'PnL', 'Exit Price', 'Timestamp', 'TX Hash'].map(escapeCsv).join(','),
                  ...filteredEvents.map(event => {
                    if (event.eventType === 'opened') {
                      const e = event as PositionOpenedEvent
                      return [
                        'Opened',
                        e.user,
                        e.isLong ? 'Long' : 'Short',
                        formatAmount(e.margin),
                        e.leverage.toString(),
                        formatPrice(e.entryPrice),
                        '-',
                        '-',
                        formatTimestamp(e.timestamp),
                        e.transactionHash
                      ].map(escapeCsv).join(',')
                    } else if (event.eventType === 'closed') {
                      const e = event as PositionClosedEvent
                      return [
                        'Closed',
                        e.user,
                        '-',
                        '-',
                        '-',
                        '-',
                        formatAmount(e.pnl, 8),
                        formatPrice(e.exitPrice),
                        formatTimestamp(e.timestamp),
                        e.transactionHash
                      ].map(escapeCsv).join(',')
                    } else {
                      const e = event as LiquidatedEvent
                      return [
                        'Liquidated',
                        e.user,
                        '-',
                        '-',
                        '-',
                        '-',
                        '-',
                        '-',
                        formatTimestamp(e.timestamp),
                        e.transactionHash
                      ].map(escapeCsv).join(',')
                    }
                  })
                ].join('\n')
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `trade-history-${Date.now()}.csv`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch (error) {
                console.error('Error exporting CSV:', error)
                alert('Failed to export CSV. Please try again.')
              }
            }}
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={filteredEvents.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>
      
      {/* Error State */}
      {backfillError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded">
          <p className="text-destructive font-semibold mb-1">Failed to Load Trade History</p>
          <p className="text-destructive text-sm mb-2">{backfillError}</p>
          <Button
            onClick={() => {
              backfill()
            }}
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* Events List */}
      {isBackfilling && allEvents.length === 0 && !backfillError ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-muted rounded p-4 border border-border">
              <div className="flex items-start gap-3">
                <Skeleton className="h-6 w-20" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 && !isBackfilling ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-foreground font-semibold mb-2">
            {allEvents.length === 0 ? "No Trade History Yet" : "No Trades Match Your Filters"}
          </p>
          <p className="text-muted-foreground text-sm mb-4">
            {allEvents.length === 0 
              ? "Your trading activity will appear here once you start trading" 
              : "Try adjusting your filters to see more results"}
          </p>
          {allEvents.length === 0 && (
            <Button
              onClick={() => backfill()}
              variant="outline"
              size="sm"
              disabled={isBackfilling}
            >
              {isBackfilling ? "Loading..." : "Refresh History"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .map((event, index) => (
            <div
              key={`${event.transactionHash}-${event.eventType}-${index}`}
              className="bg-muted rounded p-4 border border-border hover:bg-muted/80 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getEventBadge(event)}</div>
                  <div className="flex-1">
                    {event.eventType === 'opened' && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-foreground font-semibold">
                            Position Opened
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatAmount((event as PositionOpenedEvent).margin)} tBTC margin
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(event as PositionOpenedEvent).leverage.toString()}x leverage
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                          Entry: {formatPrice((event as PositionOpenedEvent).entryPrice)} | 
                          Size: {formatAmount((event as PositionOpenedEvent).positionSize)} tBTC
                        </p>
                      </>
                    )}
                    
                    {event.eventType === 'closed' && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-foreground font-semibold">
                            Position Closed
                          </p>
                          <span className={`text-sm font-semibold ${Number((event as PositionClosedEvent).pnl) >= 0 ? "text-primary" : "text-destructive"}`}>
                            {Number((event as PositionClosedEvent).pnl) >= 0 ? "+" : ""}
                            {formatAmount((event as PositionClosedEvent).pnl, 8)} tBTC
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                          Exit: {formatPrice((event as PositionClosedEvent).exitPrice)} | 
                          Funding: {formatAmount((event as PositionClosedEvent).fundingPayment, 8)} tBTC
                        </p>
                      </>
                    )}
                    
                    {event.eventType === 'liquidated' && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-foreground font-semibold">
                            Position Liquidated
                          </p>
                          <span className="text-xs text-primary">
                            Reward: {formatAmount((event as LiquidatedEvent).reward, 18)} MUSD
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                          Liquidator: {formatAddress((event as LiquidatedEvent).liquidator)}
                        </p>
                      </>
                    )}
                    
                    <p className="text-muted-foreground text-xs mt-1">
                      {formatTimestamp(event.timestamp)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <a
                    href={getBlockExplorerUrl(event.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-mono"
                  >
                    {formatAddress(event.transactionHash)}
                  </a>
                </div>
              </div>
            </div>
          ))}
          
          {/* Pagination */}
          {filteredEvents.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEvents.length)} of {filteredEvents.length} trades
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {Math.ceil(filteredEvents.length / itemsPerPage)}
                </span>
                <Button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredEvents.length / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(filteredEvents.length / itemsPerPage)}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

