import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";
import * as path from "path";

task("nominate", "Propose new validator nominees via ValidatorRegistry")
  .addParam("validators", "Comma-separated list of validator addresses")
  .setAction(async (taskArgs: { validators: string }, hre: HardhatRuntimeEnvironment) => {
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentsPath = path.join(__dirname, "../../deployments", `${chainId}.json`);

    if (!fs.existsSync(deploymentsPath)) {
      console.error(`No deployment found for chainId ${chainId}. Run deploy first.`);
      process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8")) as Record<string, string>;
    const registryAddress = deployments["ValidatorRegistry"];

    if (!registryAddress) {
      console.error("ValidatorRegistry address not found in deployments.");
      process.exit(1);
    }

    const [signer] = await hre.ethers.getSigners();
    const registryAbi = [
      "function proposeNominees(address[] calldata nominees) external",
      "function executeAfterEra() external view returns (uint32)",
    ];
    const registry = new hre.ethers.Contract(registryAddress, registryAbi, signer);

    const validators = taskArgs.validators.split(",").map((v: string) => v.trim());
    console.log(`Proposing ${validators.length} nominees to ${registryAddress}...`);

    const tx = await registry.proposeNominees(validators);
    const receipt = await tx.wait();
    console.log(`Transaction: ${receipt?.hash}`);

    const executeAfterEra = await registry.executeAfterEra();
    console.log(`Nominees will be executable after era: ${executeAfterEra}`);
  });
