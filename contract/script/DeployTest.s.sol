// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SimpleTest} from "../src/SimpleTest.sol";

contract DeployTestScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying SimpleTest with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy SimpleTest
        console.log("Deploying SimpleTest...");
        SimpleTest test = new SimpleTest();
        console.log("SimpleTest deployed at:", address(test));
        console.log("Initial value:", test.value());
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("SimpleTest:", address(test));
    }
}
