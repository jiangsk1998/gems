import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";
describe("staking test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.staking as Program<Staking>;
  const admin = (provider.wallet as any).payer;
  let mint: PublicKey;
  let adminAta: PublicKey;
  let user = Keypair.generate();
  let userAta: PublicKey;
  let poolPda: PublicKey;
  let poolBump: number;
  let stakeVault: PublicKey;
  let userStakePda: PublicKey;
  const decimals = 6;
  const rewardRate = new anchor.BN(100);
  before(async () => {
    const sig = await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    mint = await createMint(provider.connection, admin, admin.publicKey, null, decimals);
    const adminAtaAcc = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey);
    adminAta = adminAtaAcc.address;
    const userAtaAcc = await getOrCreateAssociatedTokenAccount(provider.connection, user, mint, user.publicKey);
    userAta = userAtaAcc.address;
    await mintTo(provider.connection, admin, mint, adminAta, admin, 100000000000);
    await mintTo(provider.connection, admin, mint, userAta, admin, 100000000000);
    [poolPda, poolBump] = PublicKey.findProgramAddressSync([Buffer.from("stake_pool"), mint.toBuffer()], program.programId);
    stakeVault = getAssociatedTokenAddressSync(mint, poolPda, true);
    [userStakePda] = PublicKey.findProgramAddressSync([Buffer.from("user_stake"), poolPda.toBuffer(), user.publicKey.toBuffer()], program.programId);
  });
  it("init pool", async () => {
    const tx = await program.methods.init(rewardRate).accounts({
        admin: admin.publicKey, pool: poolPda, stakeVault: stakeVault, mint: mint, systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      }).signers([admin]).rpc();
    expect(tx).to.be.a("string");
  });
  it("stake tokens", async () => {
    const stakeAmount = new anchor.BN(500000);
    const tx = await program.methods.stake(stakeAmount).accounts({
        user: user.publicKey, userStake: userStakePda, pool: poolPda, userTokenAccount: userAta, mint: mint, stakeVault: stakeVault, systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([user]).rpc();
    expect(tx).to.be.a("string");
    const poolInfo = await program.account.stakePool.fetch(poolPda);
    expect(poolInfo.totalStaked.toString()).to.equal("500000"); 
  });
  it("deposit rewards", async () => {
    const depositAmount = new anchor.BN(1000000);
    const tx = await program.methods.deposit(depositAmount).accounts({
        user: admin.publicKey, pool: poolPda, mint: mint, stakeVault: stakeVault, adminTokenAccount: adminAta, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([admin]).rpc();
    expect(tx).to.be.a("string");
    const poolInfo = await program.account.stakePool.fetch(poolPda);
    expect(poolInfo.totalStaked.toString()).to.equal("1500000"); 
  });
  it("unstake tokens", async () => {
    const userStakeInfo = await program.account.userStake.fetch(userStakePda);
    const sharesToUnstake = userStakeInfo.shares; 
    const tx = await program.methods.unstake(sharesToUnstake as any).accounts({
        pool: poolPda, userStake: userStakePda, user: user.publicKey,
      }).signers([user]).rpc();
    expect(tx).to.be.a("string");
  });
  it("withdraw tokens should fail if cooldown not passed", async () => {
    try {
      await program.methods.withdraw().accounts({
          user: user.publicKey, userTokenAccount: userAta, stakeVault: stakeVault, mint: mint, pool: poolPda, userStake: userStakePda, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([user]).rpc();
      throw new Error("Withdraw should have failed");
    } catch (e: any) {
      expect(e.message).to.include("CooldownNotFinished");
    }
  });
});
