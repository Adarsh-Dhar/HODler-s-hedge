// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract InsuranceFund is Ownable {
    IERC20 public immutable musd;
    address public tradingEngine;

    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event TradingEngineUpdated(address indexed oldEngine, address indexed newEngine);

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
}


