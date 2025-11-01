// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PythOracle} from "../src/oracle/PythOracle.sol";

contract DeployPythOracleScript is Script {
    // Pyth contract address (Mezo testnet)
    address constant PYTH_CONTRACT = 0x2880aB155794e7179c9eE2e38200202908C17B43;
    
    // BTC/USD price feed ID
    bytes32 constant BTC_USD_PRICE_ID = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    
    // Maximum age for price feed (1 hour = 3600 seconds)
    uint256 constant MAX_AGE_SECONDS = 3600;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying PythOracle with account:", deployer);
        console.log("Account balance:", deployer.balance);
        console.log("Pyth contract:", PYTH_CONTRACT);
        console.log("BTC/USD Price ID:", vm.toString(BTC_USD_PRICE_ID));
        console.log("Max age seconds:", MAX_AGE_SECONDS);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy PythOracle
        console.log("\nDeploying PythOracle...");
        PythOracle pythOracle = new PythOracle(
            PYTH_CONTRACT,
            BTC_USD_PRICE_ID,
            MAX_AGE_SECONDS
        );
        
        console.log("PythOracle deployed at:", address(pythOracle));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("PythOracle address:", address(pythOracle));
        console.log("Pyth contract:", PYTH_CONTRACT);
        console.log("BTC/USD Price ID:", vm.toString(BTC_USD_PRICE_ID));
        console.log("Max age:", MAX_AGE_SECONDS, "seconds");
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("PythOracle owner:", pythOracle.owner());
        console.log("Pyth contract (stored):", address(pythOracle.pyth()));
        console.log("BTC/USD Price ID (stored):", vm.toString(pythOracle.btcUsdPriceId()));
        console.log("Max age (stored):", pythOracle.maxAgeSeconds(), "seconds");
    }
}

