import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestFixture } from "../helpers/setup";

describe("StDOTToken", () => {
  it("has correct name and symbol", async () => {
    const { vault } = await loadFixture(deployTestFixture);
    // Vault IS the stDOT token (ERC4626 pattern)
    expect(await vault.name()).to.equal("Staked DOT");
    expect(await vault.symbol()).to.equal("stDOT");
  });

  it("has 18 decimals", async () => {
    const { vault } = await loadFixture(deployTestFixture);
    expect(await vault.decimals()).to.equal(18n);
  });

  it("mints shares on deposit", async () => {
    const { vault, alice } = await loadFixture(deployTestFixture);
    const amount = ethers.parseUnits("100", 10);

    await vault.connect(alice).deposit(amount, await alice.getAddress(), { value: amount });
    expect(await vault.balanceOf(await alice.getAddress())).to.be.gt(0n);
  });

  it("burns shares on withdrawal", async () => {
    const { vault, alice } = await loadFixture(deployTestFixture);
    const amount = ethers.parseUnits("100", 10);

    await vault.connect(alice).deposit(amount, await alice.getAddress(), { value: amount });
    const sharesBefore = await vault.balanceOf(await alice.getAddress());

    await vault.connect(alice).queueWithdrawal(ethers.parseUnits("50", 10));
    const sharesAfter = await vault.balanceOf(await alice.getAddress());

    expect(sharesAfter).to.be.lt(sharesBefore);
  });

  it("standalone StDOTToken: only vault role can mint", async () => {
    const [deployer, user] = await ethers.getSigners();
    const StDOTFactory = await ethers.getContractFactory("StDOTToken");
    const stDOT = await StDOTFactory.deploy(deployer.address);

    await expect(
      stDOT.connect(user).mint(user.address, ethers.parseUnits("100", 18))
    ).to.be.revertedWithCustomError(stDOT, "AccessControlUnauthorizedAccount");
  });

  it("standalone StDOTToken: vault can mint after role grant", async () => {
    const [deployer, vault] = await ethers.getSigners();
    const StDOTFactory = await ethers.getContractFactory("StDOTToken");
    const stDOT = await StDOTFactory.deploy(deployer.address);

    await stDOT.grantVaultRole(vault.address);
    await expect(
      stDOT.connect(vault).mint(vault.address, ethers.parseUnits("100", 18))
    ).not.to.be.reverted;
  });
});
