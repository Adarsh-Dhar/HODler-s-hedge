import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useTradingEnginePaused, useTradingEngineRefreshMarkPrice } from './use-trading'

/**
 * Optional hook for automatic periodic price updates from Pyth oracle
 * Only refreshes if contract is not paused and user is connected
 * Skips refresh if previous refresh is still pending
 */
export function useAutoRefreshMarkPrice(intervalMs: number = 60000) {
  const { address } = useAccount()
  const { data: isPaused } = useTradingEnginePaused()
  const { refreshMarkPrice, isPending, isConfirming } = useTradingEngineRefreshMarkPrice()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Don't refresh if:
    // - User not connected
    // - Contract is paused
    // - Previous refresh still pending
    if (!address || isPaused || isPending || isConfirming) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Set up interval
    intervalRef.current = setInterval(() => {
      // Double-check conditions before refreshing
      if (address && !isPaused && !isPending && !isConfirming) {
        refreshMarkPrice().catch((err) => {
          console.error('Auto price refresh failed:', err)
          // Don't throw - let interval continue
        })
      }
    }, intervalMs)

    // Initial refresh after mount (if conditions are met)
    if (address && !isPaused) {
      // Small delay to avoid immediate refresh on mount
      const timeout = setTimeout(() => {
        if (!isPending && !isConfirming) {
          refreshMarkPrice().catch((err) => {
            console.error('Initial auto price refresh failed:', err)
          })
        }
      }, 2000)

      return () => {
        clearTimeout(timeout)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [address, isPaused, isPending, isConfirming, intervalMs, refreshMarkPrice])

  return {
    isAutoRefreshing: !!intervalRef.current && !isPaused && !!address,
  }
}

