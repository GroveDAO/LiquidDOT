// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ILiquidDOT} from "../interfaces/ILiquidDOT.sol";
import {IStakingPrecompile} from "../interfaces/IStakingPrecompile.sol";

/// @title ValidatorRegistry
/// @notice Stores and updates the canonical validator nominee set for LiquidDOT
/// @dev Implements a 2-era time-lock on nominee changes to prevent rapid validator switching.
///      Only REGISTRY_ADMIN_ROLE can propose new nominees; anyone can execute after the delay.
contract ValidatorRegistry is AccessControl {
    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    /// @notice Role that can propose new nominee sets
    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Maximum number of nominees (Polkadot NPoS limit)
    uint256 public constant MAX_NOMINEES = 16;

    /// @notice Minimum era delay before a queued nominee set can be executed
    uint32 public constant NOMINEE_DELAY_ERAS = 2;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /// @notice The vault whose nominees this registry controls
    ILiquidDOT public immutable vault;

    /// @notice The staking precompile used to read the current era
    IStakingPrecompile public immutable stakingPrecompile;

    /// @notice Whether nominee proposals should wait on staking-era progression.
    bool public immutable nativeStakingEnabled;

    /// @notice Currently active nominee addresses
    address[] private _currentNominees;

    /// @notice Queued nominee addresses pending execution
    address[] private _queuedNominees;

    /// @notice The era after which the queued nominees may be applied
    uint32 public executeAfterEra;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted when a new nominee set is proposed
    /// @param proposer The address that submitted the proposal
    /// @param nominees The proposed nominee addresses
    /// @param executeAfterEra The era after which the set can be applied
    event NomineesProposed(address indexed proposer, address[] nominees, uint32 executeAfterEra);

    /// @notice Emitted when queued nominees are applied to the vault
    /// @param executor The address that executed the update
    /// @param nominees The newly applied nominees
    event NomineesExecuted(address indexed executor, address[] nominees);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy the registry
    /// @param _vault Address of the LiquidDOT vault
    /// @param _stakingPrecompile Address of the staking precompile (or mock)
    /// @param admin Address to receive REGISTRY_ADMIN_ROLE and DEFAULT_ADMIN_ROLE
    /// @param _nativeStakingEnabled Whether the underlying network exposes staking-era reads
    constructor(address _vault, address _stakingPrecompile, address admin, bool _nativeStakingEnabled) {
        require(_vault != address(0), "ValidatorRegistry: zero vault");
        require(_stakingPrecompile != address(0), "ValidatorRegistry: zero precompile");

        vault = ILiquidDOT(_vault);
        stakingPrecompile = IStakingPrecompile(_stakingPrecompile);
        nativeStakingEnabled = _nativeStakingEnabled;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ADMIN_ROLE, admin);
    }

    // -----------------------------------------------------------------------
    // Propose / execute
    // -----------------------------------------------------------------------

    /// @notice Propose a new set of validator nominees (subject to 2-era delay)
    /// @dev Only callable by REGISTRY_ADMIN_ROLE
    /// @param nominees Array of nominee addresses (1–16 non-zero entries)
    function proposeNominees(address[] calldata nominees)
        external
        onlyRole(REGISTRY_ADMIN_ROLE)
    {
        require(nominees.length > 0, "ValidatorRegistry: empty nominees");
        require(nominees.length <= MAX_NOMINEES, "ValidatorRegistry: too many nominees");
        for (uint256 i = 0; i < nominees.length; i++) {
            require(nominees[i] != address(0), "ValidatorRegistry: zero address nominee");
        }

        executeAfterEra = nativeStakingEnabled
            ? stakingPrecompile.getActiveEra() + NOMINEE_DELAY_ERAS
            : 0;

        delete _queuedNominees;
        for (uint256 i = 0; i < nominees.length; i++) {
            _queuedNominees.push(nominees[i]);
        }

        emit NomineesProposed(msg.sender, nominees, executeAfterEra);
    }

    /// @notice Apply queued nominees to the vault once the delay has elapsed
    /// @dev Anyone can call this once the delay has passed
    function executeNominees() external {
        require(_queuedNominees.length > 0, "ValidatorRegistry: no queued nominees");
        if (nativeStakingEnabled) {
            uint32 currentEra = stakingPrecompile.getActiveEra();
            require(currentEra >= executeAfterEra, "ValidatorRegistry: delay not elapsed");
        }

        // Snapshot the queued nominees, clear the queue
        address[] memory nominees = _queuedNominees;
        delete _queuedNominees;

        // Update current nominees in this registry
        delete _currentNominees;
        for (uint256 i = 0; i < nominees.length; i++) {
            _currentNominees.push(nominees[i]);
        }

        // Dispatch to the vault (vault calls the precompile)
        // Cast to access updateNominees (not in ILiquidDOT interface)
        (bool success,) = address(vault).call(
            abi.encodeWithSignature("updateNominees(address[])", nominees)
        );
        require(success, "ValidatorRegistry: vault update failed");

        emit NomineesExecuted(msg.sender, nominees);
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// @notice Get the currently active nominee set
    /// @return The array of current nominee addresses
    function getCurrentNominees() external view returns (address[] memory) {
        return _currentNominees;
    }

    /// @notice Get the queued nominee set and the era after which it can be executed
    /// @return nominees The queued nominee addresses
    /// @return _executeAfterEra The era threshold for execution
    function getQueuedNominees()
        external
        view
        returns (address[] memory nominees, uint256 _executeAfterEra)
    {
        nominees = _queuedNominees;
        _executeAfterEra = executeAfterEra;
    }
}
