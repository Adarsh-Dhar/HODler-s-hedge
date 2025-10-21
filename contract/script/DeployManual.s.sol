// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {TradingEngine} from "../src/TradingEngine.sol";
import {FundingRate} from "../src/FundingRate.sol";

contract DeployManual is Script {
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
        
        // Deploy contracts one by one with manual nonce handling
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Vault
        console.log("Deploying Vault...");
        Vault vault = new Vault(TBTC);
        console.log("Vault deployed at:", address(vault));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("Vault:", address(vault));
        console.log("tBTC Token:", TBTC);
        console.log("Initial Mark Price: $42,000");
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("Vault owner:", vault.owner());
        console.log("Vault tBTC address:", address(vault.TBTC()));
    }
}
