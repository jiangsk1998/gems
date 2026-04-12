pub mod errors;
pub mod event;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("FMk4EiXKP5e9DMyz7p4LPbPszTLNMPi7BF8EFJCSZM4z");

#[program]
pub mod nft_marketplace {
    use super::*;

    /// 挂单：卖家将 NFT 托管给合约，设置 $Tangaga 价格
    pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
        instructions::list_nft::list_nft(ctx, price)
    }

    /// 下架：卖家取回 NFT，关闭挂单记录
    pub fn delist_nft(ctx: Context<DelistNft>) -> Result<()> {
        instructions::delist_nft::delist_nft(ctx)
    }

    /// 购买：买家支付 $Tangaga，原子性获得 NFT
    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        instructions::buy_nft::buy_nft(ctx)
    }
}
