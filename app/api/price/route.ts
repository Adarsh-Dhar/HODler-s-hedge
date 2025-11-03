import { NextRequest, NextResponse } from 'next/server'
import { fetchPythLatestPrice } from '@/lib/pyth'

export async function GET(request: NextRequest) {
  try {
    const latest = await fetchPythLatestPrice()
    const priceNum = Number(latest.price)
    const expoNum = Number(latest.expo)
    if (!Number.isFinite(priceNum) || !Number.isFinite(expoNum)) {
      throw new Error('Invalid price payload from Pyth')
    }

    const currentPrice = priceNum * Math.pow(10, expoNum)

    // Use hardcoded historical price of 110000 for testing
    const historicalPrice = 110000
    
    // Calculate percentage change: ((current - historical) / historical) * 100
    const change24h = ((currentPrice - historicalPrice) / historicalPrice) * 100

    // Convert to UI-friendly shape
    return NextResponse.json({
      success: true,
      data: {
        price: currentPrice,
        market_cap: 0,
        volume_24h: 0,
        change_24h: change24h,
        last_updated: new Date(latest.publishTime * 1000).toISOString(),
        currency: 'USD',
        symbol: 'BTC',
        name: 'Bitcoin',
      },
    })
  } catch (error) {
    console.error('Pyth /api/price error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Pyth price',
      },
      { status: 500 },
    )
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
