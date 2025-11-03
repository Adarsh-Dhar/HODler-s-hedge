/**
 * Liquidation execution service
 */

import type { PublicClient, WalletClient } from 'viem'
import { TradingEngineABI } from './clients.js'
import type { PositionTracker } from './events.js'
import type { BotConfig, LiquidationResult } from './types.js'
import { parseEventLogs } from 'viem'

export class LiquidationService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient,
    private positionTracker: PositionTracker,
    private tradingEngineAddress: `0x${string}`,
    private config: BotConfig,
  ) {}

  /**
   * Execute liquidation for a given user address
   */
  async executeLiquidation(userAddress: string): Promise<LiquidationResult> {
    try {
      console.log(`⚡ Attempting to liquidate ${userAddress}...`)

      // Get gas price if limit is set
      let gasPrice: bigint | undefined
      if (this.config.maxGasPriceGwei) {
        const feeData = await this.publicClient.estimateFeesPerGas()
        const maxGasPrice = BigInt(this.config.maxGasPriceGwei) * BigInt(1e9) // Convert gwei to wei
        
        if (feeData.maxFeePerGas && feeData.maxFeePerGas > maxGasPrice) {
          console.log(`⚠️ Gas price ${feeData.maxFeePerGas} exceeds limit ${maxGasPrice}, skipping`)
          return {
            success: false,
            user: userAddress as `0x${string}`,
            error: `Gas price too high: ${feeData.maxFeePerGas} > ${maxGasPrice}`,
          }
        }
        gasPrice = feeData.maxFeePerGas || maxGasPrice
      }

      // Execute liquidation transaction
      const hash = await this.walletClient.writeContract({
        address: this.tradingEngineAddress,
        abi: TradingEngineABI,
        chain: null,
        account: null,
        functionName: 'liquidate',
        args: [userAddress as `0x${string}`],
        gasPrice,
      } as any)

      console.log(`📝 Transaction submitted: ${hash}`)

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120000, // 2 minute timeout
      })

      if (receipt.status === 'success') {
        // Parse Liquidated event from logs to extract reward
        let reward: bigint | undefined
        try {
          const logs = parseEventLogs({
            abi: TradingEngineABI,
            logs: receipt.logs,
            eventName: 'Liquidated',
          })

          if (logs.length > 0) {
            reward = (logs[0] as any).args?.reward as bigint
            const rewardFormatted = Number(reward) / 1e18
            console.log(`✅ Successfully liquidated ${userAddress}! Reward: ${rewardFormatted} MUSD`)
          }
        } catch (error) {
          console.warn(`⚠️ Could not parse reward from logs:`, error)
        }

        // Remove position from tracking
        this.positionTracker.removePosition(userAddress)

        return {
          success: true,
          user: userAddress as `0x${string}`,
          txHash: hash,
          reward,
        }
      } else {
        console.error(`❌ Liquidation transaction failed for ${userAddress}`)
        return {
          success: false,
          user: userAddress as `0x${string}`,
          txHash: hash,
          error: 'Transaction reverted',
        }
      }
    } catch (error: any) {
      // Handle specific error cases
      const errorMessage = error.message || String(error)

      if (
        errorMessage.includes('Position not liquidatable') ||
        errorMessage.includes('No position to liquidate')
      ) {
        console.log(
          `⚠️ Position ${userAddress} no longer liquidatable (race condition or already liquidated)`,
        )
        // Remove from tracking if position doesn't exist
        this.positionTracker.removePosition(userAddress)
        return {
          success: false,
          user: userAddress as `0x${string}`,
          error: errorMessage,
        }
      }

      if (errorMessage.includes('insufficient funds')) {
        console.error(`❌ Insufficient funds for gas. Please fund the liquidator wallet.`)
        return {
          success: false,
          user: userAddress as `0x${string}`,
          error: 'Insufficient funds for gas',
        }
      }

      console.error(`❌ Error liquidating ${userAddress}:`, error)
      return {
        success: false,
        user: userAddress as `0x${string}`,
        error: errorMessage,
      }
    }
  }
}

