import { NextRequest, NextResponse } from 'next/server';

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

interface PriceResponse {
  id: string;
  symbol: string;
  name: string;
  current_price: {
    usd: number;
  };
  market_cap: {
    usd: number;
  };
  total_volume: {
    usd: number;
  };
  price_change_percentage_24h: number;
  last_updated: string;
}

interface HistoricalDataResponse {
  id: string;
  symbol: string;
  name: string;
  market_data: {
    current_price: {
      usd: number;
    };
    market_cap: {
      usd: number;
    };
    total_volume: {
      usd: number;
    };
    price_change_percentage_24h: number;
  };
  last_updated: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'current';
    const date = searchParams.get('date');

    // Validate API key
    if (!COINGECKO_API_KEY) {
      return NextResponse.json(
        { error: 'CoinGecko API key not configured' },
        { status: 500 }
      );
    }

    const headers = {
      'x-cg-demo-api-key': COINGECKO_API_KEY,
      'Content-Type': 'application/json',
    };

    let response: Response;
    let data: PriceResponse | HistoricalDataResponse;

    if (type === 'historical' && date) {
      // Fetch historical data for a specific date
      const formattedDate = new Date(date).toISOString().split('T')[0];
      response = await fetch(
        `${COINGECKO_BASE_URL}/coins/bitcoin/history?date=${formattedDate}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const historicalData = await response.json() as HistoricalDataResponse;
      
      data = {
        id: historicalData.id,
        symbol: historicalData.symbol,
        name: historicalData.name,
        current_price: {
          usd: historicalData.market_data.current_price.usd
        },
        market_cap: {
          usd: historicalData.market_data.market_cap.usd
        },
        total_volume: {
          usd: historicalData.market_data.total_volume.usd
        },
        price_change_percentage_24h: historicalData.market_data.price_change_percentage_24h,
        last_updated: historicalData.last_updated
      };
    } else {
      // Fetch current price data
      response = await fetch(
        `${COINGECKO_BASE_URL}/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const priceData = await response.json();
      
      data = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: {
          usd: priceData.bitcoin.usd
        },
        market_cap: {
          usd: priceData.bitcoin.usd_market_cap
        },
        total_volume: {
          usd: priceData.bitcoin.usd_24h_vol
        },
        price_change_percentage_24h: priceData.bitcoin.usd_24h_change,
        last_updated: new Date().toISOString()
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        price: data.current_price.usd,
        market_cap: data.market_cap.usd,
        volume_24h: data.total_volume.usd,
        change_24h: data.price_change_percentage_24h,
        last_updated: data.last_updated,
        currency: 'USD',
        symbol: data.symbol.toUpperCase(),
        name: data.name
      }
    });

  } catch (error) {
    console.error('Error fetching BTC price:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch BTC price data'
      },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
