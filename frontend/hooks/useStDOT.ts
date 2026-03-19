"use client";

import { useReadContract, useAccount } from "wagmi";
import { VAULT_ABI, ERC20_ABI } from "../lib/contracts";

export function useStDOT(vaultAddress: `0x${string}`) {
  const { address: userAddress } = useAccount();

  const { data: balance } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: 12_000 },
  });

  const { data: totalSupply } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "totalSupply",
    query: { refetchInterval: 12_000 },
  });

  const { data: exchangeRate } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "exchangeRate",
    query: { refetchInterval: 12_000 },
  });

  const stDOTBalance = (balance as bigint) ?? 0n;
  const rate = (exchangeRate as bigint) ?? BigInt(1e18);

  // DOT equivalent = stDOT * exchangeRate / 1e18
  const dotEquivalent = (stDOTBalance * rate) / BigInt(1e18);

  return {
    stDOTBalance,
    totalSupply: (totalSupply as bigint) ?? 0n,
    exchangeRate: rate,
    dotEquivalent,
  };
}
