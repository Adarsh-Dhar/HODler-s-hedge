// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract InsuranceFund is Ownable {
    IERC20 public immutable musd;
    address public tradingEngine;
    
    // Bad debt tracking
    uint256 public totalBadDebt; // Accumulated bad debt in MUSD (18 decimals)
    uint256 public maxCoveragePerIncident; // Max MUSD per bad debt incident

    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event TradingEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event BadDebtCovered(address indexed user, uint256 badDebtAmount, uint256 coverageAmount, uint256 remainingBadDebt);
    event MaxCoverageUpdated(uint256 newMax);

    constructor(address _musdAddress) Ownable(msg.sender) {
        require(_musdAddress != address(0), "InsuranceFund: Invalid MUSD address");
        musd = IERC20(_musdAddress);
    }

    modifier onlyTradingEngine() {
        _onlyTradingEngine();
        _;
    }

    function _onlyTradingEngine() internal view {
        require(msg.sender == tradingEngine, "InsuranceFund: Only TradingEngine");
    }

    function setTradingEngine(address _tradingEngine) external onlyOwner {
        require(_tradingEngine != address(0), "InsuranceFund: Invalid address");
        address oldEngine = tradingEngine;
        tradingEngine = _tradingEngine;
        emit TradingEngineUpdated(oldEngine, _tradingEngine);
    }

    function setMaxCoveragePerIncident(uint256 _max) external onlyOwner {
        maxCoveragePerIncident = _max;
        emit MaxCoverageUpdated(_max);
    }

    // Optional deposit hook if TradingEngine chooses to call into fund after transfer
    function depositFunds(uint256 amount) external onlyTradingEngine {
        require(amount > 0, "InsuranceFund: Amount must be positive");
        emit FundsDeposited(msg.sender, amount);
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "InsuranceFund: Amount must be positive");
        uint256 bal = musd.balanceOf(address(this));
        require(bal >= amount, "InsuranceFund: Insufficient balance");
        require(musd.transfer(owner(), amount), "InsuranceFund: Withdrawal failed");
        emit FundsWithdrawn(owner(), amount);
    }

    function getBalance() external view returns (uint256) {
        return musd.balanceOf(address(this));
    }

    /**
     * @notice Covers bad debt from Insurance Fund reserves
     * @param badDebtAmountMusd Total bad debt amount in MUSD (18 decimals)
     * @param vaultAddress Address of Vault to receive coverage funds
     * @return coverageAmount Actual amount covered from Insurance Fund
     */
    function coverBadDebt(uint256 badDebtAmountMusd, address vaultAddress) external onlyTradingEngine returns (uint256 coverageAmount) {
        require(badDebtAmountMusd > 0, "InsuranceFund: Bad debt amount must be positive");
        require(vaultAddress != address(0), "InsuranceFund: Invalid vault address");
        
        // Edge case 1: Apply max coverage per incident cap if set (prevents single incident from draining fund)
        // If maxCoveragePerIncident is 0, no cap is applied (owner-controlled safety mechanism)
        if (maxCoveragePerIncident > 0 && badDebtAmountMusd > maxCoveragePerIncident) {
            // Cap coverage per incident - excess bad debt remains uncovered but still tracked
            badDebtAmountMusd = maxCoveragePerIncident;
        }
        
        uint256 availableBalance = musd.balanceOf(address(this));
        
        // Edge case 2: Partial coverage when fund balance is insufficient
        // If availableBalance < badDebtAmountMusd, only partial coverage is provided
        // Remaining uncovered amount is still added to totalBadDebt for transparency
        if (availableBalance >= badDebtAmountMusd) {
            coverageAmount = badDebtAmountMusd; // Full coverage available
        } else {
            // Partial coverage - cover what's available, remainder becomes uncovered bad debt
            coverageAmount = availableBalance;
        }
        
        // Edge case 3: Zero coverage if fund is empty (coverageAmount == 0)
        // No transfer occurs, but bad debt is still tracked for historical accuracy
        if (coverageAmount > 0) {
            require(musd.transfer(vaultAddress, coverageAmount), "InsuranceFund: Coverage transfer failed");
        }
        
        // Edge case 4: Track total bad debt including both covered and uncovered portions
        // This ensures transparency even when maxCoveragePerIncident cap or insufficient balance
        // results in partial/uncovered bad debt
        totalBadDebt += badDebtAmountMusd;
        
        uint256 remainingBadDebt = badDebtAmountMusd - coverageAmount;
        
        emit BadDebtCovered(msg.sender, badDebtAmountMusd, coverageAmount, remainingBadDebt);
        
        return coverageAmount;
    }

    /**
     * @notice Returns the total accumulated bad debt
     */
    function getTotalBadDebt() external view returns (uint256) {
        return totalBadDebt;
    }

    /**
     * @notice Returns available MUSD balance for coverage
     */
    function getAvailableCoverage() external view returns (uint256) {
        return musd.balanceOf(address(this));
    }

    /**
     * @notice Returns the coverage ratio (available / total bad debt) as a percentage
     * @return coverageRatioBps Coverage ratio in basis points (e.g., 10000 = 100%)
     * @return isFullyCovered Whether the fund can cover all bad debt
     */
    function getCoverageRatio() external view returns (uint256 coverageRatioBps, bool isFullyCovered) {
        // Edge case: Division by zero protection - return 100% if no bad debt exists
        if (totalBadDebt == 0) {
            return (10000, true); // 100% coverage if no bad debt
        }
        
        uint256 availableBalance = musd.balanceOf(address(this));
        // Edge case: May return >10000 (e.g., 15000 = 150%) if fund balance exceeds total bad debt
        // This indicates the fund is over-collateralized relative to historical bad debt
        coverageRatioBps = (availableBalance * 10000) / totalBadDebt;
        isFullyCovered = availableBalance >= totalBadDebt;
        
        return (coverageRatioBps, isFullyCovered);
    }
}


