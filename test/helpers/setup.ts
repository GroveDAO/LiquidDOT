import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  MockDOT,
  MockStakingPrecompile,
  LiquidDOTVault,
  AutoCompounder,
  LiquidDOTLens,
  StDOTToken,
} from "../../typechain-types";

export interface TestFixture {
  deployer: Signer;
  alice: Signer;
  bob: Signer;
  keeper: Signer;
  dot: MockDOT;
  mockStaking: MockStakingPrecompile;
  vault: LiquidDOTVault;
  autoCompounder: AutoCompounder;
  lens: LiquidDOTLens;
}

/// 10,000 DOT (10 decimals)
export const TEN_THOUSAND_DOT = ethers.parseUnits("10000", 10);
/// 1 DOT (10 decimals)
export const ONE_DOT = ethers.parseUnits("1", 10);

export async function deployTestFixture(): Promise<TestFixture> {
  const [deployer, alice, bob, keeper] = await ethers.getSigners();

  // Deploy MockDOT
  const MockDOTFactory = await ethers.getContractFactory("MockDOT");
  const dot = (await MockDOTFactory.deploy()) as unknown as MockDOT;

  // Deploy MockStakingPrecompile
  const MockStakingFactory = await ethers.getContractFactory("MockStakingPrecompile");
  const mockStaking = (await MockStakingFactory.deploy()) as unknown as MockStakingPrecompile;

  // Deploy LiquidDOTVault
  const VaultFactory = await ethers.getContractFactory("LiquidDOTVault");
  const vault = (await VaultFactory.deploy(
    await mockStaking.getAddress(),
    await dot.getAddress()
  )) as unknown as LiquidDOTVault;

  // Deploy AutoCompounder
  const AutoCompounderFactory = await ethers.getContractFactory("AutoCompounder");
  const autoCompounder = (await AutoCompounderFactory.deploy(
    await vault.getAddress()
  )) as unknown as AutoCompounder;

  // Deploy LiquidDOTLens
  const LensFactory = await ethers.getContractFactory("LiquidDOTLens");
  const lens = (await LensFactory.deploy()) as unknown as LiquidDOTLens;

  // Grant KEEPER_ROLE to autoCompounder
  const KEEPER_ROLE = await vault.KEEPER_ROLE();
  await vault.grantRole(KEEPER_ROLE, await autoCompounder.getAddress());

  // Grant KEEPER_ROLE to keeper signer for direct testing
  await vault.grantRole(KEEPER_ROLE, await keeper.getAddress());

  // Mint DOT to alice and bob
  await dot.mint(await alice.getAddress(), TEN_THOUSAND_DOT);
  await dot.mint(await bob.getAddress(), TEN_THOUSAND_DOT);

  // Alice approves vault for max DOT
  const aliceDot = dot.connect(alice);
  await aliceDot.approve(await vault.getAddress(), ethers.MaxUint256);

  // Bob approves vault for max DOT
  const bobDot = dot.connect(bob);
  await bobDot.approve(await vault.getAddress(), ethers.MaxUint256);

  return {
    deployer,
    alice,
    bob,
    keeper,
    dot,
    mockStaking,
    vault,
    autoCompounder,
    lens,
  };
}
