"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { useIsVaultOwner } from "@/hooks"
import Link from "next/link"
import Image from "next/image"

interface HeaderProps {
  fundingRate?: bigint
  nextFundingTime?: bigint
  isFundingDue?: boolean
  priceChange?: number
}

export default function Header({ fundingRate, nextFundingTime, isFundingDue, priceChange }: HeaderProps) {
  const { address } = useAccount()
  const { isOwner } = useIsVaultOwner(address)

  return (
    <header className="border-b border-border bg-card">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/hodlers-hedge-logo-1.png"
              alt="HODLer's Hedge"
              width={32}
              height={32}
              className="rounded"
              priority
            />
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
              {priceChange !== undefined ? (
                <p className={`font-semibold ${priceChange >= 0 ? "text-success" : "text-destructive"}`}>
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </p>
              ) : (
                <p className="font-semibold text-muted-foreground">N/A</p>
              )}
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

          {/* Navigation & Wallet */}
          <div className="flex items-center gap-4">
            {/* Admin Link - Only show for owner */}
            {isOwner && (
              <Link 
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-background rounded text-sm font-semibold transition-colors"
              >
                <span className="text-sm">👑</span>
                Admin
              </Link>
            )}
            
            {/* Wallet Button */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  )
}
