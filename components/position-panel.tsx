"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface PositionPanelProps {
  position?: {
    isLong: boolean
    entryPrice: bigint
    size: bigint
    margin: bigint
    leverage: bigint
    openTimestamp: bigint
    exists: boolean
  }
  pnl: number
  price: number
  liquidationPrice?: bigint
  isLiquidatable?: boolean
  onClosePosition: () => Promise<void>
  isClosing: boolean
  closePositionError?: Error
  isClosePositionConfirmed?: boolean
  closePositionHash?: string
  isPaused?: boolean
  fundingPayment?: bigint
}

export default function PositionPanel({ position, pnl, price, liquidationPrice, isLiquidatable, onClosePosition, isClosing, closePositionError, isClosePositionConfirmed, closePositionHash, isPaused, fundingPayment }: PositionPanelProps) {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions")

  // Use real position data or fallback to mock data
  const positionSize = position?.exists ? Number(position.size) / 1e18 : 0
  const entryPrice = position?.exists ? Number(position.entryPrice) / 1e18 : 42000
  const markPrice = price
  const margin = position?.exists ? Number(position.margin) / 1e18 : 0
  const liquidationPriceValue = liquidationPrice ? Number(liquidationPrice) / 1e18 : 39900
  const roi = margin > 0 ? (pnl / margin) * 100 : 0
  
  // Format funding payment
  const fundingPaymentValue = fundingPayment ? Number(fundingPayment) / 1e18 : 0

  // Validation for close position (similar to TradePanel validation)
  const canClosePosition = position?.exists && !isClosing && !isPaused

  // Handle close position function (similar to handleOpenPosition in TradePanel)
  const handleClosePosition = async () => {
    if (!canClosePosition) {
      console.error('Cannot close position:', {
        positionExists: position?.exists,
        isClosing,
        canClosePosition
      })
      return
    }
    
    try {
      console.log('Closing position:', {
        positionExists: position?.exists,
        position: position,
        isClosing,
        canClosePosition
      })
      
      await onClosePosition()
    } catch (error) {
      console.error('Error closing position:', error)
      // Error will be handled by the parent component and passed down as closePositionError
    }
  }

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
            {position?.exists ? (
              <>
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
                      <p className="text-foreground font-semibold mt-1">{margin.toFixed(4)} tBTC</p>
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
                      <p className={`font-semibold mt-1 ${isLiquidatable ? "text-destructive" : "text-foreground"}`}>
                        ${liquidationPriceValue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Funding Payment Info */}
                {fundingPaymentValue !== 0 && (
                  <div className="bg-muted rounded p-3 border border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">Funding Payment</p>
                      <p className={`font-semibold ${fundingPaymentValue >= 0 ? "text-success" : "text-destructive"}`}>
                        {fundingPaymentValue >= 0 ? "+" : ""}
                        {fundingPaymentValue.toFixed(4)} tBTC
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No open positions</p>
                <p className="text-muted-foreground text-sm mt-2">Open a position to start trading</p>
                <div className="mt-4 p-3 bg-muted/50 rounded border border-border">
                  <p className="text-muted-foreground text-xs">
                    💡 You need to have an open position to close it. Use the Trade Panel above to open a position first.
                  </p>
                </div>
              </div>
            )}

            {/* ROI Display - Only show if position exists */}
            {position?.exists && (
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
                    onClick={handleClosePosition}
                    disabled={!canClosePosition}
                    className="bg-destructive hover:bg-destructive/90 text-background font-semibold"
                  >
                    {isClosing ? "Closing..." : "Close Position"}
                  </Button>
                </div>
              </div>
            )}

            {/* Contract Paused Warning */}
            {isPaused && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
                <p className="text-yellow-600 font-semibold mb-1">⚠️ Trading Paused</p>
                <p className="text-yellow-600 text-xs">Trading is currently paused. You cannot close positions at this time.</p>
                <p className="text-yellow-600 text-xs mt-1">
                  Please try again later when trading resumes.
                </p>
              </div>
            )}

            {/* Close Position Validation Error */}
            {!position?.exists && !isPaused && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                <p className="text-destructive font-semibold mb-1">No Position to Close</p>
                <p className="text-destructive text-xs">You don't have an open position to close.</p>
                <p className="text-destructive text-xs mt-1">
                  Use the Trade Panel above to open a position first.
                </p>
              </div>
            )}

            {/* Close Position Error */}
            {closePositionError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                <p className="text-destructive font-semibold mb-1">Position Closing Failed</p>
                <p className="text-destructive text-xs">{closePositionError.message}</p>
                <p className="text-destructive text-xs mt-1">
                  Check console for more details
                </p>
              </div>
            )}

            {/* Close Position Success */}
            {isClosePositionConfirmed && (
              <div className="p-3 bg-success/10 border border-success/20 rounded text-sm">
                <p className="text-success font-semibold mb-1">✓ Position Closed Successfully</p>
                <p className="text-success text-xs">
                  Position closed and margin returned to vault
                </p>
                {closePositionHash && (
                  <p className="text-success text-xs mt-1">
                    TX: {closePositionHash.slice(0, 10)}...{closePositionHash.slice(-8)}
                  </p>
                )}
              </div>
            )}
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
