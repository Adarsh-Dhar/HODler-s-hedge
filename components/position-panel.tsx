"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface PositionPanelProps {
  pnl: number
  price: number
}

export default function PositionPanel({ pnl, price }: PositionPanelProps) {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions")

  const positionSize = 5000
  const entryPrice = 42000
  const markPrice = price
  const margin = 1000
  const liquidationPrice = 39900
  const roi = (pnl / margin) * 100

  return (
    <Card className="bg-card border-border p-6">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {(["positions", "orders", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold text-sm uppercase tracking-wide transition-colors border-b-2 ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab === "positions" && "Positions"}
              {tab === "orders" && "Orders"}
              {tab === "history" && "History"}
            </button>
          ))}
        </div>

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <div className="space-y-4">
            <div className="bg-muted rounded p-4 border border-border">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Size</p>
                  <p className="text-foreground font-semibold mt-1">${positionSize.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Entry Price</p>
                  <p className="text-foreground font-semibold mt-1">${entryPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Mark Price</p>
                  <p className="text-foreground font-semibold mt-1">
                    ${markPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Margin</p>
                  <p className="text-foreground font-semibold mt-1">{margin} tBTC</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">PnL</p>
                  <p
                    className={`font-bold mt-1 text-lg animate-pulse-subtle ${pnl >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Liquidation</p>
                  <p className="text-destructive font-semibold mt-1">${liquidationPrice.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* ROI Display */}
            <div
              className={`rounded p-4 border ${pnl >= 0 ? "bg-success-subtle border-success/30" : "bg-destructive-subtle border-destructive/30"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Return on Investment</p>
                  <p className={`text-2xl font-bold mt-1 ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                    {roi >= 0 ? "+" : ""}
                    {roi.toFixed(2)}%
                  </p>
                </div>
                <Button
                  onClick={() => {}}
                  className="bg-destructive hover:bg-destructive/90 text-background font-semibold"
                >
                  Close Position
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No open limit orders</p>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-2">
            {[
              { type: "Long", size: 2000, price: 41500, pnl: 500, time: "2 hours ago" },
              { type: "Short", size: 1500, price: 42200, pnl: -300, time: "5 hours ago" },
              { type: "Long", size: 3000, price: 40800, pnl: 1200, time: "1 day ago" },
            ].map((trade, i) => (
              <div key={i} className="bg-muted rounded p-3 border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      trade.type === "Long" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {trade.type}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold">${trade.size.toLocaleString()}</p>
                    <p className="text-muted-foreground text-xs">${trade.price.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${trade.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                    {trade.pnl >= 0 ? "+" : ""}
                    {trade.pnl.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-xs">{trade.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
