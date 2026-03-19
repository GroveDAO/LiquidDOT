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
      chainId: 420420421,
      url: process.env.POLKADOT_HUB_TESTNET_RPC ?? "https://rpc.pah.zeitgeist.pm",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    polkadot_hub: {
      chainId: 420420420,
      url: process.env.POLKADOT_HUB_RPC ?? "https://rpc.polkadot.io",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
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
      polkadot_hub_testnet: process.env.BLOCKSCOUT_API_KEY ?? "",
      polkadot_hub: process.env.BLOCKSCOUT_API_KEY ?? "",
    },
    customChains: [
      {
        network: "polkadot_hub_testnet",
        chainId: 420420421,
        urls: {
          apiURL: "https://blockscout.pah.zeitgeist.pm/api",
          browserURL: "https://blockscout.pah.zeitgeist.pm",
        },
      },
      {
        network: "polkadot_hub",
        chainId: 420420420,
        urls: {
          apiURL: "https://blockscout.polkadot.network/api",
          browserURL: "https://blockscout.polkadot.network",
        },
      },
    ],
  },
};

export default config;
