// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {FundingRate} from "../src/FundingRate.sol";

contract SetupReferences is Script {
    // Contract addresses from previous deployments
    address constant VAULT = 0xC8216a06B0E540aD60A03218B07973D266276310;
    address constant FUNDING_RATE = 0xf5994aBc3D99d3e549d63C815f0B66Ac37d40738;
    address constant TRADING_ENGINE = 0x8Fa392720D6B1E7D0D7E94ae865cf4dA4b26da53;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Setting up contract references with account:", deployer);
        console.log("Account balance:", deployer.balance);
        console.log("Vault address:", VAULT);
        console.log("FundingRate address:", FUNDING_RATE);
        console.log("TradingEngine address:", TRADING_ENGINE);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Set up cross-references
        console.log("Setting up Vault -> TradingEngine reference...");
        Vault vault = Vault(VAULT);
        vault.setTradingEngine(TRADING_ENGINE);
        console.log("Vault tradingEngine set to:", vault.tradingEngine());
        
        console.log("Setting up FundingRate -> TradingEngine reference...");
        FundingRate fundingRate = FundingRate(FUNDING_RATE);
        fundingRate.setTradingEngine(TRADING_ENGINE);
        console.log("FundingRate tradingEngine set to:", fundingRate.tradingEngine());
        
        vm.stopBroadcast();
        
        console.log("\n=== Setup Complete ===");
        console.log("Vault:", VAULT);
        console.log("TradingEngine:", TRADING_ENGINE);
        console.log("FundingRate:", FUNDING_RATE);
        console.log("tBTC Token: 0x517f2982701695D4E52f1ECFBEf3ba31Df470161");
        console.log("Initial Mark Price: $42,000");
        
        // Verify setup
        console.log("\n=== Verification ===");
        console.log("Vault owner:", vault.owner());
        console.log("Vault tradingEngine:", vault.tradingEngine());
        console.log("FundingRate owner:", fundingRate.owner());
        console.log("FundingRate tradingEngine:", fundingRate.tradingEngine());
    }
}
