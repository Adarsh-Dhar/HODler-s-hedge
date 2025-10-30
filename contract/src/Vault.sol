// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ITBTC} from "./interfaces/ITBTC.sol";

contract Vault is ReentrancyGuard, Ownable {
    ITBTC public immutable TBTC;
    ITBTC public musd; // treat as ERC20-like via ITBTC interface for simplicity
    
    // User balances (in tBTC, 8 decimals)
    mapping(address => uint256) public balances;
    // Internal MUSD balances (18 decimals)
    mapping(address => uint256) public balancesMusd;
    
    // Only TradingEngine can call lock/unlock functions
    address public tradingEngine;
    
    // Events
    event MarginDeposited(address indexed user, uint256 amount);
    event MarginWithdrawn(address indexed user, uint256 amount);
    event MarginLocked(address indexed user, uint256 amount);
    event MarginUnlocked(address indexed user, uint256 amount, int256 pnl);
    event TradingEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event MusdUpdated(address indexed oldMusd, address indexed newMusd);
    
    constructor(address _tbtc) Ownable(msg.sender) {
        require(_tbtc != address(0), "Vault: Invalid TBTC address");
        TBTC = ITBTC(_tbtc);
    }
    
    modifier onlyTradingEngine() {
        _onlyTradingEngine();
        _;
    }
    
    function _onlyTradingEngine() internal view {
        require(msg.sender == tradingEngine, "Vault: Only TradingEngine");
    }
    
    function setTradingEngine(address _tradingEngine) external onlyOwner {
        require(_tradingEngine != address(0), "Vault: Invalid address");
        address oldEngine = tradingEngine;
        tradingEngine = _tradingEngine;
        emit TradingEngineUpdated(oldEngine, _tradingEngine);
    }

    function setMusd(address _musd) external onlyOwner {
        address old = address(musd);
        musd = ITBTC(_musd);
        emit MusdUpdated(old, _musd);
    }
    
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: Amount must be positive");
        require(TBTC.transferFrom(msg.sender, address(this), amount), "Vault: Transfer failed");
        
        balances[msg.sender] += amount;
        emit MarginDeposited(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: Amount must be positive");
        require(balances[msg.sender] >= amount, "Vault: Insufficient balance");
        
        balances[msg.sender] -= amount;
        require(TBTC.transfer(msg.sender, amount), "Vault: Transfer failed");
        
        emit MarginWithdrawn(msg.sender, amount);
    }
    
    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    function balanceOfMusd(address user) external view returns (uint256) {
        return balancesMusd[user];
    }
    
    function lockMargin(address user, uint256 amount) external onlyTradingEngine {
        require(amount > 0, "Vault: Amount must be positive");
        require(balances[user] >= amount, "Vault: Insufficient balance");
        
        balances[user] -= amount;
        emit MarginLocked(user, amount);
    }
    
    function unlockMargin(address user, uint256 amount, int256 pnl) external onlyTradingEngine {
        require(amount > 0, "Vault: Amount must be positive");
        
        // Calculate final amount (margin + PnL)
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 finalAmount = int256(amount) + pnl;
        
        if (finalAmount > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            balances[user] += uint256(finalAmount);
        }
        // If finalAmount is negative, user loses their margin (liquidated)
        
        emit MarginUnlocked(user, amount, pnl);
    }

    // Settle tBTC margin and MUSD PnL using internal accounting (no ERC20 transfers)
    function unlockMarginAndSettleMusd(
        address user,
        uint256 amountTbtc,
        int256 pnlTbtc,
        int256 pnlMusd
    ) external onlyTradingEngine {
        require(amountTbtc > 0, "Vault: Amount must be positive");

        // Settle tBTC margin + PnL
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 finalTbtc = int256(amountTbtc) + pnlTbtc;
        if (finalTbtc > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            balances[user] += uint256(finalTbtc);
        }

        // Settle MUSD PnL to user accounting balance
        if (pnlMusd > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            balancesMusd[user] += uint256(pnlMusd);
        } else if (pnlMusd < 0) {
            // Reduce user's MUSD accounting balance; clamp at zero
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 toDebit = uint256(-pnlMusd);
            uint256 cur = balancesMusd[user];
            balancesMusd[user] = toDebit > cur ? 0 : (cur - toDebit);
        }

        emit MarginUnlocked(user, amountTbtc, pnlTbtc);
    }

    

    function unlockMarginWithLiquidator(
        address user,
        uint256 amount,
        int256 pnl,
        address liquidator,
        uint256 liquidatorRewardTbtc,
        uint256 liquidatorRewardMusd
    ) external onlyTradingEngine {
        require(amount > 0, "Vault: Amount must be positive");

        // Calculate final amount (margin + PnL)
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 finalAmount = int256(amount) + pnl;

        if (finalAmount > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 positive = uint256(finalAmount);

            // First, credit liquidator MUSD reward (internal accounting)
            if (liquidatorRewardMusd > 0) {
                balancesMusd[liquidator] += liquidatorRewardMusd;
            }

            // Also support optional tBTC reward (for backward compatibility / safety cap)
            if (liquidatorRewardTbtc > 0) {
                uint256 rewardT = liquidatorRewardTbtc > positive ? positive : liquidatorRewardTbtc;
                if (rewardT > 0) {
                    balances[liquidator] += rewardT;
                    positive -= rewardT;
                }
            }

            if (positive > 0) {
                balances[user] += positive;
            }
        }

        emit MarginUnlocked(user, amount, pnl);
    }

    // Settlement path for liquidation using MUSD accounting and optional on-chain MUSD
    function handleLiquidationSettlement(
        address user,
        uint256 tbtcMargin,
        int256 totalPnl,
        address liquidator,
        uint256 liquidatorRewardMusd,
        address insuranceFund,
        uint256 insuranceDepositMusd
    ) external onlyTradingEngine {
        require(tbtcMargin > 0, "Vault: Invalid margin");

        // Calculate remaining in tBTC terms to ensure consistency with TradingEngine computation
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 remainingTbtc = int256(tbtcMargin) + totalPnl;

        // If remaining is not positive, nothing to distribute; user fully liquidated
        if (remainingTbtc <= 0) {
            emit MarginUnlocked(user, tbtcMargin, totalPnl);
            return;
        }

        // Distribute MUSD credits
        if (liquidatorRewardMusd > 0) {
            balancesMusd[liquidator] += liquidatorRewardMusd;
        }
        if (insuranceDepositMusd > 0 && insuranceFund != address(0)) {
            balancesMusd[insuranceFund] += insuranceDepositMusd;
        }

        // NOTE: In liquidation we do not return any tBTC to the user; their locked margin is consumed.
        // Any remaining positive tBTC equivalent was converted into MUSD credits per TradingEngine computation.

        emit MarginUnlocked(user, tbtcMargin, totalPnl);
    }
    
    // Emergency function to recover tokens (including tBTC) to the owner
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(TBTC)) {
            // Allow owner to recover tBTC from the vault in emergencies
            require(TBTC.transfer(owner(), amount), "Vault: Emergency tBTC transfer failed");
        } else {
            require(ITBTC(token).transfer(owner(), amount), "Vault: Emergency transfer failed");
        }
    }
}
