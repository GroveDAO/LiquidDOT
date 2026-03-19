// ---------------------------------------------------------------------------
// Deployed contract addresses per chain
// ---------------------------------------------------------------------------

export interface DeployedAddresses {
  vault: string;
  stDOT: string;
  govToken: string;
  governor: string;
  registry: string;
  autoCompounder: string;
  lens: string;
}

export const DEPLOYED_ADDRESSES: Record<number, DeployedAddresses> = {
  // Polkadot Hub Testnet
  420420421: {
    vault: "0x0000000000000000000000000000000000000000",        // TBD after deployment
    stDOT: "0x0000000000000000000000000000000000000000",         // TBD
    govToken: "0x0000000000000000000000000000000000000000",      // TBD
    governor: "0x0000000000000000000000000000000000000000",      // TBD
    registry: "0x0000000000000000000000000000000000000000",      // TBD
    autoCompounder: "0x0000000000000000000000000000000000000000",// TBD
    lens: "0x0000000000000000000000000000000000000000",          // TBD
  },
  // Polkadot Hub Mainnet
  420420420: {
    vault: "0x0000000000000000000000000000000000000000",
    stDOT: "0x0000000000000000000000000000000000000000",
    govToken: "0x0000000000000000000000000000000000000000",
    governor: "0x0000000000000000000000000000000000000000",
    registry: "0x0000000000000000000000000000000000000000",
    autoCompounder: "0x0000000000000000000000000000000000000000",
    lens: "0x0000000000000000000000000000000000000000",
  },
};

// ---------------------------------------------------------------------------
// Minimal ABIs (expand with typechain-generated ABIs post-compilation)
// ---------------------------------------------------------------------------

export const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function queueWithdrawal(uint256 assets) returns (uint256)",
  "function claimWithdrawal(uint256 requestId)",
  "function compoundRewards()",
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
  "function nextRequestId() view returns (uint256)",
  "event Staked(address indexed caller, address indexed owner, uint256 dotAmount, uint256 stDOTAmount)",
  "event WithdrawalQueued(uint256 indexed requestId, address indexed owner, uint256 dotAmount, uint32 unbondEra)",
  "event WithdrawalClaimed(uint256 indexed requestId, address indexed owner, uint256 dotAmount)",
  "event RewardsCompounded(uint256 rewardsAmount, uint256 newExchangeRate)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export const LENS_ABI = [
  "function getVaultStats(address vault) view returns ((uint256 totalDOTManaged, uint256 totalStDOTSupply, uint256 exchangeRate, uint256 pendingRewards, uint256 annualizedAPY, uint256 unbondingPeriodEras, address[] currentNominees, bool isPaused))",
  "function getUserPosition(address vault, address user) view returns ((uint256 stDOTBalance, uint256 dotValue, (address owner, uint256 dotAmount, uint32 unbondEra, bool claimed)[] pendingWithdrawals))",
] as const;

export const GOVERNOR_ABI = [
  "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
  "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
  "function getVotes(address account, uint256 blockNumber) view returns (uint256)",
] as const;

export const REGISTRY_ABI = [
  "function proposeNominees(address[] nominees)",
  "function executeNominees()",
  "function getCurrentNominees() view returns (address[])",
  "function getQueuedNominees() view returns (address[] nominees, uint256 executeAfterEra)",
] as const;
