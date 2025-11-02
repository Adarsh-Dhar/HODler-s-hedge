"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useMarginEvents, useFilteredMarginEvents, useMarginEventStats } from "@/hooks"

export default function InternalMonitor() {
  const { all: allEvents, locked, unlocked, totalLocked, totalUnlocked, totalPnL } = useMarginEvents()
  const [filters, setFilters] = useState({
    userAddress: "",
    eventType: "all" as "locked" | "unlocked" | "all",
    timeRange: undefined as { start: Date; end: Date } | undefined,
  })
  
  const filteredEvents = useFilteredMarginEvents(allEvents, filters)
  const stats = useMarginEventStats(filteredEvents)

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 1e8).toFixed(4)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const getEventIcon = (event: any) => {
    if ('pnl' in event) {
      return Number(event.pnl) >= 0 ? "🔓💰" : "🔓📉"
    }
    return "🔒"
  }

  const getEventColor = (event: any) => {
    if ('pnl' in event) {
      return Number(event.pnl) >= 0 ? "text-primary" : "text-destructive"
    }
    return "text-primary"
  }

  const exportToCSV = () => {
    const csvContent = [
      "Timestamp,Type,User,Amount,PnL,Transaction Hash",
      ...filteredEvents.map(event => {
        const timestamp = formatTimestamp(event.timestamp)
        const type = 'pnl' in event ? 'Unlocked' : 'Locked'
        const amount = formatAmount(event.amount)
        const pnl = 'pnl' in event ? formatAmount(event.pnl) : ''
        const txHash = event.transactionHash
        
        return `${timestamp},${type},${event.user},${amount},${pnl},${txHash}`
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `margin-events-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <Card className="bg-card border-border p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Margin Operations Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Events</p>
            <p className="text-foreground font-semibold text-lg">{stats.totalEvents}</p>
          </div>
          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Locked</p>
            <p className="text-primary font-semibold text-lg">{formatAmount(stats.totalLocked)} BTC</p>
          </div>
          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Unlocked</p>
            <p className="text-primary font-semibold text-lg">{formatAmount(stats.totalUnlocked)} BTC</p>
          </div>
          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total PnL</p>
            <p className={`font-semibold text-lg ${Number(stats.totalPnL) >= 0 ? "text-primary" : "text-destructive"}`}>
              {Number(stats.totalPnL) >= 0 ? "+" : ""}{formatAmount(stats.totalPnL)} BTC
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Event Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-muted-foreground text-sm uppercase tracking-wide mb-2 block">
              Event Type
            </label>
            <select
              value={filters.eventType}
              onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value as any }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Events</option>
              <option value="locked">Locked Only</option>
              <option value="unlocked">Unlocked Only</option>
            </select>
          </div>
          
          <div>
            <label className="text-muted-foreground text-sm uppercase tracking-wide mb-2 block">
              User Address
            </label>
            <input
              type="text"
              value={filters.userAddress}
              onChange={(e) => setFilters(prev => ({ ...prev, userAddress: e.target.value }))}
              placeholder="0x..."
              className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => setFilters({ userAddress: "", eventType: "all", timeRange: undefined })}
              variant="outline"
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Events List */}
      <Card className="bg-card border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Margin Events</h3>
          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            disabled={filteredEvents.length === 0}
          >
            Export CSV
          </Button>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No margin events found</p>
            <p className="text-muted-foreground text-sm mt-2">
              {allEvents.length === 0 ? "No events recorded yet" : "No events match current filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((event, index) => (
              <div
                key={`${event.transactionHash}-${index}`}
                className="bg-muted rounded p-4 border border-border hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getEventIcon(event)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-semibold">
                          {'pnl' in event ? 'Margin Unlocked' : 'Margin Locked'}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded ${getEventColor(event)} bg-current/10`}>
                          {formatAmount(event.amount)} BTC
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm font-mono">
                        {formatAddress(event.user)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatTimestamp(event.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {'pnl' in event && (
                      <div>
                        <p className={`font-semibold ${getEventColor(event)}`}>
                          {Number(event.pnl) >= 0 ? "+" : ""}{formatAmount(event.pnl)} BTC
                        </p>
                        <p className="text-muted-foreground text-xs">PnL</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-muted-foreground text-xs font-mono">
                        {formatAddress(event.transactionHash)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Event Details Modal Placeholder */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Event Timeline</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Interactive timeline coming soon</p>
          <p className="text-muted-foreground text-sm mt-2">
            Visual representation of margin operations over time
          </p>
        </div>
      </Card>
    </div>
  )
}
