"use client"

import { useState } from "react"
import { Wallet } from "lucide-react"

interface HeaderProps {
  isConnected: boolean
  setIsConnected: (connected: boolean) => void
}

export default function Header({ isConnected, setIsConnected }: HeaderProps) {
  const [walletAddress, setWalletAddress] = useState("0x742d...8f2a")

  const handleWalletConnect = () => {
    setIsConnected(!isConnected)
  }

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
              <p className="text-success font-semibold">+2.45%</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Funding Rate</p>
              <p className="text-foreground font-semibold">0.0125%</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">24h Volume</p>
              <p className="text-foreground font-semibold">$2.4B</p>
            </div>
          </div>

          {/* Wallet Button */}
          <button
            onClick={handleWalletConnect}
            className={`flex items-center gap-2 px-4 py-2 rounded font-semibold transition-colors ${
              isConnected
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <Wallet size={18} />
            <span className="hidden sm:inline">{isConnected ? walletAddress : "Connect Wallet"}</span>
            <span className="sm:hidden">{isConnected ? "Connected" : "Connect"}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
