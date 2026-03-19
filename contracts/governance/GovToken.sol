// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title GovToken
/// @notice Governance token for the LiquidDOT validator governor DAO
/// @dev Fixed supply of 10,000,000 GOV minted to the deployer.
///      Implements ERC20Permit and ERC20Votes for on-chain governance.
contract GovToken is ERC20, ERC20Permit, ERC20Votes {
    /// @notice Fixed total supply: 10,000,000 GOV (18 decimals)
    uint256 public constant TOTAL_SUPPLY = 10_000_000e18;

    /// @notice Deploy and mint the entire supply to the deployer
    /// @param initialHolder Address to receive all 10,000,000 GOV tokens
    constructor(address initialHolder)
        ERC20("LiquidDOT Governance", "GOV")
        ERC20Permit("LiquidDOT Governance")
    {
        _mint(initialHolder, TOTAL_SUPPLY);
    }

    // -----------------------------------------------------------------------
    // Overrides required by Solidity for multiple inheritance
    // -----------------------------------------------------------------------

    /// @inheritdoc ERC20Votes
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, amount);
    }

    /// @inheritdoc Nonces
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
