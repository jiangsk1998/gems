use anchor_lang::prelude::*;

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub shares: u128,
    pub share_price: u128,
    pub timestamp: i64,
}

#[event]
pub struct UnstakeRequestedEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub shares: u128,
    pub token_amount: u64,
    pub requested_at: i64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub token_amount: u64,
}
