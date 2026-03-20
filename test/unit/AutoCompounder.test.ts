import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployNativeVaultModeFixture, deployTestFixture, ONE_DOT } from "../helpers/setup";

describe("AutoCompounder", () => {
  const THOUSAND_DOT = ethers.parseUnits("1000", 10);
  const HUNDRED_DOT = ethers.parseUnits("100", 10);

  // -------------------------------------------------------------------------
  describe("canCompound()", () => {
    it("returns false when rewards are below threshold", async () => {
      const { autoCompounder, mockStaking, vault } = await loadFixture(deployTestFixture);
      // No rewards injected
      expect(await autoCompounder.canCompound()).to.be.false;
    });

    it("returns true when rewards exceed threshold", async () => {
      const { autoCompounder, mockStaking, vault, alice } = await loadFixture(deployTestFixture);

      // Deposit so there's managed DOT
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      // Inject rewards above 1 DOT threshold (1e10)
      const bigReward = ethers.parseUnits("10", 10); // 10 DOT
      await mockStaking.addMockRewards(await vault.getAddress(), bigReward);

      expect(await autoCompounder.canCompound()).to.be.true;
    });

    it("returns false when vault is paused", async () => {
      const { autoCompounder, mockStaking, vault, alice } = await loadFixture(deployTestFixture);

      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      await mockStaking.addMockRewards(await vault.getAddress(), ethers.parseUnits("10", 10));

      // Pause the vault
      await vault.pause();

      expect(await autoCompounder.canCompound()).to.be.false;
    });
  });

  // -------------------------------------------------------------------------
  describe("compound()", () => {
    it("calls vault.compoundRewards() and emits Compounded event", async () => {
      const { autoCompounder, mockStaking, vault, alice } = await loadFixture(deployTestFixture);

      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      const reward = ethers.parseUnits("10", 10);
      await mockStaking.addMockRewards(await vault.getAddress(), reward);

      await expect(autoCompounder.compound())
        .to.emit(autoCompounder, "Compounded")
        .withArgs(reward, (rate: bigint) => rate > 0n);
    });

    it("reverts if canCompound() is false", async () => {
      const { autoCompounder } = await loadFixture(deployTestFixture);
      // No rewards
      await expect(autoCompounder.compound()).to.be.revertedWith(
        "AutoCompounder: cannot compound"
      );
    });

    it("increases exchange rate after compounding", async () => {
      const { autoCompounder, mockStaking, vault, alice } = await loadFixture(deployTestFixture);

      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      const rateBefore = await vault.exchangeRate();

      const reward = ethers.parseUnits("10", 10);
      await mockStaking.addMockRewards(await vault.getAddress(), reward);
      await autoCompounder.compound();

      expect(await vault.exchangeRate()).to.be.gt(rateBefore);
    });
  });

  // -------------------------------------------------------------------------
  describe("setMinRewardThreshold()", () => {
    it("owner can update threshold", async () => {
      const { autoCompounder } = await loadFixture(deployTestFixture);

      const newThreshold = ethers.parseUnits("5", 10); // 5 DOT
      await autoCompounder.setMinRewardThreshold(newThreshold);
      expect(await autoCompounder.minRewardThreshold()).to.equal(newThreshold);
    });

    it("non-owner cannot update threshold", async () => {
      const { autoCompounder, alice } = await loadFixture(deployTestFixture);

      await expect(
        autoCompounder.connect(alice).setMinRewardThreshold(ethers.parseUnits("5", 10))
      ).to.be.revertedWithCustomError(autoCompounder, "OwnableUnauthorizedAccount");
    });
  });

  // -------------------------------------------------------------------------
  describe("native vault mode", () => {
    it("can compound direct native surplus when staking integration is disabled", async () => {
      const { autoCompounder, vault, alice } = await loadFixture(deployNativeVaultModeFixture);

      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      await alice.sendTransaction({
        to: await vault.getAddress(),
        value: ethers.parseUnits("10", 10),
      });

      expect(await autoCompounder.canCompound()).to.be.true;
    });
  });
});
