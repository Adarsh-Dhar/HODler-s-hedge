"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"

interface HeaderProps {
  fundingRate?: bigint
  nextFundingTime?: bigint
  isFundingDue?: boolean
  priceChange?: number
}

export default function Header({ fundingRate, nextFundingTime, isFundingDue, priceChange }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">₿</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">HODLer's Hedge</h1>
          </div>

          {/* Market Info */}
          <div className="hidden md:flex items-center gap-8">
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Market</p>
              <p className="text-foreground font-semibold">BTC/MUSD</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">24h Change</p>
              <p className={`font-semibold ${(priceChange ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {(priceChange ?? 0) >= 0 ? "+" : ""}
                {(priceChange ?? 0).toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Funding Rate</p>
              <p className={`font-semibold ${isFundingDue ? "text-destructive" : "text-foreground"}`}>
                {fundingRate ? (Number(fundingRate) / 1e18 * 100).toFixed(4) : "0.0000"}%
              </p>
              {isFundingDue && (
                <p className="text-destructive text-xs">Due Now</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">24h Volume</p>
              <p className="text-foreground font-semibold">$2.4B</p>
            </div>
          </div>

          {/* Wallet Button */}
          <div>
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  )
}
