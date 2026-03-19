// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockDOT
/// @notice Test-only ERC-20 representing the DOT token on Polkadot Hub EVM
/// @dev Uses 10 decimals to match real DOT. mint() is public for test setups.
contract MockDOT is ERC20 {
    constructor() ERC20("DOT", "DOT") {}

    /// @notice Mint tokens to any address (test use only)
    /// @param to Recipient address
    /// @param amount Amount to mint (in planck units, 10 decimals)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice DOT uses 10 decimals on Polkadot Hub
    function decimals() public pure override returns (uint8) {
        return 10;
    }
}
