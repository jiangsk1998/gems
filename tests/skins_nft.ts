// import { PublicKey } from "./../app/node_modules/@trezor/connect/lib/types/params.d";
// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
// import { SkinsNft } from "../target/types/skins_nft";
// import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// describe.only("skins_nft", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace.skinsNft as Program<SkinsNft>;
//   const connection = provider.connection;

//   // ---- 常量（从 anchor 导出，避免手写错误）----
//   const TOKEN_PROGRAM_ID = anchor.utils.token.TOKEN_PROGRAM_ID;
//   const ASSOCIATED_TOKEN_PROGRAM_ID = anchor.utils.token.ASSOCIATED_PROGRAM_ID;
//   const metadataProgramId = new anchor.web3.PublicKey(
//     MPL_TOKEN_METADATA_PROGRAM_ID,
//   );
//   // const metadataProgramId = new anchor.web3.PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)

//   // ---- 账户 ----
//   const mintKey = anchor.web3.Keypair.generate(); // 白名单铸造的NFT
//   const manager = anchor.web3.Keypair.generate();
//   const minter = new anchor.web3.PublicKey(
//     "G1kT8PD2BVRRGBKrHk329f3aQfSaDjqnTaSMrQNAH4ws",
//   );

//   // ---- 预计算所有 PDA（所有测试共享）----
//   const [configPDA] = anchor.web3.PublicKey.findProgramAddressSync(
//     [Buffer.from("config")],
//     program.programId,
//   );
//   const [treasuryPDA] = anchor.web3.PublicKey.findProgramAddressSync(
//     [Buffer.from("treasury")],
//     program.programId,
//   );
//   const [minterMintRecord] = anchor.web3.PublicKey.findProgramAddressSync(
//     [Buffer.from("user_mint_record"), minter.toBuffer()],
//     program.programId,
//   );
//   const [minterWhitelistEntry] = anchor.web3.PublicKey.findProgramAddressSync(
//     [Buffer.from("whitelist_entry"), minter.toBuffer()],
//     program.programId,
//   );
//   // minter 持有 mintKey NFT 的 ATA
//   // 使用标准库函数代替手动 findProgramAddressSync
//   const minterAta = getAssociatedTokenAddressSync(mintKey.publicKey, minter);
//   // mintKey 对应的 Metaplex PDA
//   const [metadataAccountPDA] = anchor.web3.PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("metadata"),
//       metadataProgramId.toBuffer(),
//       mintKey.publicKey.toBuffer(),
//     ],
//     metadataProgramId,
//   );
//   const [masterEditionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("metadata"),
//       metadataProgramId.toBuffer(),
//       mintKey.publicKey.toBuffer(),
//       Buffer.from("edition"),
//     ],
//     metadataProgramId,
//   );

//   // 辅助：确认交易
//   async function confirm(sig: string) {
//     const bh = await connection.getLatestBlockhash();
//     await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
//   }

//   // ===== 1. 初始化合约（whitelistEnabled: false 先走公共铸造）=====
//   it("初始化合约", async () => {
//     const sig1 = await connection.requestAirdrop(
//       manager.publicKey,
//       anchor.web3.LAMPORTS_PER_SOL * 100,
//     );
//     await confirm(sig1);
//     const sig2 = await connection.requestAirdrop(
//       minter,
//       anchor.web3.LAMPORTS_PER_SOL * 100,
//     );
//     await confirm(sig2);

//     const tx = await program.methods
//       .initialize({
//         whitelistEnabled: false, // 关白名单，先测公共铸造
//         mintPrice: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL),
//         maxSupply: new anchor.BN(1000),
//         maxMintPerAddress: new anchor.BN(10),
//       })
//       .accountsPartial({
//         authority: provider.wallet.publicKey,
//         config: configPDA,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .rpc();
//     console.log("初始化合约:", tx);
//   });

//   // ===== 2. 公共铸造NFT =====
//   it("公共铸造NFT", async () => {
//     const mintKey2 = anchor.web3.Keypair.generate();
//     const [providerMintRecord] = anchor.web3.PublicKey.findProgramAddressSync(
//       [Buffer.from("user_mint_record"), provider.wallet.publicKey.toBuffer()],
//       program.programId,
//     );
//     const providerAta = anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         provider.wallet.publicKey.toBuffer(),
//         TOKEN_PROGRAM_ID.toBuffer(),
//         mintKey2.publicKey.toBuffer(),
//       ],
//       ASSOCIATED_TOKEN_PROGRAM_ID,
//     )[0];
//     const [metadata2] = anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("metadata"),
//         metadataProgramId.toBuffer(),
//         mintKey2.publicKey.toBuffer(),
//       ],
//       metadataProgramId,
//     );
//     const [masterEdition2] = anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("metadata"),
//         metadataProgramId.toBuffer(),
//         mintKey2.publicKey.toBuffer(),
//         Buffer.from("edition"),
//       ],
//       metadataProgramId,
//     );

//     // // 显式传所有账户，避免 accountsPartial 自动解析失败
//     // const tx = await program.methods
//     //   .mintNftPublic("Test NFT", "TNFT", "https://example.com")
//     //   .accountsPartial({
//     //     user: provider.wallet.publicKey,
//     //     config: configPDA,
//     //     mint: mintKey2.publicKey,
//     //     userMintRecord: providerMintRecord,
//     //     treasury: treasuryPDA,
//     //     tokenAccount: providerAta,
//     //     metadataAccount: metadata2,
//     //     // masterEditionAccount: masterEdition2,
//     //     systemProgram: anchor.web3.SystemProgram.programId,
//     //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//     //     tokenProgram: TOKEN_PROGRAM_ID,
//     //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//     //     metadataProgram: metadataProgramId,
//     //   })
//     //   .signers([mintKey2])
//     //   .rpc();
//     // console.log("公共铸造NFT:", tx);
//   });

//   // ===== 3. 重新初始化：开启白名单 =====
//   it("重新初始化开启白名单", async () => {
//     const tx = await program.methods
//       .initialize({
//         whitelistEnabled: true,
//         mintPrice: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL),
//         maxSupply: new anchor.BN(1000),
//         maxMintPerAddress: new anchor.BN(10),
//       })
//       .accountsPartial({
//         authority: provider.wallet.publicKey,
//         config: configPDA,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .rpc();
//     console.log("重新初始化开启白名单:", tx);
//   });

//   // ===== 4. 添加白名单地址 =====
//   it("添加白名单地址", async () => {
//     const tx = await program.methods
//       .addWhitelist({ mintAmount: new anchor.BN(5) })
//       .accountsPartial({
//         authority: provider.wallet.publicKey,
//         config: configPDA,
//         user: minter,
//         whitelistEntry: minterWhitelistEntry,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .rpc();
//     console.log("添加白名单地址:", tx);
//   });

//   // const mint_white = anchor.web3.Keypair.generate()

//   //   // mintKey 对应的 Metaplex PDA
//   // const [metadataAccountPDA_white] = anchor.web3.PublicKey.findProgramAddressSync(
//   //   [Buffer.from("metadata"), metadataProgramId.toBuffer(), mintKey.publicKey.toBuffer()],
//   //   metadataProgramId
//   // );

//   //   const minterAta = anchor.web3.PublicKey.findProgramAddressSync(
//   //   [minter.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintKey.publicKey.toBuffer()],
//   //   ASSOCIATED_TOKEN_PROGRAM_ID
//   // )[0];

//   // ===== 5. 白名单铸造NFT（mintKey，后续测试都用这个）=====
//   // it("白名单铸造NFT", async () => {
//   //   console.log(
//   //     "System Program:",
//   //     anchor.web3.SystemProgram.programId.toString(),
//   //   );
//   //   console.log("Rent Program:", anchor.web3.SYSVAR_RENT_PUBKEY.toString());
//   //   console.log("Token Program:", TOKEN_PROGRAM_ID.toString());
//   //   console.log(
//   //     "Associated Token Program:",
//   //     ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
//   //   );
//   //   console.log("Metadata Program:", metadataProgramId.toString());
//   //   // 显式传所有账户，避免 accountsPartial 自动解析失败
//   //   const tx = await program.methods
//   //     .mintNftWhitelist("Test NFT", "TNFT", "https://example.com")
//   //     .accountsPartial({
//   //       user: minter,
//   //       config: configPDA,
//   //       mint: mintKey.publicKey,
//   //       userMintRecord: minterMintRecord,
//   //       whitelistEntry: minterWhitelistEntry,
//   //       treasury: treasuryPDA,
//   //       tokenAccount: minterAta,
//   //       metadataAccount: metadataAccountPDA,
//   //       // masterEditionAccount: masterEditionPDA,
//   //       systemProgram: anchor.web3.SystemProgram.programId,
//   //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//   //       // metadataProgram: metadataProgramId,
//   //     })
//   //     .signers([minter, mintKey])
//   //     .rpc();
//   //   console.log("白名单铸造NFT:", tx);
//   //   console.log("minterAta:", minterAta.toBase58());
//   // });

//   // // ===== 6. 提现 =====
//   // it("提现", async () => {
//   //   // treasury 此时有 2 SOL（公共铸造 1 SOL + 白名单铸造 1 SOL）
//   //   const tx = await program.methods
//   //     .withdraw(new anchor.BN(anchor.web3.LAMPORTS_PER_SOL))
//   //     .accountsPartial({
//   //       config: configPDA,
//   //       authority: manager.publicKey,
//   //       treasury: treasuryPDA,
//   //       recipient: manager.publicKey,
//   //       systemProgram: anchor.web3.SystemProgram.programId,
//   //     })
//   //     .signers([manager])
//   //     .rpc();
//   //   console.log("提现:", tx);
//   // });

//   // // ===== 7. 冻结NFT =====
//   // it("冻结NFT", async () => {
//   //   const tx = await program.methods
//   //     .freezeNft()
//   //     .accountsPartial({
//   //       manager: manager.publicKey,
//   //       mint: mintKey.publicKey,
//   //       config: configPDA,
//   //       tokenAccount: minterAta,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //     })
//   //     .signers([manager])
//   //     .rpc();
//   //   console.log("冻结NFT:", tx);
//   // });

//   // // ===== 8. 解冻NFT =====
//   // it("解冻NFT", async () => {
//   //   const tx = await program.methods
//   //     .thawNft()
//   //     .accountsPartial({
//   //       manager: manager.publicKey,
//   //       config: configPDA,
//   //       mint: mintKey.publicKey,
//   //       tokenAccount: minterAta,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //     })
//   //     .signers([manager])
//   //     .rpc();
//   //   console.log("解冻NFT:", tx);
//   // });

//   // ===== 9. 转移 Metadata 更新权限（minter → manager）=====
//   // it("转移更新权限给manager", async () => {
//   //   console.log("metadataAccount:", metadataAccountPDA.toBase58());
//   //   const tx = await program.methods
//   //     .transUpdateAuth()
//   //     .accountsPartial({
//   //       currentAuthrity: minter.publicKey,
//   //       metadataAccount: metadataAccountPDA,
//   //       newAuth: manager.publicKey,
//   //       metadataProgram: metadataProgramId,
//   //     })
//   //     .signers([minter])
//   //     .rpc();
//   //   console.log("转移更新权限:", tx);
//   // });

//   // ===== 10. 撤销冻结权限 =====
//   // it("撤销冻结权限", async () => {
//   //   const tx = await program.methods
//   //     .revokeFreezeAuth()
//   //     .accountsPartial({
//   //       manager: manager.publicKey,
//   //       mint: mintKey.publicKey,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //     })
//   //     .signers([manager])
//   //     .rpc();
//   //   console.log("撤销冻结权限:", tx);
//   // });

//   // ===== 11. 转账NFT =====
//   // it("转账NFT给接收方", async () => {
//   //   const receiver = anchor.web3.Keypair.generate();
//   //   const receiverAta = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [
//   //       receiver.publicKey.toBuffer(),
//   //       TOKEN_PROGRAM_ID.toBuffer(),
//   //       mintKey.publicKey.toBuffer(),
//   //     ],
//   //     ASSOCIATED_TOKEN_PROGRAM_ID,
//   //   )[0];

//   // const tx = await program.methods
//   //   .transNft()
//   //   .accountsPartial({
//   //     owner: minter.publicKey,
//   //     mint: mintKey.publicKey,
//   //     fromAta: minterAta,
//   //     reviver: receiver.publicKey,
//   //     toAta: receiverAta,
//   //     tokenProgram: TOKEN_PROGRAM_ID,
//   //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//   //     systemProgram: anchor.web3.SystemProgram.programId,
//   //   })
//   //     .signers([minter])
//   //     .rpc();
//   //   console.log("转账NFT:", tx);
//   //   console.log("NFT已转到:", receiver.publicKey.toBase58());
//   // });
// });
