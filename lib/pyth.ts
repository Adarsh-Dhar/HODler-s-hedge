import { PYTH_BTCUSD_PRICE_ID } from './address'

const HERMES_BASE = process.env.NEXT_PUBLIC_PYTH_HERMES_URL || 'https://hermes.pyth.network'
const BENCHMARKS_BASE = process.env.NEXT_PUBLIC_PYTH_BENCHMARKS_URL || 'https://benchmarks.pyth.network'

export interface PythLatestPrice {
  id: string
  price: number
  conf: number
  expo: number
  publishTime: number
}

export interface PythHistoricalPrice {
  id: string
  price: number
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

export async function fetchPythHistoricalPrice(
  timestamp: number, // Unix timestamp in seconds
  priceId: string = PYTH_BTCUSD_PRICE_ID
): Promise<PythHistoricalPrice> {
  if (!priceId || /^0x0+$/.test(priceId)) throw new Error('PYTH_BTCUSD_PRICE_ID not configured')
  
  // Use the Benchmarks API for historical data (not Hermes)
  const url = `${BENCHMARKS_BASE}/v1/updates/price/${timestamp}?ids[]=${priceId}`
  
  console.log('Fetching historical price from Benchmarks API:', url, 'timestamp:', timestamp)
  
  const res = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
    }
  })
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    console.error('=== HISTORICAL PRICE API ERROR ===')
    console.error('Status:', res.status)
    console.error('Status Text:', res.statusText)
    console.error('Error Text:', errorText)
    console.error('URL:', url)
    console.error('Timestamp:', timestamp, '(converts to:', new Date(timestamp * 1000).toISOString(), ')')
    console.error('Price ID:', priceId)
    console.error('Response Headers:', Object.fromEntries(res.headers.entries()))
    console.error('==================================')
    
    // If 404 or similar, try multiple timestamp adjustments
    // Price updates might not exist for exact timestamp
    if (res.status === 404 || res.status === 400) {
      const timestampAdjustments = [3600, 7200, 10800, 86400] // 1h, 2h, 3h, 24h earlier
      
      for (const adjustment of timestampAdjustments) {
        const adjustedTimestamp = timestamp - adjustment
        console.log(`Trying timestamp ${adjustment}s (${adjustment/3600}h) earlier: ${adjustedTimestamp} (${new Date(adjustedTimestamp * 1000).toISOString()})`)
        const adjustedUrl = `${BENCHMARKS_BASE}/v1/updates/price/${adjustedTimestamp}?ids[]=${priceId}`
        
        try {
          const adjustedRes = await fetch(adjustedUrl, { 
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          })
          
          console.log(`  → Status: ${adjustedRes.status}`)
          
          if (adjustedRes.ok) {
            const adjustedResponseText = await adjustedRes.text()
            console.log(`  → SUCCESS with ${adjustment}s earlier! Response length:`, adjustedResponseText.length)
            
            try {
              const jsonResponse = JSON.parse(adjustedResponseText)
              console.log('  → Parsed JSON response successfully')
              return parseHistoricalResponse(jsonResponse, priceId, adjustedTimestamp)
            } catch (parseError) {
              console.error('  → Failed to parse JSON:', parseError)
              console.error('  → Response text:', adjustedResponseText.substring(0, 500))
              // Continue to next adjustment
            }
          } else {
            const adjustedErrorText = await adjustedRes.text().catch(() => '')
            console.log(`  → Failed: ${adjustedRes.status} - ${adjustedErrorText.substring(0, 100)}`)
          }
        } catch (fetchError: any) {
          console.error(`  → Fetch error:`, fetchError.message)
        }
      }
      
      console.error('All timestamp adjustments failed. Trying alternative endpoint formats...')
      
      // Try alternative endpoint format on benchmarks API
      const altUrl = `${BENCHMARKS_BASE}/api/get_price_feeds?ids[]=${priceId}&publish_time=${timestamp}`
      console.log('Trying alternative endpoint on Benchmarks API:', altUrl)
      try {
        const altRes = await fetch(altUrl, { cache: 'no-store', headers: { 'Accept': 'application/json' } })
        console.log('Alternative endpoint status:', altRes.status)
        if (altRes.ok) {
          const altJson = await altRes.json()
          console.log('Alternative endpoint response keys:', Object.keys(altJson))
          return parseHistoricalResponse(altJson, priceId, timestamp)
        }
      } catch (altError: any) {
        console.error('Alternative endpoint error:', altError.message)
      }
    }
    
    throw new Error(`Pyth Benchmarks historical price failed: ${res.status} ${res.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`)
  }
  
  const responseText = await res.text()
  console.log('=== SUCCESSFUL HISTORICAL PRICE RESPONSE ===')
  console.log('Response length:', responseText.length)
  console.log('Response preview (first 1000 chars):', responseText.substring(0, 1000))
  console.log('===========================================')
  
  let jsonResponse: any
  try {
    jsonResponse = JSON.parse(responseText)
    console.log('Parsed JSON successfully. Keys:', Object.keys(jsonResponse))
  } catch (parseError) {
    console.error('Failed to parse as JSON:', parseError)
    console.error('Response might be binary/hex. Full response:', responseText)
    throw new Error('Historical price API returned non-JSON response')
  }
  
  return parseHistoricalResponse(jsonResponse, priceId, timestamp)
}

function parseHistoricalResponse(jsonResponse: any, priceId: string, timestamp: number): PythHistoricalPrice {
  console.log('Historical price API response structure:', { 
    isArray: Array.isArray(jsonResponse),
    keys: Object.keys(jsonResponse || {}),
    responsePreview: JSON.stringify(jsonResponse).substring(0, 500)
  })
  
  // The v1/updates/price endpoint may return different structures
  // Try to handle various response formats
  let f: any = undefined
  
  if (Array.isArray(jsonResponse)) {
    f = jsonResponse[0]
  } else if (jsonResponse?.parsed?.price_feeds) {
    // Alternative structure with parsed.price_feeds array
    f = jsonResponse.parsed.price_feeds[0]
  } else if (jsonResponse?.price_feeds) {
    f = jsonResponse.price_feeds[0]
  } else if (jsonResponse?.priceFeed) {
    f = jsonResponse.priceFeed
  } else {
    f = jsonResponse
  }
  
  if (!f) {
    console.error('Unable to extract price feed from response:', jsonResponse)
    throw new Error('Hermes response missing historical price')
  }
  
  // Handle both nested and flattened response structures (similar to fetchPythLatestPrice)
  const rawPrice = f.price?.price ?? f.price ?? f.parsed?.price ?? f.parsed?.price?.price
  const rawExpo = f.price?.expo ?? f.expo ?? f.parsed?.expo ?? f.parsed?.price?.expo
  const rawPublishTime = f.publish_time ?? f.publishTime ?? f.price?.publishTime ?? f.parsed?.publish_time ?? f.parsed?.publishTime
  
  console.log('Extracted raw values:', { rawPrice, rawExpo, rawPublishTime })
  
  const priceVal = Number(rawPrice)
  const expoVal = Number(rawExpo)
  const publishTimeVal = Number(rawPublishTime)
  
  if (!Number.isFinite(priceVal) || !Number.isFinite(expoVal)) {
    console.error('Invalid numeric values:', { priceVal, expoVal, rawPrice, rawExpo })
    throw new Error('Hermes returned non-numeric historical price or expo')
  }
  
  const result = {
    id: f.id ?? priceId,
    price: priceVal,
    expo: expoVal,
    publishTime: Number.isFinite(publishTimeVal) ? publishTimeVal : timestamp,
  }
  
  console.log('Historical price fetched successfully:', result)
  return result
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


