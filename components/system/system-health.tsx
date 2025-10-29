"use client"

import { Card } from "@/components/ui/card"
import { useVaultBalance, useVaultOwner, useVaultTradingEngine, useVaultTBTC, useMarginEvents } from "@/hooks"
import { vaultAddress, tradingEngineAddress, fundingRateAddress, tBTCAddress } from "@/lib/address"

export default function SystemHealth() {
  const { data: vaultBalance } = useVaultBalance()
  const { data: vaultOwner } = useVaultOwner()
  const { data: vaultTradingEngine } = useVaultTradingEngine()
  const { data: vaultTBTC } = useVaultTBTC()
  const { totalLocked, totalUnlocked, totalPnL } = useMarginEvents()

  const vaultBalanceFormatted = vaultBalance ? Number(vaultBalance) / 1e8 : 0
  const totalLockedFormatted = Number(totalLocked) / 1e8
  const totalUnlockedFormatted = Number(totalUnlocked) / 1e8
  const totalPnLFormatted = Number(totalPnL) / 1e8

  const getHealthStatus = () => {
    // Simple health check based on contract references
    const vaultRefCorrect = vaultTradingEngine === tradingEngineAddress
    const hasOwner = !!vaultOwner
    const hasBalance = vaultBalanceFormatted > 0
    
    if (vaultRefCorrect && hasOwner && hasBalance) {
      return { status: "healthy", color: "text-success", icon: "✅" }
    } else if (vaultRefCorrect && hasOwner) {
      return { status: "warning", color: "text-yellow-600", icon: "⚠️" }
    } else {
      return { status: "critical", color: "text-destructive", icon: "❌" }
    }
  }

  const health = getHealthStatus()

  return (
    <div className="space-y-6">
      {/* System Health Status */}
      <Card className="bg-card border-border p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">System Health</h2>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{health.icon}</div>
            <div>
              <p className={`font-semibold text-lg ${health.color}`}>
                System {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </p>
              <p className="text-muted-foreground text-sm">
                {health.status === "healthy" && "All systems operational"}
                {health.status === "warning" && "Minor issues detected"}
                {health.status === "critical" && "Critical issues require attention"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Last Check</p>
            <p className="text-foreground font-semibold">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Health Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${vaultTradingEngine === tradingEngineAddress ? "bg-success" : "bg-destructive"}`}></div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Contract References</p>
            </div>
            <p className={`text-sm font-semibold ${vaultTradingEngine === tradingEngineAddress ? "text-success" : "text-destructive"}`}>
              {vaultTradingEngine === tradingEngineAddress ? "Correct" : "Incorrect"}
            </p>
          </div>

          <div className="bg-muted rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${vaultOwner ? "bg-success" : "bg-destructive"}`}></div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Vault Owner</p>
            </div>
            <p className={`text-sm font-semibold ${vaultOwner ? "text-success" : "text-destructive"}`}>
              {vaultOwner ? "Set" : "Not Set"}
            </p>
          </div>

          <div className="bg-muted rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${vaultBalanceFormatted > 0 ? "bg-success" : "bg-yellow-500"}`}></div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Vault Balance</p>
            </div>
            <p className={`text-sm font-semibold ${vaultBalanceFormatted > 0 ? "text-success" : "text-yellow-600"}`}>
              {vaultBalanceFormatted > 0 ? "Active" : "Empty"}
            </p>
          </div>
        </div>
      </Card>

      {/* System Metrics */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">System Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Value Locked</p>
            <p className="text-foreground font-semibold text-lg">
              {vaultBalanceFormatted.toFixed(4)} BTC
            </p>
            <p className="text-muted-foreground text-xs">
              Available: {(vaultBalanceFormatted - totalLockedFormatted).toFixed(4)} BTC
            </p>
          </div>

          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Margin Locked</p>
            <p className="text-blue-600 font-semibold text-lg">
              {totalLockedFormatted.toFixed(4)} BTC
            </p>
            <p className="text-muted-foreground text-xs">
              Active positions
            </p>
          </div>

          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total Margin Unlocked</p>
            <p className="text-green-600 font-semibold text-lg">
              {totalUnlockedFormatted.toFixed(4)} BTC
            </p>
            <p className="text-muted-foreground text-xs">
              Closed positions
            </p>
          </div>

          <div className="bg-muted rounded p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Total PnL</p>
            <p className={`font-semibold text-lg ${totalPnLFormatted >= 0 ? "text-success" : "text-destructive"}`}>
              {totalPnLFormatted >= 0 ? "+" : ""}{totalPnLFormatted.toFixed(4)} BTC
            </p>
            <p className="text-muted-foreground text-xs">
              All time profit/loss
            </p>
          </div>
        </div>
      </Card>

      {/* Contract Information */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Contract Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault Address</p>
              <p className="text-foreground font-mono text-sm break-all">{vaultAddress}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Trading Engine</p>
              <p className="text-foreground font-mono text-sm break-all">{tradingEngineAddress}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Funding Rate</p>
              <p className="text-foreground font-mono text-sm break-all">{fundingRateAddress}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">TBTC Token</p>
              <p className="text-foreground font-mono text-sm break-all">{tBTCAddress}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault Owner</p>
              <p className="text-foreground font-mono text-sm break-all">{vaultOwner || "Not Set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Vault TBTC Reference</p>
              <p className="text-foreground font-mono text-sm break-all">{vaultTBTC?.toString() || "Not Set"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Activity monitoring coming soon</p>
          <p className="text-muted-foreground text-sm mt-2">
            Real-time transaction and event monitoring
          </p>
        </div>
      </Card>
    </div>
  )
}
