import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestFixture } from "../helpers/setup";

/// @dev Full end-to-end integration scenario covering the complete
///      deposit → compound → withdraw lifecycle.
describe("FullFlow integration", () => {
  it("runs the complete stake → compound → withdraw flow", async () => {
    const { vault, dot, autoCompounder, mockStaking, alice, bob, keeper } =
      await loadFixture(deployTestFixture);

    const ALICE_DEPOSIT = ethers.parseUnits("1000", 10);  // 1,000 DOT
    const BOB_DEPOSIT   = ethers.parseUnits("500", 10);   //   500 DOT
    const REWARDS       = ethers.parseUnits("100", 10);   //   100 DOT

    // -----------------------------------------------------------------------
    // Step 1: Alice deposits 1,000 DOT → receives stDOT (1:1 at start)
    // -----------------------------------------------------------------------
    await vault.connect(alice).deposit(ALICE_DEPOSIT, await alice.getAddress());
    const aliceShares1 = await vault.balanceOf(await alice.getAddress());
    expect(aliceShares1).to.be.gt(0n);
    expect(await vault.totalDOTManaged()).to.equal(ALICE_DEPOSIT);

    // -----------------------------------------------------------------------
    // Step 2: Bob deposits 500 DOT
    // -----------------------------------------------------------------------
    await vault.connect(bob).deposit(BOB_DEPOSIT, await bob.getAddress());
    const bobShares = await vault.balanceOf(await bob.getAddress());
    expect(bobShares).to.be.gt(0n);
    expect(await vault.totalDOTManaged()).to.equal(ALICE_DEPOSIT + BOB_DEPOSIT);

    // -----------------------------------------------------------------------
    // Step 3: Mock precompile accrues 100 DOT rewards
    // -----------------------------------------------------------------------
    await mockStaking.addMockRewards(await vault.getAddress(), REWARDS);
    expect(await vault.pendingRewards()).to.equal(REWARDS);

    // -----------------------------------------------------------------------
    // Step 4: Keeper calls autoCompounder.compound()
    //         Exchange rate should increase
    // -----------------------------------------------------------------------
    const rateBefore = await vault.exchangeRate();
    expect(await autoCompounder.canCompound()).to.be.true;

    await autoCompounder.compound();

    const rateAfter = await vault.exchangeRate();
    expect(rateAfter).to.be.gt(rateBefore);

    // Total DOT is now 1000 + 500 + 100 = 1600 DOT
    expect(await vault.totalDOTManaged()).to.equal(ALICE_DEPOSIT + BOB_DEPOSIT + REWARDS);

    // -----------------------------------------------------------------------
    // Step 5: Alice queues withdrawal of half her shares
    // -----------------------------------------------------------------------
    const aliceShares2 = await vault.balanceOf(await alice.getAddress());
    const halfShares = aliceShares2 / 2n;

    const dotForHalfShares = await vault.previewRedeem(halfShares);
    await vault.connect(alice).redeem(halfShares, await alice.getAddress(), await alice.getAddress());

    // Withdrawal request should be created
    const req = await vault.withdrawalRequests(0n);
    expect(req.owner).to.equal(await alice.getAddress());
    expect(req.dotAmount).to.equal(dotForHalfShares);
    expect(req.claimed).to.be.false;

    // -----------------------------------------------------------------------
    // Step 6: Fast-forward 28 eras
    // -----------------------------------------------------------------------
    const UNBONDING_ERAS = await vault.UNBONDING_ERAS();
    await mockStaking.advanceEra(UNBONDING_ERAS);

    // -----------------------------------------------------------------------
    // Step 7: Alice claims withdrawal → receives DOT
    // -----------------------------------------------------------------------
    // Fund vault with DOT to simulate withdrawUnbonded
    await dot.mint(await vault.getAddress(), dotForHalfShares);

    const aliceDotBefore = await dot.balanceOf(await alice.getAddress());
    await vault.connect(alice).claimWithdrawal(0n);
    const aliceDotAfter = await dot.balanceOf(await alice.getAddress());

    expect(aliceDotAfter - aliceDotBefore).to.equal(dotForHalfShares);
    expect((await vault.withdrawalRequests(0n)).claimed).to.be.true;

    // -----------------------------------------------------------------------
    // Step 8: Bob still holds stDOT — its value has increased relative to DOT
    // -----------------------------------------------------------------------
    const bobDotValue = await vault.previewRedeem(bobShares);
    // Bob originally deposited 500 DOT; his shares are now worth more
    expect(bobDotValue).to.be.gt(BOB_DEPOSIT);

    // -----------------------------------------------------------------------
    // Step 9: Exchange rate did not change after Alice's withdrawal
    //         (no dilution from withdrawals)
    // -----------------------------------------------------------------------
    const rateAfterWithdraw = await vault.exchangeRate();
    // Rate should be unchanged (withdrawals don't affect rate, only compound does)
    expect(rateAfterWithdraw).to.equal(rateAfter);
  });
});
