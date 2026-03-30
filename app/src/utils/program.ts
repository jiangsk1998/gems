import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { SkinsNft } from '../types/skins_nft';
import idl from '../idl/skins_nft.json';

// 合约程序 ID（部署后替换）
export const PROGRAM_ID = new PublicKey("BHKrfqapEpWfgu9ammQ5LENgb6SjnA2TFU4FhGSCUzsy");

// 获取 Program 实例
export function getProgram(
  connection: Connection,
  wallet: AnchorWallet,
): Program<SkinsNft> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  return new Program<SkinsNft>(idl as SkinsNft, provider);
}

// 计算 Config PDA
export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID,
  );
}

// 计算白名单 PDA
export function getWhitelistPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('whitelist_entry'), user.toBuffer()],
    PROGRAM_ID,
  );
}

// 计算用户铸造记录 PDA
export function getUserRecordPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_mint_record'), user.toBuffer()],
    PROGRAM_ID,
  );
}