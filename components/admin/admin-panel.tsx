"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useVaultAdminInfo, useVaultBalance, useVaultOwner } from "@/hooks"
import EmergencyControls from "./emergency-controls"
import OwnershipManagement from "./ownership-management"
import InternalMonitor from "./internal-monitor"
import SystemHealth from "../system/system-health"
import InsuranceFundCard from "./insurance-fund"

interface AdminPanelProps {
  className?: string
}

export default function AdminPanel({ className }: AdminPanelProps) {
  const { address: userAddress } = useAccount()
  const { isOwner, isLoading, error, owner, canAccessAdmin } = useVaultAdminInfo(userAddress)
  const { data: vaultBalance } = useVaultBalance(userAddress)
  const { data: vaultOwner } = useVaultOwner()
  
  const [activeTab, setActiveTab] = useState<"overview" | "emergency" | "ownership" | "monitor">("overview")

  // Access control
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

  if (!userAddress) {
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

  if (!canAccessAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 bg-orange-500 rounded-full mx-auto mb-4"></div>
          <p className="text-orange-600 font-semibold mb-2">Access Denied</p>
          <p className="text-muted-foreground text-sm mb-4">Only the vault owner can access the admin panel</p>
          <div className="bg-muted rounded p-4 text-left max-w-md mx-auto">
            <p className="text-sm font-semibold mb-2">Current Owner:</p>
            <p className="font-mono text-xs break-all">{owner || "Unknown"}</p>
            <p className="text-sm font-semibold mb-2 mt-4">Your Address:</p>
            <p className="font-mono text-xs break-all">{userAddress}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {/* Admin Header */}
      <div className="border-b border-border bg-card">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground text-sm">Vault administration and monitoring</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-success text-sm font-semibold">Owner Access</span>
            </div>
          </div>
        </div>
      </div>

      <main className="p-4 md:p-6">
        {/* Admin Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-border">
            {[
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "emergency", label: "Emergency", icon: "🚨" },
              { id: "ownership", label: "Ownership", icon: "👑" },
              { id: "monitor", label: "Monitor", icon: "📈" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 font-semibold text-sm uppercase tracking-wide transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* System Status */}
              <Card className="bg-card border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">System Status</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted rounded p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault Owner</p>
                    <p className="text-foreground font-semibold text-sm break-all">{owner}</p>
                  </div>
                  <div className="bg-muted rounded p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Your Balance</p>
                    <p className="text-foreground font-semibold">
                      {vaultBalance ? (Number(vaultBalance) / 1e8).toFixed(4) : "0.0000"} BTC
                    </p>
                  </div>
                  <div className="bg-muted rounded p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Access Level</p>
                    <p className="text-success font-semibold">Full Admin</p>
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-card border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => setActiveTab("emergency")}
                    className="bg-red-600 hover:bg-red-700 text-background font-semibold h-16"
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">🚨</div>
                      <div className="text-sm">Emergency Controls</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setActiveTab("ownership")}
                    className="bg-orange-600 hover:bg-orange-700 text-background font-semibold h-16"
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">👑</div>
                      <div className="text-sm">Ownership Management</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setActiveTab("monitor")}
                    className="bg-blue-600 hover:bg-blue-700 text-background font-semibold h-16"
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">📈</div>
                      <div className="text-sm">System Monitor</div>
                    </div>
                  </Button>
                </div>
              </Card>

              {/* System Health */}
              <SystemHealth />

              {/* Insurance Fund */}
              <InsuranceFundCard />
            </div>
          )}

          {activeTab === "emergency" && (
            <EmergencyControls 
              vaultBalance={vaultBalance}
              isOwner={isOwner}
            />
          )}

          {activeTab === "ownership" && (
            <OwnershipManagement 
              currentOwner={owner}
              isOwner={isOwner}
            />
          )}

          {activeTab === "monitor" && (
            <InternalMonitor />
          )}
        </div>
      </main>
    </div>
  )
}
