"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { encodeFunctionData, parseAbiItem } from "viem";
import {
  useAccount,
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { ERC20_ABI, GOVERNOR_ABI, REGISTRY_ABI } from "../lib/contracts";
import { resolveDeploymentChainId } from "../lib/network";

const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);

export interface Proposal {
  id: bigint;
  proposer: string;
  description: string;
  state: number;
  voteStart: bigint;
  voteEnd: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
}

export function useGovernance(
  governorAddress: `0x${string}`,
  registryAddress: `0x${string}`,
  govTokenAddress: `0x${string}`,
  activeChainId?: number
) {
  const { address: userAddress } = useAccount();
  const chainId = resolveDeploymentChainId(activeChainId);
  const { data: latestBlock } = useBlockNumber({ watch: true, chainId });
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const hasGovernorAddress = !governorAddress.endsWith("0000000000000000000000000000000000000000");
  const hasRegistryAddress = !registryAddress.endsWith("0000000000000000000000000000000000000000");
  const hasGovTokenAddress = !govTokenAddress.endsWith("0000000000000000000000000000000000000000");

  const { data: currentNominees } = useReadContract({
    chainId,
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "getCurrentNominees",
    query: { enabled: hasRegistryAddress, refetchInterval: 30_000 },
  });

  const { data: queuedNomineesData } = useReadContract({
    chainId,
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "getQueuedNominees",
    query: { enabled: hasRegistryAddress, refetchInterval: 30_000 },
  });

  const { data: govBalance } = useReadContract({
    chainId,
    address: govTokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: hasGovTokenAddress && !!userAddress, refetchInterval: 30_000 },
  });

  const { data: delegatedTo } = useReadContract({
    chainId,
    address: govTokenAddress,
    abi: ERC20_ABI,
    functionName: "delegates",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: hasGovTokenAddress && !!userAddress, refetchInterval: 30_000 },
  });

  const { data: currentVotes } = useReadContract({
    chainId,
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: "getVotes",
    args:
      userAddress && latestBlock !== undefined
        ? [userAddress, latestBlock > 0n ? latestBlock - 1n : 0n]
        : undefined,
    query: {
      enabled: hasGovernorAddress && !!userAddress && latestBlock !== undefined,
      refetchInterval: 30_000,
    },
  });

  const { writeContractAsync: writeDelegate } = useWriteContract();
  const { writeContractAsync: writePropose } = useWriteContract();
  const { writeContractAsync: writeVote } = useWriteContract();
  const { writeContractAsync: writeExecute } = useWriteContract();

  const unsafeWriteDelegate = writeDelegate as unknown as (
    config: Record<string, unknown>
  ) => Promise<unknown>;
  const unsafeWritePropose = writePropose as unknown as (
    config: Record<string, unknown>
  ) => Promise<unknown>;
  const unsafeWriteVote = writeVote as unknown as (
    config: Record<string, unknown>
  ) => Promise<unknown>;
  const unsafeWriteExecute = writeExecute as unknown as (
    config: Record<string, unknown>
  ) => Promise<unknown>;

  useEffect(() => {
    let cancelled = false;

    async function loadProposals(): Promise<void> {
      if (!publicClient || !hasGovernorAddress) {
        if (!cancelled) setProposals([]);
        return;
      }

      setIsLoadingProposals(true);

      try {
        const logs = await (publicClient as any).getLogs({
          address: governorAddress,
          event: proposalCreatedEvent,
          fromBlock: 0n,
          toBlock: "latest",
        });

        const enriched = await Promise.all(
          logs.map(async (log: any) => {
            const args = log.args ?? {};
            const proposalId = BigInt(args.proposalId ?? 0);

            const state = await (publicClient as any).readContract({
              address: governorAddress,
              abi: GOVERNOR_ABI,
              functionName: "state",
              args: [proposalId],
            });

            const votes = await (publicClient as any).readContract({
              address: governorAddress,
              abi: GOVERNOR_ABI,
              functionName: "proposalVotes",
              args: [proposalId],
            });

            const [againstVotes, forVotes, abstainVotes] = Array.isArray(votes)
              ? votes
              : [votes.againstVotes, votes.forVotes, votes.abstainVotes];

            return {
              id: proposalId,
              proposer: String(args.proposer ?? ""),
              description: String(args.description ?? ""),
              state: Number(state),
              voteStart: BigInt(args.voteStart ?? 0),
              voteEnd: BigInt(args.voteEnd ?? 0),
              forVotes: BigInt(forVotes ?? 0),
              againstVotes: BigInt(againstVotes ?? 0),
              abstainVotes: BigInt(abstainVotes ?? 0),
            } satisfies Proposal;
          })
        );

        if (!cancelled) {
          setProposals(enriched.sort((a, b) => Number(b.id - a.id)));
        }
      } catch {
        if (!cancelled) setProposals([]);
      } finally {
        if (!cancelled) setIsLoadingProposals(false);
      }
    }

    void loadProposals();

    return () => {
      cancelled = true;
    };
  }, [governorAddress, hasGovernorAddress, publicClient]);

  async function delegateToSelf(): Promise<void> {
    if (!userAddress) return;

    await unsafeWriteDelegate({
      chainId,
      address: govTokenAddress,
      abi: ERC20_ABI as unknown,
      functionName: "delegate",
      args: [userAddress] as unknown,
    });

    await queryClient.invalidateQueries();
  }

  async function proposeNewValidators(nominees: string[]): Promise<void> {
    if (!userAddress) return;

    const calldata = encodeProposedNominees(nominees);
    await unsafeWritePropose({
      chainId,
      address: governorAddress,
      abi: GOVERNOR_ABI as unknown,
      functionName: "propose",
      args: [
        [registryAddress],
        [0n],
        [calldata],
        `Propose new validators: ${nominees.join(", ")}`,
      ] as unknown,
    });

    await queryClient.invalidateQueries();
  }

  async function castVote(proposalId: bigint, support: 0 | 1 | 2): Promise<void> {
    await unsafeWriteVote({
      chainId,
      address: governorAddress,
      abi: GOVERNOR_ABI as unknown,
      functionName: "castVote",
      args: [proposalId, support] as unknown,
    });

    await queryClient.invalidateQueries();
  }

  async function executeProposal(
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`
  ): Promise<void> {
    await unsafeWriteExecute({
      chainId,
      address: governorAddress,
      abi: GOVERNOR_ABI as unknown,
      functionName: "execute",
      args: [targets, values, calldatas, descriptionHash] as unknown,
    });

    await queryClient.invalidateQueries();
  }

  const queuedNominees = Array.isArray(queuedNomineesData)
    ? (queuedNomineesData[0] as string[])
    : ((queuedNomineesData as { nominees?: string[] } | undefined)?.nominees ?? []);

  const executeAfterEra = Array.isArray(queuedNomineesData)
    ? BigInt((queuedNomineesData[1] as bigint | number | undefined) ?? 0)
    : BigInt(
        ((queuedNomineesData as { executeAfterEra?: bigint | number } | undefined)?.executeAfterEra ??
          0) as bigint | number
      );

  return {
    currentNominees: (currentNominees as string[]) ?? [],
    queuedNominees,
    executeAfterEra,
    govBalance: (govBalance as bigint) ?? 0n,
    delegatedTo: (delegatedTo as string | undefined) ?? undefined,
    currentVotes: (currentVotes as bigint) ?? 0n,
    proposals,
    isLoadingProposals,
    delegateToSelf,
    proposeNewValidators,
    castVote,
    executeProposal,
  };
}

function encodeProposedNominees(nominees: string[]): `0x${string}` {
  const unsafeEncodeFunctionData = encodeFunctionData as unknown as (
    parameters: Record<string, unknown>
  ) => `0x${string}`;

  return unsafeEncodeFunctionData({
    abi: REGISTRY_ABI,
    functionName: "proposeNominees",
    args: [[...nominees] as `0x${string}`[]],
  });
}
