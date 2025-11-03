import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { runLiquidationCheck } from '../../../../liquidation-bot/src/index.js'

/**
 * Vercel Cron endpoint for checking and executing liquidations
 * This endpoint is called automatically by Vercel based on the cron schedule in vercel.json
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In production, verify the cron secret if set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    console.log('🕐 Cron job triggered at', new Date().toISOString())
    
    // Initialize KV client
    const kvClient = kv || null

    // Run the liquidation check
    await runLiquidationCheck(kvClient)

    return NextResponse.json({
      success: true,
      message: 'Liquidation check completed',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Error in liquidation cron job:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// Other HTTP methods not allowed
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

