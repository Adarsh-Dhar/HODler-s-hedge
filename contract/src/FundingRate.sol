// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract FundingRate is Ownable {
    // Funding rate in basis points (e.g., 10 = 0.001%)
    int256 public fundingRate;
    
    // Last update timestamp
    uint256 public lastUpdateTime;
    
    // Funding interval (8 hours = 28800 seconds)
    uint256 public constant FUNDING_INTERVAL = 8 hours;
    
    // Reference to TradingEngine
    address public tradingEngine;
    
    // Events
    event FundingRateUpdated(int256 oldRate, int256 newRate, uint256 timestamp);
    event TradingEngineUpdated(address indexed oldEngine, address indexed newEngine);
    
    constructor() Ownable(msg.sender) {
        lastUpdateTime = block.timestamp;
    }
    
    modifier onlyTradingEngine() {
        _onlyTradingEngine();
        _;
    }
    
    function _onlyTradingEngine() internal view {
        require(msg.sender == tradingEngine, "FundingRate: Only TradingEngine");
    }
    
    function setTradingEngine(address _tradingEngine) external onlyOwner {
        require(_tradingEngine != address(0), "FundingRate: Invalid address");
        address oldEngine = tradingEngine;
        tradingEngine = _tradingEngine;
        emit TradingEngineUpdated(oldEngine, _tradingEngine);
    }
    
    function updateFundingRate(int256 newRate) external onlyOwner {
        int256 oldRate = fundingRate;
        fundingRate = newRate;
        lastUpdateTime = block.timestamp;
        
        emit FundingRateUpdated(oldRate, newRate, block.timestamp);
    }
    
    function getFundingRate() external view returns (int256) {
        return fundingRate;
    }
    
    function calculateFundingPayment(uint256 positionSize, bool isLong) external view returns (int256) {
        // Funding payment = positionSize * fundingRate / 10000
        // Long positions pay funding when rate is positive, receive when negative
        // Short positions receive funding when rate is positive, pay when negative
        
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 payment = (int256(positionSize) * fundingRate) / 10000;
        
        if (isLong) {
            return payment; // Long pays positive funding rate
        } else {
            return -payment; // Short receives positive funding rate
        }
    }
    
    function getNextFundingTime() external view returns (uint256) {
        uint256 nextFunding = lastUpdateTime + FUNDING_INTERVAL;
        if (nextFunding <= block.timestamp) {
            return 0; // Funding is due now
        }
        return nextFunding - block.timestamp;
    }
    
    function isFundingDue() external view returns (bool) {
        return block.timestamp >= lastUpdateTime + FUNDING_INTERVAL;
    }
    
    function getFundingInterval() external pure returns (uint256) {
        return FUNDING_INTERVAL;
    }
    
    // Function to be called by TradingEngine when closing positions
    function applyFundingPayment(uint256 positionSize, bool isLong) external view onlyTradingEngine returns (int256) {
        return this.calculateFundingPayment(positionSize, isLong);
    }
}
