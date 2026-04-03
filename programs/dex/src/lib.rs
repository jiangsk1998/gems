use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod instructions;
pub mod state; // 告诉编译器：去寻找 state 目录或 state.rs 文件

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
}
