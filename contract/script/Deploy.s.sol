// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {TradingEngine} from "../src/TradingEngine.sol";
import {FundingRate} from "../src/FundingRate.sol";
import {MockTBTC} from "../src/MockTBTC.sol";

contract DeployScript is Script {
    // Initial BTC price: $42,000 (in wei)
    uint256 constant INITIAL_MARK_PRICE = 42000e18;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Get current nonce and use it
        uint256 currentNonce = vm.getNonce(deployer);
        console.log("Current nonce:", currentNonce);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MockTBTC first
        console.log("Deploying MockTBTC...");
        MockTBTC tbtc = new MockTBTC();
        console.log("MockTBTC deployed at:", address(tbtc));
        
        // Deploy Vault with MockTBTC address
        console.log("Deploying Vault...");
        Vault vault = new Vault(address(tbtc));
        console.log("Vault deployed at:", address(vault));
        
        // Deploy FundingRate
        console.log("Deploying FundingRate...");
        FundingRate fundingRate = new FundingRate();
        console.log("FundingRate deployed at:", address(fundingRate));
        
        // Deploy TradingEngine with references
        console.log("Deploying TradingEngine...");
        TradingEngine tradingEngine = new TradingEngine(
            address(vault),
            address(fundingRate),
            INITIAL_MARK_PRICE
        );
        console.log("TradingEngine deployed at:", address(tradingEngine));
        
        // Set up cross-references after all contracts are deployed
        console.log("Setting up contract references...");
        vault.setTradingEngine(address(tradingEngine));
        fundingRate.setTradingEngine(address(tradingEngine));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("Vault:", address(vault));
        console.log("TradingEngine:", address(tradingEngine));
        console.log("FundingRate:", address(fundingRate));
        console.log("MockTBTC:", address(tbtc));
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
