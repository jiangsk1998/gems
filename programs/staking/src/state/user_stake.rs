use anchor_lang::prelude::*;

#[account]
pub struct UserStake {
    pub owner: Pubkey,
    pub pool: Pubkey,

    pub shares: u128,

    pub staked_amount: u64,

    pub unstaked_requested_at: i64, //0 未请求解质押

    pub pending_unstake_shares: u128,

    pub bump: u8,
}

impl UserStake {
    pub const LEN: usize = 8 + 32 + 32 + 16 + 8 + 8 + 8 + 1;
}
