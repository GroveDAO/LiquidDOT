import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";
import * as path from "path";

task("compound", "Trigger reward compounding via AutoCompounder")
  .setAction(async (_taskArgs: unknown, hre: HardhatRuntimeEnvironment) => {
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentsPath = path.join(__dirname, "../../deployments", `${chainId}.json`);

    if (!fs.existsSync(deploymentsPath)) {
      console.error(`No deployment found for chainId ${chainId}. Run deploy first.`);
      process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8")) as Record<string, string>;
    const autoCompounderAddress = deployments["AutoCompounder"];

    if (!autoCompounderAddress) {
      console.error("AutoCompounder address not found in deployments.");
      process.exit(1);
    }

    const [signer] = await hre.ethers.getSigners();
    const autoCompounderAbi = [
      "function canCompound() external view returns (bool)",
      "function compound() external",
      "event Compounded(uint256 rewardsCompounded, uint256 newExchangeRate)",
    ];
    const autoCompounder = new hre.ethers.Contract(autoCompounderAddress, autoCompounderAbi, signer);

    const can = await autoCompounder.canCompound();
    if (!can) {
      console.log("canCompound() returned false — pending rewards are below threshold or vault is paused. Exiting.");
      return;
    }

    console.log("Triggering compound...");
    const tx = await autoCompounder.compound();
    const receipt = await tx.wait();

    // Parse Compounded event
    const iface = new hre.ethers.Interface(autoCompounderAbi);
    for (const log of receipt?.logs ?? []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "Compounded") {
          console.log(`Rewards compounded: ${parsed.args[0].toString()}`);
          console.log(`New exchange rate:  ${parsed.args[1].toString()}`);
        }
      } catch {
        // ignore non-matching logs
      }
    }

    console.log(`Transaction: ${receipt?.hash}`);
  });
