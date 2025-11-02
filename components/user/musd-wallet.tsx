"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAccount, useReadContract } from "wagmi"
import { useVaultMUSDBalance, useVaultWithdrawMUSD } from "@/hooks/use-vault"
import { vaultAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { useToast } from "@/hooks/use-toast"

export default function MusdWalletCard() {
  const { address } = useAccount()
  const { data: bal } = useVaultMUSDBalance(address)
  const balance = bal ? Number(bal) / 1e18 : 0
  const { data: musd } = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'musd' })
  const { withdrawMusd, isPending, isConfirming, isConfirmed, error, hash } = useVaultWithdrawMUSD()
  const { toast } = useToast()
  const [amount, setAmount] = useState<string>("")

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">MUSD Wallet</h2>
        <span className="text-xs text-muted-foreground">Token: {typeof musd === 'string' ? musd : '—'}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault Credit</p>
          <p className="text-foreground font-semibold text-sm">{balance.toFixed(4)} MUSD</p>
          <p className="text-muted-foreground text-xs mt-1">This is your withdrawable credit.</p>
        </div>
      </div>

      <div className="border border-border rounded p-4">
        <h3 className="text-foreground font-semibold mb-3">Withdraw MUSD</h3>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.0001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (MUSD)"
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            onClick={() => {
              const amtNum = Number(amount || 0)
              if (!amtNum || amtNum <= 0 || amtNum > balance) return
              const amt = BigInt(Math.floor(amtNum * 1e18))
              withdrawMusd(amt)
              toast({ title: 'Withdrawing MUSD', description: `${amtNum} MUSD` })
            }}
            disabled={!amount || Number(amount) <= 0 || Number(amount) > balance || isPending || isConfirming}
            className="bg-primary hover:bg-primary/90 text-background"
          >
            {isPending || isConfirming ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </div>
        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs mt-3">
            <p className="text-destructive font-semibold">{error.message}</p>
          </div>
        )}
        {isConfirmed && hash && (
          <p className="text-xs text-primary mt-2">✓ Withdrawal sent: {hash.slice(0,10)}...{hash.slice(-8)}</p>
        )}
      </div>
    </Card>
  )
}

