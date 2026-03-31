import React, { useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getProgram } from '../utils/program';
import { ADMIN_PUBKEY } from '../config';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';

export function AdminWhitelist() {
    const wallet = useAnchorWallet();
    const { connection } = useConnection();
    const [address, setAddress] = useState('');
    const [amount, setAmount] = useState<number>(1);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const isAdmin = wallet?.publicKey?.toBase58() === ADMIN_PUBKEY;

    const handleAdd = async () => {
        if (!wallet) return setMessage('请先连接钱包');
        if (!isAdmin) return setMessage('只有管理员可以操作');
        try {
            setLoading(true);
            setMessage(null);
            const program = getProgram(connection, wallet);
            const userPub = new PublicKey(address);
            const [whitelistEntry] = await PublicKey.findProgramAddress(
                [Buffer.from('whitelist_entry'), userPub.toBuffer()],
                program.programId,
            );
            const [configPda] = await PublicKey.findProgramAddress([Buffer.from('config')], program.programId);

            const tx = await program.methods
                .addWhitelist({ mintAmount: new BN(amount) })
                .accountsPartial({
                    authority: wallet.publicKey,
                    config: configPda,
                    user: userPub,
                    whitelistEntry: whitelistEntry,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            setMessage('已添加白名单: ' + tx);
        } catch (err: any) {
            console.error(err);
            setMessage(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: 20 }}>
            <h2>管理员白名单管理</h2>
            <div style={{ marginBottom: 12 }}>
                <WalletMultiButton />
            </div>
            {!isAdmin && <div style={{ color: 'red' }}>当前钱包不是管理员：{ADMIN_PUBKEY}</div>}

            <div style={{ marginTop: 12 }}>
                <input placeholder="地址" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: 420, padding: 8 }} />
            </div>
            <div style={{ marginTop: 8 }}>
                <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 120, padding: 8 }} />
                <button onClick={handleAdd} disabled={!isAdmin || loading} style={{ marginLeft: 8 }}>添加白名单</button>
            </div>
            {message && <div style={{ marginTop: 12 }}>{message}</div>}
        </div>
    );
}
