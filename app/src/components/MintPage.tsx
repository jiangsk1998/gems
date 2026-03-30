import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNftMinter } from "../hooks/useNftMinter";

// NFT 元数据配置（实际项目中从后端获取）
const NFT_CONFIG = {
  name: "My NFT",
  symbol: "MNFT",
  baseUri: "https://arweave.net/your-metadata-folder",
};

interface Config {
  mintPrice: number;
  maxSupply: number;
  mintedCount: number;
  maxPerUser: number;
  paused: boolean;
  whitelistEnabled: boolean;
}

export function MintPage() {
  const { connected } = useWallet();
  const { mintNft, fetchConfig, checkWhitelist, loading, error } =
    useNftMinter();

  const [config, setConfig] = useState<Config | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [mintResult, setMintResult] = useState<{
    signature: string;
    mintAddress: string;
  } | null>(null);

  // 加载合约配置
  useEffect(() => {
    if (connected) {
      console.log('useEffect 触发 - 加载配置');
      fetchConfig().then((cfg) => {
        console.log('设置配置:', cfg);
        setConfig(cfg);
      });
      checkWhitelist().then(setIsWhitelisted);
    }
  }, [connected, fetchConfig, checkWhitelist]);

  // 执行铸造
  const handleMint = async () => {
    if (!config) return;

    const nextId = config.mintedCount;
    const uri = `${NFT_CONFIG.baseUri}/${nextId}.json`;

    const result = await mintNft(
      `${NFT_CONFIG.name} #${nextId}`,
      NFT_CONFIG.symbol,
      uri,
    );

    if (result) {
      setMintResult(result);
      // 刷新配置
      fetchConfig().then(setConfig);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1>NFT 铸造小站</h1>

      {/* 钱包连接 */}
      <div style={{ marginBottom: 20 }}>
        <WalletMultiButton />
      </div>

      {/* 铸造信息 */}
      {(() => {
        console.log('渲染时 config:', config);
        return null;
      })()}
      {config && (
        <div
          style={{
            background: "#f5f5f5",
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <p>
            铸造进度: {config.mintedCount} / {config.maxSupply}
          </p>
          <p>铸造价格: {config.mintPrice / 1e9} SOL</p>
          <p>单用户限制: {config.maxPerUser} 个</p>

          {/* 进度条 */}
          <div
            style={{
              background: "#ddd",
              borderRadius: 4,
              height: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#4caf50",
                height: "100%",
                width: `${(config.mintedCount / config.maxSupply) * 100}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      )}

      {/* 白名单状态 */}
      {config?.whitelistEnabled && connected && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            background: isWhitelisted ? "#e8f5e9" : "#ffebee",
          }}
        >
          {isWhitelisted ? "✅ 你在白名单中，可以铸造" : "❌ 你不在白名单中"}
        </div>
      )}

      {/* 铸造按钮 */}
      {connected && (
        <button
          onClick={handleMint}
          disabled={
            loading ||
            !config ||
            config.paused ||
            config.mintedCount >= config.maxSupply ||
            (config.whitelistEnabled && !isWhitelisted)
          }
          style={{
            width: "100%",
            padding: 16,
            fontSize: 18,
            background: loading ? "#ccc" : "#1976d2",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? "铸造中..."
            : `铸造 NFT (${config?.mintPrice ? config.mintPrice / 1e9 : "?"
            } SOL)`}
        </button>
      )}

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            color: "red",
            marginTop: 12,
            padding: 12,
            background: "#ffebee",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {/* 铸造成功 */}
      {mintResult && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "#e8f5e9",
            borderRadius: 8,
          }}
        >
          <h3>铸造成功！</h3>
          <p>
            Mint 地址:{" "}
            <a
              href={`https://explorer.solana.com/address/${mintResult.mintAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              {mintResult.mintAddress.slice(0, 8)}...
            </a>
          </p>
          <p>
            交易签名:{" "}
            <a
              href={`https://explorer.solana.com/tx/${mintResult.signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              {mintResult.signature.slice(0, 8)}...
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
