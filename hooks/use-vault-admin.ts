import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { vaultAddress } from '@/lib/address'
import { VaultABI } from '@/lib/abi/Vault'
import { useVaultOwner } from './use-vault'

// ============================================================================
// VAULT ADMIN HOOKS
// ============================================================================

export function useVaultEmergencyWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const emergencyWithdraw = (token: `0x${string}`, amount: bigint) => {
    try {
      console.log('Attempting emergency withdraw:', {
        address: vaultAddress,
        token,
        amount: amount.toString(),
        amountFormatted: Number(amount) / 1e8
      })
      
      writeContract({
        address: vaultAddress,
        abi: VaultABI,
        functionName: 'emergencyWithdraw',
        args: [token, amount],
      })
    } catch (err) {
      console.error('Emergency withdraw error:', err)
    }
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    emergencyWithdraw,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error: error || receiptError,
  }
}

export function useVaultTransferOwnership() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const transferOwnership = (newOwner: `0x${string}`) => {
    try {
      console.log('Attempting ownership transfer:', {
        address: vaultAddress,
        newOwner,
        currentOwner: 'Check console for current owner'
      })
      
      writeContract({
        address: vaultAddress,
        abi: VaultABI,
        functionName: 'transferOwnership',
        args: [newOwner],
      })
    } catch (err) {
      console.error('Ownership transfer error:', err)
    }
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    transferOwnership,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error: error || receiptError,
  }
}

export function useVaultRenounceOwnership() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const renounceOwnership = () => {
    try {
      console.log('Attempting to renounce ownership:', {
        address: vaultAddress,
        warning: 'This action is IRREVERSIBLE!'
      })
      
      writeContract({
        address: vaultAddress,
        abi: VaultABI,
        functionName: 'renounceOwnership',
      })
    } catch (err) {
      console.error('Renounce ownership error:', err)
    }
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    renounceOwnership,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error: error || receiptError,
  }
}

// ============================================================================
// OWNER CHECK HOOKS
// ============================================================================

export function useIsVaultOwner(userAddress?: `0x${string}`) {
  const { data: owner, isLoading, error } = useVaultOwner()
  
  const isOwner = owner?.toLowerCase() === userAddress?.toLowerCase()
  
  return {
    isOwner: !!isOwner,
    isLoading,
    error,
    owner: owner as string | undefined,
  }
}

// ============================================================================
// ADMIN UTILITY HOOKS
// ============================================================================

export function useVaultAdminInfo(userAddress?: `0x${string}`) {
  const { isOwner, isLoading, error, owner } = useIsVaultOwner(userAddress)
  
  return {
    isOwner,
    isLoading,
    error,
    owner,
    userAddress,
    canAccessAdmin: isOwner,
  }
}
