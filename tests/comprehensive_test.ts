/**
 * 全面综合测试
 * 覆盖 Tangaga、Faucet、SkinsNFT、DEX 四个合约的所有指令
 *
 * 测试流程：
 *  1. Tangaga  : create_token / mint_to_wallet / transfer_tokens / approve /
 *                delegate / revoke / burn / close_account
 *  2. Faucet   : initialize / deposits_tokens / claim_tokens / update_config /
 *                withdraw_tokens
 *  3. SkinsNFT : initialize(公共) / mint_nft_public / initialize(白名单) /
 *                add_whitelist / mint_nft_whitelist / freeze_nft / thaw_nft /
 *                trans_update_auth / revoke_freeze_auth / trans_nft / withdraw
 *  4. DEX      : create_pool / add_liquidity / swap(B→A) / swap(A→B) / remove_liquidity
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { Tangaga } from "../target/types/tangaga";
import { Faucet } from "../target/types/faucet";
import { SkinsNft } from "../target/types/skins_nft";
import { Dex } from "../target/types/dex";
import { assert } from "chai";

const METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

// ─────────────────────────────────────────────────────────
// 辅助函数：确认交易
// ─────────────────────────────────────────────────────────
async function confirmTx(
  connection: anchor.web3.Connection,
  sig: string,
): Promise<void> {
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

// ─────────────────────────────────────────────────────────
describe.only("全面综合测试 (Tangaga + Faucet + SkinsNFT + DEX)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const tangagaProgram = anchor.workspace.Tangaga as Program<Tangaga>;
  const faucetProgram = anchor.workspace.Faucet as Program<Faucet>;
  const skinsProgram = anchor.workspace.SkinsNft as Program<SkinsNft>;
  const dexProgram = anchor.workspace.Dex as Program<Dex>;
  const connection = provider.connection;

  // ── 测试人员 ────────────────────────────────────────────
  const admin = Keypair.generate(); // 管理员 / 合约 authority
  const userA = Keypair.generate(); // 普通用户 A
  const userB = Keypair.generate(); // 白名单用户 B
  const delegateUser = Keypair.generate(); // 代理用户

  // ── Tangaga 代币 ─────────────────────────────────────────
  const tangagaMint = Keypair.generate();
  let adminTangagaAta: PublicKey;
  let userATangagaAta: PublicKey;
  let userBTangagaAta: PublicKey;

  // ── Faucet PDAs ──────────────────────────────────────────
  let faucetConfigPda: PublicKey;
  let faucetVault: PublicKey;

  // ── SkinsNFT PDAs ────────────────────────────────────────
  let skinsConfigPda: PublicKey;
  let skinsTreasuryPda: PublicKey;
  const publicNftMint = Keypair.generate(); // 公共铸造 NFT Mint
  const whitelistNftMint = Keypair.generate(); // 白名单铸造 NFT Mint

  // ── DEX ─────────────────────────────────────────────────
  const POOL_SEED = Buffer.from("pool");
  const wsolMint = NATIVE_MINT;
  const lpMintKeypair = Keypair.generate();
  let poolPda: PublicKey;
  let vaultA: PublicKey;
  let vaultB: PublicKey;

  // ─────────────────────────────────────────────────────────
  // 前置条件：空投 SOL，推导 PDA，计算 ATA
  // ─────────────────────────────────────────────────────────
  before(async () => {
    console.log("\n========== [前置条件] 钱包初始化 & 空投 ==========");

    // 1. 空投 SOL 给每个测试账户
    const airdrops: [string, Keypair, number][] = [
      ["admin", admin, 100 * LAMPORTS_PER_SOL],
      ["userA", userA, 20 * LAMPORTS_PER_SOL],
      ["userB", userB, 20 * LAMPORTS_PER_SOL],
      ["delegateUser", delegateUser, 5 * LAMPORTS_PER_SOL],
    ];
    for (const [label, kp, amount] of airdrops) {
      const sig = await connection.requestAirdrop(kp.publicKey, amount);
      await confirmTx(connection, sig);
      console.log(
        `  ✔ 空投: ${label} (${kp.publicKey.toBase58().slice(0, 8)}…) ← ${
          amount / LAMPORTS_PER_SOL
        } SOL`,
      );
    }

    // 2. 推导 Faucet PDA
    [faucetConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      faucetProgram.programId,
    );
    faucetVault = getAssociatedTokenAddressSync(
      tangagaMint.publicKey,
      faucetConfigPda,
      true, // allowOwnerOffCurve: PDA 作为 owner
      TOKEN_2022_PROGRAM_ID,
    );

    // 3. 推导 SkinsNFT PDA
    [skinsConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      skinsProgram.programId,
    );
    [skinsTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      skinsProgram.programId,
    );

    // 4. 计算 Tangaga ATA（Token-2022）
    adminTangagaAta = getAssociatedTokenAddressSync(
      tangagaMint.publicKey,
      admin.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    userATangagaAta = getAssociatedTokenAddressSync(
      tangagaMint.publicKey,
      userA.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    userBTangagaAta = getAssociatedTokenAddressSync(
      tangagaMint.publicKey,
      userB.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    // 5. 推导 DEX Pool PDA（需要 tangagaMint 已知）
    [poolPda] = PublicKey.findProgramAddressSync(
      [POOL_SEED, wsolMint.toBuffer(), tangagaMint.publicKey.toBuffer()],
      dexProgram.programId,
    );
    vaultA = getAssociatedTokenAddressSync(
      wsolMint,
      poolPda,
      true,
      TOKEN_PROGRAM_ID,
    );
    vaultB = getAssociatedTokenAddressSync(
      tangagaMint.publicKey,
      poolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
    );

    console.log("  前置条件准备完毕\n");
  });

  // ═══════════════════════════════════════════════════════════
  // 一、Tangaga Program 测试（Token-2022）
  // ═══════════════════════════════════════════════════════════
  describe("1. Tangaga Program (Token-2022)", () => {
    it("1.1 create_token — 创建 Tangaga Token-2022 代币", async () => {
      const tx = await tangagaProgram.methods
        .createToken("Tangaga", "$TAGA", "https://example.com/tangaga.json", 6)
        .accountsPartial({
          mint: tangagaMint.publicKey,
          authority: admin.publicKey,
          manager: admin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([tangagaMint, admin])
        .rpc();

      const mintInfo = await connection.getAccountInfo(tangagaMint.publicKey);
      assert.isNotNull(mintInfo, "Mint 账户应存在");
      assert.equal(
        mintInfo!.owner.toBase58(),
        TOKEN_2022_PROGRAM_ID.toBase58(),
        "Mint owner 应是 Token-2022 程序",
      );
      console.log(`  ✔ 代币创建成功: ${tangagaMint.publicKey.toBase58()}`);
    });

    it("1.2 mint_to_wallet — 向各用户铸造代币", async () => {
      const MINT_AMOUNT = new anchor.BN(100_000 * 10 ** 6); // 100,000 TAGA

      for (const [label, wallet, ata] of [
        ["admin", admin.publicKey, adminTangagaAta],
        ["userA", userA.publicKey, userATangagaAta],
        ["userB", userB.publicKey, userBTangagaAta],
      ] as [string, PublicKey, PublicKey][]) {
        await tangagaProgram.methods
          .mintToWallet(MINT_AMOUNT)
          .accountsPartial({
            mint: tangagaMint.publicKey,
            destinationAta: ata,
            destinationWallet: wallet,
            authority: admin.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([admin])
          .rpc();
        console.log(`  ✔ 铸造给 ${label}: 100,000 TAGA`);
      }

      const bal = await connection.getTokenAccountBalance(userATangagaAta);
      assert.equal(
        Number(bal.value.amount),
        MINT_AMOUNT.toNumber(),
        "userA 余额应为 100,000 TAGA",
      );
    });

    it("1.3 transfer_tokens — 代币转账 (userA → userB)", async () => {
      const TRANSFER_AMOUNT = new anchor.BN(1_000 * 10 ** 6); // 1,000 TAGA

      const balBefore = await connection.getTokenAccountBalance(
        userBTangagaAta,
      );

      await tangagaProgram.methods
        .transferTokens(TRANSFER_AMOUNT)
        .accountsPartial({
          mint: tangagaMint.publicKey,
          fromAta: userATangagaAta,
          toAta: userBTangagaAta,
          owner: userA.publicKey,
          toWallet: userB.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const balAfter = await connection.getTokenAccountBalance(userBTangagaAta);
      assert.equal(
        Number(balAfter.value.amount) - Number(balBefore.value.amount),
        TRANSFER_AMOUNT.toNumber(),
        "userB 应增加 1,000 TAGA",
      );
      console.log(
        `  ✔ 转账完成: userB 余额 = ${balAfter.value.uiAmountString} TAGA`,
      );
    });

    it("1.4 approve — userA 授权 delegateUser 代理转账", async () => {
      const APPROVE_AMOUNT = new anchor.BN(500 * 10 ** 6); // 500 TAGA

      await tangagaProgram.methods
        .approve(APPROVE_AMOUNT)
        .accountsPartial({
          owner: userA.publicKey,
          tokenAccount: userATangagaAta,
          delegate: delegateUser.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();

      console.log("  ✔ 授权: userA → delegateUser (额度 500 TAGA)");
    });

    it("1.5 delegate — delegateUser 代理从 userA 转账到 userB", async () => {
      const DELEGATE_AMOUNT = new anchor.BN(200 * 10 ** 6); // 200 TAGA

      const balBefore = await connection.getTokenAccountBalance(
        userBTangagaAta,
      );

      await tangagaProgram.methods
        .delegate(DELEGATE_AMOUNT, 6)
        .accountsPartial({
          delegate: delegateUser.publicKey,
          fromAta: userATangagaAta,
          toAta: userBTangagaAta,
          mint: tangagaMint.publicKey,
          toOwner: userB.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegateUser])
        .rpc();

      const balAfter = await connection.getTokenAccountBalance(userBTangagaAta);
      assert.equal(
        Number(balAfter.value.amount) - Number(balBefore.value.amount),
        DELEGATE_AMOUNT.toNumber(),
        "userB 应增加 200 TAGA（代理转账）",
      );
      console.log(
        `  ✔ 代理转账完成: userB 余额 = ${balAfter.value.uiAmountString} TAGA`,
      );
    });

    it("1.6 revoke — userA 撤销 delegateUser 的授权", async () => {
      await tangagaProgram.methods
        .revoke()
        .accountsPartial({
          owner: userA.publicKey,
          tokenAccount: userATangagaAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();

      console.log("  ✔ 授权已撤销");
    });

    it("1.7 burn — userA 销毁部分代币", async () => {
      const BURN_AMOUNT = new anchor.BN(500 * 10 ** 6); // 500 TAGA

      const balBefore = await connection.getTokenAccountBalance(
        userATangagaAta,
      );

      await tangagaProgram.methods
        .burn(BURN_AMOUNT)
        .accountsPartial({
          mint: tangagaMint.publicKey,
          fromAta: userATangagaAta,
          owner: userA.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();

      const balAfter = await connection.getTokenAccountBalance(userATangagaAta);
      assert.equal(
        Number(balBefore.value.amount) - Number(balAfter.value.amount),
        BURN_AMOUNT.toNumber(),
        "userA 应减少 500 TAGA（销毁）",
      );
      console.log(
        `  ✔ 销毁完成: userA 余额 = ${balAfter.value.uiAmountString} TAGA`,
      );
    });

    it("1.8 close_account — 关闭清空后的 delegateUser ATA 并回收租金", async () => {
      const delegateAta = getAssociatedTokenAddressSync(
        tangagaMint.publicKey,
        delegateUser.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // 先铸造 1 个最小单位，再销毁，使余额归零，再关闭账户
      await tangagaProgram.methods
        .mintToWallet(new anchor.BN(1))
        .accountsPartial({
          mint: tangagaMint.publicKey,
          destinationAta: delegateAta,
          destinationWallet: delegateUser.publicKey,
          authority: admin.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      await tangagaProgram.methods
        .burn(new anchor.BN(1))
        .accountsPartial({
          mint: tangagaMint.publicKey,
          fromAta: delegateAta,
          owner: delegateUser.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([delegateUser])
        .rpc();

      await tangagaProgram.methods
        .closeAccount()
        .accountsPartial({
          owner: delegateUser.publicKey,
          tokenAccount: delegateAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([delegateUser])
        .rpc();

      const ataInfo = await connection.getAccountInfo(delegateAta);
      assert.isNull(ataInfo, "ATA 关闭后应不存在");
      console.log("  ✔ delegateUser ATA 已关闭，租金已退还");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 二、Faucet Program 测试
  // ═══════════════════════════════════════════════════════════
  describe("2. Faucet Program", () => {
    it("2.1 initialize — 初始化水龙头", async () => {
      const AMOUNT_PER_CLAIM = new anchor.BN(500 * 10 ** 6); // 500 TAGA
      const COOLDOWN_SEC = new anchor.BN(1); // 1 秒（便于测试）

      await faucetProgram.methods
        .initialize(AMOUNT_PER_CLAIM, COOLDOWN_SEC)
        .accountsPartial({
          config: faucetConfigPda,
          vault: faucetVault,
          mint: tangagaMint.publicKey,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      const cfg = await faucetProgram.account.config.fetch(faucetConfigPda);
      assert.equal(
        cfg.admin.toBase58(),
        admin.publicKey.toBase58(),
        "admin 应匹配",
      );
      assert.equal(
        Number(cfg.amountPerClaim),
        AMOUNT_PER_CLAIM.toNumber(),
        "每次领取量应匹配",
      );
      console.log("  ✔ 水龙头初始化成功");
    });

    it("2.2 deposits_tokens — 管理员向金库存入代币", async () => {
      const DEPOSIT = new anchor.BN(50_000 * 10 ** 6); // 50,000 TAGA

      await faucetProgram.methods
        .depositsTokens(DEPOSIT)
        .accountsPartial({
          config: faucetConfigPda,
          vault: faucetVault,
          adminTokenAccount: adminTangagaAta,
          admin: admin.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const vaultBal = await connection.getTokenAccountBalance(faucetVault);
      assert.equal(
        Number(vaultBal.value.amount),
        DEPOSIT.toNumber(),
        "金库余额应等于存入量",
      );
      console.log(
        `  ✔ 存入完成: 金库余额 = ${vaultBal.value.uiAmountString} TAGA`,
      );
    });

    it("2.3 claim_tokens — userA 首次领取代币", async () => {
      const [claimRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("claim_record"), userA.publicKey.toBuffer()],
        faucetProgram.programId,
      );

      const balBefore = await connection.getTokenAccountBalance(
        userATangagaAta,
      );

      await faucetProgram.methods
        .claimTokens()
        .accountsPartial({
          config: faucetConfigPda,
          mint: tangagaMint.publicKey,
          claimRecord: claimRecordPda,
          vault: faucetVault,
          userTokenAccount: userATangagaAta,
          user: userA.publicKey,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const balAfter = await connection.getTokenAccountBalance(userATangagaAta);
      const claimed =
        Number(balAfter.value.amount) - Number(balBefore.value.amount);
      // 每次领取量为 500 TAGA（初始化时设置）
      assert.isTrue(claimed > 0, "userA 应领取到代币");
      console.log(`  ✔ userA 领取成功: +${claimed / 10 ** 6} TAGA`);
    });

    it("2.4 update_config — 管理员更新水龙头配置", async () => {
      const NEW_AMOUNT = new anchor.BN(1_000 * 10 ** 6); // 1,000 TAGA
      const NEW_COOLDOWN = new anchor.BN(2); // 2 秒

      await faucetProgram.methods
        .updateConfig(NEW_AMOUNT, NEW_COOLDOWN)
        .accountsPartial({
          config: faucetConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const cfg = await faucetProgram.account.config.fetch(faucetConfigPda);
      assert.equal(
        Number(cfg.amountPerClaim),
        NEW_AMOUNT.toNumber(),
        "每次领取量应更新",
      );
      assert.equal(
        Number(cfg.cooldownSeconds),
        NEW_COOLDOWN.toNumber(),
        "冷却时间应更新",
      );
      console.log("  ✔ 配置更新: amount=1,000 TAGA, cooldown=2s");
    });

    it("2.5 withdraw_tokens — 管理员提取部分代币", async () => {
      const WITHDRAW = new anchor.BN(10_000 * 10 ** 6); // 10,000 TAGA

      const balBefore = await connection.getTokenAccountBalance(
        adminTangagaAta,
      );

      await faucetProgram.methods
        .withdrawTokens(WITHDRAW)
        .accountsPartial({
          config: faucetConfigPda,
          vault: faucetVault,
          adminTokenAccount: adminTangagaAta,
          admin: admin.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const balAfter = await connection.getTokenAccountBalance(adminTangagaAta);
      assert.equal(
        Number(balAfter.value.amount) - Number(balBefore.value.amount),
        WITHDRAW.toNumber(),
        "管理员应收到 10,000 TAGA",
      );
      console.log(
        `  ✔ 提取完成: 管理员余额 = ${balAfter.value.uiAmountString} TAGA`,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 三、SkinsNFT Program 测试
  // ═══════════════════════════════════════════════════════════
  describe("3. SkinsNFT Program", () => {
    const MINT_PRICE = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL

    // 辅助：计算 Metaplex metadata PDA
    function metadataPda(mint: PublicKey): PublicKey {
      return PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID,
      )[0];
    }

    function masterEditionPda(mint: PublicKey): PublicKey {
      return PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
          Buffer.from("edition"),
        ],
        METADATA_PROGRAM_ID,
      )[0];
    }

    it("3.1 initialize — 初始化（公共铸造模式）", async () => {
      await skinsProgram.methods
        .initialize({
          whitelistEnabled: false,
          mintPrice: new anchor.BN(MINT_PRICE),
          maxSupply: new anchor.BN(1000),
          maxMintPerAddress: new anchor.BN(10),
        })
        .accountsPartial({
          authority: admin.publicKey,
          config: skinsConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const cfg = await skinsProgram.account.config.fetch(skinsConfigPda);
      assert.equal(cfg.authority.toBase58(), admin.publicKey.toBase58());
      assert.equal(cfg.whitelistEnabled, false, "应为公共铸造模式");
      console.log("  ✔ SkinsNFT 初始化（公共铸造）");
    });

    it("3.2 mint_nft_public — userA 公共铸造 NFT", async () => {
      const [userMintRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_mint_record"), userA.publicKey.toBuffer()],
        skinsProgram.programId,
      );
      const nftAta = getAssociatedTokenAddressSync(
        publicNftMint.publicKey,
        userA.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );

      await skinsProgram.methods
        .mintNftPublic("Skins #001", "SKIN", "https://example.com/nft/001.json")
        .accountsPartial({
          user: userA.publicKey,
          config: skinsConfigPda,
          mint: publicNftMint.publicKey,
          userMintRecord: userMintRecord,
          treasury: skinsTreasuryPda,
          tokenAccount: nftAta,
          metadataAccount: metadataPda(publicNftMint.publicKey),
          masterEditionAccount: masterEditionPda(publicNftMint.publicKey),
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .signers([userA, publicNftMint])
        .rpc();

      const bal = await connection.getTokenAccountBalance(nftAta);
      assert.equal(bal.value.amount, "1", "userA 应持有 1 个 NFT");
      console.log(
        `  ✔ 公共 NFT 铸造: ${publicNftMint.publicKey.toBase58().slice(0, 8)}…`,
      );
    });

    it("3.3 initialize — 重新初始化（开启白名单模式）", async () => {
      await skinsProgram.methods
        .initialize({
          whitelistEnabled: true,
          mintPrice: new anchor.BN(MINT_PRICE),
          maxSupply: new anchor.BN(1000),
          maxMintPerAddress: new anchor.BN(10),
        })
        .accountsPartial({
          authority: admin.publicKey,
          config: skinsConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const cfg = await skinsProgram.account.config.fetch(skinsConfigPda);
      assert.equal(cfg.whitelistEnabled, true, "应已开启白名单");
      console.log("  ✔ SkinsNFT 重新初始化（白名单模式）");
    });

    it("3.4 add_whitelist — 将 userB 加入白名单（可铸造 3 次）", async () => {
      const [whitelistEntry] = PublicKey.findProgramAddressSync(
        [Buffer.from("whitelist_entry"), userB.publicKey.toBuffer()],
        skinsProgram.programId,
      );

      await skinsProgram.methods
        .addWhitelist({ mintAmount: new anchor.BN(3) })
        .accountsPartial({
          authority: admin.publicKey,
          config: skinsConfigPda,
          user: userB.publicKey,
          whitelistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const entry = await skinsProgram.account.whitelistEntry.fetch(
        whitelistEntry,
      );
      assert.equal(Number(entry.remainingMints), 3);
      console.log("  ✔ userB 加入白名单，剩余铸造次数: 3");
    });

    it("3.5 mint_nft_whitelist — userB 白名单铸造 NFT", async () => {
      const [userMintRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_mint_record"), userB.publicKey.toBuffer()],
        skinsProgram.programId,
      );
      const [whitelistEntry] = PublicKey.findProgramAddressSync(
        [Buffer.from("whitelist_entry"), userB.publicKey.toBuffer()],
        skinsProgram.programId,
      );
      const nftAta = getAssociatedTokenAddressSync(
        whitelistNftMint.publicKey,
        userB.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );

      await skinsProgram.methods
        .mintNftWhitelist(
          "Skins WL #001",
          "SKINWL",
          "https://example.com/nft/wl-001.json",
        )
        .accountsPartial({
          user: userB.publicKey,
          config: skinsConfigPda,
          mint: whitelistNftMint.publicKey,
          userMintRecord,
          whitelistEntry,
          treasury: skinsTreasuryPda,
          tokenAccount: nftAta,
          metadataAccount: metadataPda(whitelistNftMint.publicKey),
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .signers([userB, whitelistNftMint])
        .rpc();

      const bal = await connection.getTokenAccountBalance(nftAta);
      assert.equal(bal.value.amount, "1", "userB 应持有 1 个白名单 NFT");
      console.log(
        `  ✔ 白名单 NFT 铸造: ${whitelistNftMint.publicKey
          .toBase58()
          .slice(0, 8)}…`,
      );
    });

    it("3.6 freeze_nft — 冻结白名单 NFT（config 为 freeze_authority）", async () => {
      const nftAta = getAssociatedTokenAddressSync(
        whitelistNftMint.publicKey,
        userB.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );

      await skinsProgram.methods
        .freezeNft()
        .accountsPartial({
          manager: admin.publicKey,
          mint: whitelistNftMint.publicKey,
          config: skinsConfigPda,
          tokenAccount: nftAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      console.log("  ✔ NFT 已冻结");
    });

    it("3.7 thaw_nft — 解冻白名单 NFT", async () => {
      const nftAta = getAssociatedTokenAddressSync(
        whitelistNftMint.publicKey,
        userB.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );

      await skinsProgram.methods
        .thawNft()
        .accountsPartial({
          manager: admin.publicKey,
          config: skinsConfigPda,
          mint: whitelistNftMint.publicKey,
          tokenAccount: nftAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      console.log("  ✔ NFT 已解冻");
    });

    it("3.8 trans_update_auth — 转移元数据更新权限 (userB → admin)", async () => {
      await skinsProgram.methods
        .transUpdateAuth()
        .accountsPartial({
          currentAuthrity: userB.publicKey,
          metadataAccount: metadataPda(whitelistNftMint.publicKey),
          newAuth: admin.publicKey,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .signers([userB])
        .rpc();

      console.log("  ✔ 元数据更新权限已转移给 admin");
    });

    it("3.9 revoke_freeze_auth — 撤销 config 的冻结权限", async () => {
      await skinsProgram.methods
        .revokeFreezeAuth()
        .accountsPartial({
          manager: admin.publicKey,
          mint: whitelistNftMint.publicKey,
          config: skinsConfigPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      console.log("  ✔ 冻结权限已撤销");
    });

    it("3.10 trans_nft — 转移 NFT (userB → userA)", async () => {
      const fromAta = getAssociatedTokenAddressSync(
        whitelistNftMint.publicKey,
        userB.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      const toAta = getAssociatedTokenAddressSync(
        whitelistNftMint.publicKey,
        userA.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );

      await skinsProgram.methods
        .transNft()
        .accountsPartial({
          owner: userB.publicKey,
          mint: whitelistNftMint.publicKey,
          fromAta,
          reviver: userA.publicKey,
          toAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      const bal = await connection.getTokenAccountBalance(toAta);
      assert.equal(bal.value.amount, "1", "userA 应接收到 NFT");
      console.log("  ✔ NFT 转移成功: userB → userA");
    });

    it("3.11 withdraw — 从 treasury 提取 SOL 到管理员", async () => {
      const treasuryBal = await connection.getBalance(skinsTreasuryPda);
      const WITHDRAW = Math.floor(treasuryBal / 2); // 提取一半

      if (WITHDRAW > 0) {
        const balBefore = await connection.getBalance(admin.publicKey);

        await skinsProgram.methods
          .withdraw(new anchor.BN(WITHDRAW))
          .accountsPartial({
            authority: admin.publicKey,
            config: skinsConfigPda,
            treasury: skinsTreasuryPda,
            recipient: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        const balAfter = await connection.getBalance(admin.publicKey);
        assert.isTrue(balAfter > balBefore, "admin SOL 余额应增加");
        console.log(`  ✔ treasury 提取 ${WITHDRAW / LAMPORTS_PER_SOL} SOL`);
      } else {
        console.log("  ⚠ treasury 余额为 0，跳过提取测试");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 四、DEX Program 测试（WSOL <> Tangaga）
  // ═══════════════════════════════════════════════════════════
  describe("4. DEX Program (WSOL ↔ Tangaga)", () => {
    before(async () => {
      // userA 包装 WSOL（需要先有 WSOL ATA 才能创建流动性）
      const userWsolAta = getAssociatedTokenAddressSync(
        wsolMint,
        userA.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      const wrapTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          userA.publicKey,
          userWsolAta,
          userA.publicKey,
          wsolMint,
          TOKEN_PROGRAM_ID,
        ),
        SystemProgram.transfer({
          fromPubkey: userA.publicKey,
          toPubkey: userWsolAta,
          lamports: 10 * LAMPORTS_PER_SOL,
        }),
        createSyncNativeInstruction(userWsolAta),
      );
      await provider.sendAndConfirm(wrapTx, [userA]);
      console.log("  userA 已包装 10 WSOL");
    });

    it("4.1 create_pool — 创建 WSOL/Tangaga 流动性池", async () => {
      await dexProgram.methods
        .createPool()
        .accountsPartial({
          authority: admin.publicKey,
          lpMint: lpMintKeypair.publicKey,
          tokenAMint: wsolMint,
          tokenBMint: tangagaMint.publicKey,
          vaultA,
          vaultB,
          pool: poolPda,
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_2022_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([admin, lpMintKeypair])
        .rpc();

      const pool = await dexProgram.account.pool.fetch(poolPda);
      assert.equal(
        pool.tokenMintA.toBase58(),
        wsolMint.toBase58(),
        "Token A 应为 WSOL",
      );
      assert.equal(
        pool.tokenMintB.toBase58(),
        tangagaMint.publicKey.toBase58(),
        "Token B 应为 Tangaga",
      );
      console.log(`  ✔ 流动性池已创建: ${poolPda.toBase58().slice(0, 8)}…`);
    });

    it("4.2 add_liquidity — userA 添加初始流动性 (2 WSOL + 200 TAGA)", async () => {
      const userWsolAta = getAssociatedTokenAddressSync(
        wsolMint,
        userA.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      const userLpAta = getAssociatedTokenAddressSync(
        lpMintKeypair.publicKey,
        userA.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const AMOUNT_A = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 WSOL
      const AMOUNT_B = new anchor.BN(200 * 10 ** 6); // 200 TAGA

      await dexProgram.methods
        .addLiquidity(AMOUNT_A, AMOUNT_B, new anchor.BN(0))
        .accountsPartial({
          user: userA.publicKey,
          pool: poolPda,
          lpMint: lpMintKeypair.publicKey,
          mintA: wsolMint,
          mintB: tangagaMint.publicKey,
          vaultA,
          vaultB,
          userTokenA: userWsolAta,
          userTokenB: userATangagaAta,
          userLpToken: userLpAta,
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_2022_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const lpBal = await connection.getTokenAccountBalance(userLpAta);
      assert.isTrue(Number(lpBal.value.amount) > 0, "userA 应获得 LP Token");
      console.log(`  ✔ 流动性添加成功，userA LP 余额: ${lpBal.value.amount}`);
    });

    it("4.3 swap — userB 用 Tangaga 兑换 WSOL (B→A)", async () => {
      const userBWsolAta = getAssociatedTokenAddressSync(
        wsolMint,
        userB.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );

      // 创建 userB 的 WSOL ATA（接收输出）
      try {
        const createAtaTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            userB.publicKey,
            userBWsolAta,
            userB.publicKey,
            wsolMint,
            TOKEN_PROGRAM_ID,
          ),
        );
        await provider.sendAndConfirm(createAtaTx, [userB]);
      } catch (_) {
        /* ATA 已存在 */
      }

      const SWAP_AMOUNT = new anchor.BN(50 * 10 ** 6); // 50 TAGA

      await dexProgram.methods
        .swap(SWAP_AMOUNT, new anchor.BN(0), false) // false = B→A
        .accountsPartial({
          user: userB.publicKey,
          pool: poolPda,
          mintA: wsolMint,
          mintB: tangagaMint.publicKey,
          vaultA,
          vaultB,
          userInput: userBTangagaAta, // 输入: Tangaga
          userPut: userBWsolAta, // 输出: WSOL
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_2022_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userB])
        .rpc();

      const wsolBal = await connection.getTokenAccountBalance(userBWsolAta);
      assert.isTrue(Number(wsolBal.value.amount) > 0, "userB 应获得 WSOL");
      console.log(
        `  ✔ Tangaga→WSOL 成功，userB WSOL = ${
          Number(wsolBal.value.amount) / LAMPORTS_PER_SOL
        } SOL`,
      );
    });

    it("4.4 swap — userA 用 WSOL 兑换 Tangaga (A→B)", async () => {
      const userWsolAta = getAssociatedTokenAddressSync(
        wsolMint,
        userA.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      const SWAP_AMOUNT = new anchor.BN(LAMPORTS_PER_SOL / 2); // 0.5 WSOL

      const tangagaBefore = await connection.getTokenAccountBalance(
        userATangagaAta,
      );

      await dexProgram.methods
        .swap(SWAP_AMOUNT, new anchor.BN(0), true) // true = A→B
        .accountsPartial({
          user: userA.publicKey,
          pool: poolPda,
          mintA: wsolMint,
          mintB: tangagaMint.publicKey,
          vaultA,
          vaultB,
          userInput: userWsolAta, // 输入: WSOL
          userPut: userATangagaAta, // 输出: Tangaga
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_2022_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();

      const tangagaAfter = await connection.getTokenAccountBalance(
        userATangagaAta,
      );
      assert.isTrue(
        Number(tangagaAfter.value.amount) > Number(tangagaBefore.value.amount),
        "userA Tangaga 余额应增加",
      );
      console.log(
        `  ✔ WSOL→Tangaga 成功，userA Tangaga = ${tangagaAfter.value.uiAmountString} TAGA`,
      );
    });

    it("4.5 remove_liquidity — userA 移除全部流动性，取回 WSOL + Tangaga", async () => {
      const userWsolAta = getAssociatedTokenAddressSync(
        wsolMint,
        userA.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      const userLpAta = getAssociatedTokenAddressSync(
        lpMintKeypair.publicKey,
        userA.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // 查询当前持有的 LP 数量，全部移除
      const lpBal = await connection.getTokenAccountBalance(userLpAta);
      const LP_AMOUNT = new anchor.BN(lpBal.value.amount);
      assert.isTrue(LP_AMOUNT.gtn(0), "userA 应持有 LP Token 才能移除流动性");

      const wsolBefore = await connection.getTokenAccountBalance(userWsolAta);
      const tangagaBefore = await connection.getTokenAccountBalance(
        userATangagaAta,
      );

      await dexProgram.methods
        .removeLiquidity(
          LP_AMOUNT,
          new anchor.BN(0), // min_a: 滑点保护设为 0（测试环境）
          new anchor.BN(0), // min_b: 滑点保护设为 0（测试环境）
        )
        .accountsPartial({
          user: userA.publicKey,
          pool: poolPda,
          vaultA,
          vaultB,
          mintA: wsolMint,
          mintB: tangagaMint.publicKey,
          lpMint: lpMintKeypair.publicKey,
          userTokenA: userWsolAta,
          userTokenB: userATangagaAta,
          userLpToken: userLpAta,
          tokenProgramA: TOKEN_PROGRAM_ID,
          tokenProgramB: TOKEN_2022_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();

      const wsolAfter = await connection.getTokenAccountBalance(userWsolAta);
      const tangagaAfter2 = await connection.getTokenAccountBalance(
        userATangagaAta,
      );

      assert.isTrue(
        Number(wsolAfter.value.amount) > Number(wsolBefore.value.amount),
        "userA WSOL 余额应增加（取回 Token A）",
      );
      assert.isTrue(
        Number(tangagaAfter2.value.amount) > Number(tangagaBefore.value.amount),
        "userA Tangaga 余额应增加（取回 Token B）",
      );

      // 验证 LP 余额已清零
      const lpBalAfter = await connection.getTokenAccountBalance(userLpAta);
      assert.equal(lpBalAfter.value.amount, "0", "移除流动性后 LP 余额应为 0");

      console.log(
        `  ✔ 移除流动性成功: WSOL +${
          (Number(wsolAfter.value.amount) - Number(wsolBefore.value.amount)) /
          LAMPORTS_PER_SOL
        } SOL` +
          ` | Tangaga +${
            (Number(tangagaAfter2.value.amount) -
              Number(tangagaBefore.value.amount)) /
            10 ** 6
          } TAGA`,
      );
    });
  });
});
