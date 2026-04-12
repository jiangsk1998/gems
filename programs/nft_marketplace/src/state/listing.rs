use anchor_lang::prelude::*;

/// 挂单账户 —— 每个 NFT 挂单对应一个 Listing PDA
/// Java 类比：相当于数据库里的 nft_listings 表的一条记录
#[account]
pub struct Listing {
    /// 卖家地址（只有这个人能下架）
    pub seller: Pubkey, // 32 字节

    /// 挂售的 NFT Mint 地址（唯一标识这个 NFT）
    pub nft_mint: Pubkey, // 32 字节

    /// 挂单价格（单位：$Tangaga最小单位，如 lamport 对应 SOL）
    /// 例如：$Tangaga 精度 6 位，price = 100_000_000 表示 100 $Tangaga
    pub price: u64, // 8 字节

    /// PDA bump，签名时需要
    pub bump: u8, // 1 字节

    /// 托管账户 bump（escrow token account）
    pub escrow_bump: u8, // 1 字节
}

impl Listing {
    /// 计算账户空间（INIT_SPACE 宏会自动，也可手动计算）
    /// 8 (discriminator) + 32 + 32 + 8 + 1 + 1 = 82 字节
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1;
}
