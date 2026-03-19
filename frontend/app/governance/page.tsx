"use client";

import React, { useState } from "react";
import ValidatorList from "../../components/ValidatorList";
import { useGovernance } from "../../hooks/useGovernance";
import { DEPLOYED_ADDRESSES } from "../../lib/contracts";
import { useChainId } from "wagmi";

export default function GovernancePage() {
  const chainId = useChainId();
  const addresses = DEPLOYED_ADDRESSES[chainId];

  const { currentNominees, govBalance, proposeNewValidators } = useGovernance(
    (addresses?.governor ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    (addresses?.registry ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    (addresses?.govToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`
  );

  const [nomineeInput, setNomineeInput] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handlePropose = async () => {
    const nominees = nomineeInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (nominees.length === 0) return;
    try {
      setIsPending(true);
      await proposeNewValidators(nominees);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Validator Governance</h1>
        <p className="text-gray-400">
          GOV token holders vote on which validators LiquidDOT nominates in Polkadot NPoS.
        </p>
        <p className="text-sm text-pink-400 mt-1">
          Your GOV balance: {(Number(govBalance) / 1e18).toFixed(2)} GOV
        </p>
      </div>

      {/* Current Nominees */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">Current Nominees</h2>
        <ValidatorList nominees={currentNominees} />
      </div>

      {/* Propose New Validators */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 max-w-xl">
        <h2 className="text-lg font-bold text-white mb-4">Propose New Validators</h2>
        <p className="text-sm text-gray-400 mb-4">
          Enter comma-separated validator addresses. This creates a Governor proposal that requires
          voting and a timelock.
        </p>
        <textarea
          value={nomineeInput}
          onChange={(e) => setNomineeInput(e.target.value)}
          placeholder="0xValidator1, 0xValidator2, ..."
          rows={3}
          className="w-full border border-gray-600 rounded-lg px-4 py-3 text-white bg-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-mono mb-4"
        />
        <button
          onClick={handlePropose}
          disabled={isPending || !nomineeInput}
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Submitting..." : "Create Proposal"}
        </button>
      </div>

      {/* Active Proposals */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">Active Proposals</h2>
        <p className="text-sm text-gray-500 italic">
          No active proposals. Connect wallet to view and vote on proposals.
        </p>
      </div>
    </div>
  );
}
