import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi'
import { encodeFunctionData } from 'viem'
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
// NEW: VAULT ADMIN SETTERS (TREASURY / FEES / AUTO-SETTLE)
// ============================================================================

export function useVaultSetTreasury() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const publicClient = usePublicClient()
  const { address: account } = useAccount()
  
  const setTreasury = async (treasury: `0x${string}`) => {
    try {
      console.log('Setting treasury:', {
        treasury,
        vaultAddress
      })
      
      // Manually estimate gas first, or provide a fixed gas limit
      const defaultGas = BigInt(100000)
      const gasLimit = publicClient && account
        ? await publicClient.estimateGas({
            account,
            to: vaultAddress,
            data: encodeFunctionData({
              abi: VaultABI,
              functionName: 'setTreasury',
              args: [treasury],
            }),
          }).catch(() => defaultGas)
        : defaultGas
      
      await writeContractAsync({
        address: vaultAddress,
        abi: VaultABI,
        functionName: 'setTreasury',
        args: [treasury],
        gas: gasLimit,
      })
    } catch (err: any) {
      console.error('Error setting treasury:', err)
      
      // Provide more specific error messages
      if (err?.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction')
      } else if (err?.message?.includes('user rejected')) {
        throw new Error('Transaction rejected by user')
      } else if (err?.message?.includes('network')) {
        throw new Error('Network connection error. Please check your connection and try again.')
      } else if (err?.message?.includes('CALL_EXCEPTION') || err?.message?.includes('missing revert data')) {
        throw new Error('Transaction failed. Please check that you are the owner and try again.')
      } else {
        throw new Error(err?.message || 'Failed to set treasury. Please try again.')
      }
    }
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  return {
    setTreasury,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useVaultSetProtocolFeeBps() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setProtocolFeeBps = (bps: bigint) => {
    writeContract({ address: vaultAddress, abi: VaultABI, functionName: 'setProtocolFeeBps', args: [bps] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setProtocolFeeBps, hash, isPending, isConfirming, isConfirmed, error }
}

export function useVaultSetAutoSettle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setAutoSettle = (on: boolean) => {
    writeContract({ address: vaultAddress, abi: VaultABI, functionName: 'setAutoSettle', args: [on] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setAutoSettle, hash, isPending, isConfirming, isConfirmed, error }
}

// (duplicate setters removed)

// ============================================================================
// OWNER CHECK HOOKS
// ============================================================================

export function useIsVaultOwner(userAddress?: `0x${string}`) {
  const { data: owner, isLoading, error } = useVaultOwner()
  
  const ownerStr = typeof owner === 'string' ? owner : undefined
  const isOwner = ownerStr?.toLowerCase() === userAddress?.toLowerCase()
  
  return {
    isOwner: !!isOwner,
    isLoading,
    error,
    owner: ownerStr,
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
