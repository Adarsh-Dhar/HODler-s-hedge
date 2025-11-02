"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useReadContract } from "wagmi"
import { insuranceFundAddress, vaultAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { InsuranceFundABI } from "@/lib/abi/InsuranceFund"

export default function InsuranceFundCard() {
  const fundAddress = useMemo(() => insuranceFundAddress as `0x${string}` | "", [])

  // Read accounting balance from Vault for the Insurance Fund address
  const { data: balanceMusd } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: VaultABI,
    functionName: "balanceOfMusd",
    args: fundAddress ? [fundAddress] : undefined,
    query: { enabled: !!fundAddress },
  })

  // Read actual token balance on InsuranceFund contract (MUSD ERC20)
  const { data: tokenBalance } = useReadContract({
    address: insuranceFundAddress as `0x${string}`,
    abi: InsuranceFundABI,
    functionName: "getBalance",
  })

  // Read total bad debt accumulated
  const { data: totalBadDebt } = useReadContract({
    address: insuranceFundAddress as `0x${string}`,
    abi: InsuranceFundABI,
    functionName: "getTotalBadDebt",
  })

  // Read available coverage (same as token balance for now)
  const { data: availableCoverage } = useReadContract({
    address: insuranceFundAddress as `0x${string}`,
    abi: InsuranceFundABI,
    functionName: "getAvailableCoverage",
  })

  // Calculate coverage ratio
  const coverageRatio = useMemo(() => {
    if (!totalBadDebt || totalBadDebt === 0n || !tokenBalance) return null
    if (tokenBalance === 0n) return 0
    // Convert to number for percentage calculation (loss of precision but fine for display)
    const debt = Number(totalBadDebt) / 1e18
    const balance = Number(tokenBalance) / 1e18
    return balance > 0 ? (debt / balance) * 100 : 0
  }, [totalBadDebt, tokenBalance])

  const hasBadDebt = totalBadDebt && totalBadDebt > 0n

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Insurance Fund</h2>
        <span className="text-xs text-muted-foreground">{fundAddress || "Not set"}</span>
      </div>

      {hasBadDebt && (
        <Alert className="mb-4 border-primary/50 bg-primary/10">
          <AlertDescription className="text-primary">
            ⚠️ Bad debt detected: {totalBadDebt?.toString() || "0"} MUSD
            {coverageRatio !== null && coverageRatio > 0 && (
              <span className="ml-2">
                (Coverage ratio: {coverageRatio.toFixed(2)}%)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Accounting Balance (Vault MUSD, 18d)</p>
          <p className="text-foreground font-semibold text-sm">{balanceMusd ? balanceMusd.toString() : "0"}</p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Token Balance (InsuranceFund MUSD, 18d)</p>
          <p className="text-foreground font-semibold text-sm">{tokenBalance ? tokenBalance.toString() : "0"}</p>
        </div>
        <div className={`bg-muted rounded p-4 ${hasBadDebt ? "border-2 border-primary/50" : ""}`}>
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Bad Debt (MUSD, 18d)</p>
          <p className={`font-semibold text-sm ${hasBadDebt ? "text-primary" : "text-foreground"}`}>
            {totalBadDebt ? totalBadDebt.toString() : "0"}
          </p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Available Coverage (MUSD, 18d)</p>
          <p className="text-foreground font-semibold text-sm">{availableCoverage ? availableCoverage.toString() : "0"}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Vault credits MUSD internally; when reserve is prefunded, payouts are sent as real ERC20 to Insurance Fund and liquidators.</p>
    </Card>
  )
}


