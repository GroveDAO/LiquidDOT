"use client";

import React from "react";
import UnstakeCard from "../../components/UnstakeCard";
import { useVault } from "../../hooks/useVault";
import { formatDOT, getNativeTokenSymbol } from "../../lib/utils";
import { useChainId, useAccount } from "wagmi";
import { getDeploymentAddresses, resolveDeploymentChainId } from "../../lib/network";
import { useHydrated } from "../../hooks/useHydrated";

export default function UnstakePage() {
  const walletChainId = useChainId();
  const chainId = resolveDeploymentChainId(walletChainId);
  const nativeSymbol = getNativeTokenSymbol(chainId);
  const addresses = getDeploymentAddresses(walletChainId);
  const vaultAddress = addresses?.vault as `0x${string}`;
  const { isConnected, status } = useAccount();
  const hydrated = useHydrated();
  const {
    activeEra,
    claimWithdrawal,
    nativeStakingEnabled,
    operatorStakingEnabled,
    stakingModeResolved,
    pendingWithdrawals,
    vaultStats,
    isLoading,
  } = useVault(vaultAddress);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Unstake</h1>
        <p className="text-gray-400">
          Burn stDOT to queue a withdrawal and claim your {nativeSymbol}
          {stakingModeResolved && nativeStakingEnabled
            ? " after the unbonding period completes."
            : stakingModeResolved && operatorStakingEnabled
            ? " after the LiquidDOT operator has returned unbonded native liquidity."
            : stakingModeResolved
            ? " as soon as the request is created in native vault mode."
            : " once the withdrawal request has been processed."}
        </p>
      </div>

      {/* Section 1 — Queue Unstake */}
      <div className="max-w-md">
        <UnstakeCard />
      </div>

      {/* Section 2 — Pending Withdrawals */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Pending Withdrawals</h2>
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">DOT Amount</th>
                <th className="px-6 py-4">Unbond Era</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {!hydrated || status === "connecting" || status === "reconnecting" ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    Loading wallet state...
                  </td>
                </tr>
              ) : !isConnected ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    Connect wallet to view pending withdrawals
                  </td>
                </tr>
              ) : pendingWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No pending withdrawals yet
                  </td>
                </tr>
              ) : (
                pendingWithdrawals.map((request) => {
                  const readyToClaim =
                    operatorStakingEnabled
                      ? request.funded
                      : !nativeStakingEnabled ||
                    (activeEra !== undefined &&
                      activeEra >= request.unbondEra + (vaultStats?.unbondingPeriodEras ?? 0n));

                  return (
                    <tr key={request.requestId.toString()} className="border-t border-gray-700">
                      <td className="px-6 py-4 text-sm text-white">#{request.requestId.toString()}</td>
                      <td className="px-6 py-4 text-sm text-white">
                        {formatDOT(request.dotAmount)} {nativeSymbol}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        Era {request.unbondEra.toString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={readyToClaim ? "text-emerald-400" : "text-amber-400"}>
                          {readyToClaim
                            ? "Ready to claim"
                            : operatorStakingEnabled
                            ? "Awaiting operator liquidity"
                            : "Unbonding"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => void claimWithdrawal(request.requestId)}
                          disabled={!readyToClaim || isLoading}
                          className="rounded-lg bg-pink-500 px-3 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {readyToClaim ? "Claim" : "Pending"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
