import { parseAbi } from "viem";

// ---------------------------------------------------------------------------
// Deployed contract addresses per chain
// ---------------------------------------------------------------------------

export interface DeployedAddresses {
  dot?: string;
  stakingPrecompile?: string;
  timelock?: string;
  vault: string;
  stDOT: string;
  stDOTToken?: string;
  govToken: string;
  governor: string;
  registry: string;
  autoCompounder: string;
  lens: string;
}

export const DEPLOYED_ADDRESSES: Record<number, DeployedAddresses> = {
  // Polkadot Hub Testnet
  420420417: {
    dot: "0x0000000000000000000000000000000000000000",
    stakingPrecompile: "0x0000000000000000000000000000000000000800",
    timelock: "0xD1d1ee0eC8B1460fc235C830179b9221549cB155",
    vault: "0x0004DF4A37C6541453e8C01182d0611eFaa76ffb",
    stDOT: "0x0004DF4A37C6541453e8C01182d0611eFaa76ffb",
    stDOTToken: "0xc79E3E0c71a0E7ED4209B3e8e5753665AE19d606",
    govToken: "0x7bEd5956dD1cC8A15CC623230763775f95857981",
    governor: "0xC8f7532c0bA448aB4D6C27CC56d7ddfaB9BF1599",
    registry: "0x69bc6e363B01d06a9939C0F8c1653D702118058b",
    autoCompounder: "0xD02Ab915f06437fB22d889F5a50fac00577C6C7B",
    lens: "0x0C287c8B5E343bE6A869C8AdCeF33B00E0Be24f2",
  },
};

// ---------------------------------------------------------------------------
// Minimal ABIs (expand with typechain-generated ABIs post-compilation)
// ---------------------------------------------------------------------------

export const VAULT_ABI = parseAbi([
  "function deposit(uint256 assets, address receiver) payable returns (uint256)",
  "function mint(uint256 shares, address receiver) payable returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function queueWithdrawal(uint256 assets) returns (uint256)",
  "function claimWithdrawal(uint256 requestId)",
  "function compoundRewards()",
  "function nativeStakingEnabled() view returns (bool)",
  "function operatorStakingEnabled() view returns (bool)",
  "function stakingOperator() view returns (address)",
  "function operatorManagedAssets() view returns (uint256)",
  "function totalDOTManaged() view returns (uint256)",
  "function totalDOTUnbonding() view returns (uint256)",
  "function exchangeRate() view returns (uint256)",
  "function pendingRewards() view returns (uint256)",
  "function unbondingPeriod() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function asset() view returns (address)",
  "function paused() view returns (bool)",
  "function withdrawalRequests(uint256 id) view returns (address owner, uint256 dotAmount, uint32 unbondEra, bool claimed)",
  "function fundedWithdrawals(uint256 id) view returns (bool)",
  "function nextRequestId() view returns (uint256)",
  "event Staked(address indexed caller, address indexed owner, uint256 dotAmount, uint256 stDOTAmount)",
  "event WithdrawalQueued(uint256 indexed requestId, address indexed owner, uint256 dotAmount, uint32 unbondEra)",
  "event WithdrawalClaimed(uint256 indexed requestId, address indexed owner, uint256 dotAmount)",
  "event RewardsCompounded(uint256 rewardsAmount, uint256 newExchangeRate)",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function delegate(address delegatee)",
  "function delegates(address account) view returns (address)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export const LENS_ABI = parseAbi([
  "function getVaultStats(address vault) view returns ((uint256 totalDOTManaged, uint256 totalStDOTSupply, uint256 exchangeRate, uint256 pendingRewards, uint256 annualizedAPY, uint256 unbondingPeriodEras, address[] currentNominees, bool isPaused))",
  "function getUserPosition(address vault, address user) view returns ((uint256 stDOTBalance, uint256 dotValue, (uint256 requestId, address owner, uint256 dotAmount, uint32 unbondEra, bool claimed)[] pendingWithdrawals))",
]);

export const STAKING_PRECOMPILE_ABI = parseAbi([
  "function getActiveEra() view returns (uint32)",
]);

export const GOVERNOR_ABI = parseAbi([
  "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
  "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
  "function getVotes(address account, uint256 blockNumber) view returns (uint256)",
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
]);

export const REGISTRY_ABI = parseAbi([
  "function proposeNominees(address[] nominees)",
  "function executeNominees()",
  "function getCurrentNominees() view returns (address[])",
  "function getQueuedNominees() view returns (address[] nominees, uint256 executeAfterEra)",
]);
