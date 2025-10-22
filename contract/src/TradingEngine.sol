// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Vault} from "./Vault.sol";
import {FundingRate} from "./FundingRate.sol";

contract TradingEngine is ReentrancyGuard, Ownable {
    // Position structure
    struct Position {
        bool isLong;
        uint256 entryPrice;
        uint256 size; // Position size in tBTC
        uint256 margin; // Margin in tBTC
        uint256 leverage;
        uint256 openTimestamp;
        bool exists;
    }
    
    // User positions (one position per user)
    mapping(address => Position) public positions;
    
    // Current mark price (in wei, e.g., $42,000 = 42000e18)
    uint256 public markPrice;
    
    // Trading fee (0.1% = 0.001)
    uint256 public constant TRADING_FEE = 1000; // 0.1% in basis points
    
    // Maintenance margin ratio (5% for 20x max leverage)
    uint256 public constant MAINTENANCE_MARGIN_RATIO = 500; // 5% in basis points
    
    // Maximum leverage
    uint256 public constant MAX_LEVERAGE = 20;
    
    // Contract references
    Vault public vault;
    FundingRate public fundingRate;
    
    // Events
    event PositionOpened(
        address indexed user, 
        bool isLong, 
        uint256 margin, 
        uint256 leverage, 
        uint256 entryPrice,
        uint256 positionSize
    );
    event PositionClosed(
        address indexed user, 
        int256 pnl, 
        uint256 exitPrice,
        int256 fundingPayment
    );
    event Liquidated(
        address indexed user, 
        address indexed liquidator, 
        uint256 reward
    );
    event MarkPriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    constructor(address _vault, address _fundingRate, uint256 _initialMarkPrice) Ownable(msg.sender) {
        vault = Vault(_vault);
        fundingRate = FundingRate(_fundingRate);
        markPrice = _initialMarkPrice;
    }
    
    modifier onlyValidLeverage(uint256 leverage) {
        _onlyValidLeverage(leverage);
        _;
    }
    
    function _onlyValidLeverage(uint256 leverage) internal pure {
        require(leverage >= 1 && leverage <= MAX_LEVERAGE, "TradingEngine: Invalid leverage");
    }
    
    function setMarkPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "TradingEngine: Invalid price");
        uint256 oldPrice = markPrice;
        markPrice = newPrice;
        emit MarkPriceUpdated(oldPrice, newPrice);
    }
    
    function openPosition(
        bool isLong, 
        uint256 marginAmount, 
        uint256 leverage
    ) external nonReentrant onlyValidLeverage(leverage) whenNotPaused {
        require(marginAmount > 0, "TradingEngine: Margin must be positive");
        require(!positions[msg.sender].exists, "TradingEngine: Position already exists");
        
        // Calculate position size
        uint256 positionSize = marginAmount * leverage;
        
        // Calculate trading fee (currently unused but kept for future implementation)
        // uint256 fee = (positionSize * TRADING_FEE) / 100000;
        
        // Lock margin in vault
        vault.lockMargin(msg.sender, marginAmount);
        
        // Create position
        positions[msg.sender] = Position({
            isLong: isLong,
            entryPrice: markPrice,
            size: positionSize,
            margin: marginAmount,
            leverage: leverage,
            openTimestamp: block.timestamp,
            exists: true
        });
        
        emit PositionOpened(msg.sender, isLong, marginAmount, leverage, markPrice, positionSize);
    }
    
    function closePosition() external nonReentrant whenNotPaused {
        Position storage position = positions[msg.sender];
        require(position.exists, "TradingEngine: No position to close");
        
        // Calculate PnL
        int256 pnl = calculatePnL(position);
        
        // Calculate funding payment
        int256 fundingPayment = fundingRate.applyFundingPayment(position.size, position.isLong);
        
        // Total PnL including funding
        int256 totalPnL = pnl - fundingPayment;
        
        // Unlock margin and PnL in vault
        vault.unlockMargin(msg.sender, position.margin, totalPnL);
        
        // Clear position
        delete positions[msg.sender];
        
        emit PositionClosed(msg.sender, totalPnL, markPrice, fundingPayment);
    }
    
    function liquidate(address user) external nonReentrant {
        Position storage position = positions[user];
        require(position.exists, "TradingEngine: No position to liquidate");
        require(isLiquidatable(user), "TradingEngine: Position not liquidatable");
        
        // Calculate PnL
        int256 pnl = calculatePnL(position);
        
        // Calculate funding payment
        int256 fundingPayment = fundingRate.applyFundingPayment(position.size, position.isLong);
        
        // Total PnL including funding
        int256 totalPnL = pnl - fundingPayment;
        
        // Liquidator gets remaining margin as reward
        uint256 liquidatorReward = position.margin;
        if (totalPnL > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            liquidatorReward += uint256(totalPnL);
        }
        
        // Unlock margin (liquidator gets the reward)
        vault.unlockMargin(user, position.margin, totalPnL);
        
        // Clear position
        delete positions[user];
        
        emit Liquidated(user, msg.sender, liquidatorReward);
    }
    
    function getPosition(address user) external view returns (Position memory) {
        return positions[user];
    }
    
    function getMarkPrice() external view returns (uint256) {
        return markPrice;
    }
    
    function calculateLiquidationPrice(address user) external view returns (uint256) {
        Position memory position = positions[user];
        if (!position.exists) return 0;
        
        // Liquidation price calculation
        // For long: liquidationPrice = entryPrice * (1 - (1/leverage) * (1 - maintenanceMarginRatio))
        // For short: liquidationPrice = entryPrice * (1 + (1/leverage) * (1 - maintenanceMarginRatio))
        
        // Calculate maintenance margin (currently unused but kept for future implementation)
        // uint256 maintenanceMargin = (position.size * MAINTENANCE_MARGIN_RATIO) / 100000;
        uint256 priceImpact = (position.entryPrice * (100000 - MAINTENANCE_MARGIN_RATIO)) / (position.leverage * 100000);
        
        if (position.isLong) {
            return position.entryPrice - priceImpact;
        } else {
            return position.entryPrice + priceImpact;
        }
    }
    
    function isLiquidatable(address user) public view returns (bool) {
        Position memory position = positions[user];
        if (!position.exists) return false;
        
        uint256 liquidationPrice = this.calculateLiquidationPrice(user);
        
        if (position.isLong) {
            return markPrice <= liquidationPrice;
        } else {
            return markPrice >= liquidationPrice;
        }
    }
    
    function calculatePnL(Position memory position) internal view returns (int256) {
        if (position.isLong) {
            // PnL = (markPrice - entryPrice) * size / entryPrice
            return int256((markPrice - position.entryPrice) * position.size / position.entryPrice);
        } else {
            // PnL = (entryPrice - markPrice) * size / entryPrice
            return int256((position.entryPrice - markPrice) * position.size / position.entryPrice);
        }
    }
    
    // Emergency pause functionality
    bool public paused;
    
    modifier whenNotPaused() {
        _whenNotPaused();
        _;
    }
    
    function _whenNotPaused() internal view {
        require(!paused, "TradingEngine: Contract is paused");
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
}
