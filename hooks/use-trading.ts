import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { tradingEngineAddress, vaultAddress, fundingRateAddress } from '@/lib/address'
import { TradingEngineABI } from '@/lib/abi/TradingEngine'
import { VaultABI } from '@/lib/abi/Vault'
import { FundingRateABI } from '@/lib/abi/FundingRate'

// ============================================================================
// CONTRACT SETUP FUNCTIONS
// ============================================================================

export function useContractSetup() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const setupVaultReference = async () => {
    try {
      console.log('Setting up Vault tradingEngine reference...')
      await writeContract({
        address: vaultAddress,
        abi: VaultABI,
        functionName: 'setTradingEngine',
        args: [tradingEngineAddress],
      })
    } catch (err: any) {
      console.error('Error setting up Vault reference:', err)
      throw err
    }
  }
  
  const setupFundingRateReference = async () => {
    try {
      console.log('Setting up FundingRate tradingEngine reference...')
      await writeContract({
        address: fundingRateAddress,
        abi: FundingRateABI,
        functionName: 'setTradingEngine',
        args: [tradingEngineAddress],
      })
    } catch (err: any) {
      console.error('Error setting up FundingRate reference:', err)
      throw err
    }
  }
  
  const setupAllReferences = async () => {
    try {
      console.log('Setting up all contract references...')
      await setupVaultReference()
      await setupFundingRateReference()
      console.log('All contract references set up successfully!')
    } catch (err: any) {
      console.error('Error setting up contract references:', err)
      throw err
    }
  }
  
  return {
    setupVaultReference,
    setupFundingRateReference,
    setupAllReferences,
    hash,
    isPending,
    error,
  }
}

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

export function useTradingEngineOraclePrice() {
  // Returns tuple [price18, publishTime]
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'peekOraclePrice',
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
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { data: currentMarkPrice } = useTradingEngineMarkPrice()
  const publicClient = usePublicClient()
  
  const openPosition = async (isLong: boolean, marginAmount: bigint, leverage: bigint) => {
    try {
      console.log('Opening position with params:', {
        isLong,
        marginAmount: marginAmount.toString(),
        leverage: leverage.toString(),
        tradingEngineAddress
      })
      
      // Fetch current UI price
      const priceRes = await fetch('/api/price')
      if (!priceRes.ok) throw new Error(`Price fetch failed: ${priceRes.status}`)
      const { data } = await priceRes.json() as { data?: { price?: number } }
      const uiPrice = data?.price
      if (!uiPrice || !isFinite(uiPrice) || uiPrice <= 0) {
        throw new Error('Invalid price from API')
      }

      // Convert to uint256 (1e18) string for on-chain usage (client-side scaling)
      const scaledPrice: bigint = parseUnits(uiPrice.toString(), 18)
      const scaledPriceStr = scaledPrice.toString()

      // Post to route for validation/echo (no on-chain update server-side)
      const markPost = await fetch('/api/mark-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: scaledPriceStr })
      })
      if (!markPost.ok) {
        const err = await markPost.json().catch(() => ({}))
        throw new Error(`Mark price post failed: ${err?.error || markPost.status}`)
      }

      // Update markPrice on-chain from client wallet (must be contract owner)
      const setHash = await writeContractAsync({
        address: tradingEngineAddress,
        abi: TradingEngineABI,
        functionName: 'setMarkPrice',
        args: [scaledPrice],
      })
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: setHash })
      }

      // Check current on-chain markPrice (read from hook)
      const currentMarkPriceNum = currentMarkPrice ? Number(currentMarkPrice) / 1e18 : 0
      const priceDiff = currentMarkPriceNum > 0 ? Math.abs(uiPrice - currentMarkPriceNum) : 0
      const priceDiffPercent = currentMarkPriceNum > 0 
        ? (priceDiff / Math.max(uiPrice, currentMarkPriceNum)) * 100 
        : 0
      
      console.log('Price comparison:', {
        uiPrice,
        onChainMarkPrice: currentMarkPriceNum,
        difference: priceDiff,
        percentDiff: priceDiffPercent.toFixed(2) + '%'
      })
      
      // Warn if on-chain price is significantly different
      if (priceDiffPercent > 1 && currentMarkPriceNum > 0) {
        console.warn(`⚠️ On-chain markPrice ($${currentMarkPriceNum.toLocaleString()}) differs from current price ($${uiPrice.toLocaleString()}) by ${priceDiffPercent.toFixed(2)}%`)
        console.warn('⚠️ Entry price will be set to on-chain markPrice, not current market price')
        console.warn('⚠️ Owner must update markPrice via setMarkPrice() for accurate entry price')
      }
      
      console.log('Opening position. Entry price will be synced to:', uiPrice)
      
      // Open the position - entryPrice will be set to current on-chain markPrice
      await writeContractAsync({
        address: tradingEngineAddress,
        abi: TradingEngineABI,
        functionName: 'openPosition',
        args: [isLong, marginAmount, leverage],
      })
    } catch (err: any) {
      console.error('Error opening position:', err)
      
      // Provide more specific error messages
      if (err?.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction')
      } else if (err?.message?.includes('user rejected')) {
        throw new Error('Transaction rejected by user')
      } else if (err?.message?.includes('network')) {
        throw new Error('Network connection error. Please check your connection and try again.')
      } else if (err?.message?.includes('position already exists')) {
        throw new Error('You already have an open position. Close it before opening a new one.')
      } else if (err?.message?.includes('margin must be positive')) {
        throw new Error('Margin amount must be greater than 0')
      } else if (err?.message?.includes('Insufficient balance') || err?.message?.includes('insufficient balance')) {
        throw new Error('Insufficient vault balance. Please deposit more BTC to the vault first.')
      } else if (err?.message?.includes('Invalid leverage')) {
        throw new Error('Invalid leverage amount. Please use a leverage between 1 and 20.')
      } else if (err?.message?.includes('CALL_EXCEPTION') || err?.message?.includes('missing revert data')) {
        throw new Error('Transaction failed. Please check your vault balance and try again.')
      } else {
        throw new Error(err?.message || 'Failed to open position. Please try again.')
      }
    }
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
  console.log('useTradingEngineClosePosition')
  const { address: userAddress } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const updateMarkPrice = async () => {
    try {
      // Oracle flow disabled: optionally fetch price for logging only
      const priceRes = await fetch('/api/price')
      if (!priceRes.ok) throw new Error(`Price fetch failed: ${priceRes.status}`)
      const { data } = await priceRes.json()
      if (!data?.price) throw new Error('Price missing in response')
      return true
    } catch (e) {
      console.error('updateMarkPrice failed:', e)
      throw e
    }
  }
  
  // Check if user has a position before allowing close
  const { data: position, isLoading: positionLoading, error: positionError } = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'getPosition',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
  
  // Check if contract is paused
  const { data: isPaused, isLoading: pausedLoading, error: pausedError } = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'paused',
  })
  
  // Check Vault's tradingEngine reference
  const { data: vaultTradingEngine, isLoading: vaultRefLoading, error: vaultRefError } = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'tradingEngine',
  })
  
  // Check FundingRate's tradingEngine reference
  const { data: fundingTradingEngine, isLoading: fundingRefLoading, error: fundingRefError } = useReadContract({
    address: fundingRateAddress,
    abi: FundingRateABI,
    functionName: 'tradingEngine',
  })
  
  console.log('writeContract', writeContract)
  console.log('isPending', isPending)
  console.log('error', error)
  console.log('userAddress', userAddress)
  console.log('Position check:', {
    position: position,
    positionLoading,
    positionError,
    positionExists: (position as any)?.exists
  })
  console.log('Paused check:', {
    isPaused,
    pausedLoading,
    pausedError
  })
  console.log('Contract References:', {
    vaultTradingEngine,
    vaultRefLoading,
    vaultRefError,
    fundingTradingEngine,
    fundingRefLoading,
    fundingRefError,
    expectedTradingEngine: tradingEngineAddress,
    vaultRefCorrect: vaultTradingEngine === tradingEngineAddress,
    fundingRefCorrect: fundingTradingEngine === tradingEngineAddress
  })
  
  const closePosition = async () => {
    try {
      console.log('=== CLOSE POSITION DEBUG START ===')
      console.log('User Address:', userAddress)
      console.log('TradingEngine Address:', tradingEngineAddress)
      console.log('Vault Address:', vaultAddress)
      console.log('FundingRate Address:', fundingRateAddress)
      
      if (!userAddress) {
        throw new Error('No user address found')
      }
      
      // Check if we have a position
      if (!(position as any)?.exists) {
        throw new Error('No position found to close. You need to open a position first.')
      }
      
      // Check if contract is paused
      if (isPaused) {
        throw new Error('Contract is paused. Trading is temporarily disabled.')
      }
      
      // Check contract references
      if (vaultTradingEngine !== tradingEngineAddress) {
        throw new Error(`Vault contract reference incorrect. Expected: ${tradingEngineAddress}, Got: ${vaultTradingEngine}`)
      }
      
      if (fundingTradingEngine !== tradingEngineAddress) {
        throw new Error(`FundingRate contract reference incorrect. Expected: ${tradingEngineAddress}, Got: ${fundingTradingEngine}`)
      }
      
      console.log('Position details:', {
        exists: (position as any).exists,
        isLong: (position as any).isLong,
        entryPrice: (position as any).entryPrice?.toString(),
        size: (position as any).size?.toString(),
        margin: (position as any).margin?.toString(),
        leverage: (position as any).leverage?.toString()
      })
      
      console.log('Contract references validated:', {
        vaultTradingEngine,
        fundingTradingEngine,
        expectedTradingEngine: tradingEngineAddress
      })
      
      console.log('=== CLOSE POSITION DEBUG END ===')

      // Oracle disabled: skip on-chain mark price update (fetch used only for logging/consistency)
      await updateMarkPrice()

      // Now try the actual closePosition call
      console.log('Attempting closePosition call...')
      await writeContract({
        address: tradingEngineAddress,
        abi: TradingEngineABI,
        functionName: 'closePosition',
      })
      
    } catch (err: any) {
      console.error('=== CLOSE POSITION ERROR ===')
      console.error('Error type:', typeof err)
      console.error('Error message:', err?.message)
      console.error('Error code:', err?.code)
      console.error('Error reason:', err?.reason)
      console.error('Error data:', err?.data)
      console.error('Error details:', err?.details)
      console.error('Error shortMessage:', err?.shortMessage)
      console.error('Error cause:', err?.cause)
      console.error('Error stack:', err?.stack)
      console.error('Full error object:', JSON.stringify(err, null, 2))
      
      // Provide more specific error messages
      if (err?.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction')
      } else if (err?.message?.includes('user rejected')) {
        throw new Error('Transaction rejected by user')
      } else if (err?.message?.includes('network')) {
        throw new Error('Network connection error. Please check your connection and try again.')
      } else if (err?.message?.includes('No position to close') || err?.message?.includes('TradingEngine: No position to close')) {
        throw new Error('No position found to close. You may not have an open position.')
      } else if (err?.message?.includes('CALL_EXCEPTION') || err?.message?.includes('missing revert data')) {
        throw new Error('Transaction failed. This usually means you don\'t have an open position to close.')
      } else if (err?.message?.includes('revert') && err?.message?.includes('No position to close')) {
        throw new Error('No position found to close. You may not have an open position.')
      } else if (err?.message?.includes('Contract is paused') || err?.message?.includes('paused')) {
        throw new Error('Trading is currently paused. Please try again later.')
      } else if (err?.message?.includes('estimateGas')) {
        throw new Error('Cannot estimate gas for closing position. This usually means you don\'t have an open position.')
      } else if (err?.message?.includes('Vault: Only TradingEngine')) {
        throw new Error('Vault contract authorization failed. Contract references may be incorrect.')
      } else if (err?.message?.includes('FundingRate: Only TradingEngine')) {
        throw new Error('FundingRate contract authorization failed. Contract references may be incorrect.')
      } else {
        throw new Error(err?.message || 'Failed to close position. Please try again.')
      }
    }
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
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const publicClient = usePublicClient()
  
  const liquidate = async (userAddress: `0x${string}`) => {
    const txHash = await writeContractAsync({
      address: tradingEngineAddress,
      abi: TradingEngineABI,
      functionName: 'liquidate',
      args: [userAddress],
    })
    if (!publicClient) return { txHash }
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    // Parse Liquidated event from logs (reward is in MUSD, 1e18 decimals)
    let reward: bigint | undefined
    let liquidator: `0x${string}` | undefined
    let liquidatedUser: `0x${string}` | undefined
    try {
      const logs = receipt.logs || []
      for (const log of logs) {
        try {
          const parsed = (window as any)?.viem?.decodeEventLog
            ? (window as any).viem.decodeEventLog({ abi: TradingEngineABI as any, ...log })
            : null
          if (parsed && parsed.eventName === 'Liquidated') {
            liquidatedUser = parsed.args.user
            liquidator = parsed.args.liquidator
            reward = parsed.args.reward
            break
          }
        } catch (_) {
          // ignore non-matching logs
        }
      }
    } catch (_) {}

    return { txHash, receipt, reward, liquidator, liquidatedUser }
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

  const liquidationBonus = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'LIQUIDATION_BONUS',
  })

  return {
    maxLeverage,
    maintenanceMarginRatio,
    tradingFee,
    liquidationBonus,
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
  const positionQuery = useTradingEnginePosition(userAddress)
  const liquidationPrice = useTradingEngineLiquidationPrice(userAddress)
  const isLiquidatable = useTradingEngineIsLiquidatable(userAddress)

  return {
    position: positionQuery,
    refetchPosition: positionQuery.refetch,
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
