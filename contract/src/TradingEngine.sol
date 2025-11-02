// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Vault} from "./Vault.sol";
import {InsuranceFund} from "./InsuranceFund.sol";
import {FundingRate} from "./FundingRate.sol";
import {PythOracle} from "./oracle/PythOracle.sol";

interface IVaultExtended {
    function unlockMarginWithLiquidator(
        address user,
        uint256 amount,
        int256 pnl,
        address liquidator,
        uint256 liquidatorRewardTbtc,
        uint256 liquidatorRewardMusd
    ) external;

    function handleLiquidationSettlement(
        address user,
        uint256 tbtcMargin,
        int256 totalPnl,
        address liquidator,
        uint256 liquidatorRewardMusd,
        address insuranceFund,
        uint256 insuranceDepositMusd,
        uint256 badDebtAmountMusd
    ) external;

    function unlockMarginAndSettleMusd(
        address user,
        uint256 amountTbtc,
        int256 pnlTbtc,
        int256 pnlMusd
    ) external;
}

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
    
    // Maintenance margin ratio (70.6% - adjusted to achieve ~1.47% price drop for liquidation at 20x leverage)
    // This is non-standard but matches desired liquidation price of ~$109k from $110,626 entry
    uint256 public constant MAINTENANCE_MARGIN_RATIO = 7060; // 70.6% in basis points
    uint256 public constant LIQUIDATION_BONUS = 500; // 5% bonus in basis points
    
    // Maximum leverage
    uint256 public constant MAX_LEVERAGE = 20;
    
    // Contract references
    Vault public vault;
    FundingRate public fundingRate;
    PythOracle public pythOracle;
    InsuranceFund public insuranceFund;

    // Fees and risk controls
    address public treasury;
    uint256 public protocolFeeBps; // e.g. 10 = 0.1%
    uint256 public maxOpenInterestTbtc; // in tBTC units (8 decimals aligned with margin)
    uint256 public currentOpenInterestTbtc; // tracks total open size
    uint256 public maxOracleMoveBps; // sanity band vs last markPrice
    
    // Long/short open interest tracking for funding rate calculation
    uint256 public longOpenInterestTbtc; // Total long position size
    uint256 public shortOpenInterestTbtc; // Total short position size
    
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
    event BadDebtOccurred(address indexed user, uint256 badDebtAmountMusd, uint256 coverageFromInsuranceFund);
    
    constructor(address _vault, address _fundingRate, uint256 _initialMarkPrice) Ownable(msg.sender) {
        vault = Vault(_vault);
        fundingRate = FundingRate(_fundingRate);
        markPrice = _initialMarkPrice;
    }

    function setInsuranceFund(address _insuranceFund) external onlyOwner {
        require(_insuranceFund != address(0), "TradingEngine: invalid IF");
        insuranceFund = InsuranceFund(_insuranceFund);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setProtocolFeeBps(uint256 _bps) external onlyOwner {
        protocolFeeBps = _bps;
    }

    function setMaxOpenInterestTbtc(uint256 _max) external onlyOwner {
        maxOpenInterestTbtc = _max;
    }

    function setMaxOracleMoveBps(uint256 _bps) external onlyOwner {
        maxOracleMoveBps = _bps;
    }

    function _getOraclePrice18() internal view returns (uint256) {
        require(address(pythOracle) != address(0), "TradingEngine: oracle not set");
        (uint256 price18,, , ,) = pythOracle.getBtcUsdPrice();
        require(price18 > 0, "TradingEngine: oracle returned zero");
        return price18;
    }

    function setPythOracle(address _pythOracle) external onlyOwner {
        require(_pythOracle != address(0), "TradingEngine: invalid oracle");
        pythOracle = PythOracle(_pythOracle);
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

    // Refresh mark price from Pyth via oracle using Hermes updates. Excess ETH is refunded by oracle.
    function refreshMarkPrice(bytes[] calldata updates) external payable whenNotPaused {
        require(address(pythOracle) != address(0), "TradingEngine: oracle not set");
        pythOracle.updatePriceFeeds{value: msg.value}(updates);
        (uint256 price18,, , ,) = pythOracle.getBtcUsdPrice();
        require(price18 > 0, "TradingEngine: oracle returned zero");
        uint256 oldPrice = markPrice;
        if (maxOracleMoveBps > 0 && oldPrice > 0) {
            uint256 diff = price18 > oldPrice ? (price18 - oldPrice) : (oldPrice - price18);
            require(diff * 10000 / oldPrice <= maxOracleMoveBps, "TradingEngine: oracle move too large");
        }
        markPrice = price18;
        emit MarkPriceUpdated(oldPrice, price18);
    }

    function peekOraclePrice() external view returns (uint256 price18, uint256 publishTime) {
        require(address(pythOracle) != address(0), "TradingEngine: oracle not set");
        (price18, publishTime,, ,) = pythOracle.getBtcUsdPrice();
    }
    
    function openPosition(
        bool isLong, 
        uint256 marginAmount, 
        uint256 leverage
    ) external nonReentrant onlyValidLeverage(leverage) whenNotPaused {
        require(marginAmount > 0, "TradingEngine: Margin must be positive");
        require(!positions[msg.sender].exists, "TradingEngine: Position already exists");
        // Oracle sanity vs mark
        if (maxOracleMoveBps > 0 && markPrice > 0) {
            uint256 oracle = _getOraclePrice18();
            uint256 diff = oracle > markPrice ? (oracle - markPrice) : (markPrice - oracle);
            require(diff * 10000 / markPrice <= maxOracleMoveBps, "TradingEngine: oracle/mark divergence");
        }
        
        // Calculate position size
        uint256 positionSize = marginAmount * leverage;

        // OI cap
        if (maxOpenInterestTbtc > 0) {
            require(currentOpenInterestTbtc + positionSize <= maxOpenInterestTbtc, "TradingEngine: OI cap");
        }
        
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
        
        currentOpenInterestTbtc += positionSize;
        // Track long/short separately for funding rate calculation
        if (isLong) {
            longOpenInterestTbtc += positionSize;
        } else {
            shortOpenInterestTbtc += positionSize;
        }
        emit PositionOpened(msg.sender, isLong, marginAmount, leverage, markPrice, positionSize);
    }
    
    function closePosition() external nonReentrant whenNotPaused {
        Position storage position = positions[msg.sender];
        require(position.exists, "TradingEngine: No position to close");
        
        // Calculate PnL in tBTC
        int256 pnlTbtc = calculatePnL(position);
        
        // Calculate funding payment
        int256 fundingPayment = fundingRate.applyFundingPayment(position.size, position.isLong);
        
        // Total PnL including funding (tBTC terms)
        int256 totalPnlTbtc = pnlTbtc - fundingPayment;

        // Convert PnL to MUSD using oracle (18 decimals price; tBTC has 8)
        uint256 price18 = _getOraclePrice18();
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 pnlMusd = (totalPnlTbtc * int256(price18)) / int256(1e8);

        // Protocol fee on notional at close
        uint256 notionalMusd = (position.size * price18) / 1e8;
        uint256 feeMusd = protocolFeeBps > 0 ? (notionalMusd * protocolFeeBps) / 10000 : 0;
        if (feeMusd > 0 && treasury != address(0)) {
            // Deduct fee from user's MUSD outcome
            // forge-lint: disable-next-line(unsafe-typecast)
            pnlMusd -= int256(feeMusd);
            // Credit/transfer fee to treasury via Vault
            Vault(address(vault)).creditTreasury(feeMusd);
        }
        
        // Unlock tBTC margin and settle MUSD accounting
        IVaultExtended(address(vault)).unlockMarginAndSettleMusd(
            msg.sender,
            position.margin,
            totalPnlTbtc,
            pnlMusd
        );
        
        // Clear position
        // Update long/short tracking
        if (position.isLong) {
            longOpenInterestTbtc -= position.size;
        } else {
            shortOpenInterestTbtc -= position.size;
        }
        currentOpenInterestTbtc -= position.size;
        delete positions[msg.sender];
        
        emit PositionClosed(msg.sender, totalPnlTbtc, markPrice, fundingPayment);
    }
    
    function liquidate(address user) external nonReentrant {
        Position storage position = positions[user];
        require(position.exists, "TradingEngine: No position to liquidate");
        // Oracle sanity vs mark
        if (maxOracleMoveBps > 0 && markPrice > 0) {
            uint256 oracle = _getOraclePrice18();
            uint256 diff = oracle > markPrice ? (oracle - markPrice) : (markPrice - oracle);
            require(diff * 10000 / markPrice <= maxOracleMoveBps, "TradingEngine: oracle/mark divergence");
        }
        require(isLiquidatable(user), "TradingEngine: Position not liquidatable");
        
        // Calculate PnL
        int256 pnl = calculatePnL(position);
        
        // Calculate funding payment
        int256 fundingPayment = fundingRate.applyFundingPayment(position.size, position.isLong);
        
        // Total PnL including funding
        int256 totalPnL = pnl - fundingPayment;

        // Compute remaining margin in tBTC terms (if positive)
        uint256 remainingTbtc = 0;
        {
            int256 rem = int256(position.margin) + totalPnL;
            if (rem > 0) {
                // forge-lint: disable-next-line(unsafe-typecast)
                remainingTbtc = uint256(rem);
            }
        }

        // Compute oracle price for conversion to MUSD (18 decimals)
        uint256 price18 = _getOraclePrice18();

        // Convert values to MUSD (assume MUSD 18 decimals): tBTC has 8 decimals
        uint256 marginMusd = (position.margin * price18) / 1e8;
        uint256 remainingMusd = (remainingTbtc * price18) / 1e8;

        // Protocol fee on notional during liquidation (taken from remaining, capped)
        uint256 notionalMusd = (position.size * price18) / 1e8;
        uint256 feeMusd = protocolFeeBps > 0 ? (notionalMusd * protocolFeeBps) / 10000 : 0;
        if (feeMusd > 0 && treasury != address(0)) {
            uint256 feeTaken = feeMusd > remainingMusd ? remainingMusd : feeMusd;
            if (feeTaken > 0) {
                remainingMusd -= feeTaken;
                Vault(address(vault)).creditTreasury(feeTaken);
            }
        }

        // Check for bad debt scenario
        // Calculate the actual remaining in tBTC terms (can be negative)
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 remainingTbtcSigned = int256(position.margin) + totalPnL;
        
        uint256 badDebtAmountMusd = 0;
        uint256 coverageFromInsuranceFund = 0;
        uint256 liquidatorRewardMusd = 0;
        uint256 insuranceDepositMusd = 0;

        if (remainingTbtcSigned <= 0) {
            // Bad debt scenario: remaining margin cannot cover the loss
            if (remainingTbtcSigned < 0) {
                // Calculate bad debt amount in MUSD from negative tBTC
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256 badDebtTbtc = uint256(-remainingTbtcSigned);
                badDebtAmountMusd = (badDebtTbtc * price18) / 1e8;

                // Attempt to cover bad debt from Insurance Fund
                if (badDebtAmountMusd > 0 && address(insuranceFund) != address(0)) {
                    coverageFromInsuranceFund = insuranceFund.coverBadDebt(badDebtAmountMusd, address(vault));
                }

                emit BadDebtOccurred(user, badDebtAmountMusd, coverageFromInsuranceFund);
            }
            // If remainingTbtcSigned == 0, no bad debt but also no distribution
        } else {
            // Normal liquidation: distribute remaining funds
            // Max reward as % of collateral value in MUSD
            uint256 maxRewardMusd = (marginMusd * LIQUIDATION_BONUS) / 10000;
            liquidatorRewardMusd = remainingMusd < maxRewardMusd ? remainingMusd : maxRewardMusd;

            // Excess that should go to Insurance Fund
            if (remainingMusd > liquidatorRewardMusd) {
                insuranceDepositMusd = remainingMusd - liquidatorRewardMusd;
            }
        }

        // Settle via Vault: do not return margin to user on liquidation; distribute MUSD
        IVaultExtended(address(vault)).handleLiquidationSettlement(
            user,
            position.margin,
            totalPnL,
            msg.sender,
            liquidatorRewardMusd,
            address(insuranceFund),
            insuranceDepositMusd,
            badDebtAmountMusd
        );
        
        // Clear position
        // Update long/short tracking
        if (position.isLong) {
            longOpenInterestTbtc -= position.size;
        } else {
            shortOpenInterestTbtc -= position.size;
        }
        currentOpenInterestTbtc -= position.size;
        delete positions[user];
        
        emit Liquidated(user, msg.sender, liquidatorRewardMusd);
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
        // uint256 maintenanceMargin = (position.size * MAINTENANCE_MARGIN_RATIO) / 10000;
        uint256 priceImpact = (position.entryPrice * (10000 - MAINTENANCE_MARGIN_RATIO)) / (position.leverage * 10000);
        
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
        uint256 oraclePrice = _getOraclePrice18();

        if (position.isLong) {
            return oraclePrice <= liquidationPrice;
        } else {
            return oraclePrice >= liquidationPrice;
        }
    }
    
    function calculatePnL(Position memory position) internal view returns (int256) {
        uint256 price = _getOraclePrice18();
        if (position.isLong) {
            // PnL = (price - entryPrice) * size / entryPrice
            return int256((price - position.entryPrice) * position.size / position.entryPrice);
        } else {
            // PnL = (entryPrice - price) * size / entryPrice
            return int256((position.entryPrice - price) * position.size / position.entryPrice);
        }
    }
    
    // Get open interest imbalance for funding rate calculation
    function getOpenInterestImbalance() external view returns (uint256 longOI, uint256 shortOI, int256 imbalance) {
        longOI = longOpenInterestTbtc;
        shortOI = shortOpenInterestTbtc;
        // Imbalance: positive means more longs, negative means more shorts
        imbalance = int256(longOI) - int256(shortOI);
    }
    
    // Function to process funding - checks if funding is due and updates rate automatically
    function processFunding() external {
        require(fundingRate.isFundingDue(), "TradingEngine: Funding not due");
        fundingRate.updateFundingRateFromImbalance();
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
