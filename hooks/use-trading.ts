import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { tradingEngineAddress } from '@/lib/address'
import { TradingEngineABI } from '@/lib/abi/TradingEngine'

// ============================================================================
// TRADING ENGINE HOOKS
// ============================================================================

export function useTradingEnginePosition(userAddress?: `0x${string}`) {
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'getPosition',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
}

export function useTradingEngineMarkPrice() {
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'getMarkPrice',
  })
}

export function useTradingEngineLiquidationPrice(userAddress?: `0x${string}`) {
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'calculateLiquidationPrice',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
}

export function useTradingEngineIsLiquidatable(userAddress?: `0x${string}`) {
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'isLiquidatable',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
}

export function useTradingEnginePaused() {
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'paused',
  })
}

// ============================================================================
// TRADING ACTIONS
// ============================================================================

export function useTradingEngineOpenPosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const openPosition = (isLong: boolean, marginAmount: bigint, leverage: bigint) => {
    writeContract({
      address: tradingEngineAddress,
      abi: TradingEngineABI,
      functionName: 'openPosition',
      args: [isLong, marginAmount, leverage],
    })
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    openPosition,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useTradingEngineClosePosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const closePosition = () => {
    writeContract({
      address: tradingEngineAddress,
      abi: TradingEngineABI,
      functionName: 'closePosition',
    })
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    closePosition,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useTradingEngineLiquidate() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const liquidate = (userAddress: `0x${string}`) => {
    writeContract({
      address: tradingEngineAddress,
      abi: TradingEngineABI,
      functionName: 'liquidate',
      args: [userAddress],
    })
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    liquidate,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

// ============================================================================
// TRADING CONSTANTS
// ============================================================================

export function useTradingEngineConstants() {
  const maxLeverage = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'MAX_LEVERAGE',
  })

  const maintenanceMarginRatio = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'MAINTENANCE_MARGIN_RATIO',
  })

  const tradingFee = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'TRADING_FEE',
  })

  return {
    maxLeverage,
    maintenanceMarginRatio,
    tradingFee,
  }
}

// ============================================================================
// TRADING UTILITY HOOKS
// ============================================================================

export function useTradingEngineInfo() {
  const markPrice = useTradingEngineMarkPrice()
  const paused = useTradingEnginePaused()
  const constants = useTradingEngineConstants()

  return {
    markPrice,
    paused,
    constants,
    address: tradingEngineAddress,
  }
}

export function useTradingEnginePositionInfo(userAddress?: `0x${string}`) {
  const position = useTradingEnginePosition(userAddress)
  const liquidationPrice = useTradingEngineLiquidationPrice(userAddress)
  const isLiquidatable = useTradingEngineIsLiquidatable(userAddress)

  return {
    position,
    liquidationPrice,
    isLiquidatable,
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Position = {
  isLong: boolean
  entryPrice: bigint
  size: bigint
  margin: bigint
  leverage: bigint
  openTimestamp: bigint
  exists: boolean
}
