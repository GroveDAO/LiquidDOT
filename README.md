# LiquidDOT — Native Liquid Staking on Polkadot Hub

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.26-blue.svg)](https://soliditylang.org/)
[![Polkadot](https://img.shields.io/badge/Built%20for-Polkadot%20Solidity%20Hackathon%202026-e6007a.svg)](https://polkadot.network/hackathon)

## Overview

**LiquidDOT** is the first liquid staking protocol on Polkadot Hub. It wraps Polkadot's native NPoS staking — accessed via the Hub's EVM staking precompile at `0x0000000000000000000000000000000000000800` — inside a Solidity ERC-4626 vault. Users deposit DOT and receive `stDOT`, a yield-bearing ERC-20 token that auto-compounds staking rewards. `stDOT` is fully composable with any DeFi protocol deployed on Polkadot Hub's EVM environment, uniquely combining the security of Polkadot's NPoS with the expressiveness of EVM-native DeFi.

## Project Vision

LiquidDOT is building toward a native staking base layer for Polkadot Hub EVM.

- **Turn native staking into a liquid primitive** so PAS/DOT can remain productive while staying usable across DeFi.
- **Unify yield and governance** so the same product surface that handles deposits and redemptions also controls validator selection and protocol operations.
- **Create a canonical Hub-native collateral asset** that can plug into lending markets, AMMs, treasury products, and eventually XCM routes across the wider Polkadot ecosystem.

The current deployment is intentionally production-minded: it uses the real native asset on Polkadot Hub Testnet, live vault accounting, on-chain governance, and operator-assisted staking while contract-native staking support on this testnet continues to mature.

## Live Deployment

- **Network:** Polkadot Hub Testnet (`PAS`)
- **Chain ID:** `420420417`
- **RPC:** `https://services.polkadothub-rpc.com/testnet`
- **Deployed at:** `2026-03-20T02:01:42.464Z`
- **Deployer:** `0x9f2EdCE3a34e42eaf8f965d4E14aDDd12Cf865f4`

## Deployed Contracts (Polkadot Hub Testnet)

| Contract | Address | Explorer |
|---|---|---|
| DOT sentinel | `0x0000000000000000000000000000000000000000` | Native asset sentinel |
| StakingPrecompile | `0x0000000000000000000000000000000000000800` | Native precompile |
| LiquidDOTVault | `0x0004DF4A37C6541453e8C01182d0611eFaa76ffb` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0x0004DF4A37C6541453e8C01182d0611eFaa76ffb) |
| StDOTToken | `0xc79E3E0c71a0E7ED4209B3e8e5753665AE19d606` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0xc79E3E0c71a0E7ED4209B3e8e5753665AE19d606) |
| GovToken | `0x7bEd5956dD1cC8A15CC623230763775f95857981` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0x7bEd5956dD1cC8A15CC623230763775f95857981) |
| ValidatorRegistry | `0x69bc6e363B01d06a9939C0F8c1653D702118058b` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0x69bc6e363B01d06a9939C0F8c1653D702118058b) |
| ValidatorGovernor | `0xC8f7532c0bA448aB4D6C27CC56d7ddfaB9BF1599` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0xC8f7532c0bA448aB4D6C27CC56d7ddfaB9BF1599) |
| TimelockController | `0xD1d1ee0eC8B1460fc235C830179b9221549cB155` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0xD1d1ee0eC8B1460fc235C830179b9221549cB155) |
| AutoCompounder | `0xD02Ab915f06437fB22d889F5a50fac00577C6C7B` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0xD02Ab915f06437fB22d889F5a50fac00577C6C7B) |
| LiquidDOTLens | `0x0C287c8B5E343bE6A869C8AdCeF33B00E0Be24f2` | [Blockscout](https://blockscout-testnet.polkadot.io/address/0x0C287c8B5E343bE6A869C8AdCeF33B00E0Be24f2) |

## Hackathon Track

- **Track 2: PVM Smart Contracts** — Accessing Polkadot native functionality via precompiles. LiquidDOT calls `bond`, `bondExtra`, `unbond`, `nominate`, and `getPendingRewards` directly on the on-chain staking precompile — no bridge, no custodian.
- **OpenZeppelin Sponsor Track** — Non-trivial OZ composition: `ERC4626`, `Governor`, `GovernorTimelockControl`, `AccessControl`, `Pausable`, `ERC20Votes`, `ReentrancyGuard` are all used in a production-grade, role-separated architecture.

## Architecture Diagram

```
                  ┌──────────────────────────────────────────────────────┐
                  │                  Polkadot Hub EVM                    │
                  │                                                      │
  User            │  LiquidDOTVault (ERC-4626 + AccessControl)           │
  ──────►  DOT  ──┼──► deposit() ──► bondExtra() ──────────────────────►│
          stDOT ◄─┼── mint shares ◄────────────                          │
                  │                                                      │
                  │  StakingPrecompile (0x...0800)                       │
                  │  ◄── bond / unbond / nominate / getPendingRewards    │
                  │       ────────────────────────────────────────────►  │
                  │                              Polkadot NPoS Runtime   │
                  │                                                      │
  ValidatorGovernor DAO                                                  │
  ────────────────┼──► ValidatorRegistry.proposeNominees()               │
  (GOV holders)   │          └──► vault.updateNominees()                 │
                  │                └──► precompile.nominate()            │
                  │                                                      │
  AutoCompounder  │                                                      │
  ────────────────┼──► vault.compoundRewards()                          │
  (keeper)        │       └──► bondExtra(pendingRewards)                 │
                  │                                                      │
                  └──────────────────────────────────────────────────────┘
```

## How It Works

1. **Deposit** — A user calls `deposit(assets, receiver)` on `LiquidDOTVault`. The vault transfers DOT from the user and calls `bondExtra(assets)` on the staking precompile, immediately bonding it to the NPoS pool.
2. **Receive stDOT** — The vault mints `stDOT` shares proportional to the current exchange rate. On the first deposit, the ratio is 1 DOT = 1e8 stDOT (bridging 10-decimal DOT to 18-decimal stDOT).
3. **Earn Rewards** — Each era, NPoS rewards accrue in the precompile. A keeper (the `AutoCompounder` contract) calls `compoundRewards()`, which bonds the rewards back and increases `totalDOTManaged`, making each stDOT worth more DOT.
4. **Queue Withdrawal** — A user calls `queueWithdrawal(assets)` or `redeem(shares, ...)`. The vault burns stDOT and calls `unbond(value)` on the precompile. A `WithdrawalRequest` is stored.
5. **Claim** — After 28 eras (~28 days), the user calls `claimWithdrawal(requestId)`. The vault calls `withdrawUnbonded()` and transfers DOT to the user.

## Why It Can Only Exist on Polkadot

- **Native NPoS called from Solidity** — The staking precompile exposes Polkadot's runtime staking module directly to EVM contracts. No other EVM chain has direct access to its consensus-layer staking.
- **No custodian, no bridge, no multisig** — DOT is staked natively in the Polkadot relay chain's NPoS system. There is no wrapped token, no third-party bridge, and no privileged admin key controlling the stake.
- **DAO dispatches NPoS nominations via precompile** — The `ValidatorGovernor` DAO calls `ValidatorRegistry`, which calls `LiquidDOTVault.updateNominees()`, which calls `nominate()` on the precompile. Governance directly controls which validators are elected.

## OpenZeppelin Usage

| Contract | OZ Primitive | How it is customized |
|---|---|---|
| `LiquidDOTVault` | `ERC4626` | `_decimalsOffset = 8` bridges 10-dec DOT to 18-dec stDOT; `totalAssets()` returns `totalDOTManaged`; deposit/withdraw call staking precompile |
| `LiquidDOTVault` | `AccessControl` | Three roles: `KEEPER_ROLE`, `GOVERNANCE_ROLE`, `GUARDIAN_ROLE`; compoundRewards bypasses pause |
| `LiquidDOTVault` | `Pausable` | `pause()` blocks deposits/withdrawals; compounding still works for emergency safety |
| `LiquidDOTVault` | `ReentrancyGuard` | All state-changing functions protected |
| `StDOTToken` | `ERC20Votes` + `ERC20Permit` | Only VAULT_ROLE can mint/burn; used for governance voting power |
| `GovToken` | `ERC20Votes` + `ERC20Permit` | Fixed supply, used by ValidatorGovernor |
| `ValidatorGovernor` | `Governor` + `GovernorTimelockControl` | Proposals restricted to ValidatorRegistry target only |
| `ValidatorGovernor` | `GovernorVotesQuorumFraction` | 4% quorum of total GOV supply |
| `AutoCompounder` | `Ownable` | Owner sets min reward threshold; anyone can trigger compound |

## Smart Contract Architecture

| Contract | Purpose | Key Interfaces |
|---|---|---|
| `LiquidDOTVault` | Core vault: deposit/withdraw/compound | `ILiquidDOT`, `ERC4626`, `AccessControl`, `Pausable` |
| `StDOTToken` | Standalone stDOT for governance voting | `ERC20Votes`, `ERC20Permit` |
| `ValidatorRegistry` | Queues/executes nominee changes with 2-era delay | `ILiquidDOT` (via vault call) |
| `ValidatorGovernor` | DAO governance for validator selection | OZ Governor suite |
| `GovToken` | Fixed-supply governance token | `ERC20Votes` |
| `AutoCompounder` | Stateless keeper for reward compounding | `ILiquidDOT` |
| `LiquidDOTLens` | Read-only view aggregator | `ILiquidDOT` |
| `StakingPrecompile` | Wrapper around 0x...0800 precompile | `IStakingPrecompile` |

## Local Development

```bash
# Clone and install
git clone https://github.com/GroveDAO/LiquidDOT.git
cd LiquidDOT
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Run coverage
npm run test:coverage
```

## Deployment

```bash
# Copy and fill in environment variables
cp .env.example .env

# Deploy to Polkadot Hub Testnet
npm run deploy:testnet

# Verify contracts
npm run verify:testnet
```

## Running the Frontend

```bash
# Set environment variables
export NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
export NEXT_PUBLIC_CHAIN_ID=420420417
export NEXT_PUBLIC_APP_URL=http://localhost:3000

# Start dev server
npm run frontend:dev
```

## Running the Auto-Compounder

```bash
npx hardhat compound --network polkadot_hub_testnet
```

## Security Considerations

- **Role separation** — No single address holds all privileges. `KEEPER_ROLE` can only compound rewards. `GOVERNANCE_ROLE` can only update nominees. `GUARDIAN_ROLE` can only pause/unpause.
- **Emergency pause scope** — `pause()` blocks `deposit`, `withdraw`, `redeem`, and `queueWithdrawal` only. `compoundRewards()` bypasses the pause so rewards continue accruing during an emergency.
- **Keeper constraints** — `AutoCompounder.compound()` can only bond pending rewards. It cannot transfer user funds or modify the nominee set.
- **2-era delay on validator changes** — `ValidatorRegistry` requires at least 2 eras before a proposed nominee set is applied.
- **Reentrancy** — All state-changing vault functions use `nonReentrant`.

## Roadmap

- **Phase 1: Live Testnet Launch** — Ship the PAS-native vault, seeded live stats, operator-assisted staking workflow, queue/claim withdrawals, and validator governance UI on Polkadot Hub Testnet.
- **Phase 2: Native Staking Upgrade** — Move from operator-assisted staking into fully contract-native staking as Polkadot Hub testnet/mainnet staking precompile support becomes available for contracts.
- **Phase 3: DeFi Integrations** — Position `stDOT` as Hub-native collateral across lending markets, AMMs, LP strategies, and DAO treasury products.
- **Phase 4: Cross-Chain Expansion** — Extend `stDOT` liquidity through XCM-connected Polkadot apps and evolve the vault toward multi-asset staking products and richer reward routing.

## On-Chain Identity

Team members should set their Polkadot wallet on-chain identity via Polkassembly before submission. See: https://openguild.wtf/blog/polkadot/polkadot-opengov-introduction

## License

MIT — see [LICENSE](./LICENSE).
