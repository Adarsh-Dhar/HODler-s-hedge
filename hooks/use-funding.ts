import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { fundingRateAddress } from '@/lib/address'
import { FundingRateABI } from '@/lib/abi/FundingRate'

// ============================================================================
// FUNDING RATE HOOKS
// ============================================================================

export function useFundingRate() {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'getFundingRate',
  })
}

export function useFundingRateNextTime() {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'getNextFundingTime',
  })
}

export function useFundingRateIsDue() {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'isFundingDue',
  })
}

export function useFundingRateLastUpdateTime() {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'lastUpdateTime',
  })
}

export function useFundingRateTradingEngine() {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'tradingEngine',
  })
}

// ============================================================================
// FUNDING CALCULATIONS
// ============================================================================

export function useFundingRateCalculatePayment(positionSize: bigint, isLong: boolean) {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'calculateFundingPayment',
    args: [positionSize, isLong],
    query: {
      enabled: positionSize > BigInt(0),
    },
  })
}

// ============================================================================
// FUNDING ACTIONS
// ============================================================================

export function useFundingRateApplyPayment(positionSize: bigint, isLong: boolean) {
  return useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'applyFundingPayment',
    args: [positionSize, isLong],
    query: {
      enabled: positionSize > BigInt(0),
    },
  })
}

// ============================================================================
// FUNDING CONSTANTS
// ============================================================================

export function useFundingRateConstants() {
  const fundingInterval = useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'getFundingInterval',
  })

  return {
    fundingInterval,
  }
}

// ============================================================================
// FUNDING UTILITY HOOKS
// ============================================================================

export function useFundingRateInfo() {
  const fundingRate = useFundingRate()
  const nextTime = useFundingRateNextTime()
  const isDue = useFundingRateIsDue()
  const lastUpdateTime = useFundingRateLastUpdateTime()
  const tradingEngine = useFundingRateTradingEngine()
  const constants = useFundingRateConstants()

  return {
    fundingRate,
    nextTime,
    isDue,
    lastUpdateTime,
    tradingEngine,
    constants,
    address: fundingRateAddress,
  }
}

export function useFundingRateStatus() {
  const isDue = useFundingRateIsDue()
  const nextTime = useFundingRateNextTime()
  const lastUpdateTime = useFundingRateLastUpdateTime()

  return {
    isDue,
    nextTime,
    lastUpdateTime,
  }
}

// ============================================================================
// FUNDING CALCULATION UTILITIES
// ============================================================================

export function useFundingRateForPosition(positionSize: bigint, isLong: boolean) {
  const fundingPayment = useFundingRateCalculatePayment(positionSize, isLong)
  const fundingRate = useFundingRate()

  return {
    fundingPayment,
    fundingRate,
    positionSize,
    isLong,
  }
}
