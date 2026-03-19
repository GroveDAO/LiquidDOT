// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IStakingPrecompile} from "../interfaces/IStakingPrecompile.sol";

/// @title StakingPrecompile
/// @notice Concrete wrapper around Polkadot Hub's native staking precompile
/// @dev Delegates all calls via low-level `.call()` to the precompile address.
///      Use `precompileExists()` to detect whether we are on Polkadot Hub.
contract StakingPrecompile is IStakingPrecompile {
    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice The canonical address of the staking precompile on Polkadot Hub
    address public constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000800;

    // -----------------------------------------------------------------------
    // Deployment check
    // -----------------------------------------------------------------------

    /// @notice Returns true if the precompile is deployed (i.e. we are on Polkadot Hub)
    /// @return exists True if the precompile address has code
    function precompileExists() external view returns (bool exists) {
        uint256 size;
        address addr = PRECOMPILE_ADDRESS;
        assembly {
            size := extcodesize(addr)
        }
        exists = size > 0;
    }

    // -----------------------------------------------------------------------
    // Mutative functions
    // -----------------------------------------------------------------------

    /// @inheritdoc IStakingPrecompile
    function bond(address controller, uint256 value, bytes calldata payee) external override {
        bytes memory data = abi.encodeWithSignature(
            "bond(address,uint256,bytes)",
            controller,
            value,
            payee
        );
        _call(data);
        emit Bonded(msg.sender, value);
    }

    /// @inheritdoc IStakingPrecompile
    function bondExtra(uint256 maxAdditional) external override {
        bytes memory data = abi.encodeWithSignature("bondExtra(uint256)", maxAdditional);
        _call(data);
        emit Bonded(msg.sender, maxAdditional);
    }

    /// @inheritdoc IStakingPrecompile
    function unbond(uint256 value) external override {
        bytes memory data = abi.encodeWithSignature("unbond(uint256)", value);
        _call(data);
        emit Unbonded(msg.sender, value);
    }

    /// @inheritdoc IStakingPrecompile
    function withdrawUnbonded(uint32 numSlashingSpans) external override {
        bytes memory data = abi.encodeWithSignature("withdrawUnbonded(uint32)", numSlashingSpans);
        _call(data);
    }

    /// @inheritdoc IStakingPrecompile
    function nominate(address[] calldata targets) external override {
        bytes memory data = abi.encodeWithSignature("nominate(address[])", targets);
        _call(data);
        emit Nominated(msg.sender, targets);
    }

    /// @inheritdoc IStakingPrecompile
    function chill() external override {
        bytes memory data = abi.encodeWithSignature("chill()");
        _call(data);
    }

    /// @inheritdoc IStakingPrecompile
    function setPayee(bytes calldata payee) external override {
        bytes memory data = abi.encodeWithSignature("setPayee(bytes)", payee);
        _call(data);
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @inheritdoc IStakingPrecompile
    function getStake(address stash) external view override returns (uint256) {
        bytes memory data = abi.encodeWithSignature("getStake(address)", stash);
        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.staticcall(data);
        require(success, "StakingPrecompile: getStake failed");
        return abi.decode(result, (uint256));
    }

    /// @inheritdoc IStakingPrecompile
    function getPendingRewards(address stash) external view override returns (uint256) {
        bytes memory data = abi.encodeWithSignature("getPendingRewards(address)", stash);
        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.staticcall(data);
        require(success, "StakingPrecompile: getPendingRewards failed");
        return abi.decode(result, (uint256));
    }

    /// @inheritdoc IStakingPrecompile
    function getActiveEra() external view override returns (uint32) {
        bytes memory data = abi.encodeWithSignature("getActiveEra()");
        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.staticcall(data);
        require(success, "StakingPrecompile: getActiveEra failed");
        return abi.decode(result, (uint32));
    }

    /// @inheritdoc IStakingPrecompile
    function getNominators(address stash) external view override returns (address[] memory) {
        bytes memory data = abi.encodeWithSignature("getNominators(address)", stash);
        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.staticcall(data);
        require(success, "StakingPrecompile: getNominators failed");
        return abi.decode(result, (address[]));
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// @dev Performs a low-level call to the precompile and reverts with the
    ///      precompile's revert reason if the call fails.
    /// @param data ABI-encoded function selector + arguments
    function _call(bytes memory data) internal {
        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.call(data);
        if (!success) {
            // Bubble up revert reason if available
            if (result.length > 0) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            revert("StakingPrecompile: call failed");
        }
    }
}
