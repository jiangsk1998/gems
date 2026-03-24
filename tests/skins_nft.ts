import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SkinsNft } from "../target/types/skins_nft";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { lamports } from "@metaplex-foundation/umi";
import { min } from "bn.js";



describe("skins_nft", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.skinsNft as Program<SkinsNft>;

  const mintKey = anchor.web3.Keypair.generate();

  // it("Is initialized!", async () => {
  //   // Add your test here.
  //   const tx = await program.methods.mintNft("Test NFT", "TNFT", "https://example.com").accounts(
  //     {
  //       user: anchor.getProvider().wallet.publicKey,
  //       mint: mintKey.publicKey, // 使用生成的 mint 密钥对
  //       metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID, // Metaplex Metadata Program ID
  //     }
  //   ).signers([mintKey]).rpc();
  //   console.log("Your transaction signature", tx);

  //   console.log("Minted NFT with transaction signature:", program.provider.connection.getTransaction(tx));
  // });



  //合约管理员
  let manager = anchor.web3.Keypair.generate();




  ///1. 初始化合约
  it("Is initialized!", async () => {

    const sig1 = await anchor.getProvider().connection.requestAirdrop(manager.publicKey, anchor.web3.LAMPORTS_PER_SOL * 500)

    await anchor.getProvider().connection.confirmTransaction(sig1);


    const sig2 = await anchor.getProvider().connection.requestAirdrop(minter.publicKey, anchor.web3.LAMPORTS_PER_SOL * 500)

    await anchor.getProvider().connection.confirmTransaction(sig2);



    let initialParam =
    {
      whitelistEnabled: true,
      mintPrice: new anchor.BN(100000000000),
      maxSupply: new anchor.BN(1000),
      maxMintPerAddress: new anchor.BN(1),
    }

    const configPDA = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    )[0]

    // Add your test here.
    const tx = await program.methods.initialize(initialParam).accountsPartial(
      {
        authority: manager.publicKey,
        // config:configPDA, 
        systemProgram: anchor.web3.SystemProgram.programId,
      }
    ).signers([manager]).rpc();
    console.log("Your transaction signature", tx);
  });


  ///2. 添加白名单地址
  const minter = anchor.web3.Keypair.generate();

  it("添加白名单地址", async () => {

    let initialParam =
    {
      whitelistEnabled: true,
      mintPrice: new anchor.BN(100000000000),
      maxSupply: new anchor.BN(1000),
      maxMintPerAddress: new anchor.BN(1),
    }

    // Add your test here.
    const tx = await program.methods.addWhitelist({ mintAmount: new anchor.BN(1) }).accountsPartial(
      {
        authority: manager.publicKey,
        user: minter.publicKey,
      }
    ).signers([manager]).rpc();
    console.log("Your transaction signature", tx);
  });

  ///3. 白名单地址铸造NFT


  it("白名单地址铸造NFT", async () => {


    // Add your test here.
    const tx = await program.methods.mintNftWhitelist("Test NFT", "TNFT", "https://example.com").accountsPartial(
      {
        user: minter.publicKey,
        mint: mintKey.publicKey, // 使用生成的 mint 密钥对
        metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID, // Metaplex Metadata Program ID
        // whitelistEntry:anchor.web3.PublicKey.findProgramAddressSync(
        //   [Buffer.from("whitelist_entry"), minter.publicKey.toBuffer()],
        //   program.programId
        // )[0],
        // whitelistEntry: anchor.web3.Keypair.generate().publicKey, // 使用生成的白名单地址
      }
    ).signers([minter, mintKey]).rpc();
    console.log("Your transaction signature", tx);
  });

  ///4. 公共铸造NFT

  it("公共铸造NFT", async () => {

    const mintKey2 = anchor.web3.Keypair.generate();

    // Add your test here.
    const tx = await program.methods.mintNftPublic("Test NFT", "TNFT", "https://example.com").accountsPartial(
      {
        user: anchor.getProvider().wallet.publicKey,
        mint: mintKey2.publicKey, // 使用生成的 mint 密钥对
        metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID, // Metaplex Metadata Program ID
      }
    ).signers([mintKey2]).rpc();
    console.log("Your transaction signature", tx);
  });

  ///5. 提现

  it("提现", async () => {

    // Add your test here.
    const tx = await program.methods.withdraw(new anchor.BN(anchor.web3.LAMPORTS_PER_SOL * 2)).accountsPartial(
      {
        treasury: anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("treasury")],
          program.programId
        )[0],
        config: anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("config")],
          program.programId
        )[0],
        authority: manager.publicKey,
        recipient: anchor.web3.Keypair.generate().publicKey, // 使用生成的 treasury 地址
      }
    ).signers([manager]).rpc();
    console.log("Your transaction signature", tx);
  });


});


