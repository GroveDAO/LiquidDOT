# LiquidDOT Demo Voiceover Script

This script is written for a roughly 4-minute screen recording of the current frontend.

Live on-chain state at the time this script was generated:

- Network: Polkadot Hub Testnet (`PAS`)
- Vault address: `0x9e982edbd3f1F4B7B9B1bA3Dd4Bc02613985AB26`
- Total PAS managed: `242 PAS`
- Pending withdrawals: `20 PAS`
- stDOT supply: `230.9160 stDOT`
- Exchange rate: `1 stDOT = 1.048000 PAS`
- Realized yield: `4.80%`
- Current nominee set: `3 validators`
- Governance voting power delegated: `10,000,000 GOV`
- Proposal status: `1 active proposal`, already voted on-chain

If any live numbers change slightly before you record, keep the narration structure and read the updated numbers directly from the UI.

## 0:00 - 0:20 Intro

On screen:
- Start on the home page.
- Keep the wallet connected and visible in the header.

Voiceover:

"This is LiquidDOT, a native liquid staking vault built for Polkadot Hub. Users deposit the network’s native asset, receive transferable stDOT shares, track vault performance on-chain, and participate in validator governance from the same interface."

## 0:20 - 0:50 Home Page And Live Stats

On screen:
- Slowly pan across the hero section.
- Highlight the stats bar.

Voiceover:

"Everything on this page is reading from live deployed contracts on Polkadot Hub Testnet. Right now the vault is managing 242 PAS, there is 230 point 916 stDOT in circulation, and the live exchange rate is 1 stDOT to 1 point 048 PAS. That means stDOT is already worth more than the original deposited asset, and the interface shows a realized yield of 4 point 8 percent based on the current vault accounting."

"The status is also live, not placeholder content. If the vault were paused or empty, those values would change immediately."

## 0:50 - 1:30 Stake Flow

On screen:
- Click into the stake card.
- Point to the wallet PAS balance.
- Enter a small amount in the stake field.
- Pause on the "You will receive" preview.

Voiceover:

"On the staking side, LiquidDOT uses the real native token, PAS, not a mock ERC-20. The amount preview is calculated from the live vault state, so because the exchange rate is already above 1, a new depositor receives slightly less than one stDOT per PAS deposited."

"That is exactly what we want in a liquid staking system. Early depositors captured the upside, and later depositors buy into the vault at the current exchange rate. This makes the stDOT preview meaningful and accurate instead of hardcoded."

"When the user clicks stake, the app sends a payable deposit transaction to the vault contract, mints stDOT shares, and refreshes the dashboard from chain."

## 1:30 - 2:05 Unstake And Pending Withdrawals

On screen:
- Navigate to the unstake page.
- Show the unstake input and preview.
- Scroll to the pending withdrawals table and pause on the seeded row.

Voiceover:

"On the unstake page, users can redeem stDOT back into native PAS. The preview shows exactly how much PAS the current share amount is worth at the live exchange rate."

"Below that, the pending withdrawals table is also live. This wallet already has a queued withdrawal for 20 PAS, and the request is being pulled directly from the deployed vault contract. Earlier, this section incorrectly told connected users to connect their wallet. That wallet-state handling is now fixed, so connected users see their actual withdrawal queue."

## 2:05 - 2:55 Governance

On screen:
- Navigate to the governance page.
- Show GOV balance, voting power, and delegate status.
- Show current nominees.
- Show proposal feed and the vote totals.

Voiceover:

"LiquidDOT also includes live validator governance. The connected wallet holds and has delegated 10 million GOV, so the voting power shown here is real on-chain voting power, not mock data."

"The current nominee set has already been seeded on-chain with three validator addresses, and the proposal feed below is loading a real proposal directly from Governor events. That proposal is active, and it has already received a live vote on-chain."

"This means the frontend is not just a staking dashboard. It is also a real control plane for validator governance, with proposal state, vote counts, delegation, and nominee management wired into deployed contracts."

## 2:55 - 3:30 Product Positioning

On screen:
- Scroll a bit to show the whole governance page, then return to the home page.

Voiceover:

"One important implementation detail is that this testnet deployment runs in native vault mode on PAS. The app still uses the real native asset and real on-chain accounting, while contract-level native staking support on this testnet continues to mature."

"To keep the product honest and functional, the vault now tracks real native inflows, syncs yield into the exchange rate, and exposes live stats that are actually backed by chain state."

## 3:30 - 4:00 Close

On screen:
- Return to the home page.
- End on the hero, stats bar, and connected wallet.

Voiceover:

"So in one product flow, LiquidDOT gives users native-asset deposits, transferable liquid staking shares, live vault analytics, queued withdrawals, and validator governance, all on Polkadot Hub. The frontend is reading real deployed contracts, the balances and stats are seeded from real transactions, and the governance activity is live on-chain."

"That is LiquidDOT: a production-minded liquid staking and governance experience for the Polkadot ecosystem."
