import { run, ethers } from "hardhat";
import { DeploymentEntry, readDeploymentManifest } from "./lib/deployments";

const RETRYABLE_PATTERNS = [
  /unable to locate contractcode/i,
  /contract source code not verified/i,
  /does not have bytecode/i,
  /not found/i,
  /rate limit/i,
  /timeout/i,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContract(entry: DeploymentEntry): Promise<"verified" | "already-verified"> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await run("verify:verify", {
        address: entry.address,
        contract: entry.contract,
        constructorArguments: entry.constructorArgs,
      });
      return "verified";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("already verified")) {
        return "already-verified";
      }

      const shouldRetry =
        attempt < maxAttempts &&
        RETRYABLE_PATTERNS.some((pattern) => pattern.test(msg));

      if (!shouldRetry) {
        throw err;
      }

      console.warn(
        `  Verification not ready yet (attempt ${attempt}/${maxAttempts}): ${msg}`
      );
      console.warn("  Waiting 15 seconds before retrying...");
      await sleep(15_000);
    }
  }

  throw new Error(`Verification exhausted retries for ${entry.name}`);
}

async function main(): Promise<void> {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const manifest = readDeploymentManifest(chainId);

  for (const entry of manifest.contracts.filter((item) => item.verifiable !== false && item.contract)) {
    console.log(`Verifying ${entry.name} at ${entry.address}...`);
    try {
      const status = await verifyContract(entry);
      console.log(
        status === "already-verified"
          ? `  ✓ ${entry.name} already verified`
          : `  ✓ ${entry.name} verified`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ ${entry.name} verification failed: ${msg}`);
    }
  }

  console.log("\nVerification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
