"use client"

import { useState } from "react"
import { useAccount, useReadContract } from "wagmi"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useVaultEmergencyWithdraw } from "@/hooks"
import { tBTCAddress, vaultAddress } from "@/lib/address"
import { ERC20ABI } from "@/lib/abi/ERC20"

interface EmergencyControlsProps {
  vaultBalance?: bigint
  isOwner: boolean
}

export default function EmergencyControls({ vaultBalance, isOwner }: EmergencyControlsProps) {
  const [tokenAddress, setTokenAddress] = useState<`0x${string}`>(tBTCAddress)
  const [amount, setAmount] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationText, setConfirmationText] = useState("")
  
  const { address: userAddress } = useAccount()
  const { emergencyWithdraw, isPending, isConfirming, isConfirmed, error, hash } = useVaultEmergencyWithdraw()

  // Dynamically read selected token balance and decimals for the VAULT address (not the user)
  const { data: rawTokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [vaultAddress],
    query: { enabled: !!tokenAddress },
  })

  // Also read the user's token balance for clarity in UI
  const { data: rawUserTokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress && !!tokenAddress },
  })

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'decimals',
    query: { enabled: !!tokenAddress },
  })

  const decimalsNumber = Number(tokenDecimals ?? 8)
  const vaultBalanceFormatted = vaultBalance ? Number(vaultBalance) / Math.pow(10, decimalsNumber) : 0
  const tokenBalanceFormatted = rawTokenBalance
    ? Number(rawTokenBalance) / Math.pow(10, decimalsNumber)
    : 0
  const userTokenBalanceFormatted = rawUserTokenBalance
    ? Number(rawUserTokenBalance) / Math.pow(10, decimalsNumber)
    : 0

  const handleEmergencyWithdraw = async () => {
    if (!showConfirmation || confirmationText !== "EMERGENCY") {
      return
    }

    try {
      const factor = Math.pow(10, decimalsNumber)
      const amountBigInt = BigInt(Math.floor(Number(amount) * factor))
      await emergencyWithdraw(tokenAddress, amountBigInt)
      
      // Reset form on success
      if (isConfirmed) {
        setAmount("")
        setConfirmationText("")
        setShowConfirmation(false)
      }
    } catch (err) {
      console.error('Emergency withdraw failed:', err)
    }
  }

  const isValidAmount = Number(amount) > 0 && Number(amount) <= tokenBalanceFormatted
  const canConfirm = showConfirmation && confirmationText === "EMERGENCY" && isValidAmount

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card className="bg-red-500/10 border-red-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🚨</div>
          <div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Emergency Controls</h2>
            <p className="text-red-600 text-sm mb-2">
              <strong>WARNING:</strong> These functions are for emergency situations only. 
              Use with extreme caution as they can affect the entire vault system.
            </p>
            <ul className="text-red-600 text-xs space-y-1">
              <li>• Emergency withdraw bypasses normal withdrawal limits</li>
              <li>• This action cannot be undone</li>
              <li>• Only use in genuine emergency situations</li>
              <li>• Consider impact on other users before proceeding</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Emergency Withdraw Form */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Emergency Withdraw</h3>
        
        <div className="space-y-4">
          {/* Token Selection */}
          <div>
            <label className="text-muted-foreground text-sm uppercase tracking-wide mb-2 block">
              Token Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value as `0x${string}`)}
                placeholder="0x..."
                className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={() => setTokenAddress(tBTCAddress)}
                variant="outline"
                size="sm"
              >
                TBTC
              </Button>
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              Vault token balance: {tokenBalanceFormatted.toFixed(4)} BTC
            </p>
            {userAddress && (
              <p className="text-muted-foreground text-xs">
                Your token balance: {userTokenBalanceFormatted.toFixed(4)} BTC
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-muted-foreground text-sm uppercase tracking-wide">
                Amount to Withdraw
              </label>
              <Button
                onClick={() => setAmount(tokenBalanceFormatted.toString())}
                variant="outline"
                size="sm"
              >
                Max
              </Button>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0"
                max={tokenBalanceFormatted}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                BTC
              </div>
            </div>
            {Number(amount) > tokenBalanceFormatted && (
              <p className="text-destructive text-xs mt-1">
                Insufficient token balance. Available: {tokenBalanceFormatted.toFixed(4)} BTC
              </p>
            )}
          </div>

          {/* Confirmation Step */}
          {!showConfirmation ? (
            <Button
              onClick={() => setShowConfirmation(true)}
              disabled={!isValidAmount || !isOwner}
              className="w-full bg-red-600 hover:bg-red-700 text-background font-semibold py-3"
            >
              {!isOwner ? "Owner Access Required" : "Initiate Emergency Withdraw"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
                <h4 className="text-red-600 font-semibold mb-2">Final Confirmation Required</h4>
                <p className="text-red-600 text-sm mb-3">
                  You are about to perform an emergency withdraw of {amount} BTC from token {tokenAddress}
                </p>
                <div className="space-y-2">
                  <label className="text-red-600 text-sm font-semibold">
                    Type "EMERGENCY" to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="EMERGENCY"
                    className="w-full bg-background border border-red-500/30 rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowConfirmation(false)
                    setConfirmationText("")
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEmergencyWithdraw}
                  disabled={!canConfirm || isPending || isConfirming}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-background font-semibold"
                >
                  {isPending || isConfirming ? "Processing..." : "Execute Emergency Withdraw"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Transaction Status */}
        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
            <p className="text-destructive font-semibold mb-1">Emergency Withdraw Failed</p>
            <p className="text-destructive text-xs">{error.message}</p>
          </div>
        )}

        {isConfirmed && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded text-sm">
            <p className="text-primary font-semibold mb-1">✓ Emergency Withdraw Successful</p>
            <p className="text-primary text-xs">{amount} BTC withdrawn from vault</p>
            {hash && (
              <p className="text-primary text-xs mt-1">
                TX: {hash.slice(0, 10)}...{hash.slice(-8)}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Recent Emergency Actions */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Recent Emergency Actions</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No emergency actions recorded</p>
          <p className="text-muted-foreground text-sm mt-2">Emergency withdrawals will be logged here</p>
        </div>
      </Card>
    </div>
  )
}
