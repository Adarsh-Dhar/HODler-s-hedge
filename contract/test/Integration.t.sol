// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";
import {TradingEngine} from "../src/TradingEngine.sol";
import {FundingRate} from "../src/FundingRate.sol";
import {ITBTC} from "../src/interfaces/ITBTC.sol";

contract IntegrationTest is Test {
    Vault public vault;
    TradingEngine public tradingEngine;
    FundingRate public fundingRate;
    ITBTC public tbtc;
    
    address public user = address(0x1);
    address public liquidator = address(0x2);
    
    // BTC address on Mezo testnet
    address constant TBTC = 0x7b7C000000000000000000000000000000000000;
    
    function setUp() public {
        // Deploy contracts
        vault = new Vault(TBTC);
        fundingRate = new FundingRate();
        tradingEngine = new TradingEngine(address(vault), address(fundingRate), 42000e18);
        
        // Set up cross-references
        vault.setTradingEngine(address(tradingEngine));
        fundingRate.setTradingEngine(address(tradingEngine));
        
        // Set up tBTC interface
        tbtc = ITBTC(TBTC);
        
        // Give user some BTC (mock for testing)
        vm.deal(user, 10 ether);
    }
    
    function testFullTradingFlow() public {
        // This is a basic integration test
        // In a real test, you would need to mock the BTC token
        // or deploy a test ERC20 token
        
        // Test that contracts are properly connected
        assertEq(address(tradingEngine.vault()), address(vault));
        assertEq(address(tradingEngine.fundingRate()), address(fundingRate));
        assertEq(tradingEngine.getMarkPrice(), 42000e18);
        
        // Test that user has no position initially
        TradingEngine.Position memory position = tradingEngine.getPosition(user);
        assertFalse(position.exists);
        
        // Test liquidation price calculation
        uint256 liqPrice = tradingEngine.calculateLiquidationPrice(user);
        assertEq(liqPrice, 0); // No position, so 0
    }
    
    function testFundingRate() public {
        // Test funding rate functionality
        assertEq(fundingRate.getFundingRate(), 0);
        
        // Update funding rate
        fundingRate.updateFundingRate(10); // 0.001%
        assertEq(fundingRate.getFundingRate(), 10);
        
        // Test funding payment calculation
        int256 payment = fundingRate.calculateFundingPayment(1000e18, true); // 1000 BTC long
        assertTrue(payment > 0); // Long pays positive funding rate
    }
    
    function testMarkPriceUpdate() public {
        uint256 newPrice = 45000e18;
        tradingEngine.setMarkPrice(newPrice);
        assertEq(tradingEngine.getMarkPrice(), newPrice);
    }
}
