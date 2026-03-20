// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title ILiquidDOT
/// @notice Native-asset liquid staking vault interface for LiquidDOT
/// @dev Mirrors ERC-4626-style share math while accepting the native gas token via payable deposits.
interface ILiquidDOT is IERC20Metadata {
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

    /// @notice ERC-4626-style deposit event for indexers and wallets.
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);

    /// @notice ERC-4626-style withdrawal event for indexers and wallets.
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

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

    /// @notice Returns the canonical native asset address sentinel.
    /// @dev Native DOT/PAS is not an ERC-20, so implementations return address(0).
    function asset() external view returns (address assetTokenAddress);

    /// @notice Returns whether native staking precompile integration is enabled.
    function nativeStakingEnabled() external view returns (bool enabled);

    /// @notice Returns the total amount of native DOT managed by the vault.
    function totalAssets() external view returns (uint256 totalManagedAssets);

    /// @notice Converts a native-asset amount into vault shares.
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @notice Converts a vault share amount into native assets.
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @notice Returns the maximum native asset amount that can be deposited for `receiver`.
    function maxDeposit(address receiver) external view returns (uint256 maxAssets);

    /// @notice Preview shares minted for a native-asset deposit.
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Deposit native assets and mint vault shares.
    function deposit(uint256 assets, address receiver) external payable returns (uint256 shares);

    /// @notice Returns the maximum shares that can be minted for `receiver`.
    function maxMint(address receiver) external view returns (uint256 maxShares);

    /// @notice Preview native assets required to mint `shares`.
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /// @notice Mint exact shares by depositing the required native assets.
    function mint(uint256 shares, address receiver) external payable returns (uint256 assets);

    /// @notice Returns the maximum native assets that can be withdrawn for `owner`.
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);

    /// @notice Preview shares burned to withdraw `assets`.
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /// @notice Queue a withdrawal for exact native assets.
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /// @notice Returns the maximum shares that can be redeemed for `owner`.
    function maxRedeem(address owner) external view returns (uint256 maxShares);

    /// @notice Preview native assets received when redeeming `shares`.
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /// @notice Queue a redemption for exact shares.
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

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
