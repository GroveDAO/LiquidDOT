// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title StDOTToken
/// @notice Yield-bearing receipt token representing staked DOT in the LiquidDOT vault
/// @dev Only the vault (held in VAULT_ROLE) can mint and burn tokens.
///      Implements ERC20Permit and ERC20Votes for DeFi composability and governance.
contract StDOTToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    /// @notice Role that permits minting and burning — granted exclusively to the vault
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy the stDOT token; vault role must be granted post-deployment
    /// @param admin The address to receive DEFAULT_ADMIN_ROLE
    constructor(address admin)
        ERC20("Staked DOT", "stDOT")
        ERC20Permit("Staked DOT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -----------------------------------------------------------------------
    // Vault-only mint / burn
    // -----------------------------------------------------------------------

    /// @notice Mint stDOT to a recipient
    /// @dev Only callable by an address holding VAULT_ROLE
    /// @param to The recipient address
    /// @param amount The amount of stDOT to mint (18 decimals)
    function mint(address to, uint256 amount) external onlyRole(VAULT_ROLE) {
        _mint(to, amount);
    }

    /// @notice Burn stDOT from a holder
    /// @dev Only callable by an address holding VAULT_ROLE
    /// @param from The address to burn from
    /// @param amount The amount of stDOT to burn (18 decimals)
    function burn(address from, uint256 amount) external onlyRole(VAULT_ROLE) {
        _burn(from, amount);
    }

    /// @notice Grant the vault role to an address
    /// @dev Only callable by DEFAULT_ADMIN_ROLE
    /// @param vault The vault contract address
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }

    // -----------------------------------------------------------------------
    // Overrides required by Solidity for multiple inheritance
    // -----------------------------------------------------------------------

    /// @dev Returns the number of decimals (18, standard ERC-20)
    function decimals() public pure override returns (uint8) {
        return 18;
    }

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
