"use client";

import React from "react";
import Link from "next/link";
import StatsBar from "../components/StatsBar";
import StakeCard from "../components/StakeCard";
import { useVault } from "../hooks/useVault";
import { DEPLOYED_ADDRESSES } from "../lib/contracts";
import { useChainId } from "wagmi";

export default function HomePage() {
  const chainId = useChainId();
  const addresses = DEPLOYED_ADDRESSES[chainId];
  const vaultAddress = addresses?.vault as `0x${string}`;
  const { vaultStats } = useVault(vaultAddress);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center pt-8 pb-4">
        <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Native Liquid Staking on Polkadot
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Deposit DOT, receive <span className="text-pink-400 font-semibold">stDOT</span>, and
          earn auto-compounding NPoS staking rewards — without lockups.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link
            href="/stake"
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Stake DOT →
          </Link>
          <Link
            href="/governance"
            className="px-6 py-3 border border-gray-600 text-gray-300 font-semibold rounded-xl hover:border-gray-400 transition-colors"
          >
            Governance
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={vaultStats} isLoading={!vaultStats} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <StakeCard />

        {/* Quick stats panel */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <h3 className="font-bold text-lg mb-4 text-white">Protocol Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Unbonding Period</span>
                <span className="font-medium text-white">28 eras (~28 days)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Validator Slots</span>
                <span className="font-medium text-white">Up to 16</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Governor Quorum</span>
                <span className="font-medium text-white">4% of GOV supply</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network</span>
                <span className="font-medium text-pink-400">Polkadot Hub</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="pt-4">
        <h2 className="text-2xl font-bold text-center mb-8 text-white">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Deposit DOT",
              desc: "Send DOT to the LiquidDOT vault. Your DOT is immediately bonded to NPoS validators via Polkadot's native staking precompile.",
              icon: "💎",
            },
            {
              step: "2",
              title: "Receive stDOT",
              desc: "You receive stDOT — a yield-bearing ERC-20 token that represents your share of the staking pool. Transfer it, use it in DeFi.",
              icon: "🪙",
            },
            {
              step: "3",
              title: "Earn Yield",
              desc: "Staking rewards are automatically compounded every era. As rewards accumulate, 1 stDOT becomes worth more DOT over time.",
              icon: "📈",
            },
          ].map(({ step, title, desc, icon }) => (
            <div key={step} className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="text-4xl mb-3">{icon}</div>
              <div className="text-xs font-bold text-pink-400 mb-1">STEP {step}</div>
              <h3 className="font-bold text-lg text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
