import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useFaucet } from '../hooks/useFaucet';

export function FaucetPage() {
    const { connected, publicKey } = useWallet();
    const { fetchConfig, fetchClaimRecord, claim, deposit, loading, error } = useFaucet();
    const [config, setConfig] = useState<any | null>(null);
    const [claimRecord, setClaimRecord] = useState<any | null>(null);
    const [depositAmount, setDepositAmount] = useState<string>('0');

    useEffect(() => {
        if (connected) {
            fetchConfig().then(setConfig);
            fetchClaimRecord().then(setClaimRecord);
        } else {
            setConfig(null);
            setClaimRecord(null);
        }
    }, [connected, fetchConfig, fetchClaimRecord]);

    const handleClaim = async () => {
        const tx = await claim();
        if (tx) {
            // 刷新
            fetchConfig().then(setConfig);
            fetchClaimRecord().then(setClaimRecord);
            alert('领取成功: ' + tx);
        }
    };

    const handleDeposit = async () => {
        const raw = Number(depositAmount || 0);
        if (!raw || raw <= 0) return alert('请输入有效数量 (raw 单位)');
        const tx = await deposit(raw);
        if (tx) {
            fetchConfig().then(setConfig);
            alert('充值成功: ' + tx);
        }
    };

    const isAdmin = !!(publicKey && config && publicKey.toString() === config.admin.toString());

    return (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: 20 }}>
            <h1>水龙头 (Faucet)</h1>

            <div style={{ marginBottom: 12 }}>
                <WalletMultiButton />
            </div>

            {config ? (
                <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                    <p>每次领取数量（raw）: {config.amountPerClaim}</p>
                    <p>冷却时间（秒）: {config.cooldownSeconds}</p>
                    <p>已分发总量（raw）: {config.totalDistributed}</p>
                    <p>领取次数: {config.claimCount}</p>
                </div>
            ) : (
                <p>未获取到水龙头配置（请连接钱包并确保合约已初始化）</p>
            )}

            <div style={{ marginTop: 16 }}>
                <button
                    onClick={handleClaim}
                    disabled={!connected || loading}
                    style={{ padding: 12, fontSize: 16, borderRadius: 8 }}
                >
                    {loading ? '进行中...' : '领取代币'}
                </button>
            </div>

            {claimRecord && (
                <div style={{ marginTop: 12, padding: 12, background: '#eef' }}>
                    <p>上次领取时间(秒): {claimRecord.lastClaimAt}</p>
                    <p>累计领取( raw ): {claimRecord.totalClaimed}</p>
                    <p>领取次数: {claimRecord.claimCount}</p>
                </div>
            )}

            {error && (
                <div style={{ marginTop: 12, color: 'red' }}>{error}</div>
            )}

            {isAdmin && (
                <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: '#fff7e6' }}>
                    <h3>管理员操作</h3>
                    <div style={{ marginBottom: 8 }}>
                        <input
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            style={{ padding: 8, width: 200, marginRight: 8 }}
                        />
                        <button onClick={handleDeposit} style={{ padding: '8px 12px' }}>充值到金库</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>注意：输入 raw 单位（含 decimals），例如代币有6位小数时 1 个代币应为 1000000。</div>
                </div>
            )}
        </div>
    );
}
