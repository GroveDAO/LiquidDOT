import { ethers } from "hardhat";
import { readDeployments } from "./lib/operator";

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deployments = readDeployments(chainId);

  const vault = await ethers.getContractAt("LiquidDOTVault", deployments["LiquidDOTVault"]);
  const registry = await ethers.getContractAt("ValidatorRegistry", deployments["ValidatorRegistry"]);
  const governor = await ethers.getContractAt("ValidatorGovernor", deployments["ValidatorGovernor"]);
  const govToken = await ethers.getContractAt("GovToken", deployments["GovToken"]);

  const pendingRequests: Array<{
    requestId: bigint;
    owner: string;
    dotAmount: bigint;
    unbondEra: number;
    claimed: boolean;
    funded: boolean;
  }> = [];

  const nextRequestId = await vault.nextRequestId();
  for (let i = 0n; i < nextRequestId; i++) {
    const request = await vault.withdrawalRequests(i);
    const funded = await vault.fundedWithdrawals(i);
    if (request.owner.toLowerCase() === signer.address.toLowerCase() && !request.claimed) {
      pendingRequests.push({
        requestId: i,
        owner: request.owner,
        dotAmount: request.dotAmount,
        unbondEra: request.unbondEra,
        claimed: request.claimed,
        funded,
      });
    }
  }

  const currentNominees = await registry.getCurrentNominees();
  const queuedNominees = await registry.getQueuedNominees();
  const currentBlock = await ethers.provider.getBlockNumber();
  const govBalance = await govToken.balanceOf(signer.address);
  const delegatedTo = await govToken.delegates(signer.address);
  const votes = await governor.getVotes(signer.address, BigInt(Math.max(currentBlock - 1, 0)));

  const iface = governor.interface;
  const proposalTopic = iface.getEvent("ProposalCreated").topicHash;
  const logs = await ethers.provider.getLogs({
    address: await governor.getAddress(),
    topics: [proposalTopic],
    fromBlock: 0,
    toBlock: "latest",
  });

  const proposals = await Promise.all(
    logs.map(async (log) => {
      const parsed = iface.parseLog(log);
      const proposalId = parsed?.args[0] as bigint;
      const description = parsed?.args[8] as string;
      const state = await governor.state(proposalId);
      const votesForProposal = await governor.proposalVotes(proposalId);

      return {
        proposalId: proposalId.toString(),
        description,
        state: Number(state),
        forVotes: votesForProposal.forVotes.toString(),
        againstVotes: votesForProposal.againstVotes.toString(),
        abstainVotes: votesForProposal.abstainVotes.toString(),
      };
    })
  );

  const result = {
    chainId: chainId.toString(),
    signer: signer.address,
    vault: {
      address: await vault.getAddress(),
      nativeStakingEnabled: await vault.nativeStakingEnabled(),
      operatorStakingEnabled: await vault.operatorStakingEnabled(),
      stakingOperator: await vault.stakingOperator(),
      operatorManagedAssets: (await vault.operatorManagedAssets()).toString(),
      totalDOTManaged: (await vault.totalDOTManaged()).toString(),
      totalDOTUnbonding: (await vault.totalDOTUnbonding()).toString(),
      totalSupply: (await vault.totalSupply()).toString(),
      exchangeRate: (await vault.exchangeRate()).toString(),
      pendingRewards: (await vault.pendingRewards()).toString(),
      paused: await vault.paused(),
      stDOTBalance: (await vault.balanceOf(signer.address)).toString(),
      nextRequestId: nextRequestId.toString(),
      pendingRequests,
    },
    governance: {
      govToken: await govToken.getAddress(),
      balance: govBalance.toString(),
      delegatedTo,
      votes: votes.toString(),
      currentNominees,
      queuedNominees: {
        nominees: queuedNominees[0],
        executeAfterEra: queuedNominees[1].toString(),
      },
      proposals,
    },
  };

  console.log(
    JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
