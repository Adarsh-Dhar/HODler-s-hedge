"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAccount, useReadContract } from "wagmi"
import { vaultAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { ERC20ABI } from "@/lib/abi/ERC20"
import { useVaultDepositMUSD } from "@/hooks"
import { useToast } from "@/hooks/use-toast"

export default function MusdReserveAdmin() {
  const { address: userAddress } = useAccount()
  const [amount, setAmount] = useState(0)

  const { data: musdAddr } = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'musd' })
  const musdAddress = useMemo(() => (musdAddr as `0x${string}` | undefined) || undefined, [musdAddr])

  const { data: reserveBalance } = useReadContract({
    address: musdAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [vaultAddress],
    query: { enabled: !!musdAddress },
  })

  const { data: allowance } = useReadContract({
    address: musdAddress,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: userAddress && musdAddress ? [userAddress, vaultAddress] : undefined,
    query: { enabled: !!userAddress && !!musdAddress },
  })

  const { depositMusd, isPending: isDepositing, isConfirming: isDepositConfirming, isConfirmed: isDepositConfirmed, error: depositError, hash: depositHash } = useVaultDepositMUSD()

  const { toast } = useToast()

  const handleFundReserve = () => {
    const amt = BigInt(Math.floor(amount * 1e18))
    if (!allowance || allowance < amt) {
      toast({ title: 'Approval required', description: 'Approve MUSD to Vault before depositing', variant: 'destructive' })
      return
    }
    depositMusd(amt)
    toast({ title: 'Depositing MUSD', description: `${amount} MUSD` })
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">MUSD Reserve (Admin)</h2>
        <span className="text-xs text-muted-foreground">Vault: {vaultAddress}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">MUSD Token</p>
          <p className="text-foreground font-semibold text-sm break-all">{musdAddress || 'Not set'}</p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault MUSD Reserve (ERC20)</p>
          <p className="text-foreground font-semibold text-sm">{reserveBalance ? reserveBalance.toString() : '0'}</p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Your MUSD Allowance</p>
          <p className="text-foreground font-semibold text-sm">{allowance ? allowance.toString() : '0'}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Fund Reserve (Deposit MUSD)</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Amount (MUSD)"
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button onClick={handleFundReserve} disabled={!musdAddress || amount <= 0 || isDepositing || isDepositConfirming}>
              {isDepositing || isDepositConfirming ? 'Depositing...' : 'Deposit'}
            </Button>
          </div>
          {depositError && (
            <p className="text-destructive text-xs mt-2">{depositError.message}</p>
          )}
          {isDepositConfirmed && depositHash && (
            <p className="text-success text-xs mt-2">✓ Deposit TX: {depositHash.slice(0,10)}...{depositHash.slice(-8)}</p>
          )}
        </div>
        <div className="border border-border rounded p-4">
          <p className="text-sm text-muted-foreground">Note: Owner can withdraw to treasury via dedicated control below.</p>
        </div>
      </div>
    </Card>
  )
}
