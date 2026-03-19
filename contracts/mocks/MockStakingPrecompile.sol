// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IStakingPrecompile} from "../interfaces/IStakingPrecompile.sol";

/// @title MockStakingPrecompile
/// @notice Test-only implementation of IStakingPrecompile
/// @dev Stores bond amounts, nominees, and pending rewards in mappings.
///      Tests can inject rewards via addMockRewards().
contract MockStakingPrecompile is IStakingPrecompile {
    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------

    /// @dev Bonded balance per stash address
    mapping(address => uint256) private _stakes;

    /// @dev Pending reward balance per stash address
    mapping(address => uint256) private _pendingRewards;

    /// @dev Nominated validators per stash address
    mapping(address => address[]) private _nominees;

    /// @dev Simulated current era
    uint32 private _currentEra;

    // -----------------------------------------------------------------------
    // Test helpers
    // -----------------------------------------------------------------------

    /// @notice Inject mock rewards for a stash account (test use only)
    /// @param stash The stash account to add rewards to
    /// @param amount The reward amount in planck units
    function addMockRewards(address stash, uint256 amount) external {
        _pendingRewards[stash] += amount;
    }

    /// @notice Advance the simulated era (test use only)
    /// @param eras Number of eras to advance
    function advanceEra(uint32 eras) external {
        _currentEra += eras;
    }

    /// @notice Set the current era directly (test use only)
    /// @param era The era to set
    function setCurrentEra(uint32 era) external {
        _currentEra = era;
    }

    // -----------------------------------------------------------------------
    // IStakingPrecompile implementation
    // -----------------------------------------------------------------------

    /// @inheritdoc IStakingPrecompile
    function bond(address controller, uint256 value, bytes calldata) external override {
        _stakes[msg.sender] += value;
        emit Bonded(msg.sender, value);
    }

    /// @inheritdoc IStakingPrecompile
    function bondExtra(uint256 maxAdditional) external override {
        _stakes[msg.sender] += maxAdditional;
        emit Bonded(msg.sender, maxAdditional);
    }

    /// @inheritdoc IStakingPrecompile
    function unbond(uint256 value) external override {
        require(_stakes[msg.sender] >= value, "MockStaking: insufficient stake");
        _stakes[msg.sender] -= value;
        emit Unbonded(msg.sender, value);
    }

    /// @inheritdoc IStakingPrecompile
    function withdrawUnbonded(uint32) external override {
        // No-op in mock — funds are transferred by the vault directly
    }

    /// @inheritdoc IStakingPrecompile
    function nominate(address[] calldata targets) external override {
        delete _nominees[msg.sender];
        for (uint256 i = 0; i < targets.length; i++) {
            _nominees[msg.sender].push(targets[i]);
        }
        emit Nominated(msg.sender, targets);
    }

    /// @inheritdoc IStakingPrecompile
    function chill() external override {
        delete _nominees[msg.sender];
    }

    /// @inheritdoc IStakingPrecompile
    function setPayee(bytes calldata) external override {
        // No-op in mock
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @inheritdoc IStakingPrecompile
    function getStake(address stash) external view override returns (uint256) {
        return _stakes[stash];
    }

    /// @inheritdoc IStakingPrecompile
    /// @dev Calling this clears the pending rewards (simulating a claim)
    function getPendingRewards(address stash) external view override returns (uint256) {
        return _pendingRewards[stash];
    }

    /// @notice Clear pending rewards for a stash (call after compounding in tests)
    /// @param stash The stash account
    function clearPendingRewards(address stash) external {
        _pendingRewards[stash] = 0;
    }

    /// @inheritdoc IStakingPrecompile
    function getActiveEra() external view override returns (uint32) {
        return _currentEra;
    }

    /// @inheritdoc IStakingPrecompile
    function getNominators(address stash) external view override returns (address[] memory) {
        return _nominees[stash];
    }
}
