"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { useReadContract } from "wagmi"
import { insuranceFundAddress, vaultAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"

export default function InsuranceFundCard() {
  const fundAddress = useMemo(() => insuranceFundAddress as `0x${string}` | "", [])

  // Read accounting balance from Vault for the Insurance Fund address
  const { data: balanceMusd } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: VaultABI,
    functionName: "balanceOfMUSD",
    args: fundAddress ? [fundAddress] : undefined,
    query: { enabled: !!fundAddress },
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
      </div>
      <p className="text-xs text-muted-foreground mt-4">Note: Settlement is accounting-only. MUSD is credited inside the Vault to the Insurance Fund address.</p>
    </Card>
  )
}


