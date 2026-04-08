use anchor_lang::prelude::*;

#[event]
pub struct PoolFeeUpdated {
    pub updated_by: Pubkey,
    pub new_fee_numerator: u64,
    pub new_fee_denominator: u64,
    pub pool: Pubkey,
}
#[event]
pub struct PoolPaused {
    pub paused_by: Pubkey,
    pub pool: Pubkey,
}

#[event]
pub struct PoolResume {
    pub resume_by: Pubkey,
    pub pool: Pubkey,
}

#[event]
pub struct SwapEvent {
    pub swap_by: Pubkey,
    pub pool: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub token_in: Pubkey,
    pub token_out: Pubkey,
}

#[event]
pub struct AddLiquidityEvent {
    pub added_by: Pubkey,
    pub pool: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub lp_amount: u64,
}

#[event]
pub struct RemoveLiquidityEvent {
    pub removed_by: Pubkey,
    pub pool: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub lp_amount: u64,
}
