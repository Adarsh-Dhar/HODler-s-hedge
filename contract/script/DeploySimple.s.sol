// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MockTBTC} from "../src/MockTBTC.sol";

contract DeploySimpleScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying MockTBTC only with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy only MockTBTC
        console.log("Deploying MockTBTC...");
        MockTBTC tbtc = new MockTBTC();
        console.log("MockTBTC deployed at:", address(tbtc));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("MockTBTC:", address(tbtc));
    }
}
