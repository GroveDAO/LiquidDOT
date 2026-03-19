"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { VAULT_ABI, ERC20_ABI, DEPLOYED_ADDRESSES } from "../lib/contracts";

export interface VaultStats {
  totalDOTManaged: bigint;
  totalStDOTSupply: bigint;
  exchangeRate: bigint;
  pendingRewards: bigint;
  annualizedAPY: bigint;
  unbondingPeriodEras: bigint;
  isPaused: boolean;
}

export interface WithdrawalRequestItem {
  requestId: bigint;
  owner: string;
  dotAmount: bigint;
  unbondEra: bigint;
  claimed: boolean;
}

export function useVault(vaultAddress: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  const { data: totalDOTManaged } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "totalDOTManaged",
    query: { refetchInterval: 12_000 },
  });

  const { data: exchangeRate } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "exchangeRate",
    query: { refetchInterval: 12_000 },
  });

  const { data: pendingRewards } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "pendingRewards",
    query: { refetchInterval: 12_000 },
  });

  const { data: totalSupply } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "totalSupply",
    query: { refetchInterval: 12_000 },
  });

  const { data: isPaused } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "paused",
    query: { refetchInterval: 12_000 },
  });

  const { data: stDOTBalance } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: 12_000 },
  });

  const { data: dotAssetAddress } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "asset",
  });

  const { data: dotBalance } = useReadContract({
    address: dotAssetAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress && !!dotAssetAddress, refetchInterval: 12_000 },
  });

  const { data: dotAllowance } = useReadContract({
    address: dotAssetAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: userAddress && dotAssetAddress ? [userAddress, vaultAddress] : undefined,
    query: { enabled: !!userAddress && !!dotAssetAddress, refetchInterval: 12_000 },
  });

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------
  const { writeContractAsync: writeApprove, isPending: isApprovePending } = useWriteContract();
  const { writeContractAsync: writeDeposit, isPending: isDepositPending } = useWriteContract();
  const { writeContractAsync: writeWithdraw, isPending: isWithdrawPending } = useWriteContract();
  const { writeContractAsync: writeClaim, isPending: isClaimPending } = useWriteContract();

  const isLoading = isApprovePending || isDepositPending || isWithdrawPending || isClaimPending;

  // -------------------------------------------------------------------------
  // Deposit flow (approve if needed, then deposit)
  // -------------------------------------------------------------------------
  async function deposit(amount: bigint): Promise<void> {
    if (!userAddress || !dotAssetAddress) return;

    const allowance = (dotAllowance as bigint) ?? 0n;
    if (allowance < amount) {
      const approveTxHash = await writeApprove({
        address: dotAssetAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, amount],
      });
      // Wait for approval to be mined before depositing
      if (publicClient && approveTxHash) {
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      }
    }

    await writeDeposit({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amount, userAddress],
    });

    // Invalidate relevant queries
    queryClient.invalidateQueries();
  }

  async function queueWithdrawal(shares: bigint): Promise<void> {
    if (!userAddress) return;
    await writeWithdraw({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "queueWithdrawal",
      args: [shares],
    });
    queryClient.invalidateQueries();
  }

  async function claimWithdrawal(requestId: bigint): Promise<void> {
    if (!userAddress) return;
    await writeClaim({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "claimWithdrawal",
      args: [requestId],
    });
    queryClient.invalidateQueries();
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
          annualizedAPY: 0n, // Placeholder — oracle integration needed
          unbondingPeriodEras: 28n,
          isPaused: (isPaused as boolean) ?? false,
        }
      : undefined;

  return {
    vaultStats,
    stDOTBalance: (stDOTBalance as bigint) ?? 0n,
    dotBalance: (dotBalance as bigint) ?? 0n,
    dotAllowance: (dotAllowance as bigint) ?? 0n,
    dotAssetAddress: dotAssetAddress as `0x${string}` | undefined,
    deposit,
    queueWithdrawal,
    claimWithdrawal,
    isLoading,
  };
}
