"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import Header from "@/components/header"
import ChartPanel from "@/components/chart-panel"
import TradePanel from "@/components/trade-panel"
import PositionPanel from "@/components/position-panel"

// Import contract hooks
import {
  useTradingEngineMarkPrice,
  useTradingEnginePosition,
  useTradingEngineLiquidationPrice,
  useTradingEngineIsLiquidatable,
  useTradingEngineConstants,
  useTradingEngineOpenPosition,
  useTradingEngineClosePosition,
  useVaultBalance,
  useVaultDeposit,
  useVaultWithdraw,
  useFundingRate,
  useFundingRateNextTime,
  useFundingRateIsDue,
  useFundingRateCalculatePayment
} from "@/hooks"

export default function Home() {
  const { address: userAddress } = useAccount()
  
  // Real blockchain data
  const { data: markPrice } = useTradingEngineMarkPrice()
  const { data: position } = useTradingEnginePosition(userAddress)
  const { data: liquidationPrice } = useTradingEngineLiquidationPrice(userAddress)
  const { data: isLiquidatable } = useTradingEngineIsLiquidatable(userAddress)
  const { data: vaultBalance } = useVaultBalance(userAddress)
  const { data: fundingRate } = useFundingRate()
  const { data: nextFundingTime } = useFundingRateNextTime()
  const { data: isFundingDue } = useFundingRateIsDue()
  const tradingConstants = useTradingEngineConstants()
  
  // Trading actions
  const { openPosition, isPending: isOpening } = useTradingEngineOpenPosition()
  const { closePosition, isPending: isClosing } = useTradingEngineClosePosition()
  const { deposit, isPending: isDepositing } = useVaultDeposit()
  const { withdraw, isPending: isWithdrawing } = useVaultWithdraw()
  
  // Calculate PnL from position data
  const calculatePnL = () => {
    if (!position || !markPrice || !(position as any)?.exists) return 0
    const priceDiff = Number(markPrice) - Number((position as any).entryPrice)
    return (position as any).isLong ? priceDiff : -priceDiff
  }
  
  // Get current price (fallback to mock if no blockchain data)
  const currentPrice = markPrice ? Number(markPrice) / 1e18 : 42850
  const currentPnL = calculatePnL()
  
  // Calculate funding payment if position exists
  const { data: fundingPayment } = useFundingRateCalculatePayment(
    (position as any)?.size || BigInt(0),
    (position as any)?.isLong || false
  )

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Panel */}
          <div className="lg:col-span-2">
            <ChartPanel 
              price={currentPrice}
              markPrice={markPrice as bigint}
              fundingRate={fundingRate as bigint}
              nextFundingTime={nextFundingTime as bigint}
              isFundingDue={isFundingDue as boolean}
            />
          </div>

          {/* Trade Panel */}
          <div className="lg:col-span-1">
            <TradePanel 
              price={currentPrice}
              vaultBalance={vaultBalance as bigint}
              maxLeverage={tradingConstants.maxLeverage.data as bigint}
              tradingFee={tradingConstants.tradingFee.data as bigint}
              onOpenPosition={openPosition}
              isPending={isOpening}
            />
          </div>
        </div>

        {/* Position Panel */}
        <div className="mt-6">
          <PositionPanel 
            position={position as any}
            pnl={currentPnL}
            price={currentPrice}
            liquidationPrice={liquidationPrice as bigint}
            isLiquidatable={isLiquidatable as boolean}
            onClosePosition={closePosition}
            isClosing={isClosing}
            fundingPayment={fundingPayment as bigint}
          />
        </div>
      </main>
    </div>
  )
}
