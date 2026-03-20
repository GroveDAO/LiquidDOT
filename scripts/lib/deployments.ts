import * as fs from "fs";
import * as path from "path";

export interface DeploymentEntry {
  name: string;
  address: string;
  contract?: string;
  constructorArgs: unknown[];
  verifiable?: boolean;
  txHash?: string;
}

export interface DeploymentManifest {
  chainId: number;
  network: string;
  deployer: string;
  deployedAt: string;
  contracts: DeploymentEntry[];
}

interface WriteDeploymentFilesArgs {
  chainId: number;
  network: string;
  deployer: string;
  contracts: DeploymentEntry[];
}

interface SyncDeploymentOutputsArgs {
  chainId: number;
  deployments: Record<string, string>;
}

function repoRoot(): string {
  return path.resolve(__dirname, "../..");
}

export function getDeploymentPaths(chainId: number): {
  deploymentsDir: string;
  addressBookPath: string;
  manifestPath: string;
} {
  const deploymentsDir = path.join(repoRoot(), "deployments");
  return {
    deploymentsDir,
    addressBookPath: path.join(deploymentsDir, `${chainId}.json`),
    manifestPath: path.join(deploymentsDir, `${chainId}.manifest.json`),
  };
}

export function writeDeploymentFiles(args: WriteDeploymentFilesArgs): {
  addressBookPath: string;
  manifestPath: string;
} {
  const { chainId, network, deployer, contracts } = args;
  const { deploymentsDir, addressBookPath, manifestPath } = getDeploymentPaths(chainId);

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const addressBook = Object.fromEntries(
    contracts.map((entry) => [entry.name, entry.address])
  );
  const manifest: DeploymentManifest = {
    chainId,
    network,
    deployer,
    deployedAt: new Date().toISOString(),
    contracts,
  };

  fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2) + "\n");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  return { addressBookPath, manifestPath };
}

export function readDeploymentManifest(chainId: number): DeploymentManifest {
  const { manifestPath } = getDeploymentPaths(chainId);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No deployment manifest found at ${manifestPath}`);
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as DeploymentManifest;
}

function deploymentPrefix(chainId: number): string {
  if (chainId === 420420417) return "POLKADOT_HUB_TESTNET";
  return `CHAIN_${chainId}`;
}

function upsertEnvValue(content: string, key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const trimmed = content.trimEnd();
  return `${trimmed}${trimmed ? "\n" : ""}${line}\n`;
}

function syncEnvFile(filePath: string, values: Record<string, string>): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const next = Object.entries(values).reduce(
    (content, [key, value]) => upsertEnvValue(content, key, value),
    existing
  );
  fs.writeFileSync(filePath, next);
}

function syncFrontendEnvFile(filePath: string, values: Record<string, string>): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const preservedWalletConnectProjectId = existing.match(
    /^NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=(.*)$/m
  )?.[1];

  const lines = [
    preservedWalletConnectProjectId
      ? `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${preservedWalletConnectProjectId}`
      : undefined,
    ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
  ].filter(Boolean);

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function frontendAddressBlock(chainId: number, deployments: Record<string, string>): string {
  const dotAddress = deployments["DOT"] ?? deployments["MockDOT"] ?? "0x0000000000000000000000000000000000000000";
  const stakingPrecompileAddress =
    deployments["StakingPrecompile"] ??
    deployments["MockStakingPrecompile"] ??
    "0x0000000000000000000000000000000000000000";
  const timelockAddress =
    deployments["TimelockController"] ?? "0x0000000000000000000000000000000000000000";
  const vaultAddress =
    deployments["LiquidDOTVault"] ?? "0x0000000000000000000000000000000000000000";
  const stDOTTokenAddress =
    deployments["StDOTToken"] ?? "0x0000000000000000000000000000000000000000";
  const govTokenAddress =
    deployments["GovToken"] ?? "0x0000000000000000000000000000000000000000";
  const governorAddress =
    deployments["ValidatorGovernor"] ?? "0x0000000000000000000000000000000000000000";
  const registryAddress =
    deployments["ValidatorRegistry"] ?? "0x0000000000000000000000000000000000000000";
  const autoCompounderAddress =
    deployments["AutoCompounder"] ?? "0x0000000000000000000000000000000000000000";
  const lensAddress =
    deployments["LiquidDOTLens"] ?? "0x0000000000000000000000000000000000000000";

  return `  ${chainId}: {
    dot: "${dotAddress}",
    stakingPrecompile: "${stakingPrecompileAddress}",
    timelock: "${timelockAddress}",
    vault: "${vaultAddress}",
    stDOT: "${vaultAddress}",
    stDOTToken: "${stDOTTokenAddress}",
    govToken: "${govTokenAddress}",
    governor: "${governorAddress}",
    registry: "${registryAddress}",
    autoCompounder: "${autoCompounderAddress}",
    lens: "${lensAddress}",
  },`;
}

function syncFrontendContracts(chainId: number, deployments: Record<string, string>): void {
  const contractsPath = path.join(repoRoot(), "frontend/lib/contracts.ts");
  const current = fs.readFileSync(contractsPath, "utf-8");
  const block = frontendAddressBlock(chainId, deployments);
  const pattern = new RegExp(`  ${chainId}: \\{[\\s\\S]*?\\n  \\},`);

  if (!pattern.test(current)) {
    throw new Error(`Could not find chain block for ${chainId} in ${contractsPath}`);
  }

  fs.writeFileSync(contractsPath, current.replace(pattern, block));
}

export function syncDeploymentOutputs(args: SyncDeploymentOutputsArgs): void {
  const { chainId, deployments } = args;
  const prefix = deploymentPrefix(chainId);
  const dotAddress = deployments["DOT"] ?? deployments["MockDOT"] ?? "";
  const stakingPrecompileAddress =
    deployments["StakingPrecompile"] ?? deployments["MockStakingPrecompile"] ?? "";

  const envValues: Record<string, string> = {
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
    [`${prefix}_CHAIN_ID`]: String(chainId),
    [`${prefix}_DOT_ADDRESS`]: dotAddress,
    [`${prefix}_MOCK_DOT_ADDRESS`]: deployments["MockDOT"] ?? "",
    [`${prefix}_STAKING_PRECOMPILE_ADDRESS`]: stakingPrecompileAddress,
    [`${prefix}_STDOT_TOKEN_ADDRESS`]: deployments["StDOTToken"] ?? "",
    [`${prefix}_TIMELOCK_ADDRESS`]: deployments["TimelockController"] ?? "",
    [`${prefix}_VAULT_ADDRESS`]: deployments["LiquidDOTVault"] ?? "",
    [`${prefix}_REGISTRY_ADDRESS`]: deployments["ValidatorRegistry"] ?? "",
    [`${prefix}_GOVERNOR_ADDRESS`]: deployments["ValidatorGovernor"] ?? "",
    [`${prefix}_GOV_TOKEN_ADDRESS`]: deployments["GovToken"] ?? "",
    [`${prefix}_AUTO_COMPOUNDER_ADDRESS`]: deployments["AutoCompounder"] ?? "",
    [`${prefix}_LENS_ADDRESS`]: deployments["LiquidDOTLens"] ?? "",
  };

  syncEnvFile(path.join(repoRoot(), ".env"), envValues);
  syncFrontendEnvFile(path.join(repoRoot(), "frontend/.env"), {
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
  });
  syncFrontendContracts(chainId, deployments);
}
