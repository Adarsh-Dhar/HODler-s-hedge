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

    // Convert to UI-friendly shape; market cap/volume are not provided by Pyth, set null
    return NextResponse.json({
      success: true,
      data: {
        price: priceNum * Math.pow(10, expoNum),
        market_cap: 0,
        volume_24h: 0,
        change_24h: 0,
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
