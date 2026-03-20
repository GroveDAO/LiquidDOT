"use client";

import React from "react";
import StakeCard from "../../components/StakeCard";
import StatsBar from "../../components/StatsBar";
import { useVault } from "../../hooks/useVault";
import { getNativeTokenSymbol } from "../../lib/utils";
import { useChainId } from "wagmi";
import { getDeploymentAddresses, resolveDeploymentChainId } from "../../lib/network";

export default function StakePage() {
  const walletChainId = useChainId();
  const chainId = resolveDeploymentChainId(walletChainId);
  const nativeSymbol = getNativeTokenSymbol(chainId);
  const addresses = getDeploymentAddresses(walletChainId);
  const vaultAddress = addresses?.vault as `0x${string}`;
  const { operatorStakingEnabled, stakingModeResolved, vaultStats } = useVault(vaultAddress);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Stake {nativeSymbol}</h1>
        <p className="text-gray-400">
          Deposit {nativeSymbol} and receive stDOT
          {stakingModeResolved && operatorStakingEnabled
            ? " — the vault mints your shares, then the LiquidDOT operator stakes the native asset on-chain."
            : stakingModeResolved
            ? " — a live vault share token backed by native PAS accounting on Polkadot Hub Testnet."
            : " — a liquid staking receipt for your live Polkadot Hub native-asset position."}
        </p>
      </div>

      <StatsBar stats={vaultStats} isLoading={!vaultStats} />

      <div className="max-w-md">
        <StakeCard />
      </div>
    </div>
  );
}
