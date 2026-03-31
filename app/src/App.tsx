import { Buffer } from 'buffer';
import React, { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { MintPage } from './components/MintPage';
import { FaucetPage } from './components/FaucetPage';
import { AdminWhitelist } from './components/AdminWhitelist';

// 引入钱包适配器样式
import '@solana/wallet-adapter-react-ui/styles.css';

window.Buffer = Buffer;

function App() {
  // 使用 Devnet
  // const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  const endpoint = useMemo(() => 'http://localhost:8899', []);

  // 支持的钱包列表
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{ padding: 20 }}>
            <PageSwitcher />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;

function PageSwitcher() {
  const [page, setPage] = React.useState<'mint' | 'faucet' | 'admin'>('mint');
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setPage('mint')} style={{ marginRight: 8 }}>铸造页面</button>
        <button onClick={() => setPage('faucet')} style={{ marginRight: 8 }}>水龙头</button>
        <button onClick={() => setPage('admin')}>管理员</button>
      </div>
      {page === 'mint' ? <MintPage /> : page === 'faucet' ? <FaucetPage /> : <AdminWhitelist />}
    </div>
  );
}