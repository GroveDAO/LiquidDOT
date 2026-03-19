// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ILiquidDOT} from "../interfaces/ILiquidDOT.sol";
import {IStakingPrecompile} from "../interfaces/IStakingPrecompile.sol";

/// @title LiquidDOTVault
/// @notice Core liquid staking vault for Polkadot Hub.
///         Users deposit DOT and receive stDOT (this vault token), a yield-bearing
///         ERC-20 that auto-compounds NPoS staking rewards via the Polkadot staking
///         precompile.
/// @dev Implements ILiquidDOT (ERC-4626 + extensions), OZ Pausable, AccessControl,
///      and ReentrancyGuard. DOT has 10 decimals on Polkadot Hub; stDOT uses 18.
///      The vault IS the stDOT share token (ERC-4626 pattern).
contract LiquidDOTVault is ILiquidDOT, ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    /// @notice Role for automated keepers allowed to compound rewards
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    /// @notice Role for governance (ValidatorRegistry) to update nominees
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    /// @notice Role for emergency guardians who can pause/unpause the vault
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Polkadot NPoS unbonding period in eras (~28 days)
    uint32 public constant UNBONDING_ERAS = 28;

    // -----------------------------------------------------------------------
    // Immutable state
    // -----------------------------------------------------------------------

    /// @notice The staking precompile (or mock) this vault delegates to
    IStakingPrecompile public immutable stakingPrecompile;

    // -----------------------------------------------------------------------
    // Mutable state
    // -----------------------------------------------------------------------

    /// @notice Total DOT currently bonded and managed by the vault
    uint256 public totalDOTManaged;

    /// @notice Total DOT currently in the unbonding queue
    uint256 public totalDOTUnbonding;

    /// @notice Monotonically increasing ID for withdrawal requests
    uint256 public nextRequestId;

    /// @notice Active withdrawal requests indexed by ID
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    /// @notice Current validator nominees
    address[] public currentNominees;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy the vault
    /// @param _stakingPrecompile Address of the staking precompile (or mock)
    /// @param dotToken Address of the DOT ERC-20 token (asset)
    constructor(
        address _stakingPrecompile,
        address dotToken
    )
        ERC4626(IERC20(dotToken))
        ERC20("Staked DOT", "stDOT")
    {
        require(_stakingPrecompile != address(0), "LiquidDOTVault: zero precompile");
        require(dotToken != address(0), "LiquidDOTVault: zero DOT token");

        stakingPrecompile = IStakingPrecompile(_stakingPrecompile);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // -----------------------------------------------------------------------
    // ERC-4626 totalAssets override
    // -----------------------------------------------------------------------

    /// @inheritdoc ERC4626
    /// @notice Returns total DOT managed (bonded) by the vault
    function totalAssets() public view override(ERC4626, IERC4626) returns (uint256) {
        return totalDOTManaged;
    }

    // -----------------------------------------------------------------------
    // ERC-4626 deposit / mint overrides
    // -----------------------------------------------------------------------

    /// @inheritdoc ERC4626
    /// @notice Deposit DOT and receive stDOT shares
    /// @param assets Amount of DOT to deposit (planck units, 10 decimals)
    /// @param receiver Address that will receive the minted stDOT
    /// @return shares The amount of stDOT minted
    function deposit(uint256 assets, address receiver)
        public
        override(ERC4626, IERC4626)
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        require(assets > 0, "LiquidDOTVault: zero deposit");

        shares = previewDeposit(assets);
        require(shares > 0, "LiquidDOTVault: zero shares");

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
        IERC20(asset()).approve(address(stakingPrecompile), assets);
        stakingPrecompile.bondExtra(assets);

        totalDOTManaged += assets;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
        emit Staked(msg.sender, receiver, assets, shares);
    }

    /// @inheritdoc ERC4626
    /// @notice Mint exact shares by depositing the required DOT
    /// @param shares Number of stDOT shares to mint
    /// @param receiver Address that will receive the minted stDOT
    /// @return assets The amount of DOT deposited
    function mint(uint256 shares, address receiver)
        public
        override(ERC4626, IERC4626)
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0, "LiquidDOTVault: zero shares");

        assets = previewMint(shares);
        require(assets > 0, "LiquidDOTVault: zero assets");

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
        IERC20(asset()).approve(address(stakingPrecompile), assets);
        stakingPrecompile.bondExtra(assets);

        totalDOTManaged += assets;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
        emit Staked(msg.sender, receiver, assets, shares);
    }

    // -----------------------------------------------------------------------
    // ERC-4626 withdraw / redeem (queue-based unbonding)
    // -----------------------------------------------------------------------

    /// @inheritdoc ERC4626
    /// @notice Queue a DOT withdrawal by burning stDOT and initiating unbonding
    /// @param assets Amount of DOT to withdraw
    /// @param receiver Address stored for the withdrawal claim
    /// @param owner Address whose stDOT is burned
    /// @return shares The amount of stDOT burned
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override(ERC4626, IERC4626)
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        require(assets > 0, "LiquidDOTVault: zero assets");
        shares = previewWithdraw(assets);
        _processWithdrawal(shares, assets, owner, receiver);
    }

    /// @inheritdoc ERC4626
    /// @notice Queue a redemption by burning stDOT and initiating unbonding
    /// @param shares Amount of stDOT to redeem
    /// @param receiver Address stored for the withdrawal claim
    /// @param owner Address whose stDOT is burned
    /// @return assets The amount of DOT queued for withdrawal
    function redeem(uint256 shares, address receiver, address owner)
        public
        override(ERC4626, IERC4626)
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0, "LiquidDOTVault: zero shares");
        assets = previewRedeem(shares);
        _processWithdrawal(shares, assets, owner, receiver);
    }

    // -----------------------------------------------------------------------
    // ILiquidDOT extension functions
    // -----------------------------------------------------------------------

    /// @inheritdoc ILiquidDOT
    /// @notice Queue a withdrawal request; burns stDOT proportional to `assets`
    /// @param assets DOT amount requested
    /// @return requestId The new withdrawal request ID
    function queueWithdrawal(uint256 assets)
        external
        override(ILiquidDOT)
        whenNotPaused
        nonReentrant
        returns (uint256 requestId)
    {
        require(assets > 0, "LiquidDOTVault: zero assets");
        uint256 shares = previewWithdraw(assets);
        requestId = _processWithdrawal(shares, assets, msg.sender, msg.sender);
    }

    /// @inheritdoc ILiquidDOT
    /// @notice Claim a previously queued withdrawal after the unbonding period
    /// @param requestId The ID of the withdrawal request to claim
    function claimWithdrawal(uint256 requestId)
        external
        override(ILiquidDOT)
        nonReentrant
    {
        WithdrawalRequest storage req = withdrawalRequests[requestId];
        require(req.owner == msg.sender, "LiquidDOTVault: not owner");
        require(!req.claimed, "LiquidDOTVault: already claimed");

        uint32 currentEra = stakingPrecompile.getActiveEra();
        require(
            currentEra >= req.unbondEra + UNBONDING_ERAS,
            "LiquidDOTVault: unbonding not complete"
        );

        req.claimed = true;
        totalDOTUnbonding -= req.dotAmount;

        stakingPrecompile.withdrawUnbonded(0);

        IERC20(asset()).safeTransfer(msg.sender, req.dotAmount);

        emit WithdrawalClaimed(requestId, msg.sender, req.dotAmount);
    }

    /// @notice Compound pending staking rewards, increasing the exchange rate
    /// @dev Only callable by KEEPER_ROLE; works even when the vault is paused
    function compoundRewards() external nonReentrant onlyRole(KEEPER_ROLE) {
        uint256 rewards = stakingPrecompile.getPendingRewards(address(this));
        if (rewards == 0) return;

        stakingPrecompile.bondExtra(rewards);
        totalDOTManaged += rewards;

        uint256 newRate = exchangeRate();
        emit RewardsCompounded(rewards, newRate);
    }

    /// @notice Update the list of nominated validators
    /// @dev Only callable by GOVERNANCE_ROLE (typically ValidatorRegistry)
    /// @param nominees Array of validator addresses to nominate (max 16)
    function updateNominees(address[] calldata nominees)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        require(nominees.length > 0, "LiquidDOTVault: empty nominees");
        require(nominees.length <= 16, "LiquidDOTVault: too many nominees");
        for (uint256 i = 0; i < nominees.length; i++) {
            require(nominees[i] != address(0), "LiquidDOTVault: zero nominee");
        }
        currentNominees = nominees;
        stakingPrecompile.nominate(nominees);
    }

    // -----------------------------------------------------------------------
    // ILiquidDOT view functions
    // -----------------------------------------------------------------------

    /// @inheritdoc ILiquidDOT
    /// @notice Returns the current exchange rate: DOT per stDOT (18-decimal precision)
    function exchangeRate() public view override(ILiquidDOT) returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return totalDOTManaged.mulDiv(1e18, supply, Math.Rounding.Floor);
    }

    /// @inheritdoc ILiquidDOT
    function totalStaked() external view override(ILiquidDOT) returns (uint256) {
        return totalDOTManaged;
    }

    /// @inheritdoc ILiquidDOT
    function pendingRewards() external view override(ILiquidDOT) returns (uint256) {
        return stakingPrecompile.getPendingRewards(address(this));
    }

    /// @inheritdoc ILiquidDOT
    function unbondingPeriod() external pure override(ILiquidDOT) returns (uint256) {
        return UNBONDING_ERAS;
    }

    // -----------------------------------------------------------------------
    // Guardian functions
    // -----------------------------------------------------------------------

    /// @notice Pause the vault — blocks deposits and withdrawals
    /// @dev compoundRewards still works while paused (emergency safety)
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    /// @notice Unpause the vault
    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // -----------------------------------------------------------------------
    // ERC-4626 decimal offset
    // -----------------------------------------------------------------------

    /// @dev Returns 8 so that shares (stDOT, 18 dec) and assets (DOT, 10 dec)
    ///      are aligned in the OZ ERC4626 virtual offset mechanism.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 8;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// @dev Core withdrawal logic shared by withdraw(), redeem(), and queueWithdrawal()
    function _processWithdrawal(
        uint256 shares,
        uint256 assets,
        address owner,
        address receiver
    ) internal returns (uint256 requestId) {
        require(balanceOf(owner) >= shares, "LiquidDOTVault: insufficient stDOT");

        _burn(owner, shares);

        totalDOTManaged -= assets;
        totalDOTUnbonding += assets;

        stakingPrecompile.unbond(assets);

        uint32 currentEra = stakingPrecompile.getActiveEra();
        requestId = nextRequestId++;

        withdrawalRequests[requestId] = WithdrawalRequest({
            owner: receiver,
            dotAmount: assets,
            unbondEra: currentEra,
            claimed: false
        });

        emit Unstaked(owner, shares, assets);
        emit WithdrawalQueued(requestId, receiver, assets, currentEra);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
}
