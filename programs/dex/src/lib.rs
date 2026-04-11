use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod event;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("GnQC2PEtVFHj5tgFWek3BFLYqh9KZfpaPpjbC6JeZPcC");

#[program]
pub mod dex {
    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        create_pool::handler(ctx)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
        min_lp_amount: u64,
    ) -> Result<()> {
        add_liquidity::handler(ctx, amount_a, amount_b, min_lp_amount)
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        a_to_b: bool,
    ) -> Result<()> {
        swap::handler(ctx, amount_in, min_amount_out, a_to_b)
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64,
        min_a: u64,
        min_b: u64,
    ) -> Result<()> {
        remove_liquidity::handler(ctx, lp_amount, min_a, min_b)
    }
}
