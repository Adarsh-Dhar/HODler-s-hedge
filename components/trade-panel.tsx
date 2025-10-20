"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TradePanelProps {
  price: number
}

export default function TradePanel({ price }: TradePanelProps) {
  const [tradeType, setTradeType] = useState<"long" | "short">("long")
  const [margin, setMargin] = useState(1000)
  const [leverage, setLeverage] = useState(5)
  const [availableBalance] = useState(5000)

  const positionSize = margin * leverage
  const liquidationPrice =
    tradeType === "long" ? price * (1 - (1 / leverage) * 0.95) : price * (1 + (1 / leverage) * 0.95)
  const tradingFee = positionSize * 0.001

  const isValid = margin > 0 && margin <= availableBalance && leverage >= 1 && leverage <= 20

  return (
    <Card className="bg-card border-border p-6">
      <div className="space-y-6">
        {/* Trade Type Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTradeType("long")}
            className={`flex-1 py-2 px-4 rounded font-semibold transition-colors ${
              tradeType === "long" ? "bg-success text-background" : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setTradeType("short")}
            className={`flex-1 py-2 px-4 rounded font-semibold transition-colors ${
              tradeType === "short" ? "bg-destructive text-background" : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            Short
          </button>
        </div>

        {/* Order Type */}
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Order Type</p>
          <div className="bg-muted rounded px-3 py-2 text-foreground font-semibold">Market</div>
        </div>

        {/* Margin Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Margin (tBTC)</p>
            <p className="text-muted-foreground text-xs">Available: {availableBalance.toFixed(2)}</p>
          </div>
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(Math.max(0, Number.parseFloat(e.target.value) || 0))}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Leverage Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Leverage</p>
            <p className="text-primary font-bold text-lg">{leverage}x</p>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={leverage}
            onChange={(e) => setLeverage(Number.parseInt(e.target.value))}
            className="w-full h-2 bg-muted rounded appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-muted-foreground text-xs mt-1">
            <span>1x</span>
            <span>20x</span>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-muted rounded p-4 space-y-3 border border-border">
          <p className="text-foreground font-semibold text-sm uppercase tracking-wide">Order Summary</p>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Position Size</p>
            <p className="text-foreground font-semibold">
              ${positionSize.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Entry Price</p>
            <p className="text-foreground font-semibold">
              ${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">Est. Liquidation Price</p>
              <p className="text-destructive font-bold">
                ${liquidationPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              {tradeType === "long" ? "Price must stay above" : "Price must stay below"} this level
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Trading Fee</p>
            <p className="text-foreground font-semibold">${tradingFee.toFixed(2)}</p>
          </div>
        </div>

        {/* Execute Button */}
        <Button
          onClick={() => {}}
          disabled={!isValid}
          className={`w-full py-3 rounded font-bold text-lg transition-colors ${
            isValid
              ? tradeType === "long"
                ? "bg-success hover:bg-success/90 text-background"
                : "bg-destructive hover:bg-destructive/90 text-background"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          Confirm {tradeType === "long" ? "Long" : "Short"}
        </Button>
      </div>
    </Card>
  )
}
