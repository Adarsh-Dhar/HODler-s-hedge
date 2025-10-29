// ============================================================================
// ADMIN UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validates address checksum format
 */
export function isValidChecksumAddress(address: string): boolean {
  if (!isValidAddress(address)) return false
  
  // Simple checksum validation (for production, use a proper library)
  const addressLower = address.toLowerCase()
  const addressUpper = address.toUpperCase()
  
  // Check if it's all lowercase or all uppercase (invalid checksum)
  if (address === addressLower || address === addressUpper) {
    return false
  }
  
  return true
}

/**
 * Formats address for display
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return "N/A"
  if (address.length < startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Validates amount input
 */
export function isValidAmount(amount: string, maxAmount?: number): { valid: boolean; error?: string } {
  const numAmount = Number(amount)
  
  if (isNaN(numAmount)) {
    return { valid: false, error: "Invalid number format" }
  }
  
  if (numAmount <= 0) {
    return { valid: false, error: "Amount must be greater than zero" }
  }
  
  if (maxAmount && numAmount > maxAmount) {
    return { valid: false, error: `Amount exceeds maximum of ${maxAmount}` }
  }
  
  return { valid: true }
}

/**
 * Converts amount to BigInt (assuming 8 decimals for BTC)
 */
export function amountToBigInt(amount: string, decimals = 8): bigint {
  const numAmount = Number(amount)
  return BigInt(Math.floor(numAmount * Math.pow(10, decimals)))
}

/**
 * Converts BigInt to formatted amount string
 */
export function bigIntToAmount(amount: bigint, decimals = 8): string {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(4)
}

/**
 * Generates confirmation text for different admin actions
 */
export function getConfirmationText(action: 'emergency' | 'transfer' | 'renounce'): string {
  switch (action) {
    case 'emergency':
      return "EMERGENCY"
    case 'transfer':
      return "TRANSFER"
    case 'renounce':
      return "RENOUNCE"
    default:
      return ""
  }
}

/**
 * Validates confirmation text input
 */
export function validateConfirmationText(input: string, expected: string): boolean {
  return input === expected
}

/**
 * Checks if user can perform admin action
 */
export function canPerformAdminAction(
  isOwner: boolean,
  isConnected: boolean,
  action: 'emergency' | 'transfer' | 'renounce'
): { canPerform: boolean; reason?: string } {
  if (!isConnected) {
    return { canPerform: false, reason: "Wallet not connected" }
  }
  
  if (!isOwner) {
    return { canPerform: false, reason: "Owner access required" }
  }
  
  return { canPerform: true }
}

/**
 * Formats transaction hash for display
 */
export function formatTransactionHash(hash: string): string {
  if (!hash) return "N/A"
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    return false
  }
}

/**
 * Downloads data as CSV
 */
export function downloadCSV(data: string[][], filename: string): void {
  const csvContent = data.map(row => row.join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

/**
 * Calculates time until next funding
 */
export function getTimeUntilFunding(nextFundingTime: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const nextTime = Number(nextFundingTime)
  const diff = nextTime - now
  
  if (diff <= 0) return "Due now"
  
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Formats timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/**
 * Gets color class for PnL value
 */
export function getPnLColorClass(pnl: bigint): string {
  const pnlNumber = Number(pnl)
  if (pnlNumber > 0) return "text-success"
  if (pnlNumber < 0) return "text-destructive"
  return "text-muted-foreground"
}

/**
 * Gets icon for margin event type
 */
export function getMarginEventIcon(event: any): string {
  if ('pnl' in event) {
    return Number(event.pnl) >= 0 ? "🔓💰" : "🔓📉"
  }
  return "🔒"
}

/**
 * Validates admin action prerequisites
 */
export function validateAdminAction(
  action: 'emergency' | 'transfer' | 'renounce',
  params: {
    isOwner: boolean
    isConnected: boolean
    amount?: string
    tokenAddress?: string
    newOwnerAddress?: string
    confirmationText?: string
    addressText?: string
    checkboxChecked?: boolean
  }
): { valid: boolean; error?: string } {
  // Basic checks
  if (!params.isConnected) {
    return { valid: false, error: "Wallet not connected" }
  }
  
  if (!params.isOwner) {
    return { valid: false, error: "Owner access required" }
  }
  
  // Action-specific validations
  switch (action) {
    case 'emergency':
      if (!params.amount || !params.tokenAddress) {
        return { valid: false, error: "Amount and token address required" }
      }
      
      const amountValidation = isValidAmount(params.amount)
      if (!amountValidation.valid) {
        return { valid: false, error: amountValidation.error }
      }
      
      if (!isValidAddress(params.tokenAddress)) {
        return { valid: false, error: "Invalid token address" }
      }
      
      if (params.confirmationText !== "EMERGENCY") {
        return { valid: false, error: "Confirmation text must be 'EMERGENCY'" }
      }
      break
      
    case 'transfer':
      if (!params.newOwnerAddress) {
        return { valid: false, error: "New owner address required" }
      }
      
      if (!isValidAddress(params.newOwnerAddress)) {
        return { valid: false, error: "Invalid new owner address" }
      }
      break
      
    case 'renounce':
      if (!params.confirmationText || params.confirmationText !== "RENOUNCE") {
        return { valid: false, error: "Confirmation text must be 'RENOUNCE'" }
      }
      
      if (!params.checkboxChecked) {
        return { valid: false, error: "Must acknowledge irreversible action" }
      }
      break
  }
  
  return { valid: true }
}
