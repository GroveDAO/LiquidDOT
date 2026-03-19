"use client";

import React, { useState } from "react";
import { useVault } from "../hooks/useVault";
import { formatDOT, formatStDOT, parseDOT } from "../lib/utils";
import { DEPLOYED_ADDRESSES } from "../lib/contracts";
import { useAccount, useChainId } from "wagmi";

export default function StakeCard() {
  const chainId = useChainId();
  const addresses = DEPLOYED_ADDRESSES[chainId];
  const vaultAddress = addresses?.vault as `0x${string}`;
  const { deposit, stDOTBalance, dotBalance, vaultStats, isLoading } = useVault(vaultAddress);
  const { isConnected } = useAccount();

  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");

  const parsedAmount = parseDOT(amount);
  const previewShares =
    parsedAmount > 0n && vaultStats
      ? (parsedAmount * BigInt(1e18)) / (vaultStats.exchangeRate || BigInt(1e18))
      : 0n;

  const handleDeposit = async () => {
    if (!parsedAmount) return;
    try {
      setTxStatus("pending");
      await deposit(parsedAmount);
      setTxStatus("success");
      setAmount("");
    } catch {
      setTxStatus("error");
    }
  };

  if (!addresses) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <p className="text-yellow-800 font-medium">Deploy contracts first</p>
        <p className="text-yellow-600 text-sm mt-1">
          No deployed contracts found for the current network.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Stake DOT</h2>

      {/* DOT Input */}
      <div className="space-y-2 mb-4">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Amount (DOT)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0000"
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button
            onClick={() => setAmount(formatDOT(dotBalance))}
            className="px-3 py-2 text-xs font-medium text-pink-600 border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors"
          >
            MAX
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Balance: {formatDOT(dotBalance)} DOT
        </p>
      </div>

      {/* Preview */}
      {parsedAmount > 0n && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">You will receive</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatStDOT(previewShares)} stDOT
            </span>
          </div>
          {vaultStats && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Exchange rate</span>
              <span className="font-medium text-gray-900 dark:text-white">
                1 stDOT = {formatDOT(vaultStats.exchangeRate)} DOT
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleDeposit}
        disabled={!isConnected || !parsedAmount || isLoading}
        className="w-full py-3 px-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!isConnected
          ? "Connect Wallet"
          : isLoading
          ? "Processing..."
          : txStatus === "success"
          ? "Staked! ✓"
          : "Stake DOT"}
      </button>

      {/* Current stDOT balance */}
      <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
        Your stDOT balance: {formatStDOT(stDOTBalance)} stDOT
      </p>
    </div>
  );
}
