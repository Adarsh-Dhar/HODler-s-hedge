// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {FundingRate} from "../src/FundingRate.sol";

contract DeployFundingRate is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying FundingRate with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy FundingRate
        console.log("Deploying FundingRate...");
        FundingRate fundingRate = new FundingRate();
        console.log("FundingRate deployed at:", address(fundingRate));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("FundingRate:", address(fundingRate));
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("FundingRate owner:", fundingRate.owner());
        console.log("FundingRate fundingRate:", fundingRate.getFundingRate());
    }
}
