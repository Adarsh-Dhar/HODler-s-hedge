/**
 * Test script to verify bot configuration and contract connection
 */

import { loadConfig } from './config.js'
import { createClients } from './clients.js'
import { TradingEngineABI } from './clients.js'

async function testConnection() {
  console.log('🧪 Testing Liquidation Bot Configuration...')
  console.log('='.repeat(50))

  // Test configuration loading
  console.log('\n1. Testing configuration...')
  try {
    const config = loadConfig()
    console.log('✅ Configuration loaded successfully')
    console.log(`   Trading Engine: ${config.tradingEngineAddress}`)
    console.log(`   RPC URL: ${config.rpcUrl}`)
  } catch (error: any) {
    console.error('❌ Configuration error:', error.message)
    process.exit(1)
  }

  // Test RPC connection
  console.log('\n2. Testing RPC connection...')
  try {
    const config = loadConfig()
    const { publicClient, walletClient, account } = createClients(config)
    
    const blockNumber = await publicClient.getBlockNumber()
    console.log('✅ RPC connection successful')
    console.log(`   Current block: ${blockNumber}`)
    
    const balance = await publicClient.getBalance({ address: account.address })
    const balanceFormatted = Number(balance) / 1e18
    console.log(`   Liquidator balance: ${balanceFormatted} BTC`)
    
    if (balance === 0n) {
      console.warn('⚠️ WARNING: Liquidator wallet has 0 balance')
    }
  } catch (error: any) {
    console.error('❌ RPC connection failed:', error.message)
    process.exit(1)
  }

  // Test contract connection
  console.log('\n3. Testing contract connection...')
  try {
    const config = loadConfig()
    const { publicClient } = createClients(config)
    
    // Try reading a view function
    const markPrice = await publicClient.readContract({
      address: config.tradingEngineAddress,
      abi: TradingEngineABI,
      functionName: 'markPrice',
    })
    
    const paused = await publicClient.readContract({
      address: config.tradingEngineAddress,
      abi: TradingEngineABI,
      functionName: 'paused',
    })
    
    console.log('✅ Contract connection successful')
    console.log(`   Mark Price: ${Number(markPrice) / 1e18}`)
    console.log(`   Paused: ${paused}`)
    
    if (paused) {
      console.warn('⚠️ WARNING: TradingEngine is paused')
    }
  } catch (error: any) {
    console.error('❌ Contract connection failed:', error.message)
    process.exit(1)
  }

  // Test event querying
  console.log('\n4. Testing event querying...')
  try {
    const config = loadConfig()
    const { publicClient } = createClients(config)
    
    const currentBlock = await publicClient.getBlockNumber()
    const fromBlock = currentBlock - 100n // Last 100 blocks
    
    const logs = await publicClient.getLogs({
      address: config.tradingEngineAddress,
      event: {
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
      },
      fromBlock,
      toBlock: currentBlock,
    })
    
    console.log('✅ Event querying successful')
    console.log(`   Found ${logs.length} PositionOpened events in last 100 blocks`)
  } catch (error: any) {
    console.error('❌ Event querying failed:', error.message)
    process.exit(1)
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ All tests passed! Bot is ready to run.')
  console.log('💡 Run "npm start" to start the liquidation bot.')
}

testConnection().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

