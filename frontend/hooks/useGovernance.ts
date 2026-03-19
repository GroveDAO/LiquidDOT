"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { GOVERNOR_ABI, REGISTRY_ABI, ERC20_ABI } from "../lib/contracts";
import { encodeFunctionData } from "viem";

export interface Proposal {
  id: bigint;
  description: string;
  state: number;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
}

export function useGovernance(
  governorAddress: `0x${string}`,
  registryAddress: `0x${string}`,
  govTokenAddress: `0x${string}`
) {
  const { address: userAddress } = useAccount();
  const queryClient = useQueryClient();

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  const { data: currentNominees } = useReadContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "getCurrentNominees",
    query: { refetchInterval: 30_000 },
  });

  const { data: govBalance } = useReadContract({
    address: govTokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: 30_000 },
  });

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------
  const { writeContractAsync: writePropose } = useWriteContract();
  const { writeContractAsync: writeVote } = useWriteContract();
  const { writeContractAsync: writeExecute } = useWriteContract();

  async function proposeNewValidators(nominees: string[]): Promise<void> {
    if (!userAddress) return;

    const calldata = encodeProposedNominees(nominees);
    await writePropose({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: "propose",
      args: [
        [registryAddress],
        [0n],
        [calldata],
        `Propose new validators: ${nominees.join(", ")}`,
      ],
    });
    queryClient.invalidateQueries();
  }

  async function castVote(proposalId: bigint, support: 0 | 1 | 2): Promise<void> {
    await writeVote({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: "castVote",
      args: [proposalId, support],
    });
    queryClient.invalidateQueries();
  }

  async function executeProposal(
    proposalId: bigint,
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`
  ): Promise<void> {
    await writeExecute({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: "execute",
      args: [targets, values, calldatas, descriptionHash],
    });
    queryClient.invalidateQueries();
  }

  return {
    currentNominees: (currentNominees as string[]) ?? [],
    govBalance: (govBalance as bigint) ?? 0n,
    proposeNewValidators,
    castVote,
    executeProposal,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeProposedNominees(nominees: string[]): `0x${string}` {
  return encodeFunctionData({
    abi: REGISTRY_ABI,
    functionName: "proposeNominees",
    args: [nominees as `0x${string}`[]],
  });
}
