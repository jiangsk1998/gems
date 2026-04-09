use crate::state::{StakePool, SCALE};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Init<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
    init,
    payer = admin,
    space = StakePool::LEN,
    seeds = [b"stake_pool",mint.key().as_ref()],
    bump,
    )]
    pub pool: Box<Account<'info, StakePool>>,

    #[account(
    init,
    payer = admin,
    associated_token::mint = mint,
    associated_token::authority = pool,
    )]
    pub stake_vault: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Init>, reward_rate: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.admin = ctx.accounts.admin.key();
    pool.mint = ctx.accounts.mint.key();
    pool.stake_vault = ctx.accounts.stake_vault.key();
    pool.reward_rate = reward_rate;
    pool.total_staked = 0;
    pool.total_shares = 0;
    pool.last_reward_time = 0;
    pool.share_price = SCALE;
    pool.bump = ctx.bumps.pool;

    msg!(
        "Stake pool initialized by admin {}: pool {}, mint {}, stake vault {}, reward rate {}",
        ctx.accounts.admin.key(),
        pool.key(),
        pool.mint,
        pool.stake_vault,
        pool.reward_rate
    );

    Ok(())
}
