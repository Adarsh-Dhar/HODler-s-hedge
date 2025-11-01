/**
 * viem client setup for PublicClient and WalletClient
 */

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { BotConfig } from './types.js'

// TradingEngine ABI - imported from contract ABI JSON
// This matches lib/abi/TradingEngine.ts
export const TradingEngineABI = [
  {
    type: 'function',
    name: 'getPosition',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [
      {
        type: 'tuple',
        internalType: 'struct TradingEngine.Position',
        components: [
          { name: 'isLong', type: 'bool' },
          { name: 'entryPrice', type: 'uint256' },
          { name: 'size', type: 'uint256' },
          { name: 'margin', type: 'uint256' },
          { name: 'leverage', type: 'uint256' },
          { name: 'openTimestamp', type: 'uint256' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isLiquidatable',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidate',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'markPrice',
    inputs: [],
    outputs: [{ type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PositionOpened',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'isLong', type: 'bool' },
      { indexed: false, name: 'margin', type: 'uint256' },
      { indexed: false, name: 'leverage', type: 'uint256' },
      { indexed: false, name: 'entryPrice', type: 'uint256' },
      { indexed: false, name: 'positionSize', type: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionClosed',
    inputs: [{ indexed: true, name: 'user', type: 'address' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Liquidated',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'liquidator', type: 'address' },
      { indexed: false, name: 'reward', type: 'uint256' },
    ],
    anonymous: false,
  },
] as const

// Mezo Testnet chain configuration (matching app/provider.tsx)
export const mezoTestnet = {
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.test.mezo.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Testnet Explorer',
      url: 'https://explorer.test.mezo.org',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11' as `0x${string}`,
      blockCreated: 3669328,
    },
  },
  testnet: true,
} as const

export function createClients(config: BotConfig): {
  publicClient: PublicClient
  walletClient: WalletClient
  account: ReturnType<typeof privateKeyToAccount>
} {
  const account = privateKeyToAccount(config.liquidatorPrivateKey)

  const publicClient = createPublicClient({
    chain: mezoTestnet,
    transport: http(config.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain: mezoTestnet,
    transport: http(config.rpcUrl),
  })

  return {
    publicClient,
    walletClient,
    account,
  }
}

