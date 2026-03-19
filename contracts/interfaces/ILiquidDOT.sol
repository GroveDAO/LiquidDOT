// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/// @title ILiquidDOT
/// @notice ERC-4626-compatible interface for the LiquidDOT liquid staking vault
/// @dev Extends IERC4626 with LiquidDOT-specific staking and withdrawal queue functions
interface ILiquidDOT is IERC4626 {
    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    /// @notice Represents a queued withdrawal request
    struct WithdrawalRequest {
        address owner;       // Owner who queued the withdrawal
        uint256 dotAmount;   // DOT amount to be received upon claim
        uint32 unbondEra;    // Era at which unbonding was initiated
        bool claimed;        // Whether the withdrawal has been claimed
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted when DOT is deposited and stDOT minted
    /// @param caller The address that initiated the stake
    /// @param owner The address receiving the stDOT
    /// @param dotAmount The amount of DOT deposited
    /// @param stDOTAmount The amount of stDOT minted
    event Staked(address indexed caller, address indexed owner, uint256 dotAmount, uint256 stDOTAmount);

    /// @notice Emitted when stDOT is queued for unstaking
    /// @param owner The owner who queued the unstake
    /// @param stDOTAmount The amount of stDOT burned
    /// @param dotAmount The DOT amount to be received
    event Unstaked(address indexed owner, uint256 stDOTAmount, uint256 dotAmount);

    /// @notice Emitted when a withdrawal is queued
    /// @param requestId The unique ID of the withdrawal request
    /// @param owner The owner of the withdrawal request
    /// @param dotAmount The DOT amount to receive upon claim
    /// @param unbondEra The era when unbonding started
    event WithdrawalQueued(uint256 indexed requestId, address indexed owner, uint256 dotAmount, uint32 unbondEra);

    /// @notice Emitted when a queued withdrawal is successfully claimed
    /// @param requestId The ID of the claimed request
    /// @param owner The owner who claimed
    /// @param dotAmount The DOT amount transferred
    event WithdrawalClaimed(uint256 indexed requestId, address indexed owner, uint256 dotAmount);

    /// @notice Emitted when staking rewards are compounded into the vault
    /// @param rewardsAmount The amount of rewards compounded
    /// @param newExchangeRate The updated exchange rate after compounding
    event RewardsCompounded(uint256 rewardsAmount, uint256 newExchangeRate);

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @notice Get the current exchange rate of stDOT to DOT
    /// @return The exchange rate with 18 decimal precision (DOT per stDOT)
    function exchangeRate() external view returns (uint256);

    /// @notice Get the total amount of DOT currently managed by the vault
    /// @return The total DOT bonded and pending rewards (in DOT planck units)
    function totalStaked() external view returns (uint256);

    /// @notice Get the amount of pending staking rewards not yet compounded
    /// @return The pending reward amount (in DOT planck units)
    function pendingRewards() external view returns (uint256);

    /// @notice Get the unbonding period in eras
    /// @return The number of eras tokens must wait before withdrawal
    function unbondingPeriod() external view returns (uint256);

    // -----------------------------------------------------------------------
    // Mutative functions
    // -----------------------------------------------------------------------

    /// @notice Queue a withdrawal of assets (DOT) from the vault
    /// @param assets The amount of DOT to withdraw
    /// @return requestId The unique ID of the withdrawal request
    function queueWithdrawal(uint256 assets) external returns (uint256 requestId);

    /// @notice Claim a previously queued withdrawal after the unbonding period
    /// @param requestId The ID of the withdrawal request to claim
    function claimWithdrawal(uint256 requestId) external;
}
