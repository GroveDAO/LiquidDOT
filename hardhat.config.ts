import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

// Import custom tasks
import "./scripts/tasks/nominate";
import "./scripts/tasks/compound";
import "./scripts/tasks/operator";

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY
  ? process.env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
    ? process.env.DEPLOYER_PRIVATE_KEY
    : `0x${process.env.DEPLOYER_PRIVATE_KEY}`
  : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polkadot_hub_testnet: {
      chainId: 420420417,
      url: process.env.POLKADOT_HUB_TESTNET_RPC ?? "https://services.polkadothub-rpc.com/testnet",
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      polkadot_hub_testnet: process.env.BLOCKSCOUT_API_KEY ?? "verifyContract",
    },
    customChains: [
      {
        network: "polkadot_hub_testnet",
        chainId: 420420417,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/420420417/etherscan",
          browserURL: "https://blockscout-testnet.polkadot.io",
        },
      },
    ],
  },
};

export default config;
