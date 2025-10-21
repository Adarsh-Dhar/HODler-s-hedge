// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {TradingEngine} from "../src/TradingEngine.sol";

contract DeployTradingEngine is Script {
    // Contract addresses from previous deployments
    address constant VAULT = 0xC8216a06B0E540aD60A03218B07973D266276310;
    address constant FUNDING_RATE = 0xf5994aBc3D99d3e549d63C815f0B66Ac37d40738;
    
    // Initial BTC price: $42,000 (in wei)
    uint256 constant INITIAL_MARK_PRICE = 42000e18;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying TradingEngine with account:", deployer);
        console.log("Account balance:", deployer.balance);
        console.log("Vault address:", VAULT);
        console.log("FundingRate address:", FUNDING_RATE);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy TradingEngine
        console.log("Deploying TradingEngine...");
        TradingEngine tradingEngine = new TradingEngine(
            VAULT,
            FUNDING_RATE,
            INITIAL_MARK_PRICE
        );
        console.log("TradingEngine deployed at:", address(tradingEngine));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("TradingEngine:", address(tradingEngine));
        console.log("Vault:", VAULT);
        console.log("FundingRate:", FUNDING_RATE);
        console.log("Initial Mark Price: $42,000");
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("TradingEngine owner:", tradingEngine.owner());
        console.log("TradingEngine vault:", address(tradingEngine.vault()));
        console.log("TradingEngine fundingRate:", address(tradingEngine.fundingRate()));
        console.log("TradingEngine markPrice:", tradingEngine.getMarkPrice());
    }
}
