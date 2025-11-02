"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

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
  pnlTbtc?: bigint
  pnlUsd?: bigint
  price: number
  oraclePrice?: number
  liquidationPrice?: bigint
  isLiquidatable?: boolean
  onClosePosition: () => Promise<void>
  isClosing: boolean
  closePositionError?: Error
  isClosePositionConfirmed?: boolean
  closePositionHash?: string
  isPaused?: boolean
  fundingPayment?: bigint
  // New props for enhanced functionality
  fundingStatus?: {
    isDue: boolean
    nextTime: bigint
    lastUpdateTime: bigint
  }
  lastFundingUpdate?: bigint
  fundingInterval?: bigint
  onLiquidate?: (userAddress: `0x${string}`) => void
  isLiquidating?: boolean
  liquidateError?: Error
  userAddress?: `0x${string}`
}

export default function PositionPanel({ 
  position, 
  pnlTbtc,
  pnlUsd,
  price, 
  oraclePrice,
  liquidationPrice, 
  isLiquidatable, 
  onClosePosition, 
  isClosing, 
  closePositionError, 
  isClosePositionConfirmed, 
  closePositionHash, 
  isPaused, 
  fundingPayment,
  fundingStatus,
  lastFundingUpdate,
  fundingInterval,
  onLiquidate,
  isLiquidating,
  liquidateError,
  userAddress
}: PositionPanelProps) {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions")
  const { toast } = useToast()

  // Use real position data or fallback to mock data
  // Position size and margin are stored in tBTC units with 8 decimals
  const positionSizeTbtc = position?.exists ? Number(position.size) / 1e8 : 0 // Convert from 8-decimal tBTC
  // Properly handle entryPrice conversion from BigInt (1e18 precision)
  const entryPriceRaw = position?.exists && position.entryPrice ? position.entryPrice : BigInt(0)
  const entryPrice = position?.exists && entryPriceRaw > BigInt(0) 
    ? Number(entryPriceRaw) / 1e18 
    : (position?.exists ? price : 42000) // If position exists but entryPrice is 0, use current price as fallback
  
  // Position size in USD = size in tBTC * entry price in USD
  const positionSize = positionSizeTbtc * entryPrice
  
  const markPrice = price
  const margin = position?.exists ? Number(position.margin) / 1e8 : 0 // tBTC uses 8 decimals
  const liquidationPriceValue = liquidationPrice ? Number(liquidationPrice) / 1e18 : 39900
  const pnlTbtcNum = pnlTbtc !== undefined ? Number(pnlTbtc) / 1e18 : 0
  const pnlUsdNum = pnlUsd !== undefined ? Number(pnlUsd) / 1e18 : 0
  const roi = margin > 0 ? (pnlTbtcNum / margin) * 100 : 0
  
  // Format funding payment
  const fundingPaymentValue = fundingPayment ? Number(fundingPayment) / 1e18 : 0

  // Calculate position duration (ensure non-negative to handle clock sync issues)
  const positionDuration = position?.openTimestamp 
    ? Math.max(0, Math.floor(Date.now() / 1000) - Number(position.openTimestamp))
    : 0

  // Format time until next funding
  const formatTimeUntil = (timestamp: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    const diff = Number(timestamp) - now
    if (diff <= 0) return "Due now"
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  // Format funding interval
  const fundingIntervalHours = fundingInterval ? Number(fundingInterval) / 3600 : 8

  // Validation for close position (similar to TradePanel validation)
  const canClosePosition = position?.exists && !isClosing && !isPaused
  const canLiquidate = isLiquidatable && onLiquidate && userAddress && !isLiquidating

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

  // Handle liquidation function
  const handleLiquidate = async () => {
    if (!canLiquidate) {
      console.error('Cannot liquidate position:', {
        isLiquidatable,
        onLiquidate: !!onLiquidate,
        userAddress,
        isLiquidating,
        canLiquidate
      })
      return
    }
    
    try {
      console.log('Liquidating position for user:', userAddress)
      await onLiquidate(userAddress)
    } catch (error) {
      console.error('Error liquidating position:', error)
      // Error will be handled by the parent component and passed down as liquidateError
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
                      {oraclePrice !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">Oracle: ${oraclePrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Margin</p>
                      <p className="text-foreground font-semibold mt-1">{margin.toFixed(4)} tBTC</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">PnL</p>
                      <div className="mt-1">
                        <p className={`font-bold text-lg animate-pulse-subtle ${pnlUsdNum >= 0 ? "text-success" : "text-destructive"}`}>
                          {pnlUsdNum >= 0 ? "+" : ""}${Math.abs(pnlUsdNum).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-xs ${pnlTbtcNum >= 0 ? "text-success" : "text-destructive"}`}>
                          {pnlTbtcNum >= 0 ? "+" : ""}{Math.abs(pnlTbtcNum).toFixed(6)} tBTC
                        </p>
                      </div>
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

                {/* Enhanced Funding Information */}
                <div className="bg-muted rounded p-4 border border-border">
                  <p className="text-muted-foreground text-sm uppercase tracking-wide mb-3">Funding Information</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Next Funding</p>
                      <p className={`font-semibold mt-1 ${fundingStatus?.isDue ? "text-destructive" : "text-foreground"}`}>
                        {fundingStatus?.nextTime ? formatTimeUntil(fundingStatus.nextTime) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Funding Interval</p>
                      <p className="text-foreground font-semibold mt-1">{fundingIntervalHours}h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Position Duration</p>
                      <p className="text-foreground font-semibold mt-1">
                        {positionDuration > 0
                          ? `${Math.floor(positionDuration / 3600)}h ${Math.floor((positionDuration % 3600) / 60)}m`
                          : "0m"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Last Update</p>
                      <p className="text-foreground font-semibold mt-1">
                        {lastFundingUpdate ? new Date(Number(lastFundingUpdate) * 1000).toLocaleTimeString() : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium border ${
                          fundingStatus?.isDue ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/50 border-border text-muted-foreground"
                        }`}
                      >
                        {fundingStatus?.isDue ? "Funding due" : "Not due"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      disabled={!position?.exists || !fundingStatus?.isDue}
                      onClick={() =>
                        toast({
                          title: "Apply funding",
                          description: "Funding is applied by the TradingEngine during position operations.",
                        })
                      }
                      className="font-semibold"
                    >
                      Apply Funding
                    </Button>
                  </div>
                </div>
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
                className={`rounded p-4 border ${pnlUsdNum >= 0 ? "bg-success-subtle border-success/30" : "bg-destructive-subtle border-destructive/30"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Return on Investment</p>
                    <p className={`text-2xl font-bold mt-1 ${pnlUsdNum >= 0 ? "text-success" : "text-destructive"}`}>
                      {roi >= 0 ? "+" : ""}
                      {roi.toFixed(2)}%
                    </p>
                    {isLiquidatable && (
                      <p className="text-destructive text-xs mt-1 font-semibold">
                        ⚠️ Position is liquidatable!
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canLiquidate && (
                      <Button
                        onClick={handleLiquidate}
                        disabled={!canLiquidate}
                        className="bg-orange-600 hover:bg-orange-700 text-background font-semibold"
                      >
                        {isLiquidating ? "Liquidating..." : "Liquidate"}
                      </Button>
                    )}
                    <Button
                      onClick={handleClosePosition}
                      disabled={!canClosePosition}
                      className="bg-destructive hover:bg-destructive/90 text-background font-semibold"
                    >
                      {isClosing ? "Closing..." : "Close Position"}
                    </Button>
                  </div>
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

            {/* Liquidation Error */}
            {liquidateError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                <p className="text-destructive font-semibold mb-1">Liquidation Failed</p>
                <p className="text-destructive text-xs">{liquidateError.message}</p>
                <p className="text-destructive text-xs mt-1">
                  Check console for more details
                </p>
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
          <div className="text-center py-8">
            <p className="text-muted-foreground">No trade history available</p>
            <p className="text-muted-foreground text-sm mt-2">Trade history tracking is coming soon</p>
            <div className="mt-4 p-3 bg-muted/50 rounded border border-border">
              <p className="text-muted-foreground text-xs">
                💡 Historical trade data will be displayed here once the feature is implemented
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
