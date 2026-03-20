// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ILiquidDOT} from "../interfaces/ILiquidDOT.sol";
import {IStakingPrecompile} from "../interfaces/IStakingPrecompile.sol";

/// @title LiquidDOTVault
/// @notice Core liquid staking vault for Polkadot Hub.
///         Users deposit DOT and receive stDOT (this vault token), a yield-bearing
///         ERC-20 that auto-compounds NPoS staking rewards via the Polkadot staking
///         precompile.
/// @dev Implements ILiquidDOT, OZ Pausable, AccessControl, and ReentrancyGuard.
///      Native DOT/PAS has 10 decimals on Polkadot Hub; stDOT uses 18.
///      The vault IS the stDOT share token.
contract LiquidDOTVault is ILiquidDOT, ERC20, AccessControl, Pausable, ReentrancyGuard {
    using Math for uint256;

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    /// @notice Role for automated keepers allowed to compound rewards
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    /// @notice Role for governance (ValidatorRegistry) to update nominees
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    /// @notice Role for the off-chain operator that stakes PAS from an EOA.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Role for emergency guardians who can pause/unpause the vault
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Polkadot NPoS unbonding period in eras (~28 days)
    uint32 public constant UNBONDING_ERAS = 28;

    /// @notice Address sentinel for the native gas token on Polkadot Hub.
    address public constant NATIVE_ASSET = address(0);

    /// @dev Virtual share offset matching 10-decimal native assets to 18-decimal shares.
    uint256 private constant VIRTUAL_SHARES = 1e8;

    /// @dev SCALE-encoded RewardDestination::Staked.
    bytes private constant STAKED_REWARD_DESTINATION = hex"00";

    // -----------------------------------------------------------------------
    // Immutable state
    // -----------------------------------------------------------------------

    /// @notice The staking precompile (or mock) this vault delegates to
    IStakingPrecompile public immutable stakingPrecompile;

    /// @notice Whether this deployment should call the native staking precompile.
    bool public immutable nativeStakingEnabled;

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

    /// @notice Authorized native staking operator EOA.
    address public stakingOperator;

    /// @notice Amount of vault assets currently swept to the operator for native staking.
    uint256 public operatorManagedAssets;

    /// @notice Tracks whether liquidity has been returned for a queued withdrawal.
    mapping(uint256 => bool) public fundedWithdrawals;

    /// @notice Emitted when the staking operator is updated.
    event StakingOperatorUpdated(address indexed previousOperator, address indexed newOperator);

    /// @notice Emitted when native PAS is swept to the operator for external staking.
    event OperatorSweep(address indexed operator, uint256 amount);

    /// @notice Emitted when the operator returns liquidity for a queued withdrawal.
    event WithdrawalFunded(uint256 indexed requestId, uint256 amount);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy the vault
    /// @param _stakingPrecompile Address of the staking precompile (or mock)
    /// @param _nativeStakingEnabled Whether native staking precompile integration is active
    constructor(address _stakingPrecompile, bool _nativeStakingEnabled) ERC20("Staked DOT", "stDOT") {
        require(_stakingPrecompile != address(0), "LiquidDOTVault: zero precompile");

        stakingPrecompile = IStakingPrecompile(_stakingPrecompile);
        nativeStakingEnabled = _nativeStakingEnabled;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        stakingOperator = msg.sender;
    }

    // -----------------------------------------------------------------------
    // Native asset handling
    // -----------------------------------------------------------------------

    /// @notice Accept native tokens returned from the staking precompile.
    receive() external payable {}

    /// @notice Returns the vault share token address for periphery helpers.
    function stDOT() external view returns (address) {
        return address(this);
    }

    /// @notice Returns true when the vault is using an off-chain operator for real native staking.
    function operatorStakingEnabled() public view returns (bool) {
        return !nativeStakingEnabled && stakingOperator != address(0);
    }

    /// @notice Exposes the current nominees for read-only consumers.
    function getCurrentNomineesView() external view returns (address[] memory) {
        return currentNominees;
    }

    /// @inheritdoc ILiquidDOT
    function asset() public pure override returns (address) {
        return NATIVE_ASSET;
    }

    /// @notice Returns total DOT managed (bonded) by the vault
    function totalAssets() public view override returns (uint256) {
        return totalDOTManaged;
    }

    // -----------------------------------------------------------------------
    // ERC-4626-style vault math
    // -----------------------------------------------------------------------

    /// @inheritdoc ERC20
    function decimals() public pure override(ERC20, IERC20Metadata) returns (uint8) {
        return 18;
    }

    /// @inheritdoc ILiquidDOT
    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        shares = _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc ILiquidDOT
    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        assets = _convertToAssets(shares, Math.Rounding.Floor);
    }

    /// @inheritdoc ILiquidDOT
    function maxDeposit(address) public view override returns (uint256 maxAssets) {
        maxAssets = paused() ? 0 : type(uint256).max;
    }

    /// @inheritdoc ILiquidDOT
    function previewDeposit(uint256 assets) public view override returns (uint256 shares) {
        shares = _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc ILiquidDOT
    function maxMint(address) public view override returns (uint256 maxShares) {
        maxShares = paused() ? 0 : type(uint256).max;
    }

    /// @inheritdoc ILiquidDOT
    function previewMint(uint256 shares) public view override returns (uint256 assets) {
        assets = _convertToAssets(shares, Math.Rounding.Ceil);
    }

    /// @inheritdoc ILiquidDOT
    function maxWithdraw(address owner) public view override returns (uint256 maxAssets) {
        if (paused()) return 0;
        maxAssets = previewRedeem(maxRedeem(owner));
    }

    /// @inheritdoc ILiquidDOT
    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        shares = _convertToShares(assets, Math.Rounding.Ceil);
    }

    /// @inheritdoc ILiquidDOT
    function maxRedeem(address owner) public view override returns (uint256 maxShares) {
        if (paused()) return 0;
        maxShares = balanceOf(owner);
    }

    /// @inheritdoc ILiquidDOT
    function previewRedeem(uint256 shares) public view override returns (uint256 assets) {
        assets = _convertToAssets(shares, Math.Rounding.Floor);
    }

    // -----------------------------------------------------------------------
    // Payable deposit / mint
    // -----------------------------------------------------------------------

    /// @notice Deposit DOT and receive stDOT shares
    /// @param assets Amount of DOT to deposit (planck units, 10 decimals)
    /// @param receiver Address that will receive the minted stDOT
    /// @return shares The amount of stDOT minted
    function deposit(uint256 assets, address receiver)
        public
        payable
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        require(assets > 0, "LiquidDOTVault: zero deposit");
        require(msg.value == assets, "LiquidDOTVault: value mismatch");

        shares = previewDeposit(assets);
        require(shares > 0, "LiquidDOTVault: zero shares");

        _stakeAssets(assets);

        totalDOTManaged += assets;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
        emit Staked(msg.sender, receiver, assets, shares);
    }

    /// @inheritdoc ILiquidDOT
    /// @notice Mint exact shares by depositing the required DOT
    /// @param shares Number of stDOT shares to mint
    /// @param receiver Address that will receive the minted stDOT
    /// @return assets The amount of DOT deposited
    function mint(uint256 shares, address receiver)
        public
        payable
        override
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0, "LiquidDOTVault: zero shares");

        assets = previewMint(shares);
        require(assets > 0, "LiquidDOTVault: zero assets");
        require(msg.value == assets, "LiquidDOTVault: value mismatch");

        _stakeAssets(assets);

        totalDOTManaged += assets;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
        emit Staked(msg.sender, receiver, assets, shares);
    }

    // -----------------------------------------------------------------------
    // ERC-4626 withdraw / redeem (queue-based unbonding)
    // -----------------------------------------------------------------------

    /// @inheritdoc ILiquidDOT
    /// @notice Queue a DOT withdrawal by burning stDOT and initiating unbonding
    /// @param assets Amount of DOT to withdraw
    /// @param receiver Address stored for the withdrawal claim
    /// @param owner Address whose stDOT is burned
    /// @return shares The amount of stDOT burned
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        require(assets > 0, "LiquidDOTVault: zero assets");
        shares = previewWithdraw(assets);
        _processWithdrawal(msg.sender, shares, assets, owner, receiver);
    }

    /// @inheritdoc ILiquidDOT
    /// @notice Queue a redemption by burning stDOT and initiating unbonding
    /// @param shares Amount of stDOT to redeem
    /// @param receiver Address stored for the withdrawal claim
    /// @param owner Address whose stDOT is burned
    /// @return assets The amount of DOT queued for withdrawal
    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0, "LiquidDOTVault: zero shares");
        assets = previewRedeem(shares);
        _processWithdrawal(msg.sender, shares, assets, owner, receiver);
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
        requestId = _processWithdrawal(msg.sender, shares, assets, msg.sender, msg.sender);
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

        if (nativeStakingEnabled) {
            uint32 currentEra = stakingPrecompile.getActiveEra();
            require(
                currentEra >= req.unbondEra + UNBONDING_ERAS,
                "LiquidDOTVault: unbonding not complete"
            );
        } else if (operatorStakingEnabled()) {
            require(fundedWithdrawals[requestId], "LiquidDOTVault: withdrawal not funded");
        }

        req.claimed = true;
        totalDOTUnbonding -= req.dotAmount;

        if (nativeStakingEnabled) {
            stakingPrecompile.withdrawUnbonded(0);
        }

        (bool success,) = payable(msg.sender).call{value: req.dotAmount}("");
        require(success, "LiquidDOTVault: native transfer failed");

        emit WithdrawalClaimed(requestId, msg.sender, req.dotAmount);
    }

    /// @notice Compound pending staking rewards, increasing the exchange rate
    /// @dev Only callable by KEEPER_ROLE; works even when the vault is paused
    function compoundRewards() external nonReentrant onlyRole(KEEPER_ROLE) {
        uint256 rewards;
        if (nativeStakingEnabled) {
            rewards = stakingPrecompile.getPendingRewards(address(this));
        } else {
            rewards = _unaccountedNativeRewards();
        }

        if (rewards == 0) return;

        if (nativeStakingEnabled) {
            stakingPrecompile.bondExtra(rewards);
            _clearPendingRewardsIfMock();
        }

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
        if (nativeStakingEnabled) {
            stakingPrecompile.nominate(nominees);
        }
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
        if (!nativeStakingEnabled) {
            return _unaccountedNativeRewards();
        }
        return stakingPrecompile.getPendingRewards(address(this));
    }

    /// @inheritdoc ILiquidDOT
    function unbondingPeriod() external view override(ILiquidDOT) returns (uint256) {
        return nativeStakingEnabled ? UNBONDING_ERAS : 0;
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

    /// @notice Update the external staking operator.
    function setStakingOperator(address newOperator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address previousOperator = stakingOperator;
        stakingOperator = newOperator;
        if (newOperator != address(0) && !hasRole(OPERATOR_ROLE, newOperator)) {
            _grantRole(OPERATOR_ROLE, newOperator);
        }
        emit StakingOperatorUpdated(previousOperator, newOperator);
    }

    /// @notice Sweep idle PAS from the vault to the operator for native staking from an EOA.
    function sweepToOperator(uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        require(operatorStakingEnabled(), "LiquidDOTVault: operator staking disabled");
        require(msg.sender == stakingOperator, "LiquidDOTVault: not configured operator");
        require(amount > 0, "LiquidDOTVault: zero amount");
        require(address(this).balance >= totalDOTUnbonding + amount, "LiquidDOTVault: insufficient liquid");

        operatorManagedAssets += amount;
        (bool success,) = payable(stakingOperator).call{value: amount}("");
        require(success, "LiquidDOTVault: operator transfer failed");

        emit OperatorSweep(stakingOperator, amount);
    }

    /// @notice Report externally realized rewards by transferring PAS back into the vault.
    function reportExternalRewards()
        external
        payable
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        require(operatorStakingEnabled(), "LiquidDOTVault: operator staking disabled");
        require(msg.sender == stakingOperator, "LiquidDOTVault: not configured operator");
        require(msg.value > 0, "LiquidDOTVault: zero rewards");

        totalDOTManaged += msg.value;
        emit RewardsCompounded(msg.value, exchangeRate());
    }

    /// @notice Return liquidity for a queued withdrawal after the operator has unbonded externally.
    function fundWithdrawal(uint256 requestId)
        external
        payable
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        require(operatorStakingEnabled(), "LiquidDOTVault: operator staking disabled");
        require(msg.sender == stakingOperator, "LiquidDOTVault: not configured operator");

        WithdrawalRequest storage req = withdrawalRequests[requestId];
        require(req.owner != address(0), "LiquidDOTVault: invalid request");
        require(!req.claimed, "LiquidDOTVault: already claimed");
        require(!fundedWithdrawals[requestId], "LiquidDOTVault: already funded");
        require(msg.value == req.dotAmount, "LiquidDOTVault: value mismatch");
        require(operatorManagedAssets >= req.dotAmount, "LiquidDOTVault: insufficient operator assets");

        operatorManagedAssets -= req.dotAmount;
        fundedWithdrawals[requestId] = true;

        emit WithdrawalFunded(requestId, req.dotAmount);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view returns (uint256) {
        return assets.mulDiv(totalSupply() + VIRTUAL_SHARES, totalAssets() + 1, rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + VIRTUAL_SHARES, rounding);
    }

    function _stakeAssets(uint256 assets) internal {
        if (!nativeStakingEnabled) {
            assets;
            return;
        }

        uint256 currentStake = stakingPrecompile.getStake(address(this));
        if (currentStake == 0) {
            stakingPrecompile.bond(address(this), assets, STAKED_REWARD_DESTINATION);
            return;
        }

        stakingPrecompile.bondExtra(assets);
    }

    function _clearPendingRewardsIfMock() internal {
        (bool success,) = address(stakingPrecompile).call(
            abi.encodeWithSignature("clearPendingRewards(address)", address(this))
        );
        success;
    }

    /// @dev Returns native-token surplus sitting in the vault beyond accounted managed + queued funds.
    function _unaccountedNativeRewards() internal view returns (uint256) {
        uint256 accountedBalance = totalDOTManaged + totalDOTUnbonding;
        uint256 currentBalance = address(this).balance;
        if (currentBalance <= accountedBalance) {
            return 0;
        }
        return currentBalance - accountedBalance;
    }

    /// @dev Core withdrawal logic shared by withdraw(), redeem(), and queueWithdrawal()
    function _processWithdrawal(
        address caller,
        uint256 shares,
        uint256 assets,
        address owner,
        address receiver
    ) internal returns (uint256 requestId) {
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }
        require(balanceOf(owner) >= shares, "LiquidDOTVault: insufficient stDOT");

        _burn(owner, shares);

        totalDOTManaged -= assets;
        totalDOTUnbonding += assets;

        uint32 currentEra = 0;
        if (nativeStakingEnabled) {
            stakingPrecompile.unbond(assets);
            currentEra = stakingPrecompile.getActiveEra();
        }

        requestId = nextRequestId++;

        withdrawalRequests[requestId] = WithdrawalRequest({
            owner: receiver,
            dotAmount: assets,
            unbondEra: currentEra,
            claimed: false
        });

        emit Unstaked(owner, shares, assets);
        emit WithdrawalQueued(requestId, receiver, assets, currentEra);
        emit Withdraw(caller, receiver, owner, assets, shares);
    }
}
