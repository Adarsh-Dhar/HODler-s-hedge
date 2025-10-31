"use client"

import { useMemo, useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { vaultAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { ERC20ABI } from "@/lib/abi/ERC20"
import { useVaultAdminInfo } from "@/hooks"
import { useVaultDepositMUSD } from "@/hooks/use-vault"

export default function MusdReserveCard() {
  const { address: userAddress } = useAccount()
  const { isOwner } = useVaultAdminInfo(userAddress)

  const { data: musdAddress } = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'musd' })
  const musd = (musdAddress as `0x${string}` | undefined) || undefined

  // On-chain balances
  const { data: reserveBalance } = useReadContract({
    address: musd,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: musd ? [vaultAddress] : undefined,
    query: { enabled: !!musd },
  })

  const { data: userMusd } = useReadContract({
    address: musd,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: userAddress && musd ? [userAddress] : undefined,
    query: { enabled: !!userAddress && !!musd },
  })

  const { data: allowance } = useReadContract({
    address: musd,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: userAddress && musd ? [userAddress, vaultAddress] : undefined,
    query: { enabled: !!userAddress && !!musd },
  })

  // Approve MUSD
  const { writeContract: writeApprove, data: approveHash, isPending: isApproving, error: approveError } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash })

  const onApproveMusd = (amount: bigint) => {
    if (!musd) return
    writeApprove({ address: musd, abi: ERC20ABI, functionName: 'approve', args: [vaultAddress, amount] })
  }

  // Deposit MUSD
  const { depositMusd, hash: depositHash, isPending: isDepositing, isConfirming: isDepositConfirming, isConfirmed: isDepositConfirmed, error: depositError } = useVaultDepositMUSD()

  // Treasury withdraw (owner)
  const { writeContract: writeWithdrawTreasury, data: wHash, isPending: isWithdrawing, error: withdrawError } = useWriteContract()
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } = useWaitForTransactionReceipt({ hash: wHash })
  const withdrawTreasury = (amount: bigint) => {
    writeWithdrawTreasury({ address: vaultAddress, abi: VaultABI, functionName: 'withdrawTreasuryMusd', args: [amount] })
  }

  // UI state
  const [depositAmount, setDepositAmount] = useState<string>("")
  const [withdrawAmount, setWithdrawAmount] = useState<string>("")

  const userMusdNum = userMusd ? Number(userMusd) / 1e18 : 0
  const reserveNum = reserveBalance ? Number(reserveBalance) / 1e18 : 0
  const allowanceOk = (() => {
    try {
      const a = BigInt(allowance || 0n)
      const need = BigInt(Math.floor((Number(depositAmount || 0) || 0) * 1e18))
      return a >= need && need > 0n
    } catch {
      return false
    }
  })()

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">MUSD Reserve</h2>
        <span className="text-xs text-muted-foreground">Vault: {vaultAddress}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">MUSD Token</p>
          <p className="text-foreground font-semibold text-sm break-all">{musd || 'Not set'}</p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault Reserve (ERC20)</p>
          <p className="text-foreground font-semibold text-sm">{reserveNum.toFixed(4)} MUSD</p>
        </div>
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Your MUSD</p>
          <p className="text-foreground font-semibold text-sm">{userMusdNum.toFixed(4)} MUSD</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit into Reserve */}
        <div className="border border-border rounded p-4">
          <h3 className="text-foreground font-semibold mb-3">Deposit MUSD to Reserve</h3>
          <div className="space-y-3">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount (MUSD)"
              className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const amt = BigInt(Math.floor((Number(depositAmount || 0) || 0) * 1e18))
                  onApproveMusd(amt)
                }}
                disabled={!musd || !depositAmount || Number(depositAmount) <= 0 || isApproving}
                variant="outline"
              >
                {isApproving || isApproveConfirming ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                onClick={() => {
                  const amt = BigInt(Math.floor((Number(depositAmount || 0) || 0) * 1e18))
                  depositMusd(amt)
                }}
                disabled={!allowanceOk || isDepositing || isDepositConfirming}
                className="bg-primary hover:bg-primary/90 text-background"
              >
                {isDepositing || isDepositConfirming ? 'Depositing...' : 'Deposit'}
              </Button>
            </div>
            {(approveError || depositError) && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                <p className="text-destructive font-semibold">{approveError?.message || depositError?.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Withdraw to Treasury (Owner) */}
        <div className="border border-border rounded p-4">
          <h3 className="text-foreground font-semibold mb-3">Withdraw to Treasury (Owner)</h3>
          <div className="space-y-3">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount (MUSD)"
              className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              onClick={() => {
                const amt = BigInt(Math.floor((Number(withdrawAmount || 0) || 0) * 1e18))
                withdrawTreasury(amt)
              }}
              disabled={!isOwner || !withdrawAmount || Number(withdrawAmount) <= 0 || isWithdrawing || isWithdrawConfirming}
              className="bg-primary hover:bg-primary/90 text-background"
            >
              {isWithdrawing || isWithdrawConfirming ? 'Withdrawing...' : 'Withdraw to Treasury'}
            </Button>
            {withdrawError && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                <p className="text-destructive font-semibold">{withdrawError.message}</p>
              </div>
            )}
            {!isOwner && (
              <p className="text-xs text-muted-foreground">Only the vault owner can withdraw to treasury.</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAccount, useReadContract } from "wagmi"
import { vaultAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { ERC20ABI } from "@/lib/abi/ERC20"
import { useVaultDepositMUSD, useVaultMUSDBalance } from "@/hooks"
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


