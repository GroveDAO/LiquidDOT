"use client";

import React, { useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useVault } from "../hooks/useVault";
import { formatDOT, formatStDOT, getNativeTokenSymbol, parseStDOT } from "../lib/utils";
import { getDeploymentAddresses, resolveDeploymentChainId } from "../lib/network";
import { useHydrated } from "../hooks/useHydrated";
import { useChainId, useAccount } from "wagmi";

export default function UnstakeCard() {
  const walletChainId = useChainId();
  const chainId = resolveDeploymentChainId(walletChainId);
  const nativeSymbol = getNativeTokenSymbol(chainId);
  const addresses = getDeploymentAddresses(walletChainId);
  const vaultAddress = addresses?.vault as `0x${string}`;
  const {
    estimatePreviewRedeem,
    nativeStakingEnabled,
    operatorStakingEnabled,
    stakingModeResolved,
    redeemShares,
    stDOTBalance,
    isLoading,
  } = useVault(vaultAddress);
  const { isConnected } = useAccount();
  const hydrated = useHydrated();
  const { openConnectModal } = useConnectModal();

  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");

  const parsedShares = parseStDOT(amount);
  const previewDOT = parsedShares > 0n ? estimatePreviewRedeem(parsedShares) : 0n;
  const handleUnstake = async () => {
    if (!parsedShares) return;
    try {
      setTxStatus("pending");
      await redeemShares(parsedShares);
      setTxStatus("success");
      setAmount("");
    } catch {
      setTxStatus("error");
    }
  };

  const handlePrimaryAction = async () => {
    if (!hydrated) return;
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    await handleUnstake();
  };

  if (!addresses) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <p className="text-yellow-800 font-medium">Deploy contracts first</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Unstake stDOT</h2>

      <div className="space-y-2 mb-4">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Amount (stDOT)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0000"
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={() => setAmount(formatStDOT(stDOTBalance))}
            className="px-3 py-2 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
          >
            MAX
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Balance: {hydrated ? formatStDOT(stDOTBalance) : "0.0000"} stDOT
        </p>
      </div>

      {parsedShares > 0n && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">You will receive</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatDOT(previewDOT)} {nativeSymbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Unbonding period</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {nativeStakingEnabled
                ? "28 eras (~28 days)"
                : stakingModeResolved && operatorStakingEnabled
                ? "Funded by operator after native unbonding"
                : stakingModeResolved
                ? "Instant in vault mode"
                : "Resolving staking mode..."}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => void handlePrimaryAction()}
        disabled={
          !hydrated || isLoading || (!isConnected && !openConnectModal) || (isConnected && !parsedShares)
        }
        className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!hydrated
          ? "Loading Wallet..."
          : !isConnected
          ? "Connect Wallet"
          : isLoading
          ? "Processing..."
          : txStatus === "success"
          ? "Queued! ✓"
          : "Queue Unstake"}
      </button>
    </div>
  );
}
