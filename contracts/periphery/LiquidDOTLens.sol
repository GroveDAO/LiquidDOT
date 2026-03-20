// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ILiquidDOT} from "../interfaces/ILiquidDOT.sol";

/// @title LiquidDOTLens
/// @notice Read-only aggregator for LiquidDOT vault and user position data
/// @dev Stateless; all data is read from the vault and related contracts at call time
contract LiquidDOTLens {
    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    /// @notice Aggregated stats for a LiquidDOT vault
    struct VaultStats {
        uint256 totalDOTManaged;       // Total DOT bonded (planck)
        uint256 totalStDOTSupply;      // Current stDOT supply (18 dec)
        uint256 exchangeRate;          // DOT per stDOT, 18 dec precision
        uint256 pendingRewards;        // Unclaimed rewards (planck)
        uint256 annualizedAPY;         // Estimated APY in basis points
        uint256 unbondingPeriodEras;   // Unbonding period in eras
        address[] currentNominees;     // Active validator nominees
        bool isPaused;                 // Whether the vault is paused
    }

    /// @notice A user's position in the vault
    struct UserPosition {
        uint256 stDOTBalance;                          // User's stDOT balance
        uint256 dotValue;                              // Equivalent DOT value
        PendingWithdrawal[] pendingWithdrawals;        // Active withdrawal requests
    }

    /// @notice A withdrawal request paired with its request ID.
    struct PendingWithdrawal {
        uint256 requestId;
        address owner;
        uint256 dotAmount;
        uint32 unbondEra;
        bool claimed;
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @notice Fetch aggregated vault statistics
    /// @param vaultAddress The address of the LiquidDOTVault contract
    /// @return stats Populated VaultStats struct
    function getVaultStats(address vaultAddress)
        external
        view
        returns (VaultStats memory stats)
    {
        ILiquidDOT vault = ILiquidDOT(vaultAddress);

        stats.totalDOTManaged = vault.totalStaked();
        stats.exchangeRate = vault.exchangeRate();
        stats.pendingRewards = vault.pendingRewards();
        stats.unbondingPeriodEras = vault.unbondingPeriod();
        stats.totalStDOTSupply = vault.totalSupply();

        // Nominees
        (bool ok, bytes memory data) = vaultAddress.staticcall(
            abi.encodeWithSignature("getCurrentNomineesView()")
        );
        if (!ok) {
            stats.currentNominees = new address[](0);
        } else {
            stats.currentNominees = abi.decode(data, (address[]));
        }

        // Paused status
        (bool ok2, bytes memory data2) = vaultAddress.staticcall(
            abi.encodeWithSignature("paused()")
        );
        if (ok2 && data2.length >= 32) {
            stats.isPaused = abi.decode(data2, (bool));
        }

        // APY: placeholder — 0 until an oracle is integrated
        stats.annualizedAPY = 0;
    }

    /// @notice Fetch a user's position in the vault
    /// @param vaultAddress The address of the LiquidDOTVault contract
    /// @param user The user address to query
    /// @return position Populated UserPosition struct
    function getUserPosition(address vaultAddress, address user)
        external
        view
        returns (UserPosition memory position)
    {
        ILiquidDOT vault = ILiquidDOT(vaultAddress);

        position.stDOTBalance = vault.balanceOf(user);

        uint256 rate = vault.exchangeRate();
        // dotValue = stDOTBalance * rate / 1e18 (both in 18-dec space, result in planck)
        position.dotValue = (position.stDOTBalance * rate) / 1e18;

        // Pending withdrawals — read nextRequestId and iterate
        (bool ok2, bytes memory data2) = vaultAddress.staticcall(
            abi.encodeWithSignature("nextRequestId()")
        );
        if (ok2 && data2.length >= 32) {
            uint256 nextId = abi.decode(data2, (uint256));
            // Collect requests belonging to this user
            PendingWithdrawal[] memory tmp = new PendingWithdrawal[](nextId);
            uint256 count = 0;
            for (uint256 i = 0; i < nextId; i++) {
                (bool ok3, bytes memory data3) = vaultAddress.staticcall(
                    abi.encodeWithSignature("withdrawalRequests(uint256)", i)
                );
                if (ok3 && data3.length >= 128) {
                    (address owner, uint256 dotAmount, uint32 unbondEra, bool claimed) =
                        abi.decode(data3, (address, uint256, uint32, bool));
                    if (owner == user && !claimed) {
                        tmp[count++] = PendingWithdrawal({
                            requestId: i,
                            owner: owner,
                            dotAmount: dotAmount,
                            unbondEra: unbondEra,
                            claimed: claimed
                        });
                    }
                }
            }
            position.pendingWithdrawals = new PendingWithdrawal[](count);
            for (uint256 i = 0; i < count; i++) {
                position.pendingWithdrawals[i] = tmp[i];
            }
        }
    }
}
