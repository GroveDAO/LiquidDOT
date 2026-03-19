// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IStakingPrecompile
/// @notice Interface for Polkadot Hub's native staking precompile
/// @dev Located at address 0x0000000000000000000000000000000000000800 on Polkadot Hub
interface IStakingPrecompile {
    /// @notice The canonical address of the staking precompile on Polkadot Hub
    // address constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000800;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted when DOT is bonded to the stash account
    /// @param stash The stash account address
    /// @param amount The amount bonded (in DOT planck units)
    event Bonded(address indexed stash, uint256 amount);

    /// @notice Emitted when DOT is queued for unbonding
    /// @param stash The stash account address
    /// @param amount The amount queued for unbonding
    event Unbonded(address indexed stash, uint256 amount);

    /// @notice Emitted when validators are nominated
    /// @param stash The nominator stash address
    /// @param targets The nominated validator addresses
    event Nominated(address indexed stash, address[] targets);

    /// @notice Emitted when staking rewards are claimed/paid out
    /// @param stash The stash account address
    /// @param amount The reward amount claimed
    event Rewarded(address indexed stash, uint256 amount);

    // -----------------------------------------------------------------------
    // Mutative functions
    // -----------------------------------------------------------------------

    /// @notice Bond DOT to a stash account with a controller
    /// @param controller The controller account address
    /// @param value The amount of DOT to bond (in planck units)
    /// @param payee Encoded reward destination (e.g. "Stash", "Controller", or an account address)
    function bond(address controller, uint256 value, bytes calldata payee) external;

    /// @notice Bond additional DOT to an already-bonded stash
    /// @param maxAdditional The maximum additional amount to bond (in planck units)
    function bondExtra(uint256 maxAdditional) external;

    /// @notice Queue DOT for unbonding (subject to the unbonding period)
    /// @param value The amount to unbond (in planck units)
    function unbond(uint256 value) external;

    /// @notice Withdraw previously unbonded DOT after the unbonding period has elapsed
    /// @param numSlashingSpans The number of slashing spans to remove (can be 0 if none)
    function withdrawUnbonded(uint32 numSlashingSpans) external;

    /// @notice Nominate a set of validators
    /// @param targets Array of validator account addresses to nominate
    function nominate(address[] calldata targets) external;

    /// @notice Chill the stash — stop nominating without unbonding
    function chill() external;

    /// @notice Update the reward destination for staking rewards
    /// @param payee Encoded reward destination
    function setPayee(bytes calldata payee) external;

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @notice Get the active bonded stake for a stash account
    /// @param stash The stash account address
    /// @return The amount of DOT currently bonded (in planck units)
    function getStake(address stash) external view returns (uint256);

    /// @notice Get unclaimed staking rewards for a stash account
    /// @param stash The stash account address
    /// @return The amount of pending rewards (in planck units)
    function getPendingRewards(address stash) external view returns (uint256);

    /// @notice Get the current active era index
    /// @return The active era number
    function getActiveEra() external view returns (uint32);

    /// @notice Get the current nominees for a stash account
    /// @param stash The stash account address
    /// @return Array of nominated validator addresses
    function getNominators(address stash) external view returns (address[] memory);
}
