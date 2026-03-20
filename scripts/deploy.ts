import { ethers, network } from "hardhat";
import { DeploymentEntry, syncDeploymentOutputs, writeDeploymentFiles } from "./lib/deployments";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const chainIdNumber = Number(chainId);
  const isLocal = chainId === 31337n;
  const nativeAssetAddress = ethers.ZeroAddress;
  const canonicalStakingPrecompile = "0x0000000000000000000000000000000000000800";
  const nativeStakingEnabled =
    isLocal || process.env.POLKADOT_HUB_ENABLE_NATIVE_STAKING === "true";

  console.log("=".repeat(60));
  console.log("LiquidDOT Deployment");
  console.log(`Network: ${network.name} (chainId: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Native staking enabled: ${nativeStakingEnabled}`);
  console.log("=".repeat(60));

  const deployed: Record<string, string> = {};
  const manifestEntries: DeploymentEntry[] = [];
  const confirmations = isLocal || chainId === 420420417n ? 1 : 5;

  async function deploy<T>(
    name: string,
    contractId: string,
    factory: Awaited<ReturnType<typeof ethers.getContractFactory>>,
    args: unknown[]
  ): Promise<T> {
    console.log(`\nDeploying ${name}...`);
    const contract = await factory.deploy(...args);
    const deploymentTx = contract.deploymentTransaction();
    await deploymentTx?.wait(confirmations);
    const address = await contract.getAddress();
    deployed[name] = address;
    manifestEntries.push({
      name,
      address,
      contract: contractId,
      constructorArgs: args,
      verifiable: true,
      txHash: deploymentTx?.hash,
    });
    console.log(`  ✓ ${name}: ${address}`);
    return contract as T;
  }

  // ---------------------------------------------------------------------------
  // Step 1: Record the native gas token sentinel
  // ---------------------------------------------------------------------------
  deployed["DOT"] = nativeAssetAddress;
  manifestEntries.push({
    name: "DOT",
    address: nativeAssetAddress,
    constructorArgs: [],
    verifiable: false,
  });

  // ---------------------------------------------------------------------------
  // Step 2: GovToken
  // ---------------------------------------------------------------------------
  const GovTokenFactory = await ethers.getContractFactory("GovToken");
  const govToken = await deploy<{ getAddress(): Promise<string> }>(
    "GovToken",
    "contracts/governance/GovToken.sol:GovToken",
    GovTokenFactory,
    [deployer.address]
  );

  // ---------------------------------------------------------------------------
  // Step 3: Staking precompile (or mock on local Hardhat)
  // ---------------------------------------------------------------------------
  let stakingPrecompileAddress: string;
  if (isLocal) {
    const MockStakingFactory = await ethers.getContractFactory("MockStakingPrecompile");
    const mockStaking = await deploy<{ getAddress(): Promise<string> }>(
      "MockStakingPrecompile",
      "contracts/mocks/MockStakingPrecompile.sol:MockStakingPrecompile",
      MockStakingFactory,
      []
    );
    stakingPrecompileAddress = await mockStaking.getAddress();
  } else {
    stakingPrecompileAddress = canonicalStakingPrecompile;
    deployed["StakingPrecompile"] = stakingPrecompileAddress;
    manifestEntries.push({
      name: "StakingPrecompile",
      address: stakingPrecompileAddress,
      constructorArgs: [],
      verifiable: false,
    });
    console.log(`\nUsing canonical staking precompile: ${stakingPrecompileAddress}`);
  }

  // ---------------------------------------------------------------------------
  // Step 4: StDOTToken (standalone — for governance/voting use)
  // ---------------------------------------------------------------------------
  const StDOTTokenFactory = await ethers.getContractFactory("StDOTToken");
  const stDOTToken = await deploy<{ getAddress(): Promise<string>; grantVaultRole(addr: string): Promise<{ wait(): Promise<void> }> }>(
    "StDOTToken",
    "contracts/core/StDOTToken.sol:StDOTToken",
    StDOTTokenFactory,
    [deployer.address]
  );

  // ---------------------------------------------------------------------------
  // Step 5: TimelockController
  // ---------------------------------------------------------------------------
  const TimelockFactory = await ethers.getContractFactory("TimelockController");
  const minDelay = 2 * 24 * 60 * 60; // 2 days
  const timelock = await deploy<{ getAddress(): Promise<string>; grantRole(role: string, addr: string): Promise<{ wait(): Promise<void> }> }>(
    "TimelockController",
    "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController",
    TimelockFactory,
    [minDelay, [], [], deployer.address]
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
  }>(
    "LiquidDOTVault",
    "contracts/core/LiquidDOTVault.sol:LiquidDOTVault",
    VaultFactory,
    [stakingPrecompileAddress, nativeStakingEnabled]
  );
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
    "ValidatorRegistry",
    "contracts/core/ValidatorRegistry.sol:ValidatorRegistry",
    RegistryFactory,
    [vaultAddress, stakingPrecompileAddress, deployer.address, nativeStakingEnabled]
  );
  const registryAddress = await registry.getAddress();

  // ---------------------------------------------------------------------------
  // Step 9: ValidatorGovernor
  // ---------------------------------------------------------------------------
  const GovernorFactory = await ethers.getContractFactory("ValidatorGovernor");
  const governor = await deploy<{ getAddress(): Promise<string> }>(
    "ValidatorGovernor",
    "contracts/governance/ValidatorGovernor.sol:ValidatorGovernor",
    GovernorFactory,
    [await govToken.getAddress(), await timelock.getAddress(), registryAddress]
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
    "AutoCompounder",
    "contracts/periphery/AutoCompounder.sol:AutoCompounder",
    AutoCompounderFactory,
    [vaultAddress]
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
  await deploy(
    "LiquidDOTLens",
    "contracts/periphery/LiquidDOTLens.sol:LiquidDOTLens",
    LensFactory,
    []
  );

  // ---------------------------------------------------------------------------
  // Step 16: Write deployments to file
  // ---------------------------------------------------------------------------
  const { addressBookPath, manifestPath } = writeDeploymentFiles({
    chainId: chainIdNumber,
    network: network.name,
    deployer: deployer.address,
    contracts: manifestEntries,
  });
  syncDeploymentOutputs({ chainId: chainIdNumber, deployments: deployed });
  console.log(`\nDeployments written to: ${addressBookPath}`);
  console.log(`Deployment manifest written to: ${manifestPath}`);
  console.log("Synchronized addresses to .env, frontend/.env, and frontend/lib/contracts.ts");

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
