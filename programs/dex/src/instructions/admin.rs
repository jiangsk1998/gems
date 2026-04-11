use crate::error::DexError;
use crate::event::{PoolFeeUpdated, PoolPaused, PoolResume};
use crate::state::Pool;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ManagePool<'info> {
    pub admin: Signer<'info>,

    #[account(mut,
        seeds = [crate::constant::POOL_SEED, pool.token_mint_a.key().as_ref(), pool.token_mint_b.key().as_ref()],
        bump = pool.bump,
        constraint = pool.authority == admin.key() @ DexError::Unauthorized,
    )]
    pub pool: Account<'info, Pool>,
}

pub fn pause(ctx: Context<ManagePool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.paused = true;
    msg!(
        "Pool paused by admin {}: pool {}, token_a {}, token_b {}",
        ctx.accounts.admin.key(),
        pool.key(),
        pool.token_mint_a,
        pool.token_mint_b
    );

    emit!(PoolPaused {
        pool: pool.key(),
        paused_by: ctx.accounts.admin.key(),
    });

    Ok(())
}

pub fn resume(ctx: Context<ManagePool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.paused = false;

    msg!(
        "Pool resumed by admin {}: pool {}, token_a {}, token_b {}",
        ctx.accounts.admin.key(),
        pool.key(),
        pool.token_mint_a,
        pool.token_mint_b
    );

    emit!(PoolResume {
        pool: pool.key(),
        resume_by: ctx.accounts.admin.key(),
    });

    Ok(())
}

pub fn update_fee(
    ctx: Context<ManagePool>,
    new_fee_numerator: u64,
    new_fee_denominator: u64,
) -> Result<()> {
    require!(new_fee_denominator > 0, DexError::DivisionByZero);

    require!(
        new_fee_numerator * 10 <= new_fee_denominator,
        DexError::InvalidFee
    );

    let pool = &mut ctx.accounts.pool;
    pool.fee_numerator = new_fee_numerator;
    pool.fee_denominator = new_fee_denominator;

    msg!(
        "Pool fee updated by admin {}: pool {}, token_a {}, token_b {}, new_fee {}/{}",
        ctx.accounts.admin.key(),
        pool.key(),
        pool.token_mint_a,
        pool.token_mint_b,
        new_fee_numerator,
        new_fee_denominator
    );

    emit!(PoolFeeUpdated {
        pool: pool.key(),
        updated_by: ctx.accounts.admin.key(),
        new_fee_numerator,
        new_fee_denominator,
    });

    Ok(())
}
