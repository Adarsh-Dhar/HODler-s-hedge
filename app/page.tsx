"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract } from "wagmi"
import { vaultAddress, fundingRateAddress, tradingEngineAddress, tBTCAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { FundingRateABI } from "@/lib/abi/FundingRate"
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
  useTradingEnginePaused,
  useTradingEngineLiquidate,
  useTradingEngineInfo,
  useTradingEnginePositionInfo,
  useContractSetup,
  useVaultBalance,
  useVaultDeposit,
  useVaultWithdraw,
  useVaultOwner,
  useVaultTradingEngine,
  useVaultTBTC,
  useVaultInfo,
  useTBTCBalance,
  useTBTCAllowance,
  useTBTCApprove,
  useFundingRate,
  useFundingRateNextTime,
  useFundingRateIsDue,
  useFundingRateCalculatePayment,
  useFundingRateLastUpdateTime,
  useFundingRateTradingEngine,
  useFundingRateConstants,
  useFundingRateInfo,
  useFundingRateStatus
} from "@/hooks"

export default function Home() {
  const { address: userAddress } = useAccount()
  
  // Real blockchain data
  const { data: markPrice } = useTradingEngineMarkPrice()
  const { data: position } = useTradingEnginePosition(userAddress)
  const { data: liquidationPrice } = useTradingEngineLiquidationPrice(userAddress)
  const { data: isLiquidatable } = useTradingEngineIsLiquidatable(userAddress)
  const { data: isPaused } = useTradingEnginePaused()
  const { data: vaultBalance, refetch: refetchVaultBalance } = useVaultBalance(userAddress)
  const { data: vaultOwner } = useVaultOwner()
  const { data: vaultTradingEngine } = useVaultTradingEngine()
  const { data: vaultTBTC } = useVaultTBTC()
  const { data: walletBalance, error: walletBalanceError, isLoading: walletBalanceLoading } = useTBTCBalance(userAddress)
  const { data: allowance } = useTBTCAllowance(userAddress, vaultAddress as `0x${string}`)
  const { data: fundingRate } = useFundingRate()
  const { data: nextFundingTime } = useFundingRateNextTime()
  const { data: isFundingDue } = useFundingRateIsDue()
  const { data: lastFundingUpdate } = useFundingRateLastUpdateTime()
  const { data: fundingTradingEngine } = useFundingRateTradingEngine()
  const tradingConstants = useTradingEngineConstants()
  const fundingConstants = useFundingRateConstants()
  const fundingStatus = useFundingRateStatus()
  const vaultInfo = useVaultInfo()
  
  // Trading actions
  const { openPosition, isPending: isOpening, error: openPositionError, isConfirmed: isOpenPositionConfirmed, hash: openPositionHash } = useTradingEngineOpenPosition()
  const { closePosition, isPending: isClosing, error: closePositionError, isConfirmed: isClosePositionConfirmed, hash: closePositionHash } = useTradingEngineClosePosition()
  const { liquidate, isPending: isLiquidating, error: liquidateError } = useTradingEngineLiquidate()
  const { setupAllReferences, isPending: isSettingUp, error: setupError } = useContractSetup()
  const { deposit, isPending: isDepositing, error: depositError, isConfirmed: isDepositConfirmed, hash: depositHash } = useVaultDeposit()
  const { withdraw, isPending: isWithdrawing, error: withdrawError, isConfirmed: isWithdrawConfirmed, hash: withdrawHash } = useVaultWithdraw()
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
  
  // Calculate price change for header
  const priceChange = markPrice ? ((Number(markPrice) / 1e18) - 42000) / 42000 * 100 : 0
  
  // Calculate funding payment if position exists
  const { data: fundingPayment } = useFundingRateCalculatePayment(
    (position as any)?.size || BigInt(0),
    (position as any)?.isLong || false
  )
  
  const needsContractSetup = vaultTradingEngine !== tradingEngineAddress || fundingTradingEngine !== tradingEngineAddress

  // Debug logging for contract state
  useEffect(() => {
    console.log('Contract state:', {
      isPaused,
      userAddress,
      positionExists: (position as any)?.exists,
      markPrice: markPrice?.toString(),
      tradingEngineAddress: '0xa1637A1D40f083E380a89a29f9D8Cf4d060e8303'
    })
  }, [isPaused, userAddress, position, markPrice])

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
      <Header 
        fundingRate={fundingRate as bigint}
        nextFundingTime={nextFundingTime as bigint}
        isFundingDue={isFundingDue as boolean}
        priceChange={priceChange}
      />

      <main className="p-4 md:p-6">
        {/* Contract Setup Alert */}
        {needsContractSetup && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-yellow-600 font-semibold mb-1">⚠️ Contract Setup Required</h3>
                <p className="text-yellow-600 text-sm">
                  The contract references are not set up correctly. This is why closing positions fails.
                </p>
                <p className="text-yellow-600 text-xs mt-1">
                  Vault: {vaultTradingEngine === tradingEngineAddress ? '✅' : '❌'} | 
                  FundingRate: {fundingTradingEngine === tradingEngineAddress ? '✅' : '❌'}
                </p>
              </div>
              <button
                onClick={setupAllReferences}
                disabled={isSettingUp}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white rounded font-semibold text-sm"
              >
                {isSettingUp ? "Setting up..." : "Fix Contract References"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Panel */}
          <div className="lg:col-span-2">
            <ChartPanel 
              price={currentPrice}
              markPrice={markPrice as bigint}
              fundingRate={fundingRate as bigint}
              nextFundingTime={nextFundingTime as bigint}
              isFundingDue={isFundingDue as boolean}
              vaultAddress={vaultAddress}
              tradingEngineAddress={tradingEngineAddress}
              fundingRateAddress={fundingRateAddress}
              tBTCAddress={tBTCAddress}
              vaultOwner={vaultOwner?.toString()}
              fundingInterval={fundingConstants.fundingInterval.data as bigint}
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
              openPositionError={openPositionError || undefined}
              isOpenPositionConfirmed={isOpenPositionConfirmed}
              openPositionHash={openPositionHash}
              currentPosition={position as any}
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
              onWithdraw={withdraw}
              isWithdrawing={isWithdrawing}
              withdrawError={withdrawError || undefined}
              isWithdrawConfirmed={isWithdrawConfirmed}
              withdrawHash={withdrawHash}
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
            closePositionError={closePositionError || undefined}
            isClosePositionConfirmed={isClosePositionConfirmed}
            closePositionHash={closePositionHash}
            isPaused={isPaused as boolean}
            fundingPayment={fundingPayment as bigint}
            fundingStatus={{
              isDue: isFundingDue as boolean,
              nextTime: nextFundingTime as bigint,
              lastUpdateTime: lastFundingUpdate as bigint
            }}
            lastFundingUpdate={lastFundingUpdate as bigint}
            fundingInterval={fundingConstants.fundingInterval.data as bigint}
            onLiquidate={liquidate}
            isLiquidating={isLiquidating}
            liquidateError={liquidateError || undefined}
            userAddress={userAddress}
          />
        </div>
      </main>
    </div>
  )
}
