"use client";

import React from "react";
import UnstakeCard from "../../components/UnstakeCard";
import { useVault } from "../../hooks/useVault";
import { DEPLOYED_ADDRESSES } from "../../lib/contracts";
import { formatDOT } from "../../lib/utils";
import { useChainId, useAccount } from "wagmi";

export default function UnstakePage() {
  const chainId = useChainId();
  const addresses = DEPLOYED_ADDRESSES[chainId];
  const vaultAddress = addresses?.vault as `0x${string}`;
  const { address: userAddress } = useAccount();
  const { claimWithdrawal, isLoading } = useVault(vaultAddress);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Unstake</h1>
        <p className="text-gray-400">
          Burn stDOT to queue an unbonding withdrawal. After 28 eras (~28 days), claim your DOT.
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
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  Connect wallet to view pending withdrawals
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
