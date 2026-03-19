"use client";

import React from "react";
import { formatDOT, formatStDOT, formatAPY, isZeroAddress } from "../lib/utils";
import type { VaultStats } from "../hooks/useVault";

interface StatsBarProps {
  stats?: VaultStats;
  isLoading?: boolean;
}

export default function StatsBar({ stats, isLoading }: StatsBarProps) {
  const items = [
    {
      label: "Total DOT Staked",
      value: stats ? `${formatDOT(stats.totalDOTManaged)} DOT` : "—",
    },
    {
      label: "stDOT Supply",
      value: stats ? `${formatStDOT(stats.totalStDOTSupply)} stDOT` : "—",
    },
    {
      label: "Current APY",
      value: stats ? formatAPY(stats.annualizedAPY) : "—",
    },
    {
      label: "Exchange Rate",
      value: stats
        ? `1 stDOT = ${(Number(stats.exchangeRate) / 1e18).toFixed(8)} DOT`
        : "—",
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
