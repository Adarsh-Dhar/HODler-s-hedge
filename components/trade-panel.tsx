"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { tBTCAddress } from "@/lib/address"

interface TradePanelProps {
  price: number
  vaultBalance?: bigint
  maxLeverage?: bigint
  tradingFee?: bigint
  onOpenPosition: (isLong: boolean, marginAmount: bigint, leverage: bigint) => Promise<void>
  isPending: boolean
  openPositionError?: Error
  isOpenPositionConfirmed?: boolean
  openPositionHash?: string
  currentPosition?: any
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
  // Withdraw props
  onWithdraw: (amount: bigint) => void
  isWithdrawing: boolean
  withdrawError?: Error
  isWithdrawConfirmed?: boolean
  withdrawHash?: string
}

export default function TradePanel({ 
  price, 
  vaultBalance, 
  maxLeverage, 
  tradingFee, 
  onOpenPosition, 
  isPending,
  openPositionError,
  isOpenPositionConfirmed,
  openPositionHash,
  currentPosition,
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
  depositHash,
  onWithdraw,
  isWithdrawing,
  withdrawError,
  isWithdrawConfirmed,
  withdrawHash
}: TradePanelProps) {
  const [tradeType, setTradeType] = useState<"long" | "short">("long")
  const [margin, setMargin] = useState(1000)
  const [leverage, setLeverage] = useState(5)
  const [depositAmount, setDepositAmount] = useState(0)
  const [showDeposit, setShowDeposit] = useState(false)
  const [lastDepositedAmount, setLastDepositedAmount] = useState(0)
  const [withdrawAmount, setWithdrawAmount] = useState(0)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [lastWithdrawnAmount, setLastWithdrawnAmount] = useState(0)

  // Clear deposit amount after successful deposit
  useEffect(() => {
    if (isDepositConfirmed) {
      setDepositAmount(0)
    }
  }, [isDepositConfirmed])

  // Clear withdraw amount after successful withdraw
  useEffect(() => {
    if (isWithdrawConfirmed) {
      setWithdrawAmount(0)
    }
  }, [isWithdrawConfirmed])
  
  // Convert vault balance from wei to tBTC (Mock tBTC uses 8 decimals)
  const availableBalance = vaultBalance ? Number(vaultBalance) / 1e8 : 0
  const walletBalanceFormatted = walletBalance ? Number(walletBalance) / 1e8 : 0
  const maxLeverageValue = maxLeverage ? Number(maxLeverage) : 20
  const tradingFeeRate = tradingFee ? Number(tradingFee) / 1e18 : 0.001

  const positionSize = margin * leverage
  const liquidationPrice =
    tradeType === "long" ? price * (1 - (1 / leverage) * 0.95) : price * (1 + (1 / leverage) * 0.95)
  const calculatedTradingFee = positionSize * tradingFeeRate

  // Check if position is truly active (not just exists flag, but also has size/margin)
  // This handles edge cases where position might have exists=true but size/margin=0
  // After closing, the position might have exists=false but still have cached data
  // Position size and margin are stored in tBTC with 8 decimals
  const currentPositionSizeTbtc = currentPosition?.size ? Number(currentPosition.size) / 1e8 : 0
  const currentPositionMargin = currentPosition?.margin ? Number(currentPosition.margin) / 1e8 : 0
  const hasActivePosition = currentPosition?.exists && currentPositionSizeTbtc > 0 && currentPositionMargin > 0
  
  const isValid = margin > 0 && margin <= availableBalance && leverage >= 1 && leverage <= maxLeverageValue && !hasActivePosition
  
  // Additional validation for better error messages
  const validationErrors = []
  if (margin <= 0) validationErrors.push("Margin must be greater than 0")
  if (margin > availableBalance) validationErrors.push(`Insufficient vault balance. Available: ${availableBalance.toFixed(4)} BTC`)
  if (leverage < 1 || leverage > maxLeverageValue) validationErrors.push(`Leverage must be between 1 and ${maxLeverageValue}`)
  if (hasActivePosition) validationErrors.push(`You already have an open ${currentPosition.isLong ? 'long' : 'short'} position. Close it before opening a new one.`)
  
  const handleOpenPosition = async () => {
    if (!isValid) return
    
    try {
      const marginAmount = BigInt(Math.floor(margin * 1e8)) // Convert to tBTC wei (8 decimals)
      const leverageBigInt = BigInt(leverage)
      
      await onOpenPosition(tradeType === "long", marginAmount, leverageBigInt)
    } catch (error) {
      console.error('Error opening position:', error)
      // Error will be handled by the parent component and passed down as openPositionError
    }
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
                        {tBTCAddress}
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
                    Amount in wei: {BigInt(Math.floor(depositAmount * 1e8)).toString()}
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
                    
                    const amount = BigInt(Math.floor(depositAmount * 1e8))
                    
                    // Store the deposit amount before transaction
                    setLastDepositedAmount(depositAmount)
                    
                    // Always try approval first if allowance is 0 or undefined
                    if (!allowance || allowance === BigInt(0) || allowance < amount) {
                      onApprove(amount)
                    } else {
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
                    : !allowance || allowance === BigInt(0) || allowance < BigInt(Math.floor(depositAmount * 1e8))
                    ? "Approve BTC"
                    : "Deposit BTC"
                  }
                  {/* Debug info */}
                  {depositAmount > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Debug: Allowance={allowance?.toString() || 'undefined'}, Amount={BigInt(Math.floor(depositAmount * 1e8)).toString()}, NeedsApproval={!allowance || allowance < BigInt(Math.floor(depositAmount * 1e8)) ? 'Yes' : 'No'}
                    </div>
                  )}
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

        {/* Withdraw Section */}
        <div className="border border-border rounded p-4 bg-muted/20">
          <button
            onClick={() => setShowWithdraw(!showWithdraw)}
            className="w-full flex items-center justify-between text-left"
          >
            <p className="text-foreground font-semibold text-sm uppercase tracking-wide">
              Withdraw BTC from Vault
            </p>
            <span className="text-muted-foreground">
              {showWithdraw ? "−" : "+"}
            </span>
          </button>
          
          {showWithdraw && (
            <div className="mt-4 space-y-4">
              {/* Balance Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded p-3 border border-border">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault Balance</p>
                  <p className="text-foreground font-bold text-lg">
                    {availableBalance.toFixed(4)} BTC
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Raw: {vaultBalance?.toString() || '0'}
                  </p>
                </div>
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
                </div>
              </div>

              {/* Withdraw Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Withdraw Amount</p>
                  <button
                    onClick={() => {
                      setWithdrawAmount(availableBalance)
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
                    max={availableBalance}
                    value={withdrawAmount}
                    onChange={(e) => {
                      const newAmount = Math.max(0, Number.parseFloat(e.target.value) || 0)
                      setWithdrawAmount(newAmount)
                    }}
                    placeholder="Enter BTC amount to withdraw"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                    BTC
                  </div>
                </div>
                {withdrawAmount > availableBalance && (
                  <p className="text-destructive text-xs mt-1">
                    Insufficient vault balance. Available: {availableBalance.toFixed(4)} BTC
                  </p>
                )}
                {currentPosition?.exists && withdrawAmount > 0 && (
                  <p className="text-yellow-600 text-xs mt-1">
                    ⚠️ You have an open position. Consider closing it before withdrawing large amounts.
                  </p>
                )}
              </div>

              {/* Current Amount Display */}
              {withdrawAmount > 0 && (
                <div className="p-2 bg-muted rounded text-sm">
                  <p className="text-foreground font-semibold">
                    Ready to withdraw: {withdrawAmount.toFixed(4)} BTC
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Amount in wei: {BigInt(Math.floor(withdrawAmount * 1e8)).toString()}
                  </p>
                </div>
              )}

              {/* Withdraw Button */}
              {withdrawAmount > 0 && (
                <Button
                  onClick={() => {
                    if (withdrawAmount <= 0) {
                      console.error('Cannot withdraw 0 or negative amount:', withdrawAmount)
                      return
                    }
                    
                    const amount = BigInt(Math.floor(withdrawAmount * 1e8))
                    
                    // Store the withdraw amount before transaction
                    setLastWithdrawnAmount(withdrawAmount)
                    
                    onWithdraw(amount)
                  }}
                  disabled={
                    withdrawAmount > availableBalance || 
                    withdrawAmount === 0 || 
                    isWithdrawing
                  }
                  className={`w-full py-2 rounded font-semibold transition-colors ${
                    withdrawAmount > availableBalance || withdrawAmount === 0 || isWithdrawing
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary hover:bg-primary/90 text-background"
                  }`}
                >
                  {isWithdrawing ? "Withdrawing..." : "Withdraw BTC"}
                </Button>
              )}

              {/* Transaction Status Messages */}
              {withdrawError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                  <p className="text-destructive font-semibold mb-1">Withdraw Failed</p>
                  <p className="text-destructive text-xs">{withdrawError.message}</p>
                </div>
              )}

              {isWithdrawConfirmed && (
                <div className="p-3 bg-success/10 border border-success/20 rounded text-sm">
                  <p className="text-success font-semibold mb-1">✓ Withdraw Successful</p>
                  <p className="text-success text-xs">{lastWithdrawnAmount.toFixed(4)} BTC withdrawn from vault</p>
                  {withdrawHash && (
                    <p className="text-success text-xs mt-1">
                      TX: {withdrawHash.slice(0, 10)}...{withdrawHash.slice(-8)}
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
          {availableBalance === 0 && (
            <p className="text-muted-foreground text-xs mt-1">
              💡 Deposit BTC to the vault above to have margin available for trading
            </p>
          )}
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

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
            <p className="text-destructive font-semibold mb-1">Validation Errors:</p>
            {validationErrors.map((error, index) => (
              <p key={index} className="text-destructive text-xs">• {error}</p>
            ))}
          </div>
        )}

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

        {/* Open Position Error */}
        {openPositionError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
            <p className="text-destructive font-semibold mb-1">Position Opening Failed</p>
            <p className="text-destructive text-xs">{openPositionError.message}</p>
            <p className="text-destructive text-xs mt-1">
              Check console for more details
            </p>
          </div>
        )}

        {/* Open Position Success */}
        {isOpenPositionConfirmed && (
          <div className="p-3 bg-success/10 border border-success/20 rounded text-sm">
            <p className="text-success font-semibold mb-1">✓ Position Opened Successfully</p>
            <p className="text-success text-xs">
              {tradeType === "long" ? "Long" : "Short"} position opened with {leverage}x leverage
            </p>
            {openPositionHash && (
              <p className="text-success text-xs mt-1">
                TX: {openPositionHash.slice(0, 10)}...{openPositionHash.slice(-8)}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
