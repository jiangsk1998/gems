use anchor_lang::prelude::*;

#[event]
pub struct NftListedEvent {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct NftDelistedEvent {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct NftBoughtEvent {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub timestamp: i64,
}
