use crate::constant::POOL_SEED;
use crate::error::DexError;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = pool,
    )]
    pub lp_mint: InterfaceAccount<'info, Mint>,

    pub token_a_mint: InterfaceAccount<'info, Mint>,

    pub token_b_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = token_a_mint,
        associated_token::authority = pool,
    )]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = token_b_mint,
        associated_token::authority = pool,
    )]
    pub vault_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        space = Pool::SPACE,
        seeds = [POOL_SEED, token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    pub token_program: Program<'info, Token2022>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<CreatePool>) -> Result<()> {
    ///1. 检查两个代币的 Mint 地址不能相同
    require!(
        ctx.accounts.token_b_mint.key() != ctx.accounts.token_a_mint.key(),
        DexError::IdenticalMints
    );
    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.token_mint_a = ctx.accounts.token_a_mint.key();
    pool.token_mint_b = ctx.accounts.token_b_mint.key();
    pool.vault_a = ctx.accounts.vault_a.key();
    pool.vault_b = ctx.accounts.vault_b.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    pool.fee_numerator = 3; // 0.3% 的交易手续费
    pool.fee_denominator = 1000;
    pool.reserve_a = 0;
    pool.reserve_b = 0;
    pool.lp_total_supply = 0;
    pool.paused = false;
    pool.bump = ctx.bumps.pool;

    
    msg!(
        "Pool created successfully with authority: {},  Token A mint: {}, Token B mint: {}, LP mint: {}",
        pool.authority,pool.token_mint_a,pool.token_mint_b,pool.lp_mint
    );

    Ok(())
}
