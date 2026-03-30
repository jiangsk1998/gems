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
          <MintPage />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;