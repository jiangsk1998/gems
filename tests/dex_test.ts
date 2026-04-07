// import * as anchor from "@coral-xyz/anchor";
// import {Program} from "@coral-xyz/anchor";
// import {Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram} from "@solana/web3.js";
// import {
//     ASSOCIATED_TOKEN_PROGRAM_ID,
//     createAssociatedTokenAccountInstruction,
//     createSyncNativeInstruction,
//     getAssociatedTokenAddressSync,
//     NATIVE_MINT,
//     TOKEN_2022_PROGRAM_ID,
//     TOKEN_PROGRAM_ID,
// } from "@solana/spl-token";
// import {Dex} from "../target/types/dex";
// import {Tangaga} from "../target/types/tangaga";
// import {assert} from "chai";
//
// describe("DEX 完整闭环测试 (WSOL <> Tangaga)", () => {
//     const provider = anchor.AnchorProvider.env();
//     anchor.setProvider(provider);
//
//     const dexProgram = anchor.workspace.Dex as Program<Dex>;
//     const tangagaProgram = anchor.workspace.Tangaga as Program<Tangaga>;
//
//     // 核心测试人员
//     const admin = Keypair.generate();
//     const user = Keypair.generate();
//
//     // 代币信息
//     const tangagaMint = Keypair.generate(); // Token B: Tangaga Mint
//     const wsolMint = NATIVE_MINT;           // Token A: Wrapped SOL
//
//     let poolPda: PublicKey;
//     let lpMintPda: PublicKey;
//     let vaultA: PublicKey;
//     let vaultB: PublicKey;
//     const POOL_SEED = Buffer.from("pool");
//
//     before(async () => {
//         // 1. 空投 SOL 给 Admin 和 User 用于充当测试资金与手续费
//         await provider.connection.confirmTransaction(
//             await provider.connection.requestAirdrop(admin.publicKey, 100 * LAMPORTS_PER_SOL)
//         );
//         await provider.connection.confirmTransaction(
//             await provider.connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL)
//         );
//
//         // 2. 使用 Tangaga 合约创建 Token-2022 代币 (作为 Token B)
//         await tangagaProgram.methods
//             .createToken("Tangaga", "$TAGA", "https://example.com/t.json", 6)
//             .accountsPartial({
//                 mint: tangagaMint.publicKey,
//                 authority: admin.publicKey,
//                 manager: admin.publicKey,
//             })
//             .signers([tangagaMint, admin])
//             .rpc();
//
//         console.log("Tangaga (Token-2022) 创建成功:", tangagaMint.publicKey.toBase58());
//     });
//
//     it("获取并包装 WSOL", async () => {
//         // 用户获取 WSOL 需要：创建 WSOL ATA -> 往里面转原生 SOL -> 调用 SyncNative 同步余额
//         const userWsolAta = getAssociatedTokenAddressSync(
//             wsolMint,
//             user.publicKey,
//             false,
//             TOKEN_PROGRAM_ID
//         );
//
//         const tx = new anchor.web3.Transaction().add(
//             createAssociatedTokenAccountInstruction(
//                 user.publicKey,       // payer
//                 userWsolAta,          // ata
//                 user.publicKey,       // owner
//                 wsolMint,             // mint
//                 TOKEN_PROGRAM_ID
//             ),
//             SystemProgram.transfer({
//                 fromPubkey: user.publicKey,
//                 toPubkey: userWsolAta,
//                 lamports: 5 * LAMPORTS_PER_SOL, // 充值 5 SOL 进 WSOL
//             }),
//             createSyncNativeInstruction(userWsolAta)
//         );
//
//         await provider.sendAndConfirm(tx, [user]);
//         console.log("用户已成功将 5 SOL 包装为 WSOL 准备提供流动性");
//     });
//
//     it("创建 DEX 资金池 (Create Pool)", async () => {
//         // 推导 Pool 的相关 PDA 地址
//         [poolPda] = PublicKey.findProgramAddressSync(
//             [POOL_SEED, wsolMint.toBuffer(), tangagaMint.publicKey.toBuffer()],
//             dexProgram.programId
//         );
//
//         vaultA = getAssociatedTokenAddressSync(wsolMint, poolPda, true, TOKEN_PROGRAM_ID);
//         vaultB = getAssociatedTokenAddressSync(tangagaMint.publicKey, poolPda, true, TOKEN_2022_PROGRAM_ID);
//
//         const lpMint = Keypair.generate();
//         lpMintPda = lpMint.publicKey;
//
//         await dexProgram.methods
//             .createPool()
//             .accountsPartial({
//                 authority: admin.publicKey,
//                 lpMint: lpMintPda,
//                 tokenAMint: wsolMint,
//                 tokenBMint: tangagaMint.publicKey,
//                 vaultA: vaultA,
//                 vaultB: vaultB,
//                 pool: poolPda,
//                 tokenProgram: TOKEN_2022_PROGRAM_ID,
//                 systemProgram: SystemProgram.programId,
//                 associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//             })
//             .signers([admin, lpMint])
//             .rpc();
//
//         console.log("流动性池已创建");
//     });
//
//     it("添加流动性 (Add Liquidity)", async () => {
//         const userTangagaAta = getAssociatedTokenAddressSync(
//             tangagaMint.publicKey,
//             user.publicKey,
//             false,
//             TOKEN_2022_PROGRAM_ID
//         );
//
//         await tangagaProgram.methods
//             .mintToWallet(new anchor.BN(10_000 * 10 ** 6))
//             .accountsPartial({
//                 mint: tangagaMint.publicKey,
//                 destinationAta: userTangagaAta,
//                 destinationWallet: user.publicKey,
//                 authority: admin.publicKey,
//                 tokenProgram: TOKEN_2022_PROGRAM_ID,
//             })
//             .signers([admin])
//             .rpc();
//
//         const userWsolAta = getAssociatedTokenAddressSync(wsolMint, user.publicKey, false, TOKEN_PROGRAM_ID);
//         const userLpAta = getAssociatedTokenAddressSync(lpMintPda, user.publicKey, false, TOKEN_2022_PROGRAM_ID);
//
//         await dexProgram.methods
//             .addLiquidity(
//                 new anchor.BN(1 * LAMPORTS_PER_SOL), // amountA (SOL)
//                 new anchor.BN(100 * 10 ** 6),        // amountB (Tangaga)
//                 new anchor.BN(0)                     // 最小 LP (0 防滑点)
//             )
//             .accountsPartial({
//                 user: user.publicKey,
//                 pool: poolPda,
//                 lpMint: lpMintPda,
//                 mintA: wsolMint,
//                 mintB: tangagaMint.publicKey,
//                 userAtaA: userWsolAta,
//                 userAtaB: userTangagaAta,
//                 userLpAta: userLpAta,
//                 poolVaultA: vaultA,
//                 poolVaultB: vaultB,
//             })
//             .signers([user])
//             .rpc();
//
//         console.log("成功添加初始流动性!");
//     });
//
//     it("兑换代币 (Swap WSOL -> Tangaga)", async () => {
//         const swapper = Keypair.generate();
//         await provider.connection.confirmTransaction(
//             await provider.connection.requestAirdrop(swapper.publicKey, 2 * LAMPORTS_PER_SOL)
//         );
//
//         const swapperWsolAta = getAssociatedTokenAddressSync(wsolMint, swapper.publicKey, false, TOKEN_PROGRAM_ID);
//         const swapperTagAta = getAssociatedTokenAddressSync(tangagaMint.publicKey, swapper.publicKey, false, TOKEN_2022_PROGRAM_ID);
//
//         const setupTx = new anchor.web3.Transaction().add(
//             createAssociatedTokenAccountInstruction(swapper.publicKey, swapperWsolAta, swapper.publicKey, wsolMint, TOKEN_PROGRAM_ID),
//             SystemProgram.transfer({
//                 fromPubkey: swapper.publicKey,
//                 toPubkey: swapperWsolAta,
//                 lamports: LAMPORTS_PER_SOL
//             }),
//             createSyncNativeInstruction(swapperWsolAta)
//         );
//         await provider.sendAndConfirm(setupTx, [swapper]);
//
//         await dexProgram.methods
//             .swap(
//                 new anchor.BN(0.1 * LAMPORTS_PER_SOL), // 输入 0.1 SOL
//                 new anchor.BN(0),                      // 最小输出 (0 防滑点)
//                 true                                   // aToB (WSOL -> Tangaga)
//             )
//             .accountsPartial({
//                 user: swapper.publicKey,
//                 pool: poolPda,
//                 userInput: swapperWsolAta,
//                 userPut: swapperTagAta,
//                 vaultA: vaultA,
//                 vaultB: vaultB,
//                 tokenProgramA: TOKEN_PROGRAM_ID,
//                 tokenProgramB: TOKEN_2022_PROGRAM_ID,
//             })
//             .signers([swapper])
//             .rpc();
//
//         const tagBalance = await provider.connection.getTokenAccountBalance(swapperTagAta);
//         console.log(`Swap 成功！交换者获得了 ${tagBalance.value.uiAmount} 个 $TAGA`);
//         assert.isAbove(tagBalance.value.uiAmount as number, 0, "换出数量必须大于 0");
//     });
// });
