import { Faucet } from "./../target/types/faucet";
import { Tangaga } from "./../target/types/tangaga";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";
import * as dotenv from "dotenv";

// 使用已有的 skins_nft program idl
import { SkinsNft } from "../target/types/skins_nft";

// 加载 faucet idl 动态
// eslint-disable-next-line @typescript-eslint/no-var-requires
const faucetIdl = require("../target/idl/faucet.json");

dotenv.config(); // 必须在最前面

describe.only("init all: token + skins_nft + faucet", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const skinsProgram = anchor.workspace.skinsNft as Program<SkinsNft>;
  const tangagaProgram = anchor.workspace.Tangaga as Program<Tangaga>;
  const faucetProgram = anchor.workspace.Faucet as Program<Faucet>;
  const connection = provider.connection;

  // 2. 从环境变量读取并生成 Keypair
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    throw new Error("环境变量 ADMIN_PRIVATE_KEY 未设置！");
  }

  const adminKeypair = anchor.web3.Keypair.fromSecretKey(
    bs58.decode(adminPrivateKey),
  );

  const default_wallet = provider.wallet as any;
  console.log("默认钱包地址:", default_wallet.publicKey.toBase58());

  const tangaga_mint = anchor.web3.Keypair.generate();

  it("init all", async () => {
    const airdropSig = await provider.connection.requestAirdrop(
      adminKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(airdropSig);

    //1.创建代币并将铸币权移交给管理员

    const tangaga_tx = await tangagaProgram.methods
      .createToken("Tangaga", "$TAGA", "https://example.com/token.json", 6)
      .accountsPartial({
        mint: tangaga_mint.publicKey, // 由合约内创建，所以传默认值
        authority: default_wallet.publicKey, // 由合约内创建，所以传默认值
        manager: adminKeypair.publicKey, // 传管理员公钥
      })
      .signers([tangaga_mint, adminKeypair]) // mint 需要作为 signer，管理员也需要签名以接收权限
      .rpc();
    console.log("Create Token 交易:", tangaga_tx);
    // 查询 mint 账户信息，验证 mint 存在且 owner 是 tangaga 程序
    const mintInfo = await connection.getAccountInfo(tangaga_mint.publicKey);
    console.log("查询 mint 账户信息:", mintInfo);
    if (mintInfo) {
      console.log("Mint 账户存在,owner:", mintInfo.owner.toBase58());
    } else {
      console.error("Mint 账户不存在");
    }

    const configAddress = (
      await PublicKey.findProgramAddress(
        [Buffer.from("config")],
        faucetProgram.programId,
      )
    )[0];

    const vaultAddress = getAssociatedTokenAddressSync(
      tangaga_mint.publicKey,
      configAddress,
      true, // allowOwnerOffCurve: 因为 authority 是 PDA
      TOKEN_2022_PROGRAM_ID, // 必须指定是 Token-2022
    );

    //2.初始化 faucet 合约，设置管理员，预先铸币到 vault
    const faucetInitializeTx = await faucetProgram.methods
      .initialize(new anchor.BN(1000000), new anchor.BN(3600)) // amount_per_claim, cooldown_seconds
      .accountsPartial({
        config: configAddress,
        mint: tangaga_mint.publicKey,
        admin: adminKeypair.publicKey,
        vault: vaultAddress,
        // systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();

    console.log("Faucet 初始化交易:", faucetInitializeTx);
  });
});

//3..初始化 skins_nft 合约，设置管理员，并将管理员加入白名单

//4.测试用户从 faucet 领取代币，并使用该代币铸造 NFT

// it("init all", async () => {

// it("create mint and initialize both programs", async () => {
//   // 创建 manager 密钥对并空投
//   const manager = Keypair.generate();
//   const sig1 = await connection.requestAirdrop(
//     manager.publicKey,
//     anchor.web3.LAMPORTS_PER_SOL * 10,
//   );
//   const bh1 = await connection.getLatestBlockhash();

//   // tangaga 程序（用于创建 Token-2022 mint 并铸币）
//   // @ts-ignore
//   const tangagaProgram = anchor.workspace.tangaga as Program<any>;
//   const TOKEN_2022_PROGRAM_ID = new PublicKey(
//     "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
//   );
//   const TOKEN_PROGRAM_ID = anchor.utils.token.TOKEN_PROGRAM_ID;
//   const ASSOCIATED_TOKEN_PROGRAM_ID =
//     anchor.utils.token.ASSOCIATED_PROGRAM_ID;
//   await connection.confirmTransaction(
//     { signature: sig1, ...bh1 },
//     "confirmed",
//   );

//   // 使用 `tangaga` 合约创建一个 Token-2022 mint（6 decimals）
//   const mintKeypair = Keypair.generate();
//   const mint = mintKeypair.publicKey;
//   const txCreate = await tangagaProgram.methods
//     .createToken("TestToken", "TTKN", "https://example.com/token.json", 6)
//     .accountsPartial({
//       mint: mint,
//       authority: manager.publicKey,
//       systemProgram: anchor.web3.SystemProgram.programId,
//       tokenProgram: TOKEN_2022_PROGRAM_ID,
//     })
//     .signers([mintKeypair, manager])
//     .rpc();
//   console.log("已使用 tangaga 创建 mint:", mint.toBase58(), txCreate);

//   // 确保 provider（测试运行器）有足够 SOL 用于后续交易
//   const sigProviderAirdrop = await connection.requestAirdrop(
//     provider.wallet.publicKey,
//     anchor.web3.LAMPORTS_PER_SOL * 2,
//   );
//   const bhProvider = await connection.getLatestBlockhash();
//   await connection.confirmTransaction(
//     { signature: sigProviderAirdrop, ...bhProvider },
//     "confirmed",
//   );

//   // 初始化 skins_nft 合约（使用 manager 作为 authority）
//   const [configPDA] = await anchor.web3.PublicKey.findProgramAddress(
//     [Buffer.from("config")],
//     skinsProgram.programId,
//   );

//   const tx1 = await skinsProgram.methods
//     .initialize({
//       whitelistEnabled: false,
//       mintPrice: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL / 10),
//       maxSupply: new anchor.BN(1000),
//       maxMintPerAddress: new anchor.BN(10),
//     })
//     .accountsPartial({
//       authority: provider.wallet.publicKey,
//       config: configPDA,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .rpc();
//   console.log("skins_nft 已初始化:", tx1);

//   // 使用 anchor.workspace 中的 faucet program（需在 Anchor.toml 注册）
//   // @ts-ignore
//   const faucetProgram = anchor.workspace.faucet as Program<any>;

//   // 计算 faucet config PDA
//   const [faucetConfigPda] = await PublicKey.findProgramAddress(
//     [Buffer.from("config")],
//     faucetProgram.programId,
//   );

//   // 调用 initialize（faucet 指令会创建 vault ATA）
//   const tx2 = await faucetProgram.methods
//     .initialize(new anchor.BN(1000000), new anchor.BN(3600)) // amount_per_claim, cooldown_seconds
//     .accountsPartial({
//       config: faucetConfigPda,
//       mint: mint,
//       admin: manager.publicKey,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .signers([manager])
//     .rpc();
//   console.log("faucet 已初始化:", tx2);

//   // faucet initialize 会创建 vault ATA，获取 vault ATA 并 mint 一些代币到 vault
//   const ASSOCIATED_TOKEN_PROGRAM_ID =
//     anchor.utils.token.ASSOCIATED_PROGRAM_ID;
//   const vaultAta = await getAssociatedTokenAddress(
//     mint,
//     faucetConfigPda,
//     true,
//     TOKEN_2022_PROGRAM_ID,
//     ASSOCIATED_TOKEN_PROGRAM_ID,
//   );

//   // 通过 tangaga 的 mintToWallet 指令把代币铸到 faucet 的 vault
//   const txMintToVault = await tangagaProgram.methods
//     .mintToWallet(new anchor.BN(100 * 10 ** 6))
//     .accountsPartial({
//       mint: mint,
//       destinationAta: vaultAta,
//       destinationWallet: faucetConfigPda,
//       authority: manager.publicKey,
//       tokenProgram: TOKEN_2022_PROGRAM_ID,
//       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .signers([manager])
//     .rpc();
//   console.log(
//     "已通过 tangaga 铸币到 vault，tx:",
//     txMintToVault,
//     vaultAta.toBase58(),
//   );

//   // ---- 测试：普通用户从 faucet 领取代币 ----

//   const user = Keypair.generate();
//   // airdrop 给用户一些 SOL 以支付交易费用并作为 payer（claim 会 init_if_needed claim_record）
//   const sigUser = await connection.requestAirdrop(
//     user.publicKey,
//     anchor.web3.LAMPORTS_PER_SOL,
//   );
//   const bh2 = await connection.getLatestBlockhash();
//   await connection.confirmTransaction(
//     { signature: sigUser, ...bh2 },
//     "confirmed",
//   );

//   // 计算 claim_record PDA
//   const [claimRecordPda] = await PublicKey.findProgramAddress(
//     [Buffer.from("claim_record"), user.publicKey.toBuffer()],
//     faucetProgram.programId,
//   );

//   const userAta = await getAssociatedTokenAddress(mint, user.publicKey);

//   // 用户调用 claimTokens
//   const txClaim = await faucetProgram.methods
//     .claimTokens()
//     .accountsPartial({
//       config: faucetConfigPda,
//       mint: mint,
//       claimRecord: claimRecordPda,
//       vault: vaultAta,
//       userTokenAccount: userAta,
//       user: user.publicKey,
//       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//       tokenProgram: TOKEN_PROGRAM_ID,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .signers([user])
//     .rpc();
//   console.log("用户从 faucet 领取，tx:", txClaim);

//   // 查询用户 token 余额
//   const userBal = await connection
//     .getTokenAccountBalance(userAta)
//     .catch(() => null);
//   console.log("用户领取后代币余额:", userBal?.value?.uiAmountString ?? "0");

//   // ---- 测试：把该用户加入 skins_nft 白名单并铸造 NFT ----
//   // 预计算 skins_nft 相关 PDA
//   const [skinsConfigPda] = await anchor.web3.PublicKey.findProgramAddress(
//     [Buffer.from("config")],
//     skinsProgram.programId,
//   );
//   const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
//     [Buffer.from("treasury")],
//     skinsProgram.programId,
//   );

//   // 确保 manager 有足够资金（前面已空投）
//   // 添加白名单（mintAmount: 1）
//   const [whitelistEntryPda] = await anchor.web3.PublicKey.findProgramAddress(
//     [Buffer.from("whitelist_entry"), user.publicKey.toBuffer()],
//     skinsProgram.programId,
//   );

//   const txAdd = await skinsProgram.methods
//     .addWhitelist({ mintAmount: new anchor.BN(1) })
//     .accountsPartial({
//       authority: manager.publicKey,
//       config: skinsConfigPda,
//       user: user.publicKey,
//       whitelistEntry: whitelistEntryPda,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .signers([manager])
//     .rpc();
//   console.log("已将用户加入白名单:", txAdd);

//   // 重新初始化合约，开启白名单（因为之前初始化为 false）
//   const txReinit = await skinsProgram.methods
//     .initialize({
//       whitelistEnabled: true,
//       mintPrice: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL / 10),
//       maxSupply: new anchor.BN(1000),
//       maxMintPerAddress: new anchor.BN(10),
//     })
//     .accountsPartial({
//       authority: provider.wallet.publicKey,
//       config: skinsConfigPda,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .rpc();
//   console.log("skins_nft 重新初始化（启用白名单）:", txReinit);

//   // 创建一个新的 NFT mint 并进行白名单铸造
//   const nftMint = Keypair.generate();
//   // 给 NFT mint keypair 空投少量 SOL，以便作为 signer 创建/支付账号时使用
//   const sigNftAirdrop = await connection.requestAirdrop(
//     nftMint.publicKey,
//     anchor.web3.LAMPORTS_PER_SOL,
//   );
//   const bhNft = await connection.getLatestBlockhash();
//   await connection.confirmTransaction(
//     { signature: sigNftAirdrop, ...bhNft },
//     "confirmed",
//   );
//   const [userMintRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
//     [Buffer.from("user_mint_record"), user.publicKey.toBuffer()],
//     skinsProgram.programId,
//   );

//   const metadataProgramId = new anchor.web3.PublicKey(
//     MPL_TOKEN_METADATA_PROGRAM_ID,
//   );
//   const [metadataPda] = await anchor.web3.PublicKey.findProgramAddress(
//     [
//       Buffer.from("metadata"),
//       metadataProgramId.toBuffer(),
//       nftMint.publicKey.toBuffer(),
//     ],
//     metadataProgramId,
//   );

//   const userNftAta = await getAssociatedTokenAddress(
//     nftMint.publicKey,
//     user.publicKey,
//   );

//   const txMint = await skinsProgram.methods
//     .mintNftWhitelist("Test NFT", "TNFT", "https://example.com/nft.json")
//     .accountsPartial({
//       user: user.publicKey,
//       config: skinsConfigPda,
//       mint: nftMint.publicKey,
//       userMintRecord: userMintRecordPda,
//       whitelistEntry: whitelistEntryPda,
//       treasury: treasuryPda,
//       tokenAccount: userNftAta,
//       metadataAccount: metadataPda,
//       systemProgram: anchor.web3.SystemProgram.programId,
//       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//       tokenProgram: TOKEN_PROGRAM_ID,
//       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//       metadataProgram: metadataProgramId,
//     })
//     .signers([user, nftMint])
//     .rpc();
//   console.log("白名单铸造交易:", txMint);

//   // 查询用户 NFT ATA
//   const nftBal = await connection
//     .getTokenAccountBalance(userNftAta)
//     .catch(() => null);
//   console.log(
//     "用户白名单铸造后 NFT 余额:",
//     nftBal?.value?.uiAmountString ?? "0",
//   );
// });
