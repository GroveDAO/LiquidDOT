"use client";

import React, { useState } from "react";
import ValidatorList from "../../components/ValidatorList";
import { useGovernance } from "../../hooks/useGovernance";
import { formatTokenAmount, shortAddress } from "../../lib/utils";
import { useChainId } from "wagmi";
import { getDeploymentAddresses, resolveDeploymentChainId } from "../../lib/network";
import { useHydrated } from "../../hooks/useHydrated";

const proposalStateLabels: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
};

export default function GovernancePage() {
  const walletChainId = useChainId();
  const chainId = resolveDeploymentChainId(walletChainId);
  const addresses = getDeploymentAddresses(walletChainId);
  const hydrated = useHydrated();

  const {
    currentNominees,
    queuedNominees,
    executeAfterEra,
    govBalance,
    delegatedTo,
    currentVotes,
    proposals,
    isLoadingProposals,
    delegateToSelf,
    proposeNewValidators,
    castVote,
  } = useGovernance(
    (addresses?.governor ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    (addresses?.registry ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    (addresses?.govToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    chainId
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
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg bg-pink-500/10 px-3 py-2 text-pink-300">
            GOV balance: {hydrated ? formatTokenAmount(govBalance, 18, 2) : "0.00"}
          </span>
          <span className="rounded-lg bg-sky-500/10 px-3 py-2 text-sky-300">
            Voting power: {hydrated ? formatTokenAmount(currentVotes, 18, 2) : "0.00"}
          </span>
          <span className="rounded-lg bg-gray-700 px-3 py-2 text-gray-300">
            Delegate: {hydrated ? (delegatedTo ? shortAddress(delegatedTo) : "Not delegated") : "Loading wallet..."}
          </span>
        </div>
        {hydrated && !delegatedTo && (
          <button
            onClick={() => void delegateToSelf()}
            className="mt-4 rounded-xl bg-white px-4 py-2 font-semibold text-gray-900 transition-opacity hover:opacity-90"
          >
            Delegate Votes To Self
          </button>
        )}
      </div>

      {/* Current Nominees */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">Current Nominees</h2>
          <ValidatorList nominees={currentNominees} />
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">Queued Nominees</h2>
          <ValidatorList nominees={queuedNominees} />
          <p className="mt-4 text-sm text-gray-400">
            Execute after era/block marker: {executeAfterEra.toString()}
          </p>
        </div>
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
        <h2 className="text-lg font-bold text-white mb-4">Proposal Feed</h2>
        {isLoadingProposals ? (
          <p className="text-sm text-gray-500 italic">Loading proposals...</p>
        ) : proposals.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No proposals yet. Create one above to seed governance activity.
          </p>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id.toString()}
                className="rounded-xl border border-gray-700 bg-gray-900/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">Proposal #{proposal.id.toString()}</p>
                    <p className="text-sm text-gray-400">{proposal.description}</p>
                  </div>
                  <span className="rounded-lg bg-pink-500/10 px-3 py-2 text-sm text-pink-300">
                    {proposalStateLabels[proposal.state] ?? `State ${proposal.state}`}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                  <div className="rounded-lg bg-gray-800 p-3 text-gray-300">
                    For: {formatTokenAmount(proposal.forVotes, 18, 2)} GOV
                  </div>
                  <div className="rounded-lg bg-gray-800 p-3 text-gray-300">
                    Against: {formatTokenAmount(proposal.againstVotes, 18, 2)} GOV
                  </div>
                  <div className="rounded-lg bg-gray-800 p-3 text-gray-300">
                    Abstain: {formatTokenAmount(proposal.abstainVotes, 18, 2)} GOV
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => void castVote(proposal.id, 1)}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Vote For
                  </button>
                  <button
                    onClick={() => void castVote(proposal.id, 0)}
                    className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Vote Against
                  </button>
                  <button
                    onClick={() => void castVote(proposal.id, 2)}
                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Abstain
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
