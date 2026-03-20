import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const Probe = await ethers.getContractFactory("PrecompileCallerProbe");
  const probe = await Probe.deploy();
  await probe.waitForDeployment();

  const probeAddress = await probe.getAddress();
  console.log(`Probe: ${probeAddress}`);

  const funding = await signer.sendTransaction({
    to: probeAddress,
    value: ethers.parseUnits("2", 10),
  });
  await funding.wait();
  console.log(`Funded probe with 2 PAS`);

  const tx = await probe.bondSelf(ethers.parseUnits("1", 10));
  console.log(`Bond tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Status: ${receipt?.status}`);
  console.log(`Gas used: ${receipt?.gasUsed}`);
  console.log(`Block: ${receipt?.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
