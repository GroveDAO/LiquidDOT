// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title ValidatorGovernor
/// @notice On-chain DAO that controls validator nominee changes in LiquidDOT
/// @dev Extends OZ Governor with settings, counting, votes, quorum, and timelock.
///      Proposals are restricted to the ValidatorRegistry contract only.
///      Voting: 1 block delay, ~1 week period (50400 blocks), 100,000 GOV threshold.
///      Quorum: 4% of total supply.
contract ValidatorGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Minimum tokens required to create a proposal (100,000 GOV)
    uint256 private constant PROPOSAL_THRESHOLD_AMOUNT = 100_000e18;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /// @notice The ValidatorRegistry contract that proposals must target
    address public validatorRegistry;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy the governor
    /// @param token The IVotes governance token (GovToken)
    /// @param timelock The TimelockController that executes approved proposals
    /// @param _validatorRegistry The only contract proposals are allowed to target
    constructor(
        IVotes token,
        TimelockController timelock,
        address _validatorRegistry
    )
        Governor("ValidatorGovernor")
        GovernorSettings(
            1,      // votingDelay: 1 block
            50400,  // votingPeriod: ~1 week at 12s blocks
            PROPOSAL_THRESHOLD_AMOUNT
        )
        GovernorVotes(token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        GovernorTimelockControl(timelock)
    {
        require(_validatorRegistry != address(0), "ValidatorGovernor: zero registry");
        validatorRegistry = _validatorRegistry;
    }

    // -----------------------------------------------------------------------
    // Target validation
    // -----------------------------------------------------------------------

    /// @notice Override propose to restrict targets to ValidatorRegistry only
    /// @dev Reverts if any target is not the ValidatorRegistry
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override returns (uint256) {
        _validateProposalTargets(targets);
        return super.propose(targets, values, calldatas, description);
    }

    /// @dev Validates that every target in the proposal is the ValidatorRegistry
    /// @param targets Array of target addresses in the proposal
    function _validateProposalTargets(address[] memory targets) internal view {
        for (uint256 i = 0; i < targets.length; i++) {
            require(
                targets[i] == validatorRegistry,
                "ValidatorGovernor: invalid target"
            );
        }
    }

    // -----------------------------------------------------------------------
    // Required overrides
    // -----------------------------------------------------------------------

    /// @inheritdoc Governor
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /// @inheritdoc Governor
    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    /// @inheritdoc Governor
    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    /// @inheritdoc Governor
    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    /// @inheritdoc Governor
    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    /// @inheritdoc Governor
    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    /// @inheritdoc Governor
    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    /// @inheritdoc Governor
    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    /// @inheritdoc Governor
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    /// @inheritdoc Governor
    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
}
