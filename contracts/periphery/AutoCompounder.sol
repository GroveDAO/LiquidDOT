// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILiquidDOT} from "../interfaces/ILiquidDOT.sol";

/// @title AutoCompounder
/// @notice Stateless keeper contract that triggers reward compounding on LiquidDOTVault
/// @dev Any address can call compound() but the actual compoundRewards() on the vault
///      requires the KEEPER_ROLE, which must be granted to this contract's address.
contract AutoCompounder is Ownable {
    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted after rewards are successfully compounded
    /// @param rewardsCompounded The amount of rewards that were compounded
    /// @param newExchangeRate The vault exchange rate after compounding
    event Compounded(uint256 rewardsCompounded, uint256 newExchangeRate);

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /// @notice The vault this keeper operates on
    ILiquidDOT public immutable vault;

    /// @notice Minimum pending reward threshold to trigger a compound (in planck)
    /// @dev Default: 1 DOT = 1e10 planck (10 decimals)
    uint256 public minRewardThreshold;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy the compounder
    /// @param _vault The LiquidDOTVault to operate on
    constructor(address _vault) Ownable(msg.sender) {
        require(_vault != address(0), "AutoCompounder: zero vault");
        vault = ILiquidDOT(_vault);
        minRewardThreshold = 1e10; // 1 DOT default
    }

    // -----------------------------------------------------------------------
    // Keeper function
    // -----------------------------------------------------------------------

    /// @notice Compound pending rewards into the vault if conditions are met
    /// @dev Reverts if canCompound() returns false (guards against wasteful calls)
    function compound() external {
        require(canCompound(), "AutoCompounder: cannot compound");

        uint256 rewardsBefore = vault.pendingRewards();

        // Cast to access compoundRewards (not in ILiquidDOT interface)
        (bool success,) = address(vault).call(
            abi.encodeWithSignature("compoundRewards()")
        );
        require(success, "AutoCompounder: compoundRewards failed");

        uint256 newRate = vault.exchangeRate();
        emit Compounded(rewardsBefore, newRate);
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @notice Check whether conditions are met to trigger a compound
    /// @return True if pending rewards exceed the threshold and vault is not paused
    function canCompound() public view returns (bool) {
        if (vault.pendingRewards() <= minRewardThreshold) return false;
        // Check paused status via low-level call (Pausable interface)
        (bool success, bytes memory data) = address(vault).staticcall(
            abi.encodeWithSignature("paused()")
        );
        if (!success) return false;
        bool isPaused = abi.decode(data, (bool));
        return !isPaused;
    }

    // -----------------------------------------------------------------------
    // Owner configuration
    // -----------------------------------------------------------------------

    /// @notice Update the minimum reward threshold for triggering a compound
    /// @param newThreshold New threshold in DOT planck units
    function setMinRewardThreshold(uint256 newThreshold) external onlyOwner {
        minRewardThreshold = newThreshold;
    }
}
