import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { vaultAddress } from '@/lib/address'
import { VaultABI } from '@/lib/abi/Vault'

// ============================================================================
// VAULT-SPECIFIC HOOKS
// ============================================================================

export function useVaultBalance(userAddress?: `0x${string}`) {
  return useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })
}

export function useVaultDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const deposit = (amount: bigint) => {
    writeContract({
      address: vaultAddress,
      abi: VaultABI,
      functionName: 'deposit',
      args: [amount],
    })
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
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
  return useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'tradingEngine',
  })
}

export function useVaultTBTC() {
  return useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'TBTC',
  })
}

// ============================================================================
// VAULT UTILITY HOOKS
// ============================================================================

export function useVaultInfo() {
  const tradingEngine = useVaultTradingEngine()
  const tbtc = useVaultTBTC()

  return {
    tradingEngine,
    tbtc,
    address: vaultAddress,
  }
}
