"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TradePanelProps {
  price: number
  vaultBalance?: bigint
  maxLeverage?: bigint
  tradingFee?: bigint
  onOpenPosition: (isLong: boolean, marginAmount: bigint, leverage: bigint) => void
  isPending: boolean
  // Deposit props
  walletBalance?: bigint
  allowance?: bigint
  onDeposit: (amount: bigint) => void
  onApprove: (amount: bigint) => void
  isDepositing: boolean
  isApproving: boolean
  walletBalanceError?: Error
  walletBalanceLoading?: boolean
  depositError?: Error
  approveError?: Error
  isDepositConfirmed?: boolean
  isApproveConfirmed?: boolean
  depositHash?: string
}

export default function TradePanel({ 
  price, 
  vaultBalance, 
  maxLeverage, 
  tradingFee, 
  onOpenPosition, 
  isPending,
  walletBalance,
  allowance,
  onDeposit,
  onApprove,
  isDepositing,
  isApproving,
  walletBalanceError,
  walletBalanceLoading,
  depositError,
  approveError,
  isDepositConfirmed,
  isApproveConfirmed,
  depositHash
}: TradePanelProps) {
  const [tradeType, setTradeType] = useState<"long" | "short">("long")
  const [margin, setMargin] = useState(1000)
  const [leverage, setLeverage] = useState(5)
  const [depositAmount, setDepositAmount] = useState(0)
  const [showDeposit, setShowDeposit] = useState(false)
  const [lastDepositedAmount, setLastDepositedAmount] = useState(0)

  // Clear deposit amount after successful deposit
  useEffect(() => {
    if (isDepositConfirmed) {
      setDepositAmount(0)
    }
  }, [isDepositConfirmed])
  
  // Convert vault balance from wei to tBTC
  const availableBalance = vaultBalance ? Number(vaultBalance) / 1e18 : 0
  const walletBalanceFormatted = walletBalance ? Number(walletBalance) / 1e18 : 0
  const maxLeverageValue = maxLeverage ? Number(maxLeverage) : 20
  const tradingFeeRate = tradingFee ? Number(tradingFee) / 1e18 : 0.001

  const positionSize = margin * leverage
  const liquidationPrice =
    tradeType === "long" ? price * (1 - (1 / leverage) * 0.95) : price * (1 + (1 / leverage) * 0.95)
  const calculatedTradingFee = positionSize * tradingFeeRate

  const isValid = margin > 0 && margin <= availableBalance && leverage >= 1 && leverage <= maxLeverageValue
  
  const handleOpenPosition = () => {
    if (!isValid) return
    const marginAmount = BigInt(Math.floor(margin * 1e18)) // Convert to wei
    const leverageBigInt = BigInt(leverage)
    onOpenPosition(tradeType === "long", marginAmount, leverageBigInt)
  }

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

        {/* Deposit Section */}
        <div className="border border-border rounded p-4 bg-muted/20">
          <button
            onClick={() => setShowDeposit(!showDeposit)}
            className="w-full flex items-center justify-between text-left"
          >
            <p className="text-foreground font-semibold text-sm uppercase tracking-wide">
              Deposit BTC to Vault
            </p>
            <span className="text-muted-foreground">
              {showDeposit ? "−" : "+"}
            </span>
          </button>
          
          {showDeposit && (
            <div className="mt-4 space-y-4">
              {/* Balance Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded p-3 border border-border">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Wallet Balance</p>
                  <p className="text-foreground font-bold text-lg">
                    {walletBalanceLoading ? "Loading..." : walletBalanceFormatted.toFixed(4)} BTC
                  </p>
                  {walletBalanceError && (
                    <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
                      <p className="text-destructive mb-1">Error loading balance:</p>
                      <p className="text-destructive text-xs">{walletBalanceError.message}</p>
                    </div>
                  )}
                  {walletBalanceFormatted === 0 && !walletBalanceLoading && !walletBalanceError && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <p className="text-muted-foreground mb-1">Import BTC token:</p>
                      <p className="font-mono text-xs break-all">
                        0x7b7C000000000000000000000000000000000000
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Add this token to MetaMask to see your balance
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-background rounded p-3 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Vault Balance</p>
                    <button
                      onClick={() => {
                        console.log('Manual vault balance refresh requested')
                        window.location.reload()
                      }}
                      className="text-primary text-xs hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <p className="text-foreground font-bold text-lg">
                    {availableBalance.toFixed(4)} BTC
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Raw: {vaultBalance?.toString() || '0'}
                  </p>
                </div>
              </div>

              {/* Deposit Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Deposit Amount</p>
                  <button
                    onClick={() => {
                      console.log('Max button clicked, setting amount to:', walletBalanceFormatted)
                      setDepositAmount(walletBalanceFormatted)
                    }}
                    className="text-primary text-xs hover:underline"
                  >
                    Max
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max={walletBalanceFormatted}
                    value={depositAmount}
                    onChange={(e) => {
                      const newAmount = Math.max(0, Number.parseFloat(e.target.value) || 0)
                      console.log('Input changed:', e.target.value, '-> parsed:', newAmount)
                      setDepositAmount(newAmount)
                    }}
                    placeholder="Enter BTC amount"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                    BTC
                  </div>
                </div>
                {depositAmount > walletBalanceFormatted && (
                  <p className="text-destructive text-xs mt-1">
                    Insufficient wallet balance. Available: {walletBalanceFormatted.toFixed(4)} BTC
                  </p>
                )}
              </div>

              {/* Current Amount Display */}
              {depositAmount > 0 && (
                <div className="p-2 bg-muted rounded text-sm">
                  <p className="text-foreground font-semibold">
                    Ready to deposit: {depositAmount.toFixed(4)} BTC
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Amount in wei: {BigInt(Math.floor(depositAmount * 1e18)).toString()}
                  </p>
                </div>
              )}

              {/* Approve/Deposit Button */}
              {depositAmount > 0 && (
                <Button
                  onClick={() => {
                    if (depositAmount <= 0) {
                      console.error('Cannot deposit 0 or negative amount:', depositAmount)
                      return
                    }
                    
                    const amount = BigInt(Math.floor(depositAmount * 1e18))
                    
                    // Store the deposit amount before transaction
                    setLastDepositedAmount(depositAmount)
                    
                    console.log('Transaction details:', {
                      depositAmount,
                      amount: amount.toString(),
                      amountFormatted: Number(amount) / 1e18,
                      walletBalance: walletBalance?.toString(),
                      allowance: allowance?.toString(),
                      needsApproval: allowance && allowance < amount
                    })
                    
                    if (allowance && allowance < amount) {
                      console.log('Calling approve with amount:', amount.toString())
                      onApprove(amount)
                    } else {
                      console.log('Calling deposit with amount:', amount.toString())
                      onDeposit(amount)
                    }
                  }}
                  disabled={
                    depositAmount > walletBalanceFormatted || 
                    depositAmount === 0 || 
                    isDepositing || 
                    isApproving
                  }
                  className={`w-full py-2 rounded font-semibold transition-colors ${
                    depositAmount > walletBalanceFormatted || depositAmount === 0 || isDepositing || isApproving
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary hover:bg-primary/90 text-background"
                  }`}
                >
                  {isApproving 
                    ? "Approving..." 
                    : isDepositing 
                    ? "Depositing..." 
                    : allowance && allowance < BigInt(Math.floor(depositAmount * 1e18))
                    ? "Approve BTC"
                    : "Deposit BTC"
                  }
                </Button>
              )}

              {/* Transaction Status Messages */}
              {approveError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                  <p className="text-destructive font-semibold mb-1">Approval Failed</p>
                  <p className="text-destructive text-xs">{approveError.message}</p>
                </div>
              )}

              {depositError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                  <p className="text-destructive font-semibold mb-1">Deposit Failed</p>
                  <p className="text-destructive text-xs">{depositError.message}</p>
                  <p className="text-destructive text-xs mt-1">
                    Check console for more details
                  </p>
                </div>
              )}

              {isApproveConfirmed && (
                <div className="p-3 bg-success/10 border border-success/20 rounded text-sm">
                  <p className="text-success font-semibold mb-1">✓ Approval Successful</p>
                  <p className="text-success text-xs">You can now deposit BTC to the vault</p>
                </div>
              )}

              {isDepositConfirmed && (
                <div className="p-3 bg-success/10 border border-success/20 rounded text-sm">
                  <p className="text-success font-semibold mb-1">✓ Deposit Successful</p>
                  <p className="text-success text-xs">{lastDepositedAmount.toFixed(4)} BTC deposited to vault</p>
                  {depositHash && (
                    <p className="text-success text-xs mt-1">
                      TX: {depositHash.slice(0, 10)}...{depositHash.slice(-8)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Margin Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Margin (BTC)</p>
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
            max={maxLeverageValue}
            value={leverage}
            onChange={(e) => setLeverage(Number.parseInt(e.target.value))}
            className="w-full h-2 bg-muted rounded appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-muted-foreground text-xs mt-1">
            <span>1x</span>
            <span>{maxLeverageValue}x</span>
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
            <p className="text-foreground font-semibold">${calculatedTradingFee.toFixed(2)}</p>
          </div>
        </div>

        {/* Execute Button */}
        <Button
          onClick={handleOpenPosition}
          disabled={!isValid || isPending}
          className={`w-full py-3 rounded font-bold text-lg transition-colors ${
            isValid && !isPending
              ? tradeType === "long"
                ? "bg-success hover:bg-success/90 text-background"
                : "bg-destructive hover:bg-destructive/90 text-background"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {isPending ? "Opening Position..." : `Confirm ${tradeType === "long" ? "Long" : "Short"}`}
        </Button>
      </div>
    </Card>
  )
}
