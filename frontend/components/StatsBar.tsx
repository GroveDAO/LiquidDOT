"use client";

import React from "react";
import { useChainId } from "wagmi";
import {
  formatAPY,
  formatDOT,
  formatExchangeRate,
  formatStDOT,
  getNativeTokenSymbol,
} from "../lib/utils";
import type { VaultStats } from "../hooks/useVault";
import { resolveDeploymentChainId } from "../lib/network";

interface StatsBarProps {
  stats?: VaultStats;
  isLoading?: boolean;
}

export default function StatsBar({ stats, isLoading }: StatsBarProps) {
  const chainId = resolveDeploymentChainId(useChainId());
  const nativeSymbol = getNativeTokenSymbol(chainId);
  const items = [
    {
      label: `Total ${nativeSymbol} Staked`,
      value: stats ? `${formatDOT(stats.totalDOTManaged)} ${nativeSymbol}` : "—",
    },
    {
      label: "stDOT Supply",
      value: stats ? `${formatStDOT(stats.totalStDOTSupply)} stDOT` : "—",
    },
    {
      label: "Realized Yield",
      value: stats ? formatAPY(stats.realizedYieldBps) : "—",
    },
    {
      label: "Exchange Rate",
      value: stats ? `1 stDOT = ${formatExchangeRate(stats.exchangeRate)} ${nativeSymbol}` : "—",
    },
    {
      label: "Status",
      value: stats?.isPaused ? "⚠️ Paused" : "✅ Active",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {isLoading ? (
              <span className="inline-block w-16 h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
            ) : (
              value
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
