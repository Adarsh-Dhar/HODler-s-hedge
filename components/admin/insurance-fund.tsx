"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
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

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Insurance Fund</h2>
        <span className="text-xs text-muted-foreground">{fundAddress || "Not set"}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Accounting Balance (Vault MUSD, 18d)</p>
          <p className="text-foreground font-semibold text-sm">{balanceMusd ? balanceMusd.toString() : "0"}</p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Token Balance (InsuranceFund MUSD, 18d)</p>
          <p className="text-foreground font-semibold text-sm">{tokenBalance ? tokenBalance.toString() : "0"}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Vault credits MUSD internally; when reserve is prefunded, payouts are sent as real ERC20 to Insurance Fund and liquidators.</p>
    </Card>
  )
}


