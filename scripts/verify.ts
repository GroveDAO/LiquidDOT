import { run, ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Constructor args for each contract, in deployment order
const CONSTRUCTOR_ARGS: Record<string, () => unknown[]> = {
  MockDOT: () => [],
  GovToken: () => {
    // requires deployer address — skip re-verification or read from env
    return [];
  },
  MockStakingPrecompile: () => [],
  StakingPrecompile: () => [],
  StDOTToken: () => [],
  LiquidDOTVault: () => [],
  ValidatorRegistry: () => [],
  ValidatorGovernor: () => [],
  AutoCompounder: () => [],
  LiquidDOTLens: () => [],
};

async function main(): Promise<void> {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deploymentsPath = path.join(__dirname, "../deployments", `${chainId}.json`);

  if (!fs.existsSync(deploymentsPath)) {
    console.error(`No deployments file found at ${deploymentsPath}`);
    process.exit(1);
  }

  const deployed: Record<string, string> = JSON.parse(
    fs.readFileSync(deploymentsPath, "utf-8")
  );

  for (const [name, address] of Object.entries(deployed)) {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: CONSTRUCTOR_ARGS[name]?.() ?? [],
      });
      console.log(`  ✓ ${name} verified`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("already verified")) {
        console.log(`  ✓ ${name} already verified`);
      } else {
        console.warn(`  ✗ ${name} verification failed: ${msg}`);
      }
    }
  }

  console.log("\nVerification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
