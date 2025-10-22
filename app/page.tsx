"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { vaultAddress } from "@/lib/address"
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
  useVaultOwner,
  useTBTCBalance,
  useTBTCAllowance,
  useTBTCApprove,
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
  const { data: vaultBalance, refetch: refetchVaultBalance } = useVaultBalance(userAddress)
  const { data: vaultOwner } = useVaultOwner()
  const { data: walletBalance, error: walletBalanceError, isLoading: walletBalanceLoading } = useTBTCBalance(userAddress)
  const { data: allowance } = useTBTCAllowance(userAddress, vaultAddress as `0x${string}`)
  const { data: fundingRate } = useFundingRate()
  const { data: nextFundingTime } = useFundingRateNextTime()
  const { data: isFundingDue } = useFundingRateIsDue()
  const tradingConstants = useTradingEngineConstants()
  
  // Trading actions
  const { openPosition, isPending: isOpening } = useTradingEngineOpenPosition()
  const { closePosition, isPending: isClosing } = useTradingEngineClosePosition()
  const { deposit, isPending: isDepositing, error: depositError, isConfirmed: isDepositConfirmed, hash: depositHash } = useVaultDeposit()
  const { withdraw, isPending: isWithdrawing } = useVaultWithdraw()
  const { approve, isPending: isApproving, error: approveError, isConfirmed: isApproveConfirmed } = useTBTCApprove()
  
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

  // Refetch vault balance after successful deposit
  useEffect(() => {
    if (isDepositConfirmed) {
      console.log('Deposit confirmed, refetching vault balance...')
      console.log('Current vault balance before refetch:', vaultBalance?.toString())
      refetchVaultBalance().then((result) => {
        console.log('Vault balance after refetch:', result.data?.toString())
      })
    }
  }, [isDepositConfirmed, refetchVaultBalance, vaultBalance])

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
              walletBalance={walletBalance as bigint}
              allowance={allowance as bigint}
              onDeposit={deposit}
              onApprove={(amount) => approve(vaultAddress as `0x${string}`, amount)}
              isDepositing={isDepositing}
              isApproving={isApproving}
              walletBalanceError={walletBalanceError || undefined}
              walletBalanceLoading={walletBalanceLoading}
              depositError={depositError || undefined}
              approveError={approveError || undefined}
              isDepositConfirmed={isDepositConfirmed}
              isApproveConfirmed={isApproveConfirmed}
              depositHash={depositHash}
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
