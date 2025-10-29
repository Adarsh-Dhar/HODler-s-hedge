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
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Hermes latest update failed: ${res.status}`)
  const json = await res.json()
  // Hermes returns updates under .binary.data (array of hex)
  const data: string[] = json?.binary?.data || json?.data || []
  if (!Array.isArray(data) || data.length === 0) throw new Error('Hermes response missing update bytes')
  return data
}

// Helper to normalize to 1e18
export function normalizeTo1e18(price: number, expo: number): number {
  // expo is negative typically; price_normalized = price * 10^(18+expo)
  const scale = Math.pow(10, 18 + expo)
  return price * scale
}


