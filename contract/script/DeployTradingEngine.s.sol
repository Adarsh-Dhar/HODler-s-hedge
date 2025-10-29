// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {TradingEngine} from "../src/TradingEngine.sol";

contract DeployTradingEngineScript is Script {
    // Initial BTC price: $42,000 (in wei)
    uint256 constant INITIAL_MARK_PRICE = 42000e18;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying TradingEngine with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Get contract addresses from environment or use defaults
        address vaultAddress = vm.envOr("VAULT_ADDRESS", address(0));
        address fundingRateAddress = vm.envOr("FUNDING_RATE_ADDRESS", address(0));
        
        require(vaultAddress != address(0), "VAULT_ADDRESS not set");
        require(fundingRateAddress != address(0), "FUNDING_RATE_ADDRESS not set");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy TradingEngine
        console.log("Deploying TradingEngine...");
        TradingEngine tradingEngine = new TradingEngine(
            vaultAddress,
            fundingRateAddress,
            INITIAL_MARK_PRICE
        );
        console.log("TradingEngine deployed at:", address(tradingEngine));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("TradingEngine:", address(tradingEngine));
        console.log("Vault:", vaultAddress);
        console.log("FundingRate:", fundingRateAddress);
        console.log("Initial Mark Price: $42,000");
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("TradingEngine owner:", tradingEngine.owner());
        console.log("TradingEngine vault:", address(tradingEngine.vault()));
        console.log("TradingEngine fundingRate:", address(tradingEngine.fundingRate()));
        console.log("TradingEngine markPrice:", tradingEngine.getMarkPrice());
    }
}