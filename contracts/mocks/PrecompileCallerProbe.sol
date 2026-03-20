// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IStakingPrecompile} from "../interfaces/IStakingPrecompile.sol";

contract PrecompileCallerProbe {
    IStakingPrecompile public constant STAKING = IStakingPrecompile(
        0x0000000000000000000000000000000000000800
    );

    receive() external payable {}

    function bondSelf(uint256 amount) external {
        STAKING.bond(address(this), amount, hex"00");
    }

    function bondExtra(uint256 amount) external {
        STAKING.bondExtra(amount);
    }

    function unbond(uint256 amount) external {
        STAKING.unbond(amount);
    }
}
