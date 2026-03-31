import { useState, useCallback } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  getProgram,
  getConfigPda,
  getWhitelistPda,
  getUserRecordPda,
} from "../utils/program";
// 避免在浏览器捆绑时加载完整的 mpl-token-metadata 包（会引起依赖 umi 的运行时错误）
// 直接使用 Metaplex Token Metadata 程序 ID 常量
const MPL_TOKEN_METADATA_PROGRAM_ID =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

interface MintResult {
  signature: string;
  mintAddress: string;
}

export function useNftMinter() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取合约配置
  const fetchConfig = useCallback(async () => {
    if (!wallet) return null;
    const program = getProgram(connection, wallet);
    const [configPda] = getConfigPda();

    console.log("获取配置 - Config PDA:", configPda.toString());

    try {
      const config = await program.account.config.fetch(configPda);
      console.log("配置数据:", config);
      const result = {
        mintPrice: config.mintPrice.toNumber(),
        maxSupply: config.maxSupply.toNumber(),
        mintedCount: config.mintedCount.toNumber(),
        maxPerUser: config.maxMintPerAddress.toNumber(),
        paused: config.mintPaused,
        whitelistEnabled: config.whitelistEnabled,
      };
      console.log("转换后的配置:", result);
      return result;
    } catch (err) {
      console.error("获取配置失败:", err);
      return null;
    }
  }, [connection, wallet]);

  // 检查白名单状态
  const checkWhitelist = useCallback(async () => {
    if (!wallet) return false;
    const program = getProgram(connection, wallet);
    const [whitelistPda] = getWhitelistPda(wallet.publicKey);

    console.log("检查白名单 - 钱包地址:", wallet.publicKey.toString());
    console.log("检查白名单 - PDA:", whitelistPda.toString());

    try {
      const entry = await program.account.whitelistEntry.fetch(whitelistPda);
      console.log("白名单数据:", entry);
      console.log("isAdded:", entry.isAdded);
      console.log("remainingMints:", entry.remainingMints.toNumber());
      return entry.isAdded && entry.remainingMints.toNumber() > 0;
    } catch (err) {
      console.error("查询白名单失败:", err);
      return false;
    }
  }, [connection, wallet]);

  // 执行铸造
  const mintNft = useCallback(
    async (
      name: string,
      symbol: string,
      uri: string,
    ): Promise<MintResult | null> => {
      if (!wallet) {
        setError("请先连接钱包");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        console.log("开始铸造 NFT...");
        const program = getProgram(connection, wallet);
        const mintKeypair = Keypair.generate();

        // 计算所有 PDA
        const [userRecordPda] = getUserRecordPda(wallet.publicKey);
        const [whitelistPda] = getWhitelistPda(wallet.publicKey);
        const [configPda] = getConfigPda();
        const [treasuryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("treasury")],
          program.programId,
        );

        const metadataProgramId = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
        const [metadataPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            metadataProgramId.toBuffer(),
            mintKeypair.publicKey.toBuffer(),
          ],
          metadataProgramId,
        );

        const userNftAta = await getAssociatedTokenAddress(
          mintKeypair.publicKey,
          wallet.publicKey!,
        );

        console.log("Mint:", mintKeypair.publicKey.toString());
        console.log("User Record PDA:", userRecordPda.toString());
        console.log("Whitelist PDA:", whitelistPda.toString());

        // 发送交易（补齐需要的账户）
        const tx = await program.methods
          .mintNftWhitelist(name, symbol, uri)
          .accountsPartial({
            user: wallet.publicKey,
            config: configPda,
            mint: mintKeypair.publicKey,
            userMintRecord: userRecordPda,
            whitelistEntry: whitelistPda,
            treasury: treasuryPda,
            tokenAccount: userNftAta,
            metadataAccount: metadataPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            metadataProgram: metadataProgramId,
          })
          .signers([mintKeypair])
          .rpc();

        console.log("铸造成功:", tx);

        return {
          signature: tx,
          mintAddress: mintKeypair.publicKey.toString(),
        };
      } catch (err: any) {
        console.error("铸造失败:", err);
        setError(err.message || "铸造失败");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet],
  );

  return {
    mintNft,
    fetchConfig,
    checkWhitelist,
    loading,
    error,
  };
}
