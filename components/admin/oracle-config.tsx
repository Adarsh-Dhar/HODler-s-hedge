"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useReadContract } from "wagmi"
import { tradingEngineAddress } from "@/lib/address"
import { TradingEngineABI } from "@/lib/abi/TradingEngine"
import { useEngineSetPythOracle, useTradingEnginePythOracle } from "@/hooks"
import { isValidAddress } from "@/lib/admin-utils"

export default function OracleConfig() {
  const [oracleAddress, setOracleAddress] = useState<`0x${string}` | "">("")

  // Read current oracle address
  const { data: currentOracle } = useTradingEnginePythOracle()
  const currentOracleAddress = useMemo(() => {
    if (!currentOracle) return null
    const addr = currentOracle as `0x${string}`
    return addr === "0x0000000000000000000000000000000000000000" ? null : addr
  }, [currentOracle])

  // Write hook
  const { setPythOracle, hash, isPending, isConfirming, isConfirmed, error } = useEngineSetPythOracle()

  const handleSetOracle = () => {
    if (!oracleAddress || !isValidAddress(oracleAddress)) {
      return
    }
    setPythOracle(oracleAddress as `0x${string}`)
  }

  const isValid = isValidAddress(oracleAddress) && oracleAddress.toLowerCase() !== currentOracleAddress?.toLowerCase()

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Pyth Oracle Configuration</h2>
        <span className="text-xs text-muted-foreground">TradingEngine: {tradingEngineAddress}</span>
      </div>

      <div className="space-y-6">
        {/* Current Oracle Address */}
        <div className="bg-muted rounded p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Current Oracle Address</p>
          <p className={`font-semibold text-sm break-all ${currentOracleAddress ? 'text-foreground' : 'text-destructive'}`}>
            {currentOracleAddress || 'Not configured (0x0000...)'}
          </p>
          {!currentOracleAddress && (
            <p className="text-muted-foreground text-xs mt-2">
              ⚠️ Oracle must be configured before positions can be opened
            </p>
          )}
        </div>

        {/* Set Oracle Address */}
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Set Pyth Oracle Address</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={oracleAddress}
              onChange={(e) => setOracleAddress(e.target.value as `0x${string}`)}
              placeholder="0x..."
              className={`flex-1 bg-background border border-border rounded px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-2 ${
                oracleAddress && !isValidAddress(oracleAddress)
                  ? 'focus:ring-destructive border-destructive'
                  : 'focus:ring-primary'
              }`}
            />
            <Button
              onClick={handleSetOracle}
              disabled={!isValid || isPending || isConfirming}
              className="bg-primary hover:bg-primary/90 text-background"
            >
              {isPending || isConfirming ? 'Setting...' : 'Set Oracle'}
            </Button>
          </div>
          
          {oracleAddress && !isValidAddress(oracleAddress) && (
            <p className="text-destructive text-xs mt-2">Invalid address format</p>
          )}
          
          {error && (
            <p className="text-destructive text-xs mt-2">{error.message}</p>
          )}
          
          {isConfirmed && hash && (
            <p className="text-success text-xs mt-2">
              ✓ Oracle set successfully. TX: {hash.slice(0, 10)}...{hash.slice(-8)}
            </p>
          )}
        </div>

        {/* Information */}
        <div className="border border-border rounded p-4 bg-muted/50">
          <p className="text-sm font-semibold mb-2">About Pyth Oracle</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              The Pyth Oracle provides cryptographically verified price feeds for BTC/USD. This oracle address must be set before the trading engine can refresh mark prices or open positions.
            </p>
            <p>
              <strong>Important:</strong> Ensure the oracle contract address is correct for your network. The oracle must implement the PythOracle interface expected by the TradingEngine.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

