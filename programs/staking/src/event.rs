use anchor_lang::prelude::*;

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub shares: u128,
    pub share_price: u128,
    pub timestamp: i64,
}
