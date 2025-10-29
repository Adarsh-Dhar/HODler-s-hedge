import { NextRequest, NextResponse } from 'next/server'

// This route validates and echoes back a client-provided mark price (already 1e18-scaled).
// It does NOT perform on-chain updates. The client is responsible for calling setMarkPrice.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const price = body?.price as string | undefined

    if (!price || typeof price !== 'string') {
      return NextResponse.json({ error: 'Missing price' }, { status: 400 })
    }

    // Basic validation: numeric string, positive, and within a sane upper bound
    if (!/^\d+$/.test(price)) {
      return NextResponse.json({ error: 'Price must be a uint256 string' }, { status: 400 })
    }

    // Ensure non-zero
    if (price === '0') {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 })
    }

    // Optional sanity check (e.g., < 10 million USD scaled by 1e18)
    // 10_000_000e18 ≈ '10000000000000000000000000'
    const maxReasonable = BigInt('10000000000000000000000000')
    const priceBig = BigInt(price)
    if (priceBig > maxReasonable) {
      return NextResponse.json({ error: 'Price exceeds reasonable upper bound' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: { price } }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to process price' }, { status: 500 })
  }
}

