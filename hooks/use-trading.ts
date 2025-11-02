import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, parseEther, decodeErrorResult, formatUnits, encodeFunctionData } from 'viem'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
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
      await setupVaultReference()
      await setupFundingRateReference()
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
  const { address: userAddress } = useAccount()
  const { syncMarkPrice } = useTradingEngineSyncMarkPriceFromOracle()
  
  const refreshMarkPrice = async () => {
    try {
      // Pre-flight diagnostic checks
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
      } catch (markPriceErr: any) {
        console.warn('Could not read mark price:', markPriceErr?.message)
      }

      // Check maxOracleMoveBps (oracle move protection)
      let maxOracleMoveBps: bigint | undefined
      try {
        maxOracleMoveBps = await publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'maxOracleMoveBps',
        }) as bigint
      } catch (maxMoveErr: any) {
        console.warn('Could not read maxOracleMoveBps:', maxMoveErr?.message)
      }

      // Try to peek at oracle price (tests PythOracle.getBtcUsdPrice without updating)
      let oraclePriceBefore: bigint | undefined
      let oraclePublishTime: bigint | undefined
      try {
        const peekResult = await publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'peekOraclePrice',
        }) as [bigint, bigint]
        oraclePriceBefore = peekResult[0]
        oraclePublishTime = peekResult[1]
      } catch (peekErr: any) {
        console.error('✗ Oracle price peek failed:', peekErr?.message)
        console.error('This suggests the Pyth contract may not have the price feed updated yet.')
        console.error('Full peek error:', peekErr)
        
        // If peek fails, it likely means price feed hasn't been updated in Pyth contract
        if (peekErr?.message?.includes('not set') || peekErr?.message?.includes('revert') || peekErr?.shortMessage?.includes('execution reverted')) {
          throw new Error('Oracle price feed not available. The Pyth contract may need to be updated first. Error: ' + peekErr?.message)
        }
      }

      // Check if PythOracle contract exists by trying to read owner
      try {
        // Try to get bytecode to verify contract exists
        const bytecode = await publicClient.getBytecode({ address: pythOracleAddress })
        if (!bytecode || bytecode === '0x') {
          throw new Error('PythOracle contract does not exist at the configured address')
        }
      } catch (verifyErr: any) {
        console.error('✗ PythOracle contract verification failed:', verifyErr?.message)
        throw new Error('PythOracle contract verification failed: ' + verifyErr?.message)
      }
      
      // Check price freshness AND divergence before attempting refresh
      // Only skip refresh if price is fresh AND on-chain mark price matches oracle
      const MAX_FRESH_AGE_SECONDS = 3600 // 1 hour
      const MAX_PRICE_DIVERGENCE_BPS = 100 // 1% divergence threshold
      
      if (oraclePriceBefore && oraclePublishTime && markPrice) {
        const ageSeconds = Math.floor(Date.now() / 1000) - Number(oraclePublishTime)
        const ageMinutes = Math.floor(ageSeconds / 60)
        
        // Calculate price divergence between oracle and on-chain mark price
        const priceDiff = oraclePriceBefore > markPrice 
          ? oraclePriceBefore - markPrice 
          : markPrice - oraclePriceBefore
        const priceDivergenceBps = Number((priceDiff * BigInt(10000)) / markPrice)
        
        // Only skip refresh if BOTH conditions are met:
        // 1. Price is fresh (recently published)
        // 2. On-chain mark price matches oracle price (within 1% divergence)
        if (ageSeconds < MAX_FRESH_AGE_SECONDS && ageSeconds >= 0 && 
            priceDivergenceBps < MAX_PRICE_DIVERGENCE_BPS) {
          console.log(`Skipping refresh: price is fresh (${ageMinutes}m old) and mark price matches oracle (${(priceDivergenceBps / 100).toFixed(2)}% divergence)`)
          return // Exit early - price is fresh AND matches, no refresh needed
        } else {
          if (priceDivergenceBps >= MAX_PRICE_DIVERGENCE_BPS) {
            console.warn(`⚠️ Price divergence detected: ${(priceDivergenceBps / 100).toFixed(2)}% > ${(MAX_PRICE_DIVERGENCE_BPS / 100).toFixed(2)}%. Refreshing mark price...`)
            console.warn(`   Oracle: $${(Number(oraclePriceBefore) / 1e18).toFixed(2)}, Mark: $${(Number(markPrice) / 1e18).toFixed(2)}`)
          }
          if (ageSeconds < 0) {
            console.warn('⚠️ Warning: Price timestamp is in the future. This may indicate a clock sync issue.')
          } else if (ageSeconds >= MAX_FRESH_AGE_SECONDS) {
            console.warn(`⚠️ Price is stale (${ageMinutes} minutes old). Attempting refresh...`)
            console.warn('Note: Refresh may fail due to Mezo testnet Pyth contract rejecting Hermes bytes.')
          }
        }
      } else if (!oraclePriceBefore) {
        console.warn('⚠️ No oracle price found. Attempting refresh (this may fail)...')
      } else if (!markPrice) {
        console.warn('⚠️ No mark price found. Attempting refresh...')
      }
      
      // 1. Fetch Hermes update bytes
      const updateBytes = await fetchPythLatestUpdateHex()
      
      if (!Array.isArray(updateBytes) || updateBytes.length === 0) {
        throw new Error('Failed to fetch Hermes update bytes')
      }
      
      // Validate and format update bytes
      const validatedBytes: `0x${string}`[] = []
      for (let i = 0; i < updateBytes.length; i++) {
        const byteStr = updateBytes[i]
        if (typeof byteStr !== 'string') {
          throw new Error(`Update byte at index ${i} is not a string: ${typeof byteStr}`)
        }
        // Ensure it starts with 0x and is a valid hex string
        let formattedByte: `0x${string}`
        if (byteStr.startsWith('0x')) {
          formattedByte = byteStr as `0x${string}`
        } else {
          formattedByte = `0x${byteStr}` as `0x${string}`
        }
        // Validate hex format
        if (!/^0x[0-9a-fA-F]+$/.test(formattedByte)) {
          throw new Error(`Update byte at index ${i} is not valid hex: ${byteStr.substring(0, 20)}...`)
        }
        validatedBytes.push(formattedByte)
      }
      
      // 2. Estimate fee (use reasonable buffer, excess refunded by contract)
      // Try higher fee first if previous attempts failed
      let feeEstimate = parseEther('0.001') // 0.001 ETH buffer
      
      if (markPrice && oraclePriceBefore) {
        const priceDiff = oraclePriceBefore > markPrice 
          ? oraclePriceBefore - markPrice 
          : markPrice - oraclePriceBefore
        const priceDiffPercent = Number((priceDiff * BigInt(10000)) / markPrice)
        if (maxOracleMoveBps && maxOracleMoveBps > BigInt(0) && priceDiffPercent > Number(maxOracleMoveBps)) {
          console.error('⚠️ WARNING: Price difference exceeds maxOracleMoveBps!')
          console.error(`Price diff: ${priceDiffPercent / 100}% > Max allowed: ${Number(maxOracleMoveBps) / 100}%`)
        }
      }

      // 3. First try simulateContract to get better error information
      try {
        if (!userAddress) {
          throw new Error('User address required for simulation')
        }
        
        // Use simulateContract which gives better error information than estimateGas
        // Use validated bytes instead of raw updateBytes
        const simulation = await publicClient.simulateContract({
          account: userAddress,
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'refreshMarkPrice',
          args: [validatedBytes],
          value: feeEstimate,
        })
        
      } catch (simulateErr: any) {
        console.error('✗ Transaction simulation failed:', simulateErr?.message)
        console.error('Simulation error details:', {
          cause: simulateErr?.cause,
          data: simulateErr?.data,
          shortMessage: simulateErr?.shortMessage,
          name: simulateErr?.name,
        })
        
        // simulateContract usually provides better error data
        let errorData: `0x${string}` | undefined
        if (simulateErr?.cause?.data) {
          errorData = simulateErr.cause.data
        } else if (simulateErr?.data) {
          errorData = simulateErr.data
        } else if (simulateErr?.cause?.cause?.data) {
          errorData = simulateErr.cause.cause.data
        }
        
        console.error('Simulation error data:', errorData ? `${errorData.slice(0, 100)}...` : 'none')
        
        if (errorData && errorData.startsWith('0x') && errorData.length > 10) {
          try {
            const decoded = decodeErrorResult({
              abi: TradingEngineABI,
              data: errorData,
            })
            console.error('✓ DECODED REVERT REASON:', decoded)
            const errorMsg = `Price refresh would fail: ${decoded.errorName || 'UnknownError'}${decoded.args ? ` - ${JSON.stringify(decoded.args)}` : ''}`
            throw new Error(errorMsg)
          } catch (decodeErr: any) {
            console.error('Could not decode revert reason:', decodeErr?.message)
            
            // Try to extract error signature to identify common errors
            const errorSig = errorData.slice(0, 10)
            console.error('Error signature (first 4 bytes):', errorSig)
            
            // Common Solidity error signatures
            const commonErrors: Record<string, string> = {
              '0x4e487b71': 'Panic(uint256) - Division by zero, array overflow, etc.',
              '0x08c379a0': 'Error(string) - Custom revert message',
            }
            
            if (commonErrors[errorSig]) {
              console.error('Likely error type:', commonErrors[errorSig])
            }
          }
        }
        
        // Check for Pyth-specific error patterns
        if (simulateErr?.message?.toLowerCase().includes('pyth') || 
            simulateErr?.message?.toLowerCase().includes('update') ||
            simulateErr?.message?.toLowerCase().includes('fee') ||
            simulateErr?.message?.toLowerCase().includes('insufficient')) {
          console.error('⚠️ This error likely originates from the Pyth contract')
          console.error('The Pyth contract rejected the update bytes from Hermes.')
          console.error('\n=== DIAGNOSIS ===')
          console.error('The update bytes are correctly formatted (PNAU magic bytes present),')
          console.error('but the Pyth contract on Mezo testnet is rejecting them.')
          console.error('This indicates a network-specific incompatibility.')
          console.error('\n=== POSSIBLE REASONS ===')
          console.error('1. Mezo testnet Pyth contract may require update bytes from a Mezo-specific source')
          console.error('2. The update bytes may need different signatures for Mezo testnet')
          console.error('3. There may be a version mismatch between Hermes and the Mezo Pyth contract')
          console.error('\n=== CURRENT ORACLE STATE ===')
          if (oraclePriceBefore) {
            const ageSeconds = oraclePublishTime ? Math.floor((Date.now() / 1000) - Number(oraclePublishTime)) : null
            const ageMinutes: number | null = ageSeconds !== null ? Math.floor(ageSeconds / 60) : null
            console.error(`Oracle price: ${formatUnits(oraclePriceBefore, 18)} USD`)
            const ageStr = ageMinutes !== null ? `${ageMinutes} minutes` : 'unknown'
            console.error(`Price age: ${ageStr}`)
            if (oraclePublishTime && ageMinutes !== null && ageMinutes < 60) {
              console.warn('⚠️ Price is fresh (< 1 hour old). Consider proceeding without refresh if contract allows.')
            } else if (ageMinutes !== null) {
              console.error(`⚠️ Price is stale (${ageMinutes} minutes old). Refresh is required.`)
            }
          }
          console.error('\n=== SUGGESTED FIX ===')
          console.error('Contact Mezo team or check Mezo documentation for:')
          console.error('- Mezo-specific Pyth update endpoint')
          console.error('- Alternative method to update Pyth prices on Mezo testnet')
          console.error('- Whether Mezo testnet supports Hermes update bytes at all')
          
          // If price exists but is stale, provide more specific error
          if (oraclePriceBefore && oraclePublishTime) {
            const ageMinutes = Math.floor((Date.now() / 1000 - Number(oraclePublishTime)) / 60)
            if (ageMinutes >= 60) {
              throw new Error(`Pyth price refresh failed: Mezo testnet rejects Hermes update bytes (network incompatibility). Current price is ${ageMinutes} minutes old (stale). The price must be refreshed manually by an admin, or you need Mezo-specific update bytes. Check Mezo documentation for the correct way to update Pyth prices on their testnet.`)
            }
          }
          
          throw new Error('Pyth contract rejected Hermes update bytes. The Mezo testnet Pyth contract appears to require a different update source. The bytes are correctly formatted but rejected by the contract. Please check Mezo documentation for the correct way to update Pyth prices on their testnet.')
        }
        
        // If we can't decode, throw the simulation error
        throw simulateErr
      }

      // 4. Try to estimate gas (simulation succeeded, so this should work)
      let gasEstimate: bigint | undefined
      // Encode function data outside try block so it's accessible in catch block
      const encodedData = encodeFunctionData({
        abi: TradingEngineABI,
        functionName: 'refreshMarkPrice',
        args: [validatedBytes],
      })
      
      try {
        if (!userAddress) {
          console.warn('No user address available for gas estimation, skipping...')
          gasEstimate = undefined
        } else {
          gasEstimate = await publicClient.estimateGas({
            account: userAddress,
            to: tradingEngineAddress,
            data: encodedData,
            value: feeEstimate,
          })
        }
      } catch (gasErr: any) {
        console.error('✗ Gas estimation failed:', gasErr?.message)
        console.error('Gas estimation error details:', {
          cause: gasErr?.cause,
          data: gasErr?.data,
          shortMessage: gasErr?.shortMessage,
          name: gasErr?.name,
          stack: gasErr?.stack,
        })

        // Try to extract error data from multiple nested levels
        let gasErrorData: `0x${string}` | undefined
        const errorChain: any[] = []
        let currentErr: any = gasErr
        
        // Walk the error chain to find all error data
        while (currentErr) {
          errorChain.push({
            message: currentErr?.message,
            name: currentErr?.name,
            data: currentErr?.data,
            cause: currentErr?.cause?.message || currentErr?.cause?.shortMessage,
          })
          if (currentErr?.cause?.data) {
            gasErrorData = currentErr.cause.data
          } else if (currentErr?.data && !gasErrorData) {
            gasErrorData = currentErr.data
          }
          currentErr = currentErr?.cause
        }
        
        console.error('Error chain:', errorChain)
        console.error('Extracted error data:', gasErrorData ? `${gasErrorData.slice(0, 100)}...` : 'none')

        // Try to decode with TradingEngine ABI
        if (gasErrorData && gasErrorData.startsWith('0x') && gasErrorData.length > 10) {
          try {
            const decodedGasError = decodeErrorResult({
              abi: TradingEngineABI,
              data: gasErrorData,
            })
            console.error('✓ Decoded TradingEngine error:', decodedGasError)
            const errorMsg = `Gas estimation failed: ${decodedGasError.errorName || 'UnknownError'}${decodedGasError.args ? ` - ${JSON.stringify(decodedGasError.args)}` : ''}`
            throw new Error(errorMsg)
          } catch (decodeErr: any) {
            console.error('Could not decode with TradingEngine ABI:', decodeErr?.message)
            
            // Try to extract error signature to identify common errors
            const errorSig = gasErrorData.slice(0, 10)
            console.error('Error signature (first 4 bytes):', errorSig)
            
            // Common Solidity error signatures
            const commonErrors: Record<string, string> = {
              '0x4e487b71': 'Panic(uint256) - Division by zero, array overflow, etc.',
              '0x08c379a0': 'Error(string) - Custom revert message',
              '0x': 'Empty error data',
            }
            
            if (commonErrors[errorSig]) {
              console.error('Likely error type:', commonErrors[errorSig])
            }
            
            // Check if it might be a Pyth-specific error
            // Pyth errors are usually from the IPyth contract, not our contracts
            if (gasErr?.message?.toLowerCase().includes('pyth') || 
                gasErr?.shortMessage?.toLowerCase().includes('pyth') ||
                gasErr?.message?.toLowerCase().includes('update') ||
                gasErr?.message?.toLowerCase().includes('fee')) {
              console.error('⚠️ This error likely originates from the Pyth contract, not TradingEngine')
              console.error('Possible causes:')
              console.error('  - Update bytes are for wrong network (mainnet vs testnet)')
              console.error('  - Update bytes format is invalid')
              console.error('  - Insufficient fee for Pyth update')
              console.error('  - Price feed ID mismatch')
              throw new Error('Pyth contract rejected the update. This usually means the Hermes update bytes are for the wrong network (mainnet vs testnet) or are invalid. Check that you are using the correct Hermes endpoint for Mezo testnet.')
            }
          }
        }

        // If gas estimation fails with insufficient fee, try higher fee
        if (gasErr?.message?.includes('insufficient') || gasErr?.shortMessage?.includes('insufficient')) {
          feeEstimate = parseEther('0.01')
          // Re-encode with updated fee (though data doesn't change, this ensures scope)
          const retryEncodedData = encodeFunctionData({
            abi: TradingEngineABI,
            functionName: 'refreshMarkPrice',
            args: [validatedBytes],
          })
          try {
            if (!userAddress) {
              console.warn('No user address available for retry gas estimation')
              throw gasErr // Re-throw original error if no address
            }
            gasEstimate = await publicClient.estimateGas({
              account: userAddress,
              to: tradingEngineAddress,
              data: retryEncodedData,
              value: feeEstimate,
            })
          } catch (retryErr: any) {
            console.error('✗ Gas estimation still failed with higher fee:', retryErr?.message)
            
            // Final attempt: provide user-friendly diagnostic
            const diagnosticMsg = 'Price refresh failed during gas estimation. The Pyth contract rejected the update bytes.\n\n' +
              'Most likely causes:\n' +
              '• Update bytes are for wrong network (check Hermes endpoint)\n' +
              '• Update bytes format is invalid or expired\n' +
              '• Network-specific Pyth contract requirements\n\n' +
              'Please verify:\n' +
              '1. You are using the correct Hermes endpoint for Mezo testnet\n' +
              '2. The update bytes are fresh (not expired)\n' +
              '3. The Pyth contract address matches your network\n\n' +
              `Error: ${retryErr?.message || gasErr?.message}`
            
            throw new Error(diagnosticMsg)
          }
        } else {
          // Provide diagnostic for non-insufficient errors
          const diagnosticMsg = 'Price refresh failed during gas estimation. The transaction would revert.\n\n' +
            'Check the console logs above for detailed error information.\n' +
            `Error: ${gasErr?.message || 'Unknown error'}`
          throw new Error(diagnosticMsg)
        }
       }
       
       // 5. Call refreshMarkPrice with bytes and ETH for fee
      try {
        const txHash = await writeContractAsync({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'refreshMarkPrice',
          args: [validatedBytes],
          value: feeEstimate, // Pyth will use what it needs and refund excess
        })
        
        // 4. Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash })
        }
      } catch (writeError: any) {
        console.error('\n=== REFRESH MARK PRICE WRITE ERROR ===')
        console.error('Error type:', typeof writeError)
        console.error('Error name:', writeError?.name)
        console.error('Error message:', writeError?.message)
        console.error('Error shortMessage:', writeError?.shortMessage)
        console.error('Error code:', writeError?.code)
        
        // Deep log error structure
        console.error('Error structure:', {
          hasCause: !!writeError?.cause,
          hasData: !!writeError?.data,
          causeKeys: writeError?.cause ? Object.keys(writeError.cause) : [],
          keys: Object.keys(writeError || {}),
        })

        // Try to extract error data from multiple possible locations
        let decodedError: any = null
        let errorData: `0x${string}` | undefined
        
        // Check various error data locations - viem error structure can vary
        const errorDataPaths = [
          writeError?.cause?.data,
          writeError?.data,
          writeError?.cause?.reason?.data,
          writeError?.cause?.data?.data,
          writeError?.cause?.reason?.cause?.data,
          writeError?.details,
          writeError?.error?.data,
        ]
        
        for (const potentialData of errorDataPaths) {
          if (potentialData && typeof potentialData === 'string' && potentialData.startsWith('0x')) {
            errorData = potentialData as `0x${string}`
            break
          }
        }

        // Also try to extract from transaction data
        if (!errorData && writeError?.transaction?.data) {
          const txData = writeError.transaction.data
          // Check if it's an error response (starts with error selector)
        }
        
        if (errorData && errorData.startsWith('0x')) {
          try {
            decodedError = decodeErrorResult({
              abi: TradingEngineABI,
              data: errorData,
            })
            console.error('✓ Decoded error from refreshMarkPrice:', {
              errorName: decodedError.errorName,
              args: decodedError.args,
            })
            
            // Re-throw with decoded information
            const errorName = decodedError.errorName || 'UnknownError'
            const argsStr = decodedError.args ? ` Args: ${JSON.stringify(decodedError.args)}` : ''
            throw new Error(`Oracle update failed: ${errorName}${argsStr}`)
          } catch (decodeErr: any) {
            console.error('Could not decode refreshMarkPrice error:', decodeErr?.message)
            // Log the raw error data for manual inspection
            console.error('Raw error data (hex):', errorData)
            console.error('Raw error data (first 200 chars):', errorData.substring(0, 200))
          }
        } else {
          console.error('No decodable error data found in error structure')
        }

        // Log full error for debugging
        console.error('Full error object:', JSON.stringify(writeError, Object.getOwnPropertyNames(writeError), 2))
        
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
        // Try fallback: sync mark price directly from oracle
        console.warn('Hermes fetch failed, attempting fallback: sync mark price from oracle...')
        try {
          await syncMarkPrice()
          console.log('Fallback successful: mark price synced from oracle')
          return // Successfully synced, exit early
        } catch (fallbackErr: any) {
          console.error('Fallback also failed:', fallbackErr)
          // If fallback fails, throw original Hermes error with context
          throw new Error(`Failed to fetch price update from Hermes. Fallback sync also failed: ${fallbackErr?.message || 'Unknown error'}. Please check your network connection and try again.`)
        }
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
// SYNC MARK PRICE FROM ORACLE (FALLBACK WHEN HERMES FAILS)
// ============================================================================

export function useTradingEngineSyncMarkPriceFromOracle() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const publicClient = usePublicClient()
  const { address: userAddress } = useAccount()
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const syncMarkPrice = async () => {
    try {
      if (!publicClient) {
        throw new Error('Public client not available. Cannot sync mark price.')
      }

      if (!userAddress) {
        throw new Error('User address not available. Please connect your wallet.')
      }

      // Read current mark price and oracle price in parallel
      const [currentMarkPrice, oraclePriceResult, contractOwner, maxOracleMoveBps] = await Promise.all([
        publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'getMarkPrice',
        }),
        publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'peekOraclePrice',
        }),
        publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: tradingEngineAddress,
          abi: TradingEngineABI,
          functionName: 'maxOracleMoveBps',
        }),
      ]) as [bigint, [bigint, bigint], `0x${string}`, bigint]

      const oraclePrice = oraclePriceResult[0]

      if (!oraclePrice || oraclePrice === BigInt(0)) {
        throw new Error('Oracle price not available or zero')
      }

      // Calculate price divergence in basis points
      const priceDiff = oraclePrice > currentMarkPrice 
        ? oraclePrice - currentMarkPrice 
        : currentMarkPrice - oraclePrice
      const priceDivergenceBps = Number((priceDiff * BigInt(10000)) / currentMarkPrice)

      console.log(`Syncing mark price: Oracle $${Number(oraclePrice) / 1e18}, Mark $${Number(currentMarkPrice) / 1e18}, Divergence: ${priceDivergenceBps / 100}%`)

      // Check if user is contract owner
      const isOwner = userAddress.toLowerCase() === contractOwner.toLowerCase()

      if (isOwner) {
        // Owner can update mark price directly
        if (priceDivergenceBps >= 100) { // 1% threshold
          console.log('User is owner, updating mark price directly...')
          const txHash = await writeContractAsync({
            address: tradingEngineAddress,
            abi: TradingEngineABI,
            functionName: 'setMarkPrice',
            args: [oraclePrice],
          })

          // Wait for confirmation
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: txHash })
          }

          console.log('Mark price updated successfully via setMarkPrice')
          return { success: true, updated: true }
        } else {
          console.log('Price divergence is acceptable (<1%), no update needed')
          return { success: true, updated: false }
        }
      } else {
        // Non-owner: check if divergence is within acceptable bounds
        if (maxOracleMoveBps > BigInt(0) && priceDivergenceBps > Number(maxOracleMoveBps)) {
          throw new Error(
            `Price divergence (${(priceDivergenceBps / 100).toFixed(2)}%) exceeds maximum allowed (${Number(maxOracleMoveBps) / 100}%). ` +
            `Owner must update mark price first. Current: $${(Number(currentMarkPrice) / 1e18).toFixed(2)}, Oracle: $${(Number(oraclePrice) / 1e18).toFixed(2)}`
          )
        }

        // If within bounds, contract will validate on-chain during position opening
        console.log(`Price divergence (${(priceDivergenceBps / 100).toFixed(2)}%) is within acceptable bounds. Contract will validate on-chain.`)
        return { success: true, updated: false }
      }
    } catch (err: any) {
      console.error('Failed to sync mark price from oracle:', err)
      
      // Provide user-friendly error messages
      if (err?.message?.includes('Only owner') || err?.shortMessage?.includes('OwnableUnauthorizedAccount')) {
        throw new Error('Only contract owner can update mark price. Please contact the owner.')
      }
      
      if (err?.message) {
        throw err
      }
      
      throw new Error(`Failed to sync mark price from oracle: ${err?.message || 'Unknown error'}`)
    }
  }

  return {
    syncMarkPrice,
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
  const { syncMarkPrice } = useTradingEngineSyncMarkPriceFromOracle()
  
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
      
      // IMPORTANT: Read position directly from contract to bypass stale cache
      // This ensures we have the latest position state, especially after closing a position
      let currentPosition: any = null
      if (publicClient && userAddress) {
        try {
          currentPosition = await publicClient.readContract({
            address: tradingEngineAddress,
            abi: TradingEngineABI,
            functionName: 'getPosition',
            args: [userAddress],
          }) as any
        } catch (readErr) {
          console.warn('Failed to read position from contract, using cached value:', readErr)
          // Fallback to cached value if read fails
          currentPosition = position
        }
      } else {
        // Fallback to cached value if publicClient not available
        currentPosition = position
      }
      
      // Check if user already has a position (using fresh data from contract)
      // Check both exists flag AND size/margin to handle edge cases
      const hasActivePosition = currentPosition?.exists || 
        (currentPosition?.size && currentPosition.size > BigInt(0)) ||
        (currentPosition?.margin && currentPosition.margin > BigInt(0))
      
      if (hasActivePosition) {
        console.error('Position check failed - active position detected:', {
          exists: currentPosition?.exists,
          size: currentPosition?.size?.toString(),
          margin: currentPosition?.margin?.toString(),
        })
        throw new Error('You already have an open position. Close it before opening a new one.')
      }
      
      // REQUIRED: Refresh mark price from Pyth oracle before opening position
      // This ensures the on-chain price is accurate and verified cryptographically
      try {
        await refreshMarkPrice()
      } catch (refreshError: any) {
        console.warn('Price refresh failed, attempting fallback: sync mark price from oracle...', refreshError)
        
        // Fallback: Try to sync mark price directly from oracle
        try {
          await syncMarkPrice()
          console.log('Fallback successful: mark price synced from oracle, proceeding with position opening')
          // Continue with position opening since sync succeeded
        } catch (syncError: any) {
          console.error('Both refresh and fallback sync failed:', { refreshError, syncError })
          throw new Error(
            `Cannot open position: Price refresh failed. ${refreshError?.message || 'Oracle update failed. '}` +
            `Fallback sync also failed: ${syncError?.message || 'Unknown error'}. ` +
            `Please try again or contact the contract owner if you're not the owner.`
          )
        }
      }
      
      // Simulate the contract call first to catch errors early
      try {
        if (publicClient) {
          await publicClient.simulateContract({
            address: tradingEngineAddress as `0x${string}`,
            abi: TradingEngineABI,
            functionName: 'openPosition',
            args: [isLong, marginAmount, leverage],
            account: userAddress,
          })
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
            }
          } catch (decodeErr) {
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
      try {
        await writeContractAsync({
          address: tradingEngineAddress as `0x${string}`,
          abi: TradingEngineABI,
          functionName: 'openPosition',
          args: [isLong, marginAmount, leverage],
        })
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
            
            // Re-throw with decoded information
            const errorName = decodedError.errorName || 'UnknownError'
            const argsStr = decodedError.args ? ` Args: ${JSON.stringify(decodedError.args)}` : ''
            throw new Error(`Contract error: ${errorName}${argsStr}`)
          } catch (decodeErr) {
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
  const { address: userAddress } = useAccount()
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()
  
  const { refreshMarkPrice } = useTradingEngineRefreshMarkPrice()
  
  // Check if user has a position before allowing close
  const { data: position, isLoading: positionLoading, error: positionError, refetch: refetchPosition } = useReadContract({
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
  
  const closePosition = async () => {
    try {
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

      // REQUIRED: Refresh mark price from Pyth oracle before closing position
      // This ensures the exit price is accurate and verified cryptographically
      try {
        await refreshMarkPrice()
      } catch (refreshError: any) {
        console.error('Price refresh failed, blocking position closing:', refreshError)
        // NO FALLBACK: Block close if refresh fails
        throw new Error(`Cannot close position: Price refresh failed. ${refreshError?.message || 'Oracle update failed. Please try again.'}`)
      }

      // Now try the actual closePosition call - use writeContractAsync to await the hash
      const txHash = await writeContractAsync({
        address: tradingEngineAddress,
        abi: TradingEngineABI,
        functionName: 'closePosition',
      })
      
      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash })
        
        // Add a small delay to ensure on-chain state is fully updated
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Aggressively clear and refetch all position queries
        // Wagmi v2 query keys: ['readContract', { address, abi, functionName, args, ... }, ...]
        
        // Helper function to match position queries
        const matchPositionQuery = (query: any): boolean => {
          const queryKey = query.queryKey as any[]
          if (!Array.isArray(queryKey) || queryKey.length === 0) return false
          if (queryKey[0] !== 'readContract') return false
          
          const config = queryKey[1]
          if (!config || typeof config !== 'object') return false
          
          // Match by address and functionName (case-insensitive for address)
          const addressMatch = config.address?.toLowerCase() === tradingEngineAddress.toLowerCase()
          const functionMatch = config.functionName === 'getPosition'
          
          return addressMatch && functionMatch
        }
        
        // Strategy 1: Remove all matching queries from cache
        await queryClient.removeQueries({
          predicate: matchPositionQuery,
        })
        
        // Strategy 2: Invalidate all matching queries
        await queryClient.invalidateQueries({
          predicate: matchPositionQuery,
        })
        
        // Strategy 3: Force refetch all matching queries
        await queryClient.refetchQueries({
          predicate: matchPositionQuery,
        })
        
        // Also refetch the local position query for immediate update
        await refetchPosition()
        
        // Verify the position is actually closed by reading directly from contract
        if (userAddress) {
          const verifyPosition = await publicClient.readContract({
            address: tradingEngineAddress,
            abi: TradingEngineABI,
            functionName: 'getPosition',
            args: [userAddress],
          }) as any
          
          if (verifyPosition?.exists) {
            console.warn('⚠️ WARNING: Position still exists on-chain after close transaction!')
            // Wait a bit longer and retry
            await new Promise(resolve => setTimeout(resolve, 1000))
            await queryClient.refetchQueries({
              predicate: matchPositionQuery,
            })
          }
        }
      }
      
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

export function useEngineSetPythOracle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setPythOracle = (oracleAddress: `0x${string}`) => {
    writeContract({ address: tradingEngineAddress, abi: TradingEngineABI, functionName: 'setPythOracle', args: [oracleAddress] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setPythOracle, hash, isPending, isConfirming, isConfirmed, error }
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
