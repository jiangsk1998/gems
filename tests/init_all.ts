import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getAssociatedTokenAddress,
  mintTo,
} from "@solana/spl-token";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

// 使用已有的 skins_nft program idl
import { SkinsNft } from "../target/types/skins_nft";

// 加载 faucet idl 动态
// eslint-disable-next-line @typescript-eslint/no-var-requires
const faucetIdl = require("../target/idl/faucet.json");

describe.only("init all: token + skins_nft + faucet", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const skinsProgram = anchor.workspace.skinsNft as Program<SkinsNft>;
  const connection = provider.connection;

  // 管理员公钥（仅作为展示/比较），测试中使用 manager 作为签名者
  const ADMIN_PUBKEY = new PublicKey(
    "G1kT8PD2BVRRGBKrHk329f3aQfSaDjqnTaSMrQNAH4ws",
  );

  it("create mint and initialize both programs", async () => {
    // 创建 manager 密钥对并空投
    const manager = Keypair.generate();
    const sig1 = await connection.requestAirdrop(
      manager.publicKey,
      anchor.web3.LAMPORTS_PER_SOL * 10,
    );
    const bh1 = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sig1, ...bh1 },
      "confirmed",
    );

    // 使用 manager 创建一个新的 SPL Mint（6 decimals）
    const mint = await createMint(
      connection,
      manager,
      manager.publicKey,
      null,
      6,
    );
    console.log("mint created:", mint.toBase58());

    // 确保 provider（测试运行器）有足够 SOL 用于后续交易
    const sigProviderAirdrop = await connection.requestAirdrop(
      provider.wallet.publicKey,
      anchor.web3.LAMPORTS_PER_SOL * 2,
    );
    const bhProvider = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sigProviderAirdrop, ...bhProvider },
      "confirmed",
    );

    // 初始化 skins_nft 合约（使用 manager 作为 authority）
    const [configPDA] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("config")],
      skinsProgram.programId,
    );

    const tx1 = await skinsProgram.methods
      .initialize({
        whitelistEnabled: false,
        mintPrice: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL / 10),
        maxSupply: new anchor.BN(1000),
        maxMintPerAddress: new anchor.BN(10),
      })
      .accountsPartial({
        authority: provider.wallet.publicKey,
        config: configPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("skins_nft initialized:", tx1);

    // 使用 anchor.workspace 中的 faucet program（需在 Anchor.toml 注册）
    // @ts-ignore
    const faucetProgram = anchor.workspace.faucet as Program<any>;

    // 计算 faucet config PDA
    const [faucetConfigPda] = await PublicKey.findProgramAddress(
      [Buffer.from("config")],
      faucetProgram.programId,
    );

    // 调用 initialize（faucet 指令会创建 vault ATA）
    const tx2 = await faucetProgram.methods
      .initialize(new anchor.BN(1000000), new anchor.BN(3600)) // amount_per_claim, cooldown_seconds
      .accountsPartial({
        config: faucetConfigPda,
        mint: mint,
        admin: manager.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([manager])
      .rpc();
    console.log("faucet initialized:", tx2);

    // faucet initialize 会创建 vault ATA，获取 vault ATA 并 mint 一些代币到 vault
    const vaultAta = await getAssociatedTokenAddress(
      mint,
      faucetConfigPda,
      true,
    );
    // mint 100 tokens (raw: 100 * 10^6)
    await mintTo(connection, manager, mint, vaultAta, manager, 100 * 10 ** 6);
    console.log("minted to vault:", vaultAta.toBase58());

    // ---- 测试：普通用户从 faucet 领取代币 ----
    const TOKEN_PROGRAM_ID = anchor.utils.token.TOKEN_PROGRAM_ID;
    const ASSOCIATED_TOKEN_PROGRAM_ID =
      anchor.utils.token.ASSOCIATED_PROGRAM_ID;

    const user = Keypair.generate();
    // airdrop 给用户一些 SOL 以支付交易费用并作为 payer（claim 会 init_if_needed claim_record）
    const sigUser = await connection.requestAirdrop(
      user.publicKey,
      anchor.web3.LAMPORTS_PER_SOL,
    );
    const bh2 = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sigUser, ...bh2 },
      "confirmed",
    );

    // 计算 claim_record PDA
    const [claimRecordPda] = await PublicKey.findProgramAddress(
      [Buffer.from("claim_record"), user.publicKey.toBuffer()],
      faucetProgram.programId,
    );

    const userAta = await getAssociatedTokenAddress(mint, user.publicKey);

    // 用户调用 claimTokens
    const txClaim = await faucetProgram.methods
      .claimTokens()
      .accountsPartial({
        config: faucetConfigPda,
        mint: mint,
        claimRecord: claimRecordPda,
        vault: vaultAta,
        userTokenAccount: userAta,
        user: user.publicKey,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    console.log("user claimed from faucet:", txClaim);

    // 查询用户 token 余额
    const userBal = await connection
      .getTokenAccountBalance(userAta)
      .catch(() => null);
    console.log(
      "user token balance after claim:",
      userBal?.value?.uiAmountString ?? "0",
    );

    // ---- 测试：把该用户加入 skins_nft 白名单并铸造 NFT ----
    // 预计算 skins_nft 相关 PDA
    const [skinsConfigPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("config")],
      skinsProgram.programId,
    );
    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      skinsProgram.programId,
    );

    // 确保 manager 有足够资金（前面已空投）
    // 添加白名单（mintAmount: 1）
    const [whitelistEntryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("whitelist_entry"), user.publicKey.toBuffer()],
      skinsProgram.programId,
    );

    const txAdd = await skinsProgram.methods
      .addWhitelist({ mintAmount: new anchor.BN(1) })
      .accountsPartial({
        authority: manager.publicKey,
        config: skinsConfigPda,
        user: user.publicKey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([manager])
      .rpc();
    console.log("added user to whitelist:", txAdd);

    // 重新初始化合约，开启白名单（因为之前初始化为 false）
    const txReinit = await skinsProgram.methods
      .initialize({
        whitelistEnabled: true,
        mintPrice: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL / 10),
        maxSupply: new anchor.BN(1000),
        maxMintPerAddress: new anchor.BN(10),
      })
      .accountsPartial({
        authority: provider.wallet.publicKey,
        config: skinsConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("skins_nft reinitialized (whitelist enabled):", txReinit);

    // 创建一个新的 NFT mint 并进行白名单铸造
    const nftMint = Keypair.generate();
    // 给 NFT mint keypair 空投少量 SOL，以便作为 signer 创建/支付账号时使用
    const sigNftAirdrop = await connection.requestAirdrop(
      nftMint.publicKey,
      anchor.web3.LAMPORTS_PER_SOL,
    );
    const bhNft = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sigNftAirdrop, ...bhNft },
      "confirmed",
    );
    const [userMintRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("user_mint_record"), user.publicKey.toBuffer()],
      skinsProgram.programId,
    );

    const metadataProgramId = new anchor.web3.PublicKey(
      MPL_TOKEN_METADATA_PROGRAM_ID,
    );
    const [metadataPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        metadataProgramId.toBuffer(),
        nftMint.publicKey.toBuffer(),
      ],
      metadataProgramId,
    );

    const userNftAta = await getAssociatedTokenAddress(
      nftMint.publicKey,
      user.publicKey,
    );

    const txMint = await skinsProgram.methods
      .mintNftWhitelist("Test NFT", "TNFT", "https://example.com/nft.json")
      .accountsPartial({
        user: user.publicKey,
        config: skinsConfigPda,
        mint: nftMint.publicKey,
        userMintRecord: userMintRecordPda,
        whitelistEntry: whitelistEntryPda,
        treasury: treasuryPda,
        tokenAccount: userNftAta,
        metadataAccount: metadataPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: metadataProgramId,
      })
      .signers([user, nftMint])
      .rpc();
    console.log("whitelist mint tx:", txMint);

    // 查询用户 NFT ATA
    const nftBal = await connection
      .getTokenAccountBalance(userNftAta)
      .catch(() => null);
    console.log(
      "user NFT balance after whitelist mint:",
      nftBal?.value?.uiAmountString ?? "0",
    );
  });
});
