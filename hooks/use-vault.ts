import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi'
import { useState } from 'react'
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

  return result
}

export function useVaultDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const deposit = (amount: bigint) => {
    try {
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

  return result
}

export function useVaultTBTC() {
  const result = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'TBTC',
  })

  return result
}

export function useVaultOwner() {
  const result = useReadContract({
    address: vaultAddress,
    abi: VaultABI,
    functionName: 'owner',
  })

  return result
}

// ============================================================================
// VAULT UTILITY HOOKS
// ============================================================================

export function useVaultInfo() {
  const tradingEngine = useVaultTradingEngine()
  const tbtc = useVaultTBTC()
  const musd = useReadContract({ address: vaultAddress, abi: VaultABI, functionName: 'musd' })

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
    functionName: 'balanceOfMusd',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
}

export function useVaultSetMUSD() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const setMUSD = (musd: `0x${string}`) => {
    writeContract({ address: vaultAddress, abi: VaultABI, functionName: 'setMusd', args: [musd] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { setMUSD, hash, isPending, isConfirming, isConfirmed, error }
}

export function useVaultDepositMUSD() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const depositMusd = (amount: bigint) => {
    writeContract({ address: vaultAddress, abi: VaultABI, functionName: 'depositMusd', args: [amount] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { depositMusd, hash, isPending, isConfirming, isConfirmed, error }
}

export function useVaultWithdrawMUSD() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const withdrawMusd = (amount: bigint) => {
    writeContract({ address: vaultAddress, abi: VaultABI, functionName: 'withdrawMusd', args: [amount] })
  }
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  return { withdrawMusd, hash, isPending, isConfirming, isConfirmed, error }
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

  return result
}

export function useTBTCApprove() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  
  const approve = (spender: `0x${string}`, amount: bigint) => {
    try {
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

// ============================================================================
// COMBINED DEPOSIT WITH APPROVAL
// ============================================================================

export function useVaultDepositWithApproval() {
  const { address: userAddress } = useAccount()
  const publicClient = usePublicClient()
  const [isApproving, setIsApproving] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [currentError, setCurrentError] = useState<Error | null>(null)
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>()
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>()
  const [isConfirmed, setIsConfirmed] = useState(false)

  // Get current allowance
  const { data: allowance } = useTBTCAllowance(userAddress, vaultAddress as `0x${string}`)

  // Use single writeContract instance
  const { writeContractAsync } = useWriteContract()

  // Wait for approve transaction
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // Wait for deposit transaction
  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  const depositWithApproval = async (amount: bigint) => {
    try {
      setCurrentError(null)
      setIsConfirmed(false)

      if (!userAddress) {
        throw new Error('No user address found. Please connect your wallet.')
      }

      if (amount <= BigInt(0)) {
        throw new Error('Amount must be greater than 0')
      }

      // Check if approval is needed
      const needsApproval = !allowance || allowance < amount

      if (needsApproval) {
        // Step 1: Approve
        setIsApproving(true)
        setIsDepositing(false)

        try {
          const approveTxHash = await writeContractAsync({
            address: tBTCAddress,
            abi: ERC20ABI,
            functionName: 'approve',
            args: [vaultAddress as `0x${string}`, amount],
          })

          setApproveHash(approveTxHash)

          // Wait for approval confirmation
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
          }
        } catch (approveErr: any) {
          setIsApproving(false)
          const error = approveErr?.message 
            ? new Error(`Approval failed: ${approveErr.message}`)
            : new Error('Approval failed')
          setCurrentError(error)
          throw error
        }

        setIsApproving(false)
      }

      // Step 2: Deposit
      setIsDepositing(true)

      try {
        const depositTxHash = await writeContractAsync({
          address: vaultAddress,
          abi: VaultABI,
          functionName: 'deposit',
          args: [amount],
        })

        setDepositHash(depositTxHash)

        // Wait for deposit confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: depositTxHash })
        }

        setIsConfirmed(true)
        setIsDepositing(false)
      } catch (depositErr: any) {
        setIsDepositing(false)
        const error = depositErr?.message
          ? new Error(`Deposit failed: ${depositErr.message}`)
          : new Error('Deposit failed')
        setCurrentError(error)
        throw error
      }
    } catch (err: any) {
      setIsApproving(false)
      setIsDepositing(false)
      if (err instanceof Error) {
        setCurrentError(err)
      } else {
        setCurrentError(new Error(err?.message || 'Unknown error occurred'))
      }
      throw err
    }
  }

  return {
    depositWithApproval,
    isPending: isApproving || isDepositing || isApproveConfirming || isDepositConfirming,
    isApproving,
    isDepositing,
    isConfirmed: isConfirmed || isDepositConfirmed,
    error: currentError,
    approveHash,
    depositHash,
  }
}
