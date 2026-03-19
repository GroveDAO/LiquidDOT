# LiquidDOT — Local Demo Guide

This guide walks hackathon judges through a complete local demo of LiquidDOT.

## Prerequisites

- Node.js >= 18
- npm >= 9
- MetaMask (or any EVM wallet browser extension)

## Step 1: Install Dependencies

```bash
git clone https://github.com/GroveDAO/LiquidDOT.git
cd LiquidDOT
npm install
```

## Step 2: Compile Contracts

```bash
npm run compile
# Expected: "Compiled 73 Solidity files successfully"
```

## Step 3: Run Tests

```bash
npm test
# Expected: 52 passing
```

## Step 4: Start a Local Hardhat Node

```bash
npx hardhat node
# Leave this terminal running
```

## Step 5: Deploy Mock Environment

In a new terminal:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

This deploys:
- MockDOT (test DOT token)
- MockStakingPrecompile (simulates Polkadot staking)
- LiquidDOTVault (the core vault)
- GovToken + ValidatorGovernor + ValidatorRegistry
- AutoCompounder + LiquidDOTLens

Deployed addresses are saved to `deployments/31337.json`.

## Step 6: Simulate a Full Flow

Run the simulation script:

```bash
npx hardhat run scripts/simulate.ts --network localhost
```

This script:
1. Mints 10,000 DOT to Alice and Bob
2. Alice deposits 1,000 DOT → receives stDOT
3. Bob deposits 500 DOT → receives stDOT
4. Injects 100 DOT rewards into mock precompile
5. Calls `autoCompounder.compound()` → exchange rate increases
6. Alice queues withdrawal of 500 stDOT
7. Fast-forwards 28 eras
8. Alice claims her DOT
9. Prints the final state (exchange rate, balances, etc.)

## Step 7: View on Frontend

```bash
# In a new terminal:
cd frontend
npm install
NEXT_PUBLIC_CHAIN_ID=31337 npm run dev
```

Open http://localhost:3000 in your browser.

- **Stake page** (`/stake`): Deposit DOT, receive stDOT
- **Unstake page** (`/unstake`): Queue and claim withdrawals
- **Governance page** (`/governance`): Propose and vote on validators

> **Note:** The frontend shows a "Deploy contracts first" banner if `NEXT_PUBLIC_CHAIN_ID` does not match a deployment. Set it to `31337` for local testing.

## Step 8: Verify Key Invariants

After the simulation, verify:

```bash
# Check exchange rate increased after compounding
npx hardhat console --network localhost
> const vault = await ethers.getContractAt("LiquidDOTVault", "<vault_address>")
> (await vault.exchangeRate()).toString()
# Should be > 1e18 (rate increased after compounding)

> (await vault.totalDOTManaged()).toString()
# Should equal initial deposits + compounded rewards - withdrawn DOT
```

## Troubleshooting

- **"Deploy contracts first" banner**: Ensure `NEXT_PUBLIC_CHAIN_ID` matches your running network
- **Test failures**: Run `npx hardhat clean && npm test`
- **Compiler not found**: The project uses solc 0.8.26 cached locally; no internet required
