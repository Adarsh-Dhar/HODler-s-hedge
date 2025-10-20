"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import ChartPanel from "@/components/chart-panel"
import TradePanel from "@/components/trade-panel"
import PositionPanel from "@/components/position-panel"

export default function Home() {
  const [mockPrice, setMockPrice] = useState(42850)
  const [mockPnL, setMockPnL] = useState(1250)

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMockPrice((prev) => {
        const change = (Math.random() - 0.5) * 100
        return Math.max(40000, prev + change)
      })
      setMockPnL((prev) => {
        const change = (Math.random() - 0.5) * 200
        return prev + change
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Panel */}
          <div className="lg:col-span-2">
            <ChartPanel price={mockPrice} />
          </div>

          {/* Trade Panel */}
          <div className="lg:col-span-1">
            <TradePanel price={mockPrice} />
          </div>
        </div>

        {/* Position Panel */}
        <div className="mt-6">
          <PositionPanel pnl={mockPnL} price={mockPrice} />
        </div>
      </main>
    </div>
  )
}
