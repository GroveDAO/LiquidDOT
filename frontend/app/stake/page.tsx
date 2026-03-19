"use client";

import React from "react";
import StakeCard from "../../components/StakeCard";
import StatsBar from "../../components/StatsBar";
import { useVault } from "../../hooks/useVault";
import { DEPLOYED_ADDRESSES } from "../../lib/contracts";
import { useChainId } from "wagmi";

export default function StakePage() {
  const chainId = useChainId();
  const addresses = DEPLOYED_ADDRESSES[chainId];
  const vaultAddress = addresses?.vault as `0x${string}`;
  const { vaultStats } = useVault(vaultAddress);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Stake DOT</h1>
        <p className="text-gray-400">
          Deposit DOT and receive stDOT — a yield-bearing token that auto-compounds staking rewards.
        </p>
      </div>

      <StatsBar stats={vaultStats} isLoading={!vaultStats} />

      <div className="max-w-md">
        <StakeCard />
      </div>
    </div>
  );
}
