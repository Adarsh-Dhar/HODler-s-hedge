// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythOracle is Ownable {
    IPyth public pyth;
    bytes32 public btcUsdPriceId;
    uint256 public maxAgeSeconds;

    event PriceIdUpdated(bytes32 oldId, bytes32 newId);
    event MaxAgeUpdated(uint256 oldAge, uint256 newAge);
    event PriceFeedsUpdated(uint256 feePaid);

    constructor(address _pyth, bytes32 _btcUsdPriceId, uint256 _maxAgeSeconds) Ownable(msg.sender) {
        require(_pyth != address(0), "PythOracle: invalid pyth address");
        require(_btcUsdPriceId != bytes32(0), "PythOracle: invalid price id");
        require(_maxAgeSeconds > 0, "PythOracle: invalid maxAge");
        pyth = IPyth(_pyth);
        btcUsdPriceId = _btcUsdPriceId;
        maxAgeSeconds = _maxAgeSeconds;
    }

    function setPriceId(bytes32 newPriceId) external onlyOwner {
        require(newPriceId != bytes32(0), "PythOracle: invalid price id");
        bytes32 old = btcUsdPriceId;
        btcUsdPriceId = newPriceId;
        emit PriceIdUpdated(old, newPriceId);
    }

    function setMaxAgeSeconds(uint256 newMaxAge) external onlyOwner {
        require(newMaxAge > 0, "PythOracle: invalid maxAge");
        uint256 old = maxAgeSeconds;
        maxAgeSeconds = newMaxAge;
        emit MaxAgeUpdated(old, newMaxAge);
    }

    // Returns BTC/USD normalized to 1e18 and publishTime
    function getBtcUsdPrice()
        external
        view
        returns (uint256 price18, uint256 publishTime, int64 rawPrice, int32 expo, uint64 conf)
    {
        PythStructs.Price memory p = pyth.getPriceNoOlderThan(btcUsdPriceId, maxAgeSeconds);
        rawPrice = p.price;
        expo = p.expo;
        conf = p.conf;
        publishTime = p.publishTime;

        // Normalize: price18 = raw * 10^(18+expo) where expo is negative for USD feeds
        // Use uint64 cast per Pyth docs to avoid sign issues; negative handled by expo
        uint256 absPrice = uint256(uint64(p.price));
        uint32 negExpo = uint32(uint32(-p.expo));
        price18 = absPrice * (10 ** 18) / (10 ** negExpo);
    }

    // Update Pyth price feeds using Hermes-provided update bytes
    function updatePriceFeeds(bytes[] calldata updates) external payable returns (uint256 feePaid) {
        feePaid = pyth.getUpdateFee(updates);
        require(msg.value >= feePaid, "PythOracle: insufficient fee");
        pyth.updatePriceFeeds{value: feePaid}(updates);
        // Refund any excess
        if (msg.value > feePaid) {
            // forge-lint: disable-next-line(unsafe-typecast)
            payable(msg.sender).transfer(msg.value - feePaid);
        }
        emit PriceFeedsUpdated(feePaid);
    }
}


