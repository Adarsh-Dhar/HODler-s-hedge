import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { vaultAddress, tBTCAddress } from '@/lib/address'
import { VaultABI } from '@/lib/abi/Vault'
import { ERC20ABI } from '@/lib/abi/ERC20'

// ============================================================================
// VAULT-SPECIFIC HOOKS
// ============================================================================

export function useVaultBalance(userAddress?: `0x${string}`) {
  const result = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })

  // Debug logging
  console.log('Vault balance query result:', {
    userAddress,
    vaultAddress,
    balance: result.data?.toString() || 'undefined',
    balanceFormatted: result.data ? Number(result.data) / 1e8 : 'undefined',
    isLoading: result.isLoading,
    error: result.error,
    isError: result.isError,
    isSuccess: result.isSuccess
  })

  return result
}

export function useVaultDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const deposit = (amount: bigint) => {
    try {
      console.log('Attempting deposit:', {
        address: vaultAddress,
        amount: amount.toString(),
        amountFormatted: Number(amount) / 1e8
      })
      
      writeContract({
        address: vaultAddress,
        abi: VaultABI,
        functionName: 'deposit',
        args: [amount],
      })
    } catch (err) {
      console.error('Deposit error:', err)
    }
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error: error || receiptError,
  }
}

export function useVaultWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const withdraw = (amount: bigint) => {
    writeContract({
      address: vaultAddress,
      abi: VaultABI,
      functionName: 'withdraw',
      args: [amount],
    })
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useVaultTradingEngine() {
  const result = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'tradingEngine',
  })

  // Debug logging
  console.log('Vault trading engine query result:', {
    vaultAddress,
    tradingEngine: result.data?.toString() || 'undefined',
    isLoading: result.isLoading,
    error: result.error,
    isError: result.isError,
    isSuccess: result.isSuccess
  })

  return result
}

export function useVaultTBTC() {
  const result = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'TBTC',
  })

  // Debug logging
  console.log('Vault TBTC query result:', {
    vaultAddress,
    tbtc: result.data?.toString() || 'undefined',
    isLoading: result.isLoading,
    error: result.error,
    isError: result.isError,
    isSuccess: result.isSuccess
  })

  return result
}

export function useVaultOwner() {
  const result = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'owner',
  })

  // Debug logging
  console.log('Vault owner query result:', {
    vaultAddress,
    owner: result.data?.toString() || 'undefined',
    isLoading: result.isLoading,
    error: result.error,
    isError: result.isError,
    isSuccess: result.isSuccess
  })

  return result
}

// ============================================================================
// VAULT UTILITY HOOKS
// ============================================================================

export function useVaultInfo() {
  const tradingEngine = useVaultTradingEngine()
  const tbtc = useVaultTBTC()
  const musd = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'MUSD' })

  return {
    tradingEngine,
    tbtc,
    musd,
    address: vaultAddress,
  }
}

// ============================================================================
// TBTC TOKEN HOOKS
// ============================================================================

export function useTBTCBalance(userAddress?: `0x${string}`) {
  return useReadContract({
    address: tBTCAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
}

// =========================================================================
// MUSD HELPERS
// =========================================================================

export function useVaultMUSDBalance(userAddress?: `0x${string}`) {
  return useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'balanceOfMUSD',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
}

export function useVaultSetMUSD() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setMUSD = (musd: `0x${string}`) => {
    writeContract({ address: vaultAddress, abi: VaultABI, functionName: 'setMUSD', args: [musd] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setMUSD, hash, isPending, isConfirming, isConfirmed, error }
}

export function useTBTCAllowance(owner?: `0x${string}`, spender?: `0x${string}`) {
  const result = useReadContract({
    address: tBTCAddress,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!owner && !!spender,
    },
  })

  // Debug logging
  console.log('Allowance query result:', {
    owner,
    spender,
    allowance: result.data?.toString() || 'undefined',
    isLoading: result.isLoading,
    error: result.error,
    isError: result.isError,
    isSuccess: result.isSuccess
  })

  return result
}

export function useTBTCApprove() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const approve = (spender: `0x${string}`, amount: bigint) => {
    try {
      console.log('Attempting approve:', {
        tokenAddress: tBTCAddress,
        spender,
        amount: amount.toString(),
        amountFormatted: Number(amount) / 1e8
      })
      
      writeContract({
        address: tBTCAddress,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [spender, amount],
      })
    } catch (err) {
      console.error('Approve error:', err)
    }
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}
