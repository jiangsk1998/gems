import { useState, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import BN from "bn.js";

// 从本地 src/idl 导入 IDL（避免 CRA 禁止跨 src 导入）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const idl = require("../idl/faucet.json");

export const FAUCET_PROGRAM_ID = new PublicKey(
  "8pjYoQdRtEbGxddTSPfWAyQYcQhUUhizqxVjtojNxenN",
);

function getProgram(connection: Connection, wallet: any): Program<any> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  // 将 IDL 视为 any，返回 Program<any> 以避免类型约束
  // 使用 any 绕过类型系统在前端与 anchor 版本差异导致的构造器签名不匹配
  return new (Program as any)(
    idl as any,
    provider,
    FAUCET_PROGRAM_ID,
  ) as Program<any>;
}

export function getFaucetConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    FAUCET_PROGRAM_ID,
  );
}

export function getClaimRecordPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim_record"), user.toBuffer()],
    FAUCET_PROGRAM_ID,
  );
}

export function useFaucet() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!wallet) return null;
    const program = getProgram(connection, wallet);
    const [configPda] = getFaucetConfigPda();
    try {
      const cfg: any = await (program as any).account.config.fetch(configPda);
      return {
        admin: new PublicKey(cfg.admin),
        mint: new PublicKey(cfg.mint),
        vault: new PublicKey(cfg.vault),
        amountPerClaim: Number(cfg.amountPerClaim ?? cfg.amount_per_claim),
        cooldownSeconds: Number(cfg.cooldownSeconds ?? cfg.cooldown_seconds),
        totalDistributed: Number(cfg.totalDistributed ?? cfg.total_distributed),
        claimCount: Number(cfg.claimCount ?? cfg.claim_count),
      };
    } catch (err) {
      console.error("fetchConfig error", err);
      return null;
    }
  }, [connection, wallet]);

  const fetchClaimRecord = useCallback(async () => {
    if (!wallet) return null;
    const program = getProgram(connection, wallet);
    const [claimPda] = getClaimRecordPda(wallet.publicKey!);
    try {
      const rec: any = await (program as any).account.claimRecord.fetch(
        claimPda,
      );
      return {
        lastClaimAt: Number(rec.lastClaimAt ?? rec.last_claim_at),
        totalClaimed: Number(rec.totalClaimed ?? rec.total_claimed),
        claimCount: Number(rec.claimCount ?? rec.claim_count),
      };
    } catch (err) {
      return null;
    }
  }, [connection, wallet]);

  const claim = useCallback(async () => {
    if (!wallet) {
      setError("请先连接钱包");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const program = getProgram(connection, wallet);
      const [configPda] = getFaucetConfigPda();
      const cfg: any = await (program as any).account.config.fetch(configPda);

      const mintPub = new PublicKey(cfg.mint);
      const userAta = await getAssociatedTokenAddress(
        mintPub,
        wallet.publicKey!,
      );
      const [claimPda] = getClaimRecordPda(wallet.publicKey!);

      const tx = await program.methods
        .claimTokens()
        .accountsPartial({
          config: configPda,
          mint: mintPub,
          claimRecord: claimPda,
          vault: new PublicKey(cfg.vault),
          userTokenAccount: userAta,
          user: wallet.publicKey!,
        })
        .rpc();

      return tx;
    } catch (err: any) {
      console.error("claim error", err);
      setError(err?.message || String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const deposit = useCallback(
    async (amountRaw: number) => {
      if (!wallet) {
        setError("请先连接钱包");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const program = getProgram(connection, wallet);
        const [configPda] = getFaucetConfigPda();
        const cfg: any = await (program as any).account.config.fetch(configPda);
        const mintPub = new PublicKey(cfg.mint);
        const adminAta = await getAssociatedTokenAddress(
          mintPub,
          wallet.publicKey!,
        );

        const tx = await program.methods
          .depositsTokens(new BN(amountRaw))
          .accountsPartial({
            config: configPda,
            vault: new PublicKey(cfg.vault),
            adminTokenAccount: adminAta,
            admin: wallet.publicKey!,
          })
          .rpc();

        return tx;
      } catch (err: any) {
        console.error("deposit error", err);
        setError(err?.message || String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet],
  );

  return {
    fetchConfig,
    fetchClaimRecord,
    claim,
    deposit,
    loading,
    error,
  };
}
