"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { useIsVaultOwner } from "@/hooks"
import Link from "next/link"
import Image from "next/image"

export default function Header() {
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

          {/* Navigation & Wallet */}
          <div className="flex items-center gap-4">
            {/* Admin Link - Only show for owner */}
            {isOwner && (
              <Link 
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-background border-2 border-primary text-primary hover:bg-primary hover:text-background rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <span className="text-base">👑</span>
                <span>Admin</span>
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
