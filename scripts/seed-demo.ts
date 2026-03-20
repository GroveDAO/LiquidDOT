import hre, { ethers } from "hardhat";
import { readDeployments, syncOperatorState } from "./lib/operator";

const PRIMARY_DEPOSIT = ethers.parseUnits("250", 10);
const WITHDRAWAL_AMOUNT = ethers.parseUnits("20", 10);

const INITIAL_NOMINEES = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
] as const;

const PROPOSAL_NOMINEES = [
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
] as const;

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deployments = readDeployments(chainId);

  const vault = await ethers.getContractAt("LiquidDOTVault", deployments["LiquidDOTVault"]);
  const registry = await ethers.getContractAt("ValidatorRegistry", deployments["ValidatorRegistry"]);
  const governor = await ethers.getContractAt("ValidatorGovernor", deployments["ValidatorGovernor"]);
  const govToken = await ethers.getContractAt("GovToken", deployments["GovToken"]);

  const txHashes: string[] = [];

  if ((await vault.totalDOTManaged()) === 0n) {
    const tx = await vault.deposit(PRIMARY_DEPOSIT, signer.address, { value: PRIMARY_DEPOSIT });
    const receipt = await tx.wait();
    txHashes.push(receipt!.hash);
  }

  const initialOperatorSync = await syncOperatorState(hre, {
    log: (message) => console.log(`[operator] ${message}`),
  });
  txHashes.push(...initialOperatorSync.transactions);

  const nextRequestIdBefore = await vault.nextRequestId();
  if (nextRequestIdBefore === 0n) {
    const tx = await vault.queueWithdrawal(WITHDRAWAL_AMOUNT);
    const receipt = await tx.wait();
    txHashes.push(receipt!.hash);
  }

  const postWithdrawalSync = await syncOperatorState(hre, {
    log: (message) => console.log(`[operator] ${message}`),
  });
  txHashes.push(...postWithdrawalSync.transactions);

  const currentNominees = await registry.getCurrentNominees();
  if (currentNominees.length === 0) {
    const tx = await registry.proposeNominees([...INITIAL_NOMINEES]);
    const receipt = await tx.wait();
    txHashes.push(receipt!.hash);

    const executeTx = await registry.executeNominees();
    const executeReceipt = await executeTx.wait();
    txHashes.push(executeReceipt!.hash);
  }

  const nomineeSync = await syncOperatorState(hre, {
    fundWithdrawals: false,
    log: (message) => console.log(`[operator] ${message}`),
  });
  txHashes.push(...nomineeSync.transactions);

  const currentDelegate = await govToken.delegates(signer.address);
  if (currentDelegate.toLowerCase() !== signer.address.toLowerCase()) {
    const tx = await govToken.delegate(signer.address);
    const receipt = await tx.wait();
    txHashes.push(receipt!.hash);
  }

  const governorInterface = governor.interface;
  const proposeCalldata = registry.interface.encodeFunctionData("proposeNominees", [
    [...PROPOSAL_NOMINEES],
  ]);

  const proposalTopic = governorInterface.getEvent("ProposalCreated").topicHash;
  const existingLogs = await ethers.provider.getLogs({
    address: await governor.getAddress(),
    topics: [proposalTopic],
    fromBlock: 0,
    toBlock: "latest",
  });

  let proposalId: bigint | undefined;
  if (existingLogs.length === 0) {
    const tx = await governor.propose(
      [await registry.getAddress()],
      [0],
      [proposeCalldata],
      "Rotate the validator nominee set for the live demo"
    );
    const receipt = await tx.wait();
    txHashes.push(receipt!.hash);

    const creationLog = receipt!.logs.find((log) => {
      try {
        return governorInterface.parseLog(log)?.name === "ProposalCreated";
      } catch {
        return false;
      }
    });

    const parsed = creationLog ? governorInterface.parseLog(creationLog) : undefined;
    proposalId = parsed?.args[0] as bigint | undefined;
  } else {
    const parsed = governorInterface.parseLog(existingLogs[existingLogs.length - 1]);
    proposalId = parsed?.args[0] as bigint | undefined;
  }

  if (proposalId !== undefined) {
    const proposalState = Number(await governor.state(proposalId));
    if (proposalState === 1) {
      const votes = await governor.proposalVotes(proposalId);
      if (votes.forVotes === 0n && votes.againstVotes === 0n && votes.abstainVotes === 0n) {
        const tx = await governor.castVote(proposalId, 1);
        const receipt = await tx.wait();
        txHashes.push(receipt!.hash);
      }
    }
  }

  const queuedNominees = await registry.getQueuedNominees();
  const status = {
    chainId: chainId.toString(),
    signer: signer.address,
    txHashes,
    vault: {
      totalDOTManaged: (await vault.totalDOTManaged()).toString(),
      totalDOTUnbonding: (await vault.totalDOTUnbonding()).toString(),
      totalSupply: (await vault.totalSupply()).toString(),
      exchangeRate: (await vault.exchangeRate()).toString(),
      pendingRewards: (await vault.pendingRewards()).toString(),
      operatorManagedAssets: (await vault.operatorManagedAssets()).toString(),
      stakingOperator: await vault.stakingOperator(),
      stDOTBalance: (await vault.balanceOf(signer.address)).toString(),
      nextRequestId: (await vault.nextRequestId()).toString(),
    },
    governance: {
      delegate: await govToken.delegates(signer.address),
      votes: (await governor.getVotes(signer.address, BigInt(Math.max((await ethers.provider.getBlockNumber()) - 1, 0)))).toString(),
      currentNominees: await registry.getCurrentNominees(),
      queuedNominees: {
        nominees: queuedNominees[0],
        executeAfterEra: queuedNominees[1].toString(),
      },
      proposalId: proposalId?.toString() ?? null,
      proposalState: proposalId !== undefined ? Number(await governor.state(proposalId)) : null,
    },
  };

  console.log(JSON.stringify(status, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
