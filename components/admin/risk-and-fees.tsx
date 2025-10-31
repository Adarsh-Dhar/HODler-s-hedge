"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAccount, useReadContract } from "wagmi"
import { vaultAddress, tradingEngineAddress } from "@/lib/address"
import { VaultABI } from "@/lib/abi/Vault"
import { TradingEngineABI } from "@/lib/abi/TradingEngine"
import { useVaultSetAutoSettle, useVaultSetProtocolFeeBps, useVaultSetTreasury, useTradingEngineRefreshMarkPrice, useTradingEngineOraclePrice } from "@/hooks"
import { useEngineSetMaxOpenInterestTbtc, useEngineSetMaxOracleMoveBps, useEngineSetProtocolFeeBps, useEngineSetTreasury } from "@/hooks"

export default function RiskAndFeesAdmin() {
  const { address } = useAccount()

  // Reads
  const { data: vaultMusd } = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'musd' })
  const { data: vaultTreasury } = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'treasury' })
  const { data: autoSettle } = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'autoSettleOn' })

  const { data: markPrice } = useReadContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'getMarkPrice' })
  const oraclePriceQuery = useTradingEngineOraclePrice()
  const { refreshMarkPrice, isPending: isRefreshing, isConfirming: isRefreshConfirming, isConfirmed: isRefreshConfirmed, error: refreshError } = useTradingEngineRefreshMarkPrice()

  // Forms
  const [treasury, setTreasury] = useState<`0x${string}` | "">("")
  const [vaultFeeBps, setVaultFeeBps] = useState(0)
  const [engineFeeBps, setEngineFeeBps] = useState(0)
  const [maxOI, setMaxOI] = useState(0)
  const [oracleBand, setOracleBand] = useState(0)
  const [auto, setAuto] = useState<boolean | null>(null)

  // Actions
  const vaultSetTreasury = useVaultSetTreasury()
  const vaultSetFee = useVaultSetProtocolFeeBps()
  const vaultSetAuto = useVaultSetAutoSettle()

  const engSetTreasury = useEngineSetTreasury()
  const engSetFee = useEngineSetProtocolFeeBps()
  const engSetOI = useEngineSetMaxOpenInterestTbtc()
  const engSetBand = useEngineSetMaxOracleMoveBps()

  return (
    <Card className="bg-card border-border p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">Risk & Fees (Admin)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Treasury Settings */}
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Treasury</p>
          <p className="text-muted-foreground text-xs mb-2">Current: {(vaultTreasury as string) || 'Not set'}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={treasury}
              onChange={(e) => setTreasury(e.target.value as any)}
              placeholder="0x..."
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground font-mono text-sm"
            />
            <Button
              onClick={() => {
                if (!treasury) return
                vaultSetTreasury.setTreasury(treasury as `0x${string}`)
                engSetTreasury.setTreasury(treasury as `0x${string}`)
                console.log('Treasury set', treasury)
              }}
            >Set</Button>
          </div>
        </div>

        {/* Fee Settings */}
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Protocol Fee (bps)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-xs">Vault</label>
              <div className="flex gap-2">
                <input type="number" min={0} value={vaultFeeBps} onChange={(e) => setVaultFeeBps(Math.max(0, Number(e.target.value)||0))} className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground text-sm" />
                <Button onClick={() => vaultSetFee.setProtocolFeeBps(BigInt(vaultFeeBps))}>Update</Button>
              </div>
            </div>
            <div>
              <label className="text-muted-foreground text-xs">TradingEngine</label>
              <div className="flex gap-2">
                <input type="number" min={0} value={engineFeeBps} onChange={(e) => setEngineFeeBps(Math.max(0, Number(e.target.value)||0))} className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground text-sm" />
                <Button onClick={() => engSetFee.setProtocolFeeBps(BigInt(engineFeeBps))}>Update</Button>
              </div>
            </div>
          </div>
        </div>

        {/* OI Cap */}
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Max Open Interest (tBTC, 8d)</p>
          <div className="flex gap-2">
            <input type="number" min={0} value={maxOI} onChange={(e)=>setMaxOI(Math.max(0, Number(e.target.value)||0))} className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground text-sm" />
            <Button onClick={() => engSetOI.setMaxOpenInterestTbtc(BigInt(maxOI))}>Update</Button>
          </div>
        </div>

        {/* Oracle Sanity Band */}
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Oracle Sanity Band (bps)</p>
          <div className="flex gap-2">
            <input type="number" min={0} value={oracleBand} onChange={(e)=>setOracleBand(Math.max(0, Number(e.target.value)||0))} className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground text-sm" />
            <Button onClick={() => engSetBand.setMaxOracleMoveBps(BigInt(oracleBand))}>Update</Button>
          </div>
          <p className="text-muted-foreground text-xs mt-2">Current mark price: {markPrice ? (Number(markPrice)/1e18).toFixed(0) : '-'}</p>
        </div>

        {/* Auto-Settle Toggle */}
        <div className="border border-border rounded p-4">
          <p className="text-sm font-semibold mb-2">Auto-Settle</p>
          <p className="text-muted-foreground text-xs mb-2">Current: {String(autoSettle)}</p>
          <div className="flex gap-2 items-center">
            <select value={auto === null ? '' : (auto ? 'on' : 'off')} onChange={(e)=> setAuto(e.target.value === 'on')} className="bg-background border border-border rounded px-3 py-2 text-foreground text-sm">
              <option value="">Select</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
            <Button onClick={() => auto !== null && vaultSetAuto.setAutoSettle(auto)}>Set</Button>
          </div>
          <p className="text-muted-foreground text-xs mt-2">Auto-settle attempts ERC20 transfers; falls back to internal credit otherwise.</p>
        </div>

        {/* Price Oracle Refresh */}
        <div className="border border-border rounded p-4 md:col-span-2">
          <p className="text-sm font-semibold mb-2">Price Oracle Refresh</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-muted rounded p-3">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Current Mark Price</p>
              <p className="text-foreground font-semibold">
                {markPrice ? `$${(Number(markPrice) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Loading...'}
              </p>
            </div>
            <div className="bg-muted rounded p-3">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Oracle Price (Pyth)</p>
              <p className="text-foreground font-semibold">
                {(() => {
                  const oracleData = oraclePriceQuery?.data as [bigint, bigint] | undefined
                  return oracleData && oracleData[0]
                    ? `$${(Number(oracleData[0]) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    : 'Not available'
                })()}
              </p>
              {(() => {
                const oracleData = oraclePriceQuery?.data as [bigint, bigint] | undefined
                return oracleData && oracleData[1] ? (
                  <p className="text-muted-foreground text-xs mt-1">
                    Updated: {new Date(Number(oracleData[1]) * 1000).toLocaleTimeString()}
                  </p>
                ) : null
              })()}
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => refreshMarkPrice()}
              disabled={isRefreshing || isRefreshConfirming}
              className="bg-primary hover:bg-primary/90 text-background"
            >
              {isRefreshing || isRefreshConfirming ? 'Refreshing...' : 'Refresh from Hermes'}
            </Button>
            {isRefreshConfirmed && (
              <span className="text-success text-sm">✓ Refresh successful</span>
            )}
            {refreshError && (
              <span className="text-destructive text-sm">{refreshError.message}</span>
            )}
          </div>
          
          <div className="mt-3 space-y-1">
            <p className="text-muted-foreground text-xs">
              Updates on-chain mark price from Pyth oracle using Hermes price feed. Requires small ETH fee (~0.001 ETH, excess refunded).
            </p>
            <p className="text-muted-foreground text-xs">
              This ensures prices are cryptographically verified and match other DeFi protocols using Pyth.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
