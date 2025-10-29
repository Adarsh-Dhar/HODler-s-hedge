// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {FundingRate} from "../src/FundingRate.sol";

contract SetupReferencesScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Setting up contract references with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Get contract addresses from environment
        address vaultAddress = vm.envOr("VAULT_ADDRESS", address(0));
        address fundingRateAddress = vm.envOr("FUNDING_RATE_ADDRESS", address(0));
        address tradingEngineAddress = vm.envOr("TRADING_ENGINE_ADDRESS", address(0));
        
        require(vaultAddress != address(0), "VAULT_ADDRESS not set");
        require(fundingRateAddress != address(0), "FUNDING_RATE_ADDRESS not set");
        require(tradingEngineAddress != address(0), "TRADING_ENGINE_ADDRESS not set");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Set up contract references
        console.log("Setting up Vault -> TradingEngine reference...");
        Vault vault = Vault(vaultAddress);
        vault.setTradingEngine(tradingEngineAddress);
        console.log("Vault tradingEngine set to:", vault.tradingEngine());
        
        console.log("Setting up FundingRate -> TradingEngine reference...");
        FundingRate fundingRate = FundingRate(fundingRateAddress);
        fundingRate.setTradingEngine(tradingEngineAddress);
        console.log("FundingRate tradingEngine set to:", fundingRate.tradingEngine());
        
        vm.stopBroadcast();
        
        console.log("\n=== Setup Summary ===");
        console.log("Vault:", vaultAddress);
        console.log("FundingRate:", fundingRateAddress);
        console.log("TradingEngine:", tradingEngineAddress);
        console.log("All references set successfully!");
    }
}