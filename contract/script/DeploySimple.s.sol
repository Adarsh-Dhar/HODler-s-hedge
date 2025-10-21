// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {TradingEngine} from "../src/TradingEngine.sol";
import {FundingRate} from "../src/FundingRate.sol";

contract DeploySimple is Script {
    // tBTC address on Mezo testnet
    address constant TBTC = 0x517f2982701695D4E52f1ECFBEf3ba31Df470161;
    
    // Initial BTC price: $42,000 (in wei)
    uint256 constant INITIAL_MARK_PRICE = 42000e18;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        console.log("tBTC address:", TBTC);
        
        // Deploy contracts one by one to avoid nonce issues
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Vault
        console.log("Deploying Vault...");
        Vault vault = new Vault(TBTC);
        console.log("Vault deployed at:", address(vault));
        
        vm.stopBroadcast();
        
        // Wait a bit between deployments
        vm.sleep(2000);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy FundingRate
        console.log("Deploying FundingRate...");
        FundingRate fundingRate = new FundingRate();
        console.log("FundingRate deployed at:", address(fundingRate));
        
        vm.stopBroadcast();
        
        // Wait a bit between deployments
        vm.sleep(2000);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy TradingEngine
        console.log("Deploying TradingEngine...");
        TradingEngine tradingEngine = new TradingEngine(
            address(vault),
            address(fundingRate),
            INITIAL_MARK_PRICE
        );
        console.log("TradingEngine deployed at:", address(tradingEngine));
        
        vm.stopBroadcast();
        
        // Wait a bit between setup calls
        vm.sleep(2000);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Set up cross-references
        console.log("Setting up contract references...");
        vault.setTradingEngine(address(tradingEngine));
        fundingRate.setTradingEngine(address(tradingEngine));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("Vault:", address(vault));
        console.log("TradingEngine:", address(tradingEngine));
        console.log("FundingRate:", address(fundingRate));
        console.log("tBTC Token:", TBTC);
        console.log("Initial Mark Price: $42,000");
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("Vault owner:", vault.owner());
        console.log("TradingEngine owner:", tradingEngine.owner());
        console.log("FundingRate owner:", fundingRate.owner());
        console.log("TradingEngine vault:", address(tradingEngine.vault()));
        console.log("TradingEngine fundingRate:", address(tradingEngine.fundingRate()));
        console.log("TradingEngine markPrice:", tradingEngine.getMarkPrice());
    }
}
