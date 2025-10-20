"use client"

import { Card } from "@/components/ui/card"

interface ChartPanelProps {
  price: number
}

export default function ChartPanel({ price }: ChartPanelProps) {
  const priceChange = ((price - 42000) / 42000) * 100

  return (
    <Card className="bg-card border-border p-6">
      <div className="space-y-6">
        {/* Chart Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm uppercase tracking-wide">BTC Price</p>
            <h2 className="text-4xl font-bold text-foreground mt-2">
              ${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </h2>
            <p className={`text-sm mt-2 ${priceChange >= 0 ? "text-success" : "text-destructive"}`}>
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}% from $42,000
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Perpetual</p>
            <p className="text-foreground font-semibold mt-1">BTC/MUSD</p>
          </div>
        </div>

        {/* Placeholder Chart */}
        <div className="bg-muted rounded h-64 flex items-center justify-center border border-border">
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
        </div>

        {/* Market Info */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted rounded p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Index Price</p>
            <p className="text-foreground font-semibold mt-1">
              ${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-muted rounded p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Mark Price</p>
            <p className="text-foreground font-semibold mt-1">
              ${(price + 50).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-muted rounded p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Next Funding</p>
            <p className="text-foreground font-semibold mt-1">2h 15m</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
