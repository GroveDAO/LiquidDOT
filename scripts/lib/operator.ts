import * as fs from "fs";
import * as path from "path";
import { Contract } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

const CANONICAL_STAKING_PRECOMPILE = "0x0000000000000000000000000000000000000800";
const STAKED_REWARD_DESTINATION = "0x00";

const STAKING_PRECOMPILE_ABI = [
  "function bond(address controller,uint256 value,bytes payee)",
  "function bondExtra(uint256 maxAdditional)",
  "function unbond(uint256 value)",
  "function withdrawUnbonded(uint32 numSlashingSpans)",
  "function nominate(address[] targets)",
] as const;

export interface OperatorSyncOptions {
  fundWithdrawals?: boolean;
  maxSweep?: bigint;
  syncNominees?: boolean;
  log?: (message: string) => void;
}

export interface OperatorSyncResult {
  sweptAmount: bigint;
  bondedAmount: bigint;
  unbondedAmount: bigint;
  fundedRequestIds: bigint[];
  nominatedNominees: string[];
  transactions: string[];
}

export function readDeployments(chainId: bigint): Record<string, string> {
  const filePath = path.join(__dirname, "..", "..", "deployments", `${chainId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No deployment file found at ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
}

export async function syncOperatorState(
  hre: HardhatRuntimeEnvironment,
  options: OperatorSyncOptions = {}
): Promise<OperatorSyncResult> {
  const [signer] = await hre.ethers.getSigners();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const deployments = readDeployments(chainId);
  const log = options.log ?? console.log;

  const vault = await hre.ethers.getContractAt("LiquidDOTVault", deployments["LiquidDOTVault"]);
  const registry = await hre.ethers.getContractAt("ValidatorRegistry", deployments["ValidatorRegistry"]);
  const stakingPrecompile = new Contract(
    deployments["StakingPrecompile"] ?? CANONICAL_STAKING_PRECOMPILE,
    STAKING_PRECOMPILE_ABI,
    signer
  );

  if (!(await vault.operatorStakingEnabled())) {
    throw new Error("LiquidDOT operator staking mode is not enabled on this deployment.");
  }

  const configuredOperator = await vault.stakingOperator();
  if (configuredOperator.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the configured staking operator ${configuredOperator}.`
    );
  }

  const result: OperatorSyncResult = {
    sweptAmount: 0n,
    bondedAmount: 0n,
    unbondedAmount: 0n,
    fundedRequestIds: [],
    nominatedNominees: [],
    transactions: [],
  };

  const attemptTx = async (
    label: string,
    send: () => Promise<{ hash: string; wait(): Promise<unknown> }>
  ): Promise<boolean> => {
    try {
      const tx = await send();
      result.transactions.push(tx.hash);
      await tx.wait();
      log(`  ✓ ${label}: ${tx.hash}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  • ${label} skipped: ${message}`);
      return false;
    }
  };

  await attemptTx("withdraw unbonded native stake", async () =>
    stakingPrecompile.withdrawUnbonded(0)
  );

  if (options.fundWithdrawals !== false) {
    const unfundedRequests: Array<{ requestId: bigint; dotAmount: bigint }> = [];
    const nextRequestId = await vault.nextRequestId();

    for (let requestId = 0n; requestId < nextRequestId; requestId += 1n) {
      const request = await vault.withdrawalRequests(requestId);
      const isFunded = await vault.fundedWithdrawals(requestId);
      if (request.owner === hre.ethers.ZeroAddress || request.claimed || isFunded) {
        continue;
      }

      unfundedRequests.push({
        requestId,
        dotAmount: request.dotAmount,
      });
    }

    const totalUnbondAmount = unfundedRequests.reduce(
      (sum, request) => sum + request.dotAmount,
      0n
    );

    if (totalUnbondAmount > 0n) {
      const unbonded = await attemptTx("queue native unbond for withdrawals", async () =>
        stakingPrecompile.unbond(totalUnbondAmount)
      );
      if (unbonded) {
        result.unbondedAmount = totalUnbondAmount;
      }
    }

    for (const request of unfundedRequests) {
      const funded = await attemptTx(
        `fund withdrawal #${request.requestId.toString()}`,
        async () =>
          vault.fundWithdrawal(request.requestId, {
            value: request.dotAmount,
          })
      );

      if (funded) {
        result.fundedRequestIds.push(request.requestId);
      }
    }
  }

  const vaultAddress = await vault.getAddress();
  const vaultBalance = await hre.ethers.provider.getBalance(vaultAddress);
  const totalUnbonding = await vault.totalDOTUnbonding();
  const maxSweepable = vaultBalance > totalUnbonding ? vaultBalance - totalUnbonding : 0n;
  const sweepAmount =
    options.maxSweep !== undefined && options.maxSweep < maxSweepable
      ? options.maxSweep
      : maxSweepable;

  if (sweepAmount > 0n) {
    const operatorManagedBefore = await vault.operatorManagedAssets();
    const swept = await attemptTx("sweep idle PAS to operator", async () =>
      vault.sweepToOperator(sweepAmount)
    );

    if (swept) {
      result.sweptAmount = sweepAmount;

      const bondWithFallback = async (): Promise<boolean> => {
        if (operatorManagedBefore === 0n) {
          const bonded = await attemptTx("bond native PAS", async () =>
            stakingPrecompile.bond(signer.address, sweepAmount, STAKED_REWARD_DESTINATION)
          );
          if (bonded) return true;

          return attemptTx("bond extra native PAS", async () =>
            stakingPrecompile.bondExtra(sweepAmount)
          );
        }

        const bondedExtra = await attemptTx("bond extra native PAS", async () =>
          stakingPrecompile.bondExtra(sweepAmount)
        );
        if (bondedExtra) return true;

        return attemptTx("bond native PAS", async () =>
          stakingPrecompile.bond(signer.address, sweepAmount, STAKED_REWARD_DESTINATION)
        );
      };

      const bonded = await bondWithFallback();
      if (bonded) {
        result.bondedAmount = sweepAmount;
      }
    }
  }

  if (options.syncNominees !== false) {
    const nominees = await registry.getCurrentNominees();
    if (nominees.length > 0) {
      const nominated = await attemptTx("sync native nominees", async () =>
        stakingPrecompile.nominate([...nominees])
      );
      if (nominated) {
        result.nominatedNominees = [...nominees];
      }
    }
  }

  return result;
}
