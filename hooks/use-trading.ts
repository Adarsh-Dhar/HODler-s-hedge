import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, parseEther, decodeErrorResult, formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { tradingEngineAddress, vaultAddress, fundingRateAddress } from '@/lib/address'
import { TradingEngineABI } from '@/lib/abi/TradingEngine'
import { VaultABI } from '@/lib/abi/Vault'
import { FundingRateABI } from '@/lib/abi/FundingRate'
import { fetchPythLatestUpdateHex } from '@/lib/pyth'

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

export function useTradingEnginePythOracle() {
  return useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'pythOracle',
  })
}

// ============================================================================
// ORACLE PRICE REFRESH
// ============================================================================

export function useTradingEngineRefreshMarkPrice() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const publicClient = usePublicClient()
  
  const refreshMarkPrice = async () => {
    try {
      // Pre-flight diagnostic checks
      console.log('=== REFRESH MARK PRICE PRE-FLIGHT CHECKS ===')
      
      if (!publicClient) {
        throw new Error('Public client not available. Cannot check contract state.')
      }
      
      // Check if contract is paused
      let isPaused: boolean = false
      try {
        isPaused = await publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'paused',
        }) as boolean
        console.log('Contract paused status:', isPaused)
        if (isPaused) {
          throw new Error('Contract is paused. Trading is temporarily disabled.')
        }
      } catch (pauseErr: any) {
        if (pauseErr?.message?.includes('paused')) {
          throw pauseErr
        }
        console.warn('Could not check paused status:', pauseErr?.message)
      }
      
      // Check if Pyth oracle is configured
      let pythOracleAddress: `0x${string}` | undefined
      try {
        pythOracleAddress = await publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'pythOracle',
        }) as `0x${string}`
        console.log('Pyth oracle address:', pythOracleAddress)
        
        if (!pythOracleAddress || pythOracleAddress === '0x0000000000000000000000000000000000000000') {
          throw new Error('Pyth oracle not configured. Oracle address is zero. Please contact the contract owner.')
        }
      } catch (oracleErr: any) {
        if (oracleErr?.message?.includes('oracle not configured')) {
          throw oracleErr
        }
        console.warn('Could not check oracle address:', oracleErr?.message)
        throw new Error('Failed to verify oracle configuration. Please contact support.')
      }
      
      // Check current mark price (for diagnostics)
      let markPrice: bigint | undefined
      try {
        markPrice = await publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'getMarkPrice',
        }) as bigint
        console.log('Current mark price:', markPrice?.toString(), `(${markPrice ? Number(markPrice) / 1e18 : 'N/A'} USD)`)
      } catch (markPriceErr: any) {
        console.warn('Could not read mark price:', markPriceErr?.message)
      }
      
      console.log('Pre-flight checks passed. Proceeding with price refresh...')
      
      // 1. Fetch Hermes update bytes
      console.log('Fetching Pyth Hermes update bytes...')
      const updateBytes = await fetchPythLatestUpdateHex()
      
      if (!Array.isArray(updateBytes) || updateBytes.length === 0) {
        throw new Error('Failed to fetch Hermes update bytes')
      }
      
      // 2. Estimate fee (use reasonable buffer, excess refunded by contract)
      const feeEstimate = parseEther('0.001') // 0.001 ETH buffer
      
      console.log('Calling refreshMarkPrice with Hermes bytes...', {
        updateBytesCount: updateBytes.length,
        feeEstimate: feeEstimate.toString(),
        pythOracleAddress,
        currentMarkPrice: markPrice ? Number(markPrice) / 1e18 : 'N/A'
      })
      
      // 3. Call refreshMarkPrice with bytes and ETH for fee
      try {
        const txHash = await writeContractAsync({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'refreshMarkPrice',
          args: [updateBytes],
          value: feeEstimate, // Pyth will use what it needs and refund excess
        })
        
        // 4. Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash })
        }
        
        console.log('Price refresh successful')
      } catch (writeError: any) {
        console.error('=== REFRESH MARK PRICE WRITE ERROR ===')
        console.error('Write error:', writeError)
        
        // Try to decode error from multiple possible locations
        let decodedError: any = null
        let errorData: `0x${string}` | undefined
        
        // Check various error data locations - viem error structure can vary
        if (writeError?.cause?.data) {
          errorData = writeError.cause.data
        } else if (writeError?.data) {
          errorData = writeError.data
        } else if (writeError?.cause?.reason?.data) {
          errorData = writeError.cause.reason.data
        } else if (writeError?.cause?.data?.data) {
          errorData = writeError.cause.data.data
        }
        
        if (errorData && errorData.startsWith('0x')) {
          try {
            decodedError = decodeErrorResult({
              abi: TradingEngineABI,
              data: errorData,
            })
            console.log('Decoded error from refreshMarkPrice:', decodedError)
            
            // Re-throw with decoded information
            const errorName = decodedError.errorName || 'UnknownError'
            const argsStr = decodedError.args ? ` Args: ${JSON.stringify(decodedError.args)}` : ''
            throw new Error(`Oracle update failed: ${errorName}${argsStr}`)
          } catch (decodeErr) {
            console.log('Could not decode refreshMarkPrice error:', decodeErr)
            // Continue to throw original error
          }
        }
        
        // If we couldn't decode, throw the original error to be handled below
        throw writeError
      }
    } catch (err: any) {
      console.error('=== REFRESH MARK PRICE ERROR ===')
      console.error('Error type:', typeof err)
      console.error('Error message:', err?.message)
      console.error('Error cause:', err?.cause)
      console.error('Error data:', err?.data)
      console.error('Error code:', err?.code)
      console.error('Error name:', err?.name)
      console.error('Error shortMessage:', err?.shortMessage)
      
      // Log transaction details if available (from gas estimation error)
      if (err?.transaction) {
        console.error('Transaction details:', {
          to: err.transaction.to,
          from: err.transaction.from,
          dataLength: err.transaction.data?.length || 0,
        })
      }
      
      console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
      
      // Provide user-friendly error messages
      if (err?.message?.includes('Oracle update failed:')) {
        // Already formatted error from decoded contract error
        throw err
      } else if (err?.message?.includes('Public client not available')) {
        // Pre-flight check failure
        throw err
      } else if (err?.message?.includes('Contract is paused')) {
        // Pre-flight check failure
        throw err
      } else if (err?.message?.includes('oracle not configured') || err?.message?.includes('Oracle address is zero') || err?.message?.includes('Failed to verify oracle')) {
        // Pre-flight check failure
        throw err
      } else if (err?.message?.includes('Hermes') || err?.message?.includes('fetch')) {
        throw new Error('Failed to fetch price update from Hermes. Please check your network connection and try again.')
      } else if (err?.message?.includes('insufficient fee') || err?.message?.includes('insufficient funds')) {
        throw new Error('Insufficient ETH for Pyth update fee. Please ensure you have enough ETH for the transaction.')
      } else if (err?.message?.includes('oracle returned zero') || err?.message?.includes('oracle not set')) {
        throw new Error('Oracle not configured. Please contact the contract owner.')
      } else if (err?.message?.includes('oracle move too large')) {
        throw new Error('Price update rejected: price change too large. This protects against oracle manipulation.')
      } else if (err?.message?.includes('paused') || err?.message?.includes('Paused')) {
        throw new Error('Contract is paused. Trading is temporarily disabled.')
      } else if (err?.message?.includes('user rejected') || err?.message?.includes('User rejected')) {
        throw new Error('Transaction rejected by user')
      } else if (err?.message?.includes('CALL_EXCEPTION') || err?.message?.includes('missing revert data') || err?.code === 'CALL_EXCEPTION') {
        // Enhanced error message for missing revert data during oracle update
        // Note: Pre-flight checks should have caught most common issues, so this suggests:
        // - Price change too large (oracle move protection)
        // - Pyth oracle contract itself is reverting
        // - Invalid/expired update bytes
        let diagnosticMessage = 'Oracle price update failed during gas estimation (missing revert data).\n\n'
        diagnosticMessage += 'Pre-flight checks passed, but transaction still failed. Possible causes:\n'
        diagnosticMessage += '• Price change too large (oracle move protection)\n'
        diagnosticMessage += '• Invalid or expired Pyth update bytes\n'
        diagnosticMessage += '• Pyth oracle contract error\n'
        diagnosticMessage += '• Insufficient ETH for Pyth update fee\n\n'
        diagnosticMessage += 'Check the console logs for detailed diagnostic information.'
        
        throw new Error(diagnosticMessage)
      } else {
        throw new Error(err?.message || 'Failed to refresh price from oracle. Please try again.')
      }
    }
  }
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })
  
  return {
    refreshMarkPrice,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

// ============================================================================
// TRADING ACTIONS
// ============================================================================

export function useTradingEngineOpenPosition() {
  const { address: userAddress } = useAccount()
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const publicClient = usePublicClient()
  const { refreshMarkPrice } = useTradingEngineRefreshMarkPrice()
  
  // Pre-flight checks
  const { data: isPaused } = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'paused',
  })
  
  const { data: position } = useReadContract({
    address: tradingEngineAddress,
    abi: TradingEngineABI,
    functionName: 'getPosition',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
  
  const openPosition = async (isLong: boolean, marginAmount: bigint, leverage: bigint) => {
    try {
      console.log('=== OPEN POSITION DEBUG START ===')
      console.log('Opening position with params:', {
        isLong,
        marginAmount: marginAmount.toString(),
        leverage: leverage.toString(),
        marginAmountFormatted: formatUnits(marginAmount, 8),
        tradingEngineAddress,
        userAddress
      })
      
      // Pre-flight validations
      if (!userAddress) {
        throw new Error('No user address found. Please connect your wallet.')
      }
      
      if (marginAmount <= BigInt(0)) {
        throw new Error('Margin amount must be greater than 0')
      }
      
      if (leverage < BigInt(1) || leverage > BigInt(20)) {
        throw new Error('Invalid leverage. Must be between 1 and 20.')
      }
      
      // Check if contract is paused
      if (isPaused) {
        throw new Error('Contract is paused. Trading is temporarily disabled.')
      }
      
      // Check if user already has a position
      if ((position as any)?.exists) {
        throw new Error('You already have an open position. Close it before opening a new one.')
      }
      
      // REQUIRED: Refresh mark price from Pyth oracle before opening position
      // This ensures the on-chain price is accurate and verified cryptographically
      console.log('Refreshing mark price from Pyth oracle...')
      try {
        await refreshMarkPrice()
        console.log('Price refresh successful, proceeding with position opening...')
      } catch (refreshError: any) {
        console.error('Price refresh failed, blocking position opening:', refreshError)
        // NO FALLBACK: Block trade if refresh fails
        throw new Error(`Cannot open position: Price refresh failed. ${refreshError?.message || 'Oracle update failed. Please try again.'}`)
      }
      
      // Simulate the contract call first to catch errors early
      console.log('Simulating contract call...')
      try {
        if (publicClient) {
          await publicClient.simulateContract({
            address: tradingEngineAddress as `0x${string}`,
            abi: TradingEngineABI,
            functionName: 'openPosition',
            args: [isLong, marginAmount, leverage],
            account: userAddress,
          })
          console.log('Simulation successful')
        }
      } catch (simulateError: any) {
        console.error('Contract simulation failed:', simulateError)
        
        // Try to decode the error
        let errorMessage = simulateError?.message || 'Transaction simulation failed'
        
        if (simulateError?.cause) {
          try {
            // Try to decode revert reason from error data
            if (simulateError.cause.data) {
              const decoded = decodeErrorResult({
                abi: TradingEngineABI,
                data: simulateError.cause.data as `0x${string}`,
              })
              errorMessage = decoded.errorName || errorMessage
              console.log('Decoded error:', decoded)
            }
          } catch (decodeErr) {
            console.log('Could not decode error:', decodeErr)
          }
        }
        
        // Map common error patterns
        if (errorMessage.includes('Position already exists') || errorMessage.includes('position already exists')) {
          throw new Error('You already have an open position. Close it before opening a new one.')
        } else if (errorMessage.includes('Margin must be positive') || errorMessage.includes('margin must be positive')) {
          throw new Error('Margin amount must be greater than 0')
        } else if (errorMessage.includes('Invalid leverage') || errorMessage.includes('invalid leverage')) {
          throw new Error('Invalid leverage amount. Please use a leverage between 1 and 20.')
        } else if (errorMessage.includes('Contract is paused') || errorMessage.includes('paused')) {
          throw new Error('Contract is paused. Trading is temporarily disabled.')
        } else if (errorMessage.includes('oracle/mark divergence') || errorMessage.includes('oracle move too large')) {
          throw new Error('Oracle price divergence detected. Please try again in a moment.')
        } else if (errorMessage.includes('OI cap') || errorMessage.includes('open interest')) {
          throw new Error('Maximum open interest reached. Please try again later.')
        } else if (errorMessage.includes('insufficient balance') || errorMessage.includes('Insufficient balance')) {
          throw new Error('Insufficient vault balance. Please deposit more BTC to the vault first.')
        } else if (errorMessage.includes('oracle not set') || errorMessage.includes('oracle returned zero')) {
          throw new Error('Oracle not configured properly. Please contact support.')
        } else if (errorMessage.includes('Vault: Only TradingEngine') || errorMessage.includes('Unauthorized')) {
          throw new Error('Contract configuration error. Vault reference may be incorrect.')
        } else {
          throw new Error(`Transaction will fail: ${errorMessage}`)
        }
      }
      
      // Open the position - entryPrice will use the freshly updated on-chain markPrice
      console.log('Executing openPosition transaction...')
      try {
        await writeContractAsync({
          address: tradingEngineAddress as `0x${string}`,
          abi: TradingEngineABI,
          functionName: 'openPosition',
          args: [isLong, marginAmount, leverage],
        })
        
        console.log('Transaction submitted')
        console.log('=== OPEN POSITION DEBUG END ===')
        // Note: hash is tracked via useWriteContract and returned from the hook
      } catch (writeError: any) {
        console.error('=== WRITE CONTRACT ERROR ===')
        console.error('Write error:', writeError)
        
        // Try to decode error from multiple possible locations
        let decodedError: any = null
        let errorData: `0x${string}` | undefined
        
        // Check various error data locations - viem error structure can vary
        if (writeError?.cause?.data) {
          errorData = writeError.cause.data
        } else if (writeError?.data) {
          errorData = writeError.data
        } else if (writeError?.cause?.reason?.data) {
          errorData = writeError.cause.reason.data
        } else if (writeError?.cause?.data?.data) {
          errorData = writeError.cause.data.data
        }
        
        if (errorData && errorData.startsWith('0x')) {
          try {
            decodedError = decodeErrorResult({
              abi: TradingEngineABI,
              data: errorData,
            })
            console.log('Decoded error from writeContract:', decodedError)
            
            // Re-throw with decoded information
            const errorName = decodedError.errorName || 'UnknownError'
            const argsStr = decodedError.args ? ` Args: ${JSON.stringify(decodedError.args)}` : ''
            throw new Error(`Contract error: ${errorName}${argsStr}`)
          } catch (decodeErr) {
            console.log('Could not decode writeContract error:', decodeErr)
            // Continue to throw original error
          }
        }
        
        // If we couldn't decode, throw the original error to be handled below
        throw writeError
      }
    } catch (err: any) {
      console.error('=== OPEN POSITION ERROR ===')
      console.error('Error type:', typeof err)
      console.error('Error message:', err?.message)
      console.error('Error cause:', err?.cause)
      console.error('Error data:', err?.data)
      console.error('Error code:', err?.code)
      console.error('Error name:', err?.name)
      console.error('Error shortMessage:', err?.shortMessage)
      
      // Log transaction details if available (from gas estimation error)
      if (err?.transaction) {
        console.error('Transaction details:', {
          to: err.transaction.to,
          from: err.transaction.from,
          dataLength: err.transaction.data?.length || 0,
        })
      }
      
      console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
      
      // Provide more specific error messages
      if (err?.message?.includes('Price refresh failed') || err?.message?.includes('Cannot open position')) {
        // Already formatted error from refresh failure
        throw err
      } else if (err?.message?.includes('Contract error:')) {
        // Already formatted error from decoded contract error
        throw err
      } else if (err?.message?.includes('insufficient funds') || err?.message?.includes('gas')) {
        throw new Error('Insufficient funds for transaction. Please ensure you have enough ETH for gas.')
      } else if (err?.message?.includes('user rejected') || err?.message?.includes('User rejected')) {
        throw new Error('Transaction rejected by user')
      } else if (err?.message?.includes('network') || err?.message?.includes('Network')) {
        throw new Error('Network connection error. Please check your connection and try again.')
      } else if (err?.message?.includes('Transaction will fail')) {
        // Already formatted from simulation
        throw err
      } else if (err?.message?.includes('CALL_EXCEPTION') || err?.message?.includes('missing revert data') || err?.code === 'CALL_EXCEPTION') {
        // Enhanced error message for missing revert data
        let diagnosticMessage = 'Transaction failed during gas estimation (missing revert data).\n\n'
        diagnosticMessage += 'Common causes:\n'
        diagnosticMessage += '• Insufficient vault balance\n'
        diagnosticMessage += '• Existing position not closed\n'
        diagnosticMessage += '• Contract is paused\n'
        diagnosticMessage += '• Oracle not configured or price too stale\n'
        diagnosticMessage += '• Vault/TradingEngine reference mismatch\n'
        diagnosticMessage += '• Open interest cap reached\n\n'
        diagnosticMessage += 'Please check your vault balance and contract state.'
        
        throw new Error(diagnosticMessage)
      } else {
        // Pass through the error message if it's already user-friendly
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
  
  const { refreshMarkPrice } = useTradingEngineRefreshMarkPrice()
  
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

      // REQUIRED: Refresh mark price from Pyth oracle before closing position
      // This ensures the exit price is accurate and verified cryptographically
      console.log('Refreshing mark price from Pyth oracle...')
      try {
        await refreshMarkPrice()
        console.log('Price refresh successful, proceeding with position closing...')
      } catch (refreshError: any) {
        console.error('Price refresh failed, blocking position closing:', refreshError)
        // NO FALLBACK: Block close if refresh fails
        throw new Error(`Cannot close position: Price refresh failed. ${refreshError?.message || 'Oracle update failed. Please try again.'}`)
      }

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
// ADMIN SETTERS FOR TRADING ENGINE
// ============================================================================

export function useTESetProtocolFeeBps() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setProtocolFeeBps = (bps: bigint) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setProtocolFeeBps', args: [bps] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setProtocolFeeBps, hash, isPending, isConfirming, isConfirmed, error }
}

export function useTESetMaxOpenInterestTbtc() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setMaxOpenInterestTbtc = (amount: bigint) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setMaxOpenInterestTbtc', args: [amount] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setMaxOpenInterestTbtc, hash, isPending, isConfirming, isConfirmed, error }
}

export function useTESetMaxOracleMoveBps() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setMaxOracleMoveBps = (bps: bigint) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setMaxOracleMoveBps', args: [bps] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setMaxOracleMoveBps, hash, isPending, isConfirming, isConfirmed, error }
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
// NEW: TRADING ENGINE ADMIN SETTERS
// ============================================================================

export function useEngineSetTreasury() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setTreasury = (addr: `0x${string}`) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setTreasury', args: [addr] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setTreasury, hash, isPending, isConfirming, isConfirmed, error }
}

export function useEngineSetProtocolFeeBps() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setProtocolFeeBps = (bps: bigint) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setProtocolFeeBps', args: [bps] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setProtocolFeeBps, hash, isPending, isConfirming, isConfirmed, error }
}

export function useEngineSetMaxOpenInterestTbtc() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setMaxOpenInterestTbtc = (amountTbtc: bigint) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setMaxOpenInterestTbtc', args: [amountTbtc] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setMaxOpenInterestTbtc, hash, isPending, isConfirming, isConfirmed, error }
}

export function useEngineSetMaxOracleMoveBps() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setMaxOracleMoveBps = (bps: bigint) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setMaxOracleMoveBps', args: [bps] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setMaxOracleMoveBps, hash, isPending, isConfirming, isConfirmed, error }
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
