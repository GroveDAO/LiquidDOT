import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const isMainnet = chainId === 420420420n;
  const isLocal = chainId === 31337n;

  console.log("=".repeat(60));
  console.log("LiquidDOT Deployment");
  console.log(`Network: ${network.name} (chainId: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("=".repeat(60));

  const deployed: Record<string, string> = {};
  const confirmations = isLocal ? 1 : 5;

  async function deploy<T>(name: string, factory: Awaited<ReturnType<typeof ethers.getContractFactory>>, args: unknown[]): Promise<T> {
    console.log(`\nDeploying ${name}...`);
    const contract = await factory.deploy(...args);
    await contract.deploymentTransaction()?.wait(confirmations);
    const address = await contract.getAddress();
    deployed[name] = address;
    console.log(`  ✓ ${name}: ${address}`);
    return contract as T;
  }

  // ---------------------------------------------------------------------------
  // Step 1: MockDOT (only on non-mainnet) or use native DOT address
  // ---------------------------------------------------------------------------
  let dotAddress: string;
  if (!isMainnet) {
    const MockDOTFactory = await ethers.getContractFactory("MockDOT");
    const mockDOT = await deploy<{ getAddress(): Promise<string> }>("MockDOT", MockDOTFactory, []);
    dotAddress = await mockDOT.getAddress();
  } else {
    dotAddress = process.env.DOT_TOKEN_ADDRESS ?? "";
    if (!dotAddress) throw new Error("DOT_TOKEN_ADDRESS env var required on mainnet");
    deployed["DOT"] = dotAddress;
  }

  // ---------------------------------------------------------------------------
  // Step 2: GovToken
  // ---------------------------------------------------------------------------
  const GovTokenFactory = await ethers.getContractFactory("GovToken");
  const govToken = await deploy<{ getAddress(): Promise<string> }>("GovToken", GovTokenFactory, [deployer.address]);

  // ---------------------------------------------------------------------------
  // Step 3: StakingPrecompile wrapper (or MockStakingPrecompile on local)
  // ---------------------------------------------------------------------------
  let stakingPrecompileAddress: string;
  if (isLocal) {
    const MockStakingFactory = await ethers.getContractFactory("MockStakingPrecompile");
    const mockStaking = await deploy<{ getAddress(): Promise<string> }>("MockStakingPrecompile", MockStakingFactory, []);
    stakingPrecompileAddress = await mockStaking.getAddress();
  } else {
    const StakingFactory = await ethers.getContractFactory("StakingPrecompile");
    const staking = await deploy<{ getAddress(): Promise<string> }>("StakingPrecompile", StakingFactory, []);
    stakingPrecompileAddress = await staking.getAddress();
  }

  // ---------------------------------------------------------------------------
  // Step 4: StDOTToken (standalone — for governance/voting use)
  // ---------------------------------------------------------------------------
  const StDOTTokenFactory = await ethers.getContractFactory("StDOTToken");
  const stDOTToken = await deploy<{ getAddress(): Promise<string>; grantVaultRole(addr: string): Promise<{ wait(): Promise<void> }> }>(
    "StDOTToken", StDOTTokenFactory, [deployer.address]
  );

  // ---------------------------------------------------------------------------
  // Step 5: TimelockController
  // ---------------------------------------------------------------------------
  const TimelockFactory = await ethers.getContractFactory("TimelockController");
  const minDelay = 2 * 24 * 60 * 60; // 2 days
  const timelock = await deploy<{ getAddress(): Promise<string>; grantRole(role: string, addr: string): Promise<{ wait(): Promise<void> }> }>(
    "TimelockController", TimelockFactory, [minDelay, [], [], deployer.address]
  );

  // ---------------------------------------------------------------------------
  // Step 6: LiquidDOTVault
  // ---------------------------------------------------------------------------
  const VaultFactory = await ethers.getContractFactory("LiquidDOTVault");
  const vault = await deploy<{
    getAddress(): Promise<string>;
    grantRole(role: string, addr: string): Promise<{ wait(): Promise<void> }>;
    KEEPER_ROLE(): Promise<string>;
    GOVERNANCE_ROLE(): Promise<string>;
  }>("LiquidDOTVault", VaultFactory, [stakingPrecompileAddress, dotAddress]);
  const vaultAddress = await vault.getAddress();

  // ---------------------------------------------------------------------------
  // Step 7: Grant VAULT_ROLE on StDOTToken to vault address
  // ---------------------------------------------------------------------------
  console.log("\nGranting VAULT_ROLE on StDOTToken to vault...");
  await (await stDOTToken.grantVaultRole(vaultAddress)).wait();
  console.log("  ✓ Done");

  // ---------------------------------------------------------------------------
  // Step 8: ValidatorRegistry
  // ---------------------------------------------------------------------------
  const RegistryFactory = await ethers.getContractFactory("ValidatorRegistry");
  const registry = await deploy<{ getAddress(): Promise<string> }>(
    "ValidatorRegistry", RegistryFactory, [vaultAddress, stakingPrecompileAddress, deployer.address]
  );
  const registryAddress = await registry.getAddress();

  // ---------------------------------------------------------------------------
  // Step 9: ValidatorGovernor
  // ---------------------------------------------------------------------------
  const GovernorFactory = await ethers.getContractFactory("ValidatorGovernor");
  const governor = await deploy<{ getAddress(): Promise<string> }>(
    "ValidatorGovernor", GovernorFactory, [await govToken.getAddress(), await timelock.getAddress(), registryAddress]
  );
  const governorAddress = await governor.getAddress();

  // ---------------------------------------------------------------------------
  // Steps 10–11: Grant roles on TimelockController
  // ---------------------------------------------------------------------------
  const PROPOSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROPOSER_ROLE"));
  const EXECUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EXECUTOR_ROLE"));
  const CANCELLER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("CANCELLER_ROLE"));

  console.log("\nConfiguring TimelockController roles...");
  await (await timelock.grantRole(PROPOSER_ROLE, governorAddress)).wait();
  await (await timelock.grantRole(CANCELLER_ROLE, governorAddress)).wait();
  await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
  console.log("  ✓ Done");

  // ---------------------------------------------------------------------------
  // Step 12: Grant GOVERNANCE_ROLE on vault to ValidatorRegistry
  // ---------------------------------------------------------------------------
  const GOVERNANCE_ROLE = await vault.GOVERNANCE_ROLE();
  console.log("\nGranting GOVERNANCE_ROLE to ValidatorRegistry...");
  await (await vault.grantRole(GOVERNANCE_ROLE, registryAddress)).wait();
  console.log("  ✓ Done");

  // ---------------------------------------------------------------------------
  // Step 13: AutoCompounder
  // ---------------------------------------------------------------------------
  const AutoCompounderFactory = await ethers.getContractFactory("AutoCompounder");
  const autoCompounder = await deploy<{ getAddress(): Promise<string> }>(
    "AutoCompounder", AutoCompounderFactory, [vaultAddress]
  );
  const autoCompounderAddress = await autoCompounder.getAddress();

  // ---------------------------------------------------------------------------
  // Step 14: Grant KEEPER_ROLE to AutoCompounder
  // ---------------------------------------------------------------------------
  const KEEPER_ROLE = await vault.KEEPER_ROLE();
  console.log("\nGranting KEEPER_ROLE to AutoCompounder...");
  await (await vault.grantRole(KEEPER_ROLE, autoCompounderAddress)).wait();
  console.log("  ✓ Done");

  // ---------------------------------------------------------------------------
  // Step 15: LiquidDOTLens
  // ---------------------------------------------------------------------------
  const LensFactory = await ethers.getContractFactory("LiquidDOTLens");
  await deploy("LiquidDOTLens", LensFactory, []);

  // ---------------------------------------------------------------------------
  // Step 16: Write deployments to file
  // ---------------------------------------------------------------------------
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const outputPath = path.join(deploymentsDir, `${chainId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deployed, null, 2));
  console.log(`\nDeployments written to: ${outputPath}`);

  // ---------------------------------------------------------------------------
  // Step 17: Summary table
  // ---------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  Object.entries(deployed).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(30)} ${addr}`);
  });
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
