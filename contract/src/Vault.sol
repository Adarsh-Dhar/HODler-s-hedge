// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ITBTC} from "./interfaces/ITBTC.sol";

contract Vault is ReentrancyGuard, Ownable {
    ITBTC public immutable TBTC;
    
    // User balances (in tBTC, 8 decimals)
    mapping(address => uint256) public balances;
    
    // Only TradingEngine can call lock/unlock functions
    address public tradingEngine;
    
    // Events
    event MarginDeposited(address indexed user, uint256 amount);
    event MarginWithdrawn(address indexed user, uint256 amount);
    event MarginLocked(address indexed user, uint256 amount);
    event MarginUnlocked(address indexed user, uint256 amount, int256 pnl);
    event TradingEngineUpdated(address indexed oldEngine, address indexed newEngine);
    
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
