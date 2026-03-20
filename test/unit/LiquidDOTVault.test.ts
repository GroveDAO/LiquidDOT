import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployNativeVaultModeFixture, deployTestFixture, ONE_DOT } from "../helpers/setup";

describe("LiquidDOTVault", () => {
  const THOUSAND_DOT = ethers.parseUnits("1000", 10);
  const FIVE_HUNDRED_DOT = ethers.parseUnits("500", 10);
  const HUNDRED_DOT = ethers.parseUnits("100", 10);

  // -------------------------------------------------------------------------
  describe("deployment", () => {
    it("initializes with correct staking precompile address", async () => {
      const { vault, mockStaking } = await loadFixture(deployTestFixture);
      expect(await vault.stakingPrecompile()).to.equal(await mockStaking.getAddress());
    });

    it("initializes with correct DOT asset address", async () => {
      const { vault } = await loadFixture(deployTestFixture);
      expect(await vault.asset()).to.equal(ethers.ZeroAddress);
    });

    it("deployer has DEFAULT_ADMIN_ROLE", async () => {
      const { vault, deployer } = await loadFixture(deployTestFixture);
      const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();
      expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, await deployer.getAddress())).to.be.true;
    });

    it("initializes totalDOTManaged to zero", async () => {
      const { vault } = await loadFixture(deployTestFixture);
      expect(await vault.totalDOTManaged()).to.equal(0n);
    });

    it("initial exchange rate is 1e18 when no supply", async () => {
      const { vault } = await loadFixture(deployTestFixture);
      expect(await vault.exchangeRate()).to.equal(ethers.parseUnits("1", 18));
    });
  });

  // -------------------------------------------------------------------------
  describe("deposit", () => {
    it("mints stDOT at correct rate on first deposit", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);

      const tx = await vault.connect(alice).deposit(
        THOUSAND_DOT,
        await alice.getAddress(),
        { value: THOUSAND_DOT }
      );
      await tx.wait();

      const stDOTBalance = await vault.balanceOf(await alice.getAddress());
      // With _decimalsOffset = 8: shares = assets * 10^8 = 1000e10 * 10^8 = 1000e18
      expect(stDOTBalance).to.be.gt(0n);
    });

    it("emits Staked event with correct args", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);
      const aliceAddr = await alice.getAddress();

      await expect(
        vault.connect(alice).deposit(THOUSAND_DOT, aliceAddr, { value: THOUSAND_DOT })
      )
        .to.emit(vault, "Staked")
        .withArgs(aliceAddr, aliceAddr, THOUSAND_DOT, (shares: bigint) => shares > 0n);
    });

    it("updates totalDOTManaged after deposit", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);

      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      expect(await vault.totalDOTManaged()).to.equal(THOUSAND_DOT);
    });

    it("calls bondExtra on staking precompile", async () => {
      const { vault, mockStaking, alice } = await loadFixture(deployTestFixture);

      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      const stake = await mockStaking.getStake(await vault.getAddress());
      expect(stake).to.equal(THOUSAND_DOT);
    });

    it("reverts when paused", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);

      await vault.pause();
      await expect(
        vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT })
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("reverts with zero amount", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);

      await expect(
        vault.connect(alice).deposit(0n, await alice.getAddress(), { value: 0n })
      ).to.be.revertedWith("LiquidDOTVault: zero deposit");
    });

    it("reverts if msg.value does not match the requested asset amount", async () => {
      const { vault, deployer } = await loadFixture(deployTestFixture);
      await expect(
        vault.connect(deployer).deposit(ONE_DOT, await deployer.getAddress(), { value: 0n })
      ).to.be.revertedWith("LiquidDOTVault: value mismatch");
    });
  });

  // -------------------------------------------------------------------------
  describe("withdraw / queueWithdrawal", () => {
    async function depositFixture() {
      const base = await loadFixture(deployTestFixture);
      const { vault, alice } = base;
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      return base;
    }

    it("queues correct DOT amount", async () => {
      const { vault, alice } = await depositFixture();

      await vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT);
      const req = await vault.withdrawalRequests(0n);
      expect(req.dotAmount).to.equal(FIVE_HUNDRED_DOT);
    });

    it("burns stDOT from owner", async () => {
      const { vault, alice } = await depositFixture();
      const balanceBefore = await vault.balanceOf(await alice.getAddress());

      await vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT);
      const balanceAfter = await vault.balanceOf(await alice.getAddress());
      expect(balanceAfter).to.be.lt(balanceBefore);
    });

    it("emits WithdrawalQueued event", async () => {
      const { vault, alice } = await depositFixture();

      await expect(vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT))
        .to.emit(vault, "WithdrawalQueued")
        .withArgs(0n, await alice.getAddress(), FIVE_HUNDRED_DOT, 0n);
    });

    it("creates WithdrawalRequest with correct era", async () => {
      const { vault, alice, mockStaking } = await depositFixture();

      await vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT);
      const req = await vault.withdrawalRequests(0n);
      expect(req.unbondEra).to.equal(await mockStaking.getActiveEra());
    });

    it("reverts if user has insufficient stDOT", async () => {
      const { vault, bob } = await deployTestFixture();
      // bob has no stDOT

      await expect(
        vault.connect(bob).queueWithdrawal(ONE_DOT)
      ).to.be.revertedWith("LiquidDOTVault: insufficient stDOT");
    });

    it("reverts when paused", async () => {
      const { vault, alice } = await depositFixture();
      await vault.pause();

      await expect(
        vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  // -------------------------------------------------------------------------
  describe("claimWithdrawal", () => {
    async function queuedFixture() {
      const base = await loadFixture(deployTestFixture);
      const { vault, alice } = base;

      // Deposit
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      // Queue withdrawal
      await vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT);

      return { ...base, requestId: 0n };
    }

    it("succeeds after unbonding period passes", async () => {
      const { vault, alice, mockStaking, requestId } = await queuedFixture();
      const UNBONDING_ERAS = await vault.UNBONDING_ERAS();

      // Advance era past unbonding period
      await mockStaking.advanceEra(UNBONDING_ERAS);

      await expect(vault.connect(alice).claimWithdrawal(requestId)).not.to.be.reverted;
    });

    it("transfers DOT to receiver after unbonding", async () => {
      const { vault, alice, mockStaking, requestId } = await queuedFixture();
      const UNBONDING_ERAS = await vault.UNBONDING_ERAS();
      await mockStaking.advanceEra(UNBONDING_ERAS);

      const aliceAddress = await alice.getAddress();
      const balanceBefore = await ethers.provider.getBalance(aliceAddress);
      const tx = await vault.connect(alice).claimWithdrawal(requestId);
      const receipt = await tx.wait();
      const gasCost = (receipt?.gasUsed ?? 0n) * (receipt?.gasPrice ?? 0n);
      const balanceAfter = await ethers.provider.getBalance(aliceAddress);

      expect(balanceAfter + gasCost - balanceBefore).to.equal(FIVE_HUNDRED_DOT);
    });

    it("emits WithdrawalClaimed event", async () => {
      const { vault, alice, mockStaking, requestId } = await queuedFixture();
      const UNBONDING_ERAS = await vault.UNBONDING_ERAS();
      await mockStaking.advanceEra(UNBONDING_ERAS);

      await expect(vault.connect(alice).claimWithdrawal(requestId))
        .to.emit(vault, "WithdrawalClaimed")
        .withArgs(requestId, await alice.getAddress(), FIVE_HUNDRED_DOT);
    });

    it("reverts before unbonding period elapses", async () => {
      const { vault, alice, requestId } = await queuedFixture();

      await expect(
        vault.connect(alice).claimWithdrawal(requestId)
      ).to.be.revertedWith("LiquidDOTVault: unbonding not complete");
    });

    it("reverts if already claimed", async () => {
      const { vault, alice, mockStaking, requestId } = await queuedFixture();
      const UNBONDING_ERAS = await vault.UNBONDING_ERAS();
      await mockStaking.advanceEra(UNBONDING_ERAS);

      await vault.connect(alice).claimWithdrawal(requestId);
      await expect(
        vault.connect(alice).claimWithdrawal(requestId)
      ).to.be.revertedWith("LiquidDOTVault: already claimed");
    });

    it("reverts if not the request owner", async () => {
      const { vault, bob, mockStaking, requestId } = await queuedFixture();
      const UNBONDING_ERAS = await vault.UNBONDING_ERAS();
      await mockStaking.advanceEra(UNBONDING_ERAS);

      await expect(
        vault.connect(bob).claimWithdrawal(requestId)
      ).to.be.revertedWith("LiquidDOTVault: not owner");
    });
  });

  // -------------------------------------------------------------------------
  describe("compoundRewards", () => {
    async function depositedFixture() {
      const base = await loadFixture(deployTestFixture);
      const { vault, alice, mockStaking } = base;
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      return base;
    }

    it("increases totalDOTManaged by reward amount", async () => {
      const { vault, mockStaking, keeper } = await depositedFixture();
      const managedBefore = await vault.totalDOTManaged();

      await mockStaking.addMockRewards(await vault.getAddress(), HUNDRED_DOT);
      await vault.connect(keeper).compoundRewards();

      expect(await vault.totalDOTManaged()).to.equal(managedBefore + HUNDRED_DOT);
    });

    it("increases exchange rate after compounding", async () => {
      const { vault, mockStaking, keeper } = await depositedFixture();
      const rateBefore = await vault.exchangeRate();

      await mockStaking.addMockRewards(await vault.getAddress(), HUNDRED_DOT);
      await vault.connect(keeper).compoundRewards();

      expect(await vault.exchangeRate()).to.be.gt(rateBefore);
    });

    it("emits RewardsCompounded event", async () => {
      const { vault, mockStaking, keeper } = await depositedFixture();

      await mockStaking.addMockRewards(await vault.getAddress(), HUNDRED_DOT);
      await expect(vault.connect(keeper).compoundRewards())
        .to.emit(vault, "RewardsCompounded")
        .withArgs(HUNDRED_DOT, (rate: bigint) => rate > 0n);
    });

    it("is only callable by KEEPER_ROLE", async () => {
      const { vault, alice } = await depositedFixture();

      await expect(
        vault.connect(alice).compoundRewards()
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("is callable even when vault is paused", async () => {
      const { vault, mockStaking, keeper } = await depositedFixture();

      await vault.pause();
      await mockStaking.addMockRewards(await vault.getAddress(), HUNDRED_DOT);
      await expect(vault.connect(keeper).compoundRewards()).not.to.be.reverted;
    });

    it("does nothing if pendingRewards is zero", async () => {
      const { vault, keeper } = await depositedFixture();
      const managedBefore = await vault.totalDOTManaged();

      await expect(vault.connect(keeper).compoundRewards()).not.to.be.reverted;
      expect(await vault.totalDOTManaged()).to.equal(managedBefore);
    });
  });

  // -------------------------------------------------------------------------
  describe("native vault mode", () => {
    it("tracks direct native transfers as pending rewards", async () => {
      const { vault, alice } = await loadFixture(deployNativeVaultModeFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      await alice.sendTransaction({
        to: await vault.getAddress(),
        value: HUNDRED_DOT,
      });

      expect(await vault.pendingRewards()).to.equal(HUNDRED_DOT);
    });

    it("syncs native surplus into managed assets when compounded", async () => {
      const { vault, alice, keeper } = await loadFixture(deployNativeVaultModeFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      const rateBefore = await vault.exchangeRate();
      await alice.sendTransaction({
        to: await vault.getAddress(),
        value: HUNDRED_DOT,
      });

      await expect(vault.connect(keeper).compoundRewards())
        .to.emit(vault, "RewardsCompounded")
        .withArgs(HUNDRED_DOT, (rate: bigint) => rate > rateBefore);

      expect(await vault.totalDOTManaged()).to.equal(THOUSAND_DOT + HUNDRED_DOT);
      expect(await vault.exchangeRate()).to.be.gt(rateBefore);
      expect(await vault.pendingRewards()).to.equal(0n);
    });
  });

  // -------------------------------------------------------------------------
  describe("operator-assisted staking mode", () => {
    it("sweeps idle PAS to the configured operator", async () => {
      const { vault, alice, deployer } = await loadFixture(deployNativeVaultModeFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      const deployerAddress = await deployer.getAddress();
      const balanceBefore = await ethers.provider.getBalance(deployerAddress);
      const tx = await vault.sweepToOperator(FIVE_HUNDRED_DOT);
      const receipt = await tx.wait();
      const gasCost = (receipt?.gasUsed ?? 0n) * (receipt?.gasPrice ?? 0n);
      const balanceAfter = await ethers.provider.getBalance(deployerAddress);

      expect(await vault.operatorManagedAssets()).to.equal(FIVE_HUNDRED_DOT);
      expect(balanceAfter + gasCost - balanceBefore).to.equal(FIVE_HUNDRED_DOT);
    });

    it("reports external rewards into exchange-rate accounting", async () => {
      const { vault, alice } = await loadFixture(deployNativeVaultModeFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      const rateBefore = await vault.exchangeRate();
      await vault.reportExternalRewards({ value: HUNDRED_DOT });

      expect(await vault.totalDOTManaged()).to.equal(THOUSAND_DOT + HUNDRED_DOT);
      expect(await vault.exchangeRate()).to.be.gt(rateBefore);
    });

    it("requires operator funding before claims in operator-assisted mode", async () => {
      const { vault, alice } = await loadFixture(deployNativeVaultModeFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });
      await vault.sweepToOperator(FIVE_HUNDRED_DOT);

      await vault.connect(alice).queueWithdrawal(FIVE_HUNDRED_DOT);
      await expect(vault.connect(alice).claimWithdrawal(0n)).to.be.revertedWith(
        "LiquidDOTVault: withdrawal not funded"
      );

      await vault.fundWithdrawal(0n, { value: FIVE_HUNDRED_DOT });
      await expect(vault.connect(alice).claimWithdrawal(0n)).not.to.be.reverted;
    });
  });

  // -------------------------------------------------------------------------
  describe("exchangeRate", () => {
    it("remains 1e18 with no rewards (initial proportional rate)", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      // Rate should be stable: 1000e10 DOT / (1000e18 stDOT) = 1e-8 DOT per stDOT-wei
      // As a ratio: totalDOT * 1e18 / supply
      const rate = await vault.exchangeRate();
      expect(rate).to.be.gt(0n);
    });

    it("increases proportionally after compounding", async () => {
      const { vault, alice, mockStaking, keeper } = await loadFixture(deployTestFixture);
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      const rateBefore = await vault.exchangeRate();

      await mockStaking.addMockRewards(await vault.getAddress(), HUNDRED_DOT);
      await vault.connect(keeper).compoundRewards();

      const rateAfter = await vault.exchangeRate();
      expect(rateAfter).to.be.gt(rateBefore);
    });

    it("late depositors receive fewer stDOT at elevated rate", async () => {
      const { vault, alice, bob, mockStaking, keeper } = await loadFixture(deployTestFixture);

      // Alice deposits first
      await vault.connect(alice).deposit(THOUSAND_DOT, await alice.getAddress(), { value: THOUSAND_DOT });

      // Compound rewards
      await mockStaking.addMockRewards(await vault.getAddress(), HUNDRED_DOT);
      await vault.connect(keeper).compoundRewards();

      // Bob deposits same amount — should get fewer shares
      await vault.connect(bob).deposit(THOUSAND_DOT, await bob.getAddress(), { value: THOUSAND_DOT });

      const aliceShares = await vault.balanceOf(await alice.getAddress());
      const bobShares = await vault.balanceOf(await bob.getAddress());

      expect(bobShares).to.be.lt(aliceShares);
    });
  });

  // -------------------------------------------------------------------------
  describe("access control", () => {
    it("non-keeper cannot call compoundRewards", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);
      await expect(
        vault.connect(alice).compoundRewards()
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("non-governance cannot call updateNominees", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);
      await expect(
        vault.connect(alice).updateNominees([await alice.getAddress()])
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("non-guardian cannot pause", async () => {
      const { vault, alice } = await loadFixture(deployTestFixture);
      await expect(
        vault.connect(alice).pause()
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("guardian can pause and unpause", async () => {
      const { vault } = await loadFixture(deployTestFixture);

      await vault.pause();
      expect(await vault.paused()).to.be.true;

      await vault.unpause();
      expect(await vault.paused()).to.be.false;
    });
  });
});
