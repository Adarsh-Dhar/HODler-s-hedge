"use client"

import { Card } from "@/components/ui/card"
import { useBTCPrice } from "@/hooks"
import { useEffect, useState } from "react"

interface ChartPanelProps {
  price?: number
  markPrice?: bigint
  fundingRate?: bigint
  nextFundingTime?: bigint
  isFundingDue?: boolean
}

export default function ChartPanel({ price: fallbackPrice, markPrice, fundingRate, nextFundingTime, isFundingDue }: ChartPanelProps) {
  const { data: btcData, loading, error, lastUpdated } = useBTCPrice({ refreshInterval: 30000 })
  const [priceHistory, setPriceHistory] = useState<number[]>([])
  
  // Use real-time price if available, otherwise fallback to prop
  const currentPrice = btcData?.price || fallbackPrice || 42000
  const priceChange = btcData?.change_24h || ((currentPrice - 42000) / 42000) * 100
  
  // Update price history for chart visualization
  useEffect(() => {
    if (btcData?.price) {
      setPriceHistory(prev => {
        const newHistory = [...prev, btcData.price]
        // Keep only last 50 data points
        return newHistory.length > 50 ? newHistory.slice(-50) : newHistory
      })
    }
  }, [btcData?.price])
  
  // Format funding rate as percentage
  const fundingRatePercent = fundingRate ? Number(fundingRate) / 1e18 * 100 : 0
  
  // Calculate time until next funding
  const getNextFundingTime = () => {
    if (!nextFundingTime) return "2h 15m"
    const now = Math.floor(Date.now() / 1000)
    const timeDiff = Number(nextFundingTime) - now
    if (timeDiff <= 0) return "Due now"
    
    const hours = Math.floor(timeDiff / 3600)
    const minutes = Math.floor((timeDiff % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="space-y-6">
        {/* Chart Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-sm uppercase tracking-wide">BTC Price</p>
              {loading && (
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              )}
              {error && (
                <div className="w-2 h-2 bg-destructive rounded-full"></div>
              )}
            </div>
            <h2 className="text-4xl font-bold text-foreground mt-2">
              ${currentPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </h2>
            <p className={`text-sm mt-2 ${priceChange >= 0 ? "text-success" : "text-destructive"}`}>
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}% {btcData ? "24h" : "from $42,000"}
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Perpetual</p>
            <p className="text-foreground font-semibold mt-1">BTC/USD</p>
            {btcData && (
              <p className="text-xs text-muted-foreground mt-1">
                Vol: ${(btcData.volume_24h / 1e9).toFixed(1)}B
              </p>
            )}
          </div>
        </div>

        {/* Price Chart */}
        <div className="bg-muted rounded h-64 flex items-center justify-center border border-border relative overflow-hidden">
          {loading ? (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-muted-foreground text-sm">Loading price data...</p>
            </div>
          ) : error ? (
            <div className="text-center">
              <p className="text-destructive text-sm">Failed to load price data</p>
              <p className="text-muted-foreground text-xs mt-1">{error}</p>
            </div>
          ) : priceHistory.length > 0 ? (
            <div className="w-full h-full p-4">
              <div className="flex items-end justify-between h-full gap-1">
                {priceHistory.map((price, i) => {
                  const minPrice = Math.min(...priceHistory)
                  const maxPrice = Math.max(...priceHistory)
                  const range = maxPrice - minPrice
                  const height = range > 0 ? ((price - minPrice) / range) * 100 : 50
                  
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary/60 rounded-sm hover:bg-primary/80 transition-colors"
                      style={{
                        height: `${Math.max(height, 5)}%`,
                        minHeight: '2px'
                      }}
                      title={`$${price.toLocaleString()}`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>${Math.min(...priceHistory).toLocaleString()}</span>
                <span>${Math.max(...priceHistory).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground text-sm">Interactive Price Chart</p>
              <p className="text-muted-foreground text-xs mt-2">TradingView Lightweight Charts</p>
              <div className="mt-4 flex justify-center gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary/50 rounded"
                    style={{
                      height: `${Math.random() * 100 + 20}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Market Info */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted rounded p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Index Price</p>
            <p className="text-foreground font-semibold mt-1">
              ${currentPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            {btcData && (
              <p className="text-xs text-muted-foreground mt-1">
                Market Cap: ${(btcData.market_cap / 1e9).toFixed(1)}B
              </p>
            )}
          </div>
          <div className="bg-muted rounded p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Mark Price</p>
            <p className="text-foreground font-semibold mt-1">
              ${markPrice ? (Number(markPrice) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 }) : (currentPrice + 50).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            {btcData && (
              <p className="text-xs text-muted-foreground mt-1">
                24h Vol: ${(btcData.volume_24h / 1e9).toFixed(1)}B
              </p>
            )}
          </div>
          <div className="bg-muted rounded p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Next Funding</p>
            <p className={`text-foreground font-semibold mt-1 ${isFundingDue ? "text-destructive" : ""}`}>
              {getNextFundingTime()}
            </p>
            {btcData && (
              <p className="text-xs text-muted-foreground mt-1">
                Change: {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
