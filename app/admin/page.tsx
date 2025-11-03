"use client"

// Force dynamic rendering to prevent static generation issues with wagmi
export const dynamic = 'force-dynamic'

import { useAccount } from "wagmi"
import { useIsVaultOwner } from "@/hooks"
import AdminPanel from "@/components/admin/admin-panel"

export default function AdminPage() {
  const { address } = useAccount()
  const { isOwner, isLoading, error } = useIsVaultOwner(address)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking admin access...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 bg-destructive rounded-full mx-auto mb-4"></div>
          <p className="text-destructive font-semibold mb-2">Error checking admin access</p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!address) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 bg-muted rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground font-semibold mb-2">Wallet Not Connected</p>
          <p className="text-muted-foreground text-sm">Please connect your wallet to access the admin panel</p>
        </div>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-full mx-auto mb-4"></div>
          <p className="text-primary font-semibold mb-2">Access Denied</p>
          <p className="text-muted-foreground text-sm mb-4">Only the vault owner can access the admin panel</p>
          <div className="bg-muted rounded p-4 text-left max-w-md mx-auto">
            <p className="text-sm font-semibold mb-2">Your Address:</p>
            <p className="font-mono text-xs break-all">{address}</p>
          </div>
        </div>
      </div>
    )
  }

  return <AdminPanel />
}
