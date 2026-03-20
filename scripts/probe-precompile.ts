import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const precompile = "0x0000000000000000000000000000000000000800";
  const iface = new ethers.Interface([
    "function bond(address controller,uint256 value,bytes payee)",
    "function bondExtra(uint256 maxAdditional)",
    "function unbond(uint256 value)",
  ]);

  const data = iface.encodeFunctionData("bond", [
    signer.address,
    ethers.parseUnits("1", 10),
    "0x00",
  ]);

  console.log(`Signer: ${signer.address}`);
  console.log(`Sending probe tx to ${precompile}...`);

  const tx = await signer.sendTransaction({
    to: precompile,
    data,
  });

  console.log(`Hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Status: ${receipt?.status}`);
  console.log(`Gas used: ${receipt?.gasUsed}`);
  console.log(`Block: ${receipt?.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
