// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IValidatorOracle
/// @notice Interface for querying validator performance data
/// @dev Implementations may source data from on-chain indices or off-chain oracle feeds
interface IValidatorOracle {
    /// @notice Get the list of recommended validators for nomination
    /// @return validators Array of recommended validator addresses
    function getRecommendedValidators() external view returns (address[] memory validators);

    /// @notice Get the estimated annual percentage yield for a specific validator
    /// @param validator The validator address to query
    /// @return apy The estimated APY in basis points (1 bp = 0.01%)
    function getValidatorAPY(address validator) external view returns (uint256 apy);

    /// @notice Check whether a validator is currently active in the elected set
    /// @param validator The validator address to check
    /// @return active True if the validator is in the active set this era
    function isValidatorActive(address validator) external view returns (bool active);
}
