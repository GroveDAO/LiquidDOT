"use client";

import React from "react";
import { shortAddress } from "../lib/utils";

interface ValidatorListProps {
  nominees: string[];
  isLoading?: boolean;
}

export default function ValidatorList({ nominees, isLoading }: ValidatorListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (nominees.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        No nominees configured yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {nominees.map((addr) => (
        <div
          key={addr}
          className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3"
        >
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
            {addr}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {shortAddress(addr)}
          </span>
        </div>
      ))}
    </div>
  );
}
