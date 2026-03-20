"use client";

import { useReadContract, useWriteContract, useAccount, useBalance, useChainId, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { DEPLOYED_ADDRESSES, STAKING_PRECOMPILE_ABI, VAULT_ABI } from "../lib/contracts";
import { resolveDeploymentChainId } from "../lib/network";

export interface VaultStats {
  totalDOTManaged: bigint;
  totalStDOTSupply: bigint;
  exchangeRate: bigint;
  pendingRewards: bigint;
  realizedYieldBps: bigint;
  unbondingPeriodEras: bigint;
  isPaused: boolean;
}

export interface WithdrawalRequestItem {
  requestId: bigint;
  owner: string;
  dotAmount: bigint;
  unbondEra: bigint;
  claimed: boolean;
  funded: boolean;
}

const VIRTUAL_SHARES = 100000000n;
const BASE_EXCHANGE_RATE = 10000000000n;

function normalizeWithdrawalRequest(
  rawRequest: unknown,
  requestId: bigint
): WithdrawalRequestItem | undefined {
  if (Array.isArray(rawRequest) && rawRequest.length >= 4) {
    const [owner, dotAmount, unbondEra, claimed] = rawRequest;
    if (typeof owner === "string" && typeof dotAmount === "bigint") {
      return {
        requestId,
        owner,
        dotAmount,
        unbondEra: BigInt(unbondEra),
        claimed: Boolean(claimed),
        funded: false,
      };
    }
  }

  if (rawRequest && typeof rawRequest === "object") {
    const candidate = rawRequest as {
      owner?: string;
      dotAmount?: bigint;
      unbondEra?: bigint | number;
      claimed?: boolean;
    };

    if (candidate.owner && typeof candidate.dotAmount === "bigint") {
      return {
        requestId,
        owner: candidate.owner,
        dotAmount: candidate.dotAmount,
        unbondEra: BigInt(candidate.unbondEra ?? 0),
        claimed: Boolean(candidate.claimed),
        funded: false,
      };
    }
  }

  return undefined;
}

export function useVault(vaultAddress: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const walletChainId = useChainId();
  const chainId = resolveDeploymentChainId(walletChainId);
  const addresses = DEPLOYED_ADDRESSES[chainId];
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId });
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequestItem[]>([]);

  const stakingPrecompileAddress = addresses?.stakingPrecompile as `0x${string}` | undefined;
  const hasVaultAddress = Boolean(vaultAddress && !vaultAddress.endsWith("0000000000000000000000000000000000000000"));

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  const { data: nativeBalance } = useBalance({
    address: userAddress,
    chainId,
    query: { enabled: !!userAddress && hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: totalDOTManaged } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "totalDOTManaged",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: exchangeRate } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "exchangeRate",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: pendingRewards } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "pendingRewards",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: totalSupply } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "totalSupply",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: isPaused } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "paused",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: stDOTBalance } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: hasVaultAddress && !!userAddress, refetchInterval: 12_000 },
  });

  const { data: dotAssetAddress } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "asset",
    query: { enabled: hasVaultAddress },
  });

  const { data: nextRequestId } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "nextRequestId",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: unbondingPeriod } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "unbondingPeriod",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: nativeStakingEnabled } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "nativeStakingEnabled",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: operatorStakingEnabled } = useReadContract({
    chainId,
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "operatorStakingEnabled",
    query: { enabled: hasVaultAddress, refetchInterval: 12_000 },
  });

  const { data: activeEra } = useReadContract({
    chainId,
    address: stakingPrecompileAddress,
    abi: STAKING_PRECOMPILE_ABI,
    functionName: "getActiveEra",
    query: {
      enabled: hasVaultAddress && !!stakingPrecompileAddress && Boolean(nativeStakingEnabled),
      refetchInterval: 12_000,
    },
  });

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------
  const { writeContractAsync: writeDeposit, isPending: isDepositPending } = useWriteContract();
  const { writeContractAsync: writeWithdraw, isPending: isWithdrawPending } = useWriteContract();
  const { writeContractAsync: writeClaim, isPending: isClaimPending } = useWriteContract();

  const isLoading = isDepositPending || isWithdrawPending || isClaimPending;

  function estimatePreviewDeposit(assets: bigint): bigint {
    const managed = (totalDOTManaged as bigint) ?? 0n;
    const supply = (totalSupply as bigint) ?? 0n;
    return (assets * (supply + VIRTUAL_SHARES)) / (managed + 1n);
  }

  function estimatePreviewRedeem(shares: bigint): bigint {
    const managed = (totalDOTManaged as bigint) ?? 0n;
    const supply = (totalSupply as bigint) ?? 0n;
    return (shares * (managed + 1n)) / (supply + VIRTUAL_SHARES);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPendingWithdrawals(): Promise<void> {
      if (!publicClient || !hasVaultAddress || !userAddress || nextRequestId === undefined) {
        if (!cancelled) setPendingWithdrawals([]);
        return;
      }

      const requestCount = Number(nextRequestId);
      if (requestCount === 0) {
        if (!cancelled) setPendingWithdrawals([]);
        return;
      }

      const requests = await Promise.all(
        Array.from({ length: requestCount }, async (_, index) =>
          Promise.all([
            (publicClient as any).readContract({
              address: vaultAddress,
              abi: VAULT_ABI as unknown as Abi,
              functionName: "withdrawalRequests" as const,
              args: [BigInt(index)] as const,
            }),
            (publicClient as any).readContract({
              address: vaultAddress,
              abi: VAULT_ABI as unknown as Abi,
              functionName: "fundedWithdrawals" as const,
              args: [BigInt(index)] as const,
            }),
          ])
        )
      );

      if (cancelled) return;

      const normalized = requests.flatMap(([request, funded], index) => {
        const parsed = normalizeWithdrawalRequest(request, BigInt(index));
        if (!parsed) return [];
        if (parsed.owner.toLowerCase() !== userAddress.toLowerCase() || parsed.claimed) return [];
        parsed.funded = Boolean(funded);

        return [parsed];
      });

      setPendingWithdrawals(normalized);
    }

    void loadPendingWithdrawals().catch(() => {
      if (!cancelled) setPendingWithdrawals([]);
    });

    return () => {
      cancelled = true;
    };
  }, [hasVaultAddress, nextRequestId, publicClient, userAddress, vaultAddress]);

  async function waitForConfirmation(hash: `0x${string}`): Promise<void> {
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }

    await queryClient.invalidateQueries();
  }

  // -------------------------------------------------------------------------
  // Native deposit / withdrawal flow
  // -------------------------------------------------------------------------
  async function deposit(amount: bigint): Promise<void> {
    if (!userAddress || !hasVaultAddress) return;

    const hash = await writeDeposit({
      chainId,
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amount, userAddress],
      value: amount,
    } as unknown as Parameters<typeof writeDeposit>[0]);

    await waitForConfirmation(hash);
  }

  async function redeemShares(shares: bigint): Promise<void> {
    if (!userAddress || !hasVaultAddress) return;
    const hash = await writeWithdraw({
      chainId,
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "redeem",
      args: [shares, userAddress, userAddress],
    } as unknown as Parameters<typeof writeWithdraw>[0]);
    await waitForConfirmation(hash);
  }

  async function queueWithdrawal(assets: bigint): Promise<void> {
    if (!userAddress || !hasVaultAddress) return;
    const hash = await writeWithdraw({
      chainId,
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "queueWithdrawal",
      args: [assets],
    } as unknown as Parameters<typeof writeWithdraw>[0]);
    await waitForConfirmation(hash);
  }

  async function claimWithdrawal(requestId: bigint): Promise<void> {
    if (!userAddress || !hasVaultAddress) return;
    const hash = await writeClaim({
      chainId,
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "claimWithdrawal",
      args: [requestId],
    } as unknown as Parameters<typeof writeClaim>[0]);
    await waitForConfirmation(hash);
  }

  // -------------------------------------------------------------------------
  // Derived stats
  // -------------------------------------------------------------------------
  const vaultStats: VaultStats | undefined =
    totalDOTManaged !== undefined && exchangeRate !== undefined
      ? {
          totalDOTManaged: totalDOTManaged as bigint,
          totalStDOTSupply: (totalSupply as bigint) ?? 0n,
          exchangeRate: exchangeRate as bigint,
          pendingRewards: (pendingRewards as bigint) ?? 0n,
          realizedYieldBps:
            (exchangeRate as bigint) > BASE_EXCHANGE_RATE
              ? (((exchangeRate as bigint) - BASE_EXCHANGE_RATE) * 10000n) / BASE_EXCHANGE_RATE
              : 0n,
          unbondingPeriodEras: (unbondingPeriod as bigint) ?? 0n,
          isPaused: (isPaused as boolean) ?? false,
        }
      : undefined;

  return {
    vaultStats,
    stDOTBalance: (stDOTBalance as bigint) ?? 0n,
    dotBalance: nativeBalance?.value ?? 0n,
    dotAssetAddress: dotAssetAddress as `0x${string}` | undefined,
    nativeStakingEnabled: Boolean(nativeStakingEnabled),
    operatorStakingEnabled: Boolean(operatorStakingEnabled),
    stakingModeResolved:
      nativeStakingEnabled !== undefined && operatorStakingEnabled !== undefined,
    estimatePreviewDeposit,
    estimatePreviewRedeem,
    deposit,
    redeemShares,
    queueWithdrawal,
    claimWithdrawal,
    pendingWithdrawals,
    activeEra: activeEra !== undefined ? BigInt(activeEra as number | bigint) : undefined,
    isLoading,
  };
}
