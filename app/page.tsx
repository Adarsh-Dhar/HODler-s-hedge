"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract } from "wagmi"
import { vaultAddress, fundingRateAddress, tradingEngineAddress, tBTCAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { FundingRateABI } from "@/lib/abi/FundingRate"
import Header from "@/components/header"
import { useToast } from "@/hooks/use-toast"
import ChartPanel from "@/components/chart-panel"
import TradePanel from "@/components/trade-panel"
import PositionPanel from "@/components/position-panel"
import MusdWalletCard from "@/components/user/musd-wallet"

// Import contract hooks
import {
  // consolidated trading info hooks
  useTradingEngineInfo,
  useTradingEnginePositionInfo,
  useTradingEngineOpenPosition,
  useTradingEngineClosePosition,
  useTradingEngineLiquidate,
  useTradingEngineOraclePrice,
  useContractSetup,
  useVaultBalance,
  useVaultDepositWithApproval,
  useVaultWithdraw,
  useVaultOwner,
  useVaultTradingEngine,
  useVaultTBTC,
  useVaultInfo,
  useTBTCBalance,
  useFundingRate,
  useFundingRateNextTime,
  useFundingRateIsDue,
  useFundingRateCalculatePayment,
  useFundingRateLastUpdateTime,
  useFundingRateTradingEngine,
  useFundingRateConstants,
  useFundingRateInfo,
  useFundingRateStatus,
  useFundingRateForPosition,
  useFundingRateApplyPayment,
  useBTCPrice
} from "@/hooks"

export default function Home() {
  const { address: userAddress } = useAccount()
  const { toast } = useToast()
  
  // Real blockchain data
  const tradingInfo = useTradingEngineInfo()
  const oracleTuple = useTradingEngineOraclePrice()
  const positionInfo = useTradingEnginePositionInfo(userAddress)
  const markPrice = tradingInfo.markPrice.data as bigint | undefined
  const isPaused = tradingInfo.paused.data as boolean | undefined
  const tradingConstants = tradingInfo.constants
  const position = positionInfo.position.data
  const refetchPosition = positionInfo.refetchPosition
  const liquidationPrice = positionInfo.liquidationPrice.data
  const isLiquidatable = positionInfo.isLiquidatable.data
  const { data: vaultBalance, refetch: refetchVaultBalance } = useVaultBalance(userAddress)
  const { data: vaultOwner } = useVaultOwner()
  const { data: vaultTradingEngine } = useVaultTradingEngine()
  const { data: vaultTBTC } = useVaultTBTC()
  const { data: walletBalance, error: walletBalanceError, isLoading: walletBalanceLoading } = useTBTCBalance(userAddress)
  const { data: fundingRate } = useFundingRate()
  const { data: nextFundingTime } = useFundingRateNextTime()
  const { data: isFundingDue } = useFundingRateIsDue()
  const { data: lastFundingUpdate } = useFundingRateLastUpdateTime()
  const { data: fundingTradingEngine } = useFundingRateTradingEngine()
  const fundingConstants = useFundingRateConstants()
  const fundingStatus = useFundingRateStatus()
  const vaultInfo = useVaultInfo()
  
  // Trading actions
  const { openPosition, isPending: isOpening, error: openPositionError, isConfirmed: isOpenPositionConfirmed, hash: openPositionHash } = useTradingEngineOpenPosition()
  const { closePosition, isPending: isClosing, error: closePositionError, isConfirmed: isClosePositionConfirmed, hash: closePositionHash } = useTradingEngineClosePosition()
  const { liquidate, isPending: isLiquidating, error: liquidateError } = useTradingEngineLiquidate()
  const { setupAllReferences, isPending: isSettingUp, error: setupError } = useContractSetup()
  const { depositWithApproval, isApproving, isDepositing, error: depositError, isConfirmed: isDepositConfirmed, depositHash } = useVaultDepositWithApproval()
  const { withdraw, isPending: isWithdrawing, error: withdrawError, isConfirmed: isWithdrawConfirmed, hash: withdrawHash } = useVaultWithdraw()
  
  // Fetch real-time BTC price from API (same as chart panel)
  const { data: btcPriceData } = useBTCPrice({ refreshInterval: 30000 })
  const oraclePrice = (oracleTuple?.data as any)?.[0] ? Number((oracleTuple as any).data[0]) / 1e18 : undefined
  const realTimePrice = btcPriceData?.price || (oraclePrice ?? (markPrice ? Number(markPrice) / 1e18 : 42850))
  
  // Calculate unrealized PnL using real-time BTC price
  const calcUnrealizedPnL = () => {
    try {
      if (!position || !(position as any)?.exists) return { tbtc: BigInt(0), usd: BigInt(0) }
      const entry = (position as any).entryPrice as bigint // 1e18 USD precision
      const size = (position as any).size as bigint // 8-decimal tBTC (size in tBTC)
      if (entry === BigInt(0) || size === BigInt(0)) return { tbtc: BigInt(0), usd: BigInt(0) }
      
      // Convert real-time price to bigint (1e18 precision)
      const currentPriceBigInt = BigInt(Math.floor(realTimePrice * 1e18))
      
      // Calculate price difference based on position direction
      // For long: profit if current > entry (price goes up)
      // For short: profit if entry > current (price goes down)
      const diff = (position as any).isLong 
        ? (currentPriceBigInt - entry)
        : (entry - currentPriceBigInt)

      // PnL calculation: size is in 8-decimal tBTC, prices are in 18-decimal USD
      // PnL in tBTC (18-decimal) = (size_8dec * diff_18dec * 1e10) / entry_18dec
      // We multiply by 1e10 to convert size from 8 decimals to 18 decimals
      const pnlTbtc = (size * diff * BigInt(1e10)) / entry // Result in 18-decimal tBTC

      // PnL in USD = pnl_tbtc_18dec * current_price_18dec / 1e18
      const pnlUsd = (pnlTbtc * currentPriceBigInt) / BigInt("1000000000000000000") // 1e18 USD

      return { tbtc: pnlTbtc, usd: pnlUsd }
    } catch (error) {
      console.error('Error calculating PnL:', error)
      return { tbtc: BigInt(0), usd: BigInt(0) }
    }
  }
  
  // Get current price (use real-time API price, fallback to mark price, then default)
  const currentPrice = realTimePrice
  const currentPnL = calcUnrealizedPnL()
  const handleLiquidate = async (user: `0x${string}`) => {
    try {
      const res = await liquidate(user)
      if (res?.reward && userAddress && res?.liquidator?.toLowerCase() === userAddress.toLowerCase()) {
        toast({
          title: 'Liquidation executed',
          description: `Reward: ${Number(res.reward) / 1e18} tBTC`,
        })
      }
      if (refetchPosition) await refetchPosition()
      await refetchVaultBalance()
    } catch (e: any) {
      toast({ title: 'Liquidation failed', description: e?.message || 'Transaction error', variant: 'destructive' })
      throw e
    }
  }
  
  // Calculate price change for header - only use actual 24h change from API
  const priceChange = btcPriceData?.change_24h ?? undefined
  
  // Funding for current position (grouped hook)
  const { fundingPayment: fundingPaymentQuery } = useFundingRateForPosition(
    (position as any)?.size || BigInt(0),
    (position as any)?.isLong || false
  )
  const fundingPayment = fundingPaymentQuery.data as bigint | undefined

  // Read-only preview of applyFundingPayment (restricted to TradingEngine on-chain)
  // This mirrors calculateFundingPayment and is used for parity/visibility only
  const _applyFundingPreview = useFundingRateApplyPayment(
    (position as any)?.size || BigInt(0),
    (position as any)?.isLong || false
  )
  
  const needsContractSetup = vaultTradingEngine !== tradingEngineAddress || fundingTradingEngine !== tradingEngineAddress

  // Refetch vault balance after successful deposit
  useEffect(() => {
    if (isDepositConfirmed) {
      refetchVaultBalance()
    }
  }, [isDepositConfirmed, refetchVaultBalance])

  // Refetch position data after successful open or close
  useEffect(() => {
    if (isOpenPositionConfirmed || isClosePositionConfirmed) {
      if (refetchPosition) {
        // Add a small delay to ensure on-chain state is updated
        const timeoutId = setTimeout(() => {
          refetchPosition().catch((err) => {
            console.error('Error refetching position:', err)
          })
        }, 300) // Small delay to ensure state propagation
        
        return () => clearTimeout(timeoutId)
      }
    }
  }, [isOpenPositionConfirmed, isClosePositionConfirmed, refetchPosition])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="p-4 md:p-6">
        {/* Market Stats */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border-2 border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Market</p>
              <p className="text-foreground font-bold text-lg">BTC/MUSD</p>
            </div>
            <div className="bg-card border-2 border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">24h Change</p>
              {priceChange !== undefined ? (
                <p className={`font-bold text-lg ${priceChange >= 0 ? "text-primary" : "text-destructive"}`}>
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </p>
              ) : (
                <p className="font-bold text-lg text-muted-foreground">N/A</p>
              )}
            </div>
            <div className="bg-card border-2 border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Funding Rate</p>
              <p className={`font-bold text-lg ${isFundingDue ? "text-destructive" : "text-foreground"}`}>
                {fundingRate ? (Number(fundingRate) / 100).toFixed(4) : "0.0000"}%
              </p>
              {(isFundingDue as boolean) === true && (
                <p className="text-destructive text-xs mt-1">Due Now</p>
              )}
            </div>
            <div className="bg-card border-2 border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">24h Volume</p>
              <p className="text-foreground font-bold text-lg">
                {btcPriceData?.volume_24h ? `$${(btcPriceData.volume_24h / 1e9).toFixed(1)}B` : "$2.4B"}
              </p>
            </div>
          </div>
        </div>

        {/* Contract Setup Alert */}
        {needsContractSetup && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-primary font-semibold mb-1">⚠️ Contract Setup Required</h3>
                <p className="text-primary text-sm">
                  The contract references are not set up correctly. This is why closing positions fails.
                </p>
                <p className="text-primary text-xs mt-1">
                  Vault: {vaultTradingEngine === tradingEngineAddress ? '✅' : '❌'} | 
                  FundingRate: {fundingTradingEngine === tradingEngineAddress ? '✅' : '❌'}
                </p>
              </div>
              <button
                onClick={setupAllReferences}
                disabled={isSettingUp}
                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background rounded font-semibold text-sm"
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
              onDepositWithApproval={depositWithApproval}
              isDepositing={isDepositing}
              isApproving={isApproving}
              walletBalanceError={walletBalanceError || undefined}
              walletBalanceLoading={walletBalanceLoading}
              depositError={depositError || undefined}
              isDepositConfirmed={isDepositConfirmed}
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
            pnlTbtc={currentPnL.tbtc}
            pnlUsd={currentPnL.usd}
            price={currentPrice}
            oraclePrice={oraclePrice}
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
            onLiquidate={handleLiquidate}
            isLiquidating={isLiquidating}
            liquidateError={liquidateError || undefined}
            userAddress={userAddress}
          />
        </div>

        {/* MUSD Wallet */}
        <div className="mt-6">
          <MusdWalletCard />
        </div>
      </main>
    </div>
  )
}
