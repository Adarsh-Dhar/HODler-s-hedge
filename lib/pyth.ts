import { PYTH_BTCUSD_PRICE_ID } from './address'

const HERMES_BASE = process.env.NEXT_PUBLIC_PYTH_HERMES_URL || 'https://hermes.pyth.network'

export interface PythLatestPrice {
  id: string
  price: number
  conf: number
  expo: number
  publishTime: number
}

export async function fetchPythLatestPrice(priceId: string = PYTH_BTCUSD_PRICE_ID): Promise<PythLatestPrice> {
  if (!priceId || /^0x0+$/.test(priceId)) throw new Error('PYTH_BTCUSD_PRICE_ID not configured')
  // Try v2 endpoint first
  const v2Url = `${HERMES_BASE}/v2/price/latest?ids[]=${priceId}`
  let res = await fetch(v2Url, { cache: 'no-store' })
  if (res.ok) {
    const json = await res.json()
    const p = json?.prices?.[0]
    if (!p) throw new Error('Hermes response missing price')
    const priceVal = Number(p.price?.price ?? p.price)
    const confVal = Number(p.price?.conf ?? p.conf)
    const expoVal = Number(p.price?.expo ?? p.expo)
    const publishTimeVal = Number(p.publishTime ?? p.price?.publishTime)
    if (!Number.isFinite(priceVal) || !Number.isFinite(expoVal)) {
      throw new Error('Hermes v2 returned non-numeric price or expo')
    }
    return {
      id: p.id,
      price: priceVal,
      conf: Number.isFinite(confVal) ? confVal : 0,
      expo: expoVal,
      publishTime: Number.isFinite(publishTimeVal) ? publishTimeVal : Math.floor(Date.now() / 1000),
    }
  }

  // Fallback to stable legacy endpoint
  const v1Url = `${HERMES_BASE}/api/latest_price_feeds?ids[]=${priceId}`
  res = await fetch(v1Url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Hermes latest price failed: ${res.status}`)
  const feeds = await res.json()
  const f = Array.isArray(feeds) ? feeds[0] : undefined
  if (!f) throw new Error('Hermes response missing price')
  // v1 may return flattened fields or nested under .price similar to v2
  const rawPrice = f.price?.price ?? f.price
  const rawConf = f.price?.conf ?? f.conf
  const rawExpo = f.price?.expo ?? f.expo
  const rawPublishTime = f.publish_time ?? f.publishTime ?? f.price?.publishTime
  const priceVal = Number(rawPrice)
  const confVal = Number(rawConf)
  const expoVal = Number(rawExpo)
  const publishTimeVal = Number(rawPublishTime)
  if (!Number.isFinite(priceVal) || !Number.isFinite(expoVal)) {
    throw new Error('Hermes v1 returned non-numeric price or expo')
  }
  return {
    id: f.id,
    price: priceVal,
    conf: Number.isFinite(confVal) ? confVal : 0,
    expo: expoVal,
    publishTime: Number.isFinite(publishTimeVal) ? publishTimeVal : Math.floor(Date.now() / 1000),
  }
}

// Returns an array of hex strings (bytes[]) suitable for contract calls
export async function fetchPythLatestUpdateHex(priceId: string = PYTH_BTCUSD_PRICE_ID): Promise<string[]> {
  if (!priceId || /^0x0+$/.test(priceId)) throw new Error('PYTH_BTCUSD_PRICE_ID not configured')
  const url = `${HERMES_BASE}/v2/updates/price/latest?ids[]=${priceId}&encoding=hex`
  
  // Add timeout to prevent hanging (30 seconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error('Hermes fetch timeout - aborting request after 30s')
    controller.abort()
  }, 30000) // 30 second timeout
  
  try {
    console.log('Fetching from Hermes:', url)
    const fetchStart = Date.now()
    
    const res = await fetch(url, { 
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    })
    
    clearTimeout(timeoutId)
    const fetchTime = Date.now() - fetchStart
    console.log(`Hermes fetch completed in ${fetchTime}ms, status: ${res.status}`)
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error('Hermes API error:', { status: res.status, statusText: res.statusText, errorText })
      throw new Error(`Hermes latest update failed: ${res.status} ${res.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`)
    }
    
    console.log('Hermes response received, parsing JSON...')
    const parseStart = Date.now()
    const json = await res.json()
    const parseTime = Date.now() - parseStart
    console.log(`JSON parsed in ${parseTime}ms, extracting data...`, { 
      hasBinary: !!json?.binary, 
      hasData: !!json?.data,
      keys: Object.keys(json || {})
    })
    
    // Hermes returns updates under .binary.data (array of hex)
    const data: string[] = json?.binary?.data || json?.data || []
    
    if (!Array.isArray(data) || data.length === 0) {
      console.error('Hermes response structure:', { 
        json, 
        binary: json?.binary, 
        data: json?.data,
        binaryDataType: typeof json?.binary,
        dataType: typeof json?.data,
        allKeys: Object.keys(json || {})
      })
      throw new Error('Hermes response missing update bytes')
    }
    
    console.log('Hermes update bytes fetched successfully:', { 
      count: data.length, 
      firstBytesLength: data[0]?.length,
      firstBytesPreview: data[0]?.substring(0, 50) + '...'
    })
    return data
  } catch (err: any) {
    clearTimeout(timeoutId)
    
    if (err.name === 'AbortError' || err.name === 'TimeoutError' || err?.message?.includes('aborted')) {
      console.error('Hermes fetch timeout or aborted:', err)
      throw new Error('Hermes API request timed out after 30 seconds. Please check your network connection and try again.')
    }
    
    if (err?.message) {
      console.error('Hermes fetch error:', err)
      throw err
    }
    
    console.error('Unknown Hermes fetch error:', err)
    throw new Error(`Failed to fetch Hermes update bytes: ${err?.message || 'Unknown error'}`)
  }
}

// Helper to normalize to 1e18
export function normalizeTo1e18(price: number, expo: number): number {
  // expo is negative typically; price_normalized = price * 10^(18+expo)
  const scale = Math.pow(10, 18 + expo)
  return price * scale
}


