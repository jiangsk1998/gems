use crate::constant::POOL_SEED;
use crate::error::DexError;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::token::accessor::amount;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount, TokenInterface};
use anchor_spl::{token_2022, token_interface};

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut,
                seeds = [POOL_SEED, pool.token_mint_a.key().as_ref(), pool.token_mint_b.key().as_ref()],
    bump = pool.bump,
    constraint = !pool.paused,
    has_one = vault_a,
    has_one = vault_b,
    has_one = lp_mint,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut)]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub vault_b: InterfaceAccount<'info, TokenAccount>,

    ///LP Mint 销毁LP Token
    pub lp_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        token::mint = pool.token_mint_a,
        token::authority = user,
    )]
    pub user_token_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        token::mint = pool.token_mint_b,
    token::authority = user,
    )]
    pub user_token_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = lp_mint,
        token::authority = user,
    )]
    pub user_lp_token: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program_a: Interface<'info, TokenInterface>,
    pub token_program_b: Interface<'info, TokenInterface>,

    pub token_program_2022: Program<'info, Token2022>,
}

pub fn handler(
    ctx: Context<RemoveLiquidity>,
    lp_amount: u64, //用户想要移除的流动性数量，单位是LP Token
    min_a: u64,     //用户期望至少收到的代币A数量，防止滑点过大
    min_b: u64,     //用户期望至少收到的代币B数量，防止滑点过大
) -> Result<()> {
    require!(lp_amount > 0, DexError::ZeroAmount);

    let pool = &mut ctx.accounts.pool;

    require!(
        ctx.accounts.user_lp_token.amount >= lp_amount,
        DexError::InsufficientLiquidity
    );

    // 计算按比例取回的代币数量
    // amount_a = reserve_a × lp_amount / lp_total
    // amount_b = reserve_b × lp_amount / lp_total
    let lp_total = pool.lp_total_supply;
    let amount_a = (pool.reserve_a as u128)
        .checked_mul(lp_amount as u128)
        .unwrap()
        .checked_div(lp_total as u128)
        .ok_or(DexError::DivisionByZero)? as u64;
    let amount_b = (pool.reserve_b as u128)
        .checked_mul(lp_amount as u128)
        .unwrap()
        .checked_div(lp_total as u128)
        .ok_or(DexError::DivisionByZero)? as u64;

    // 滑点保护
    require!(amount_a >= min_a, DexError::InvalidTokenAmount);
    require!(amount_b >= min_b, DexError::InvalidTokenAmount);
    require!(amount_a > 0 && amount_b > 0, DexError::ZeroAmount);

    //销毁用户的Token
    token_2022::burn(
        CpiContext::new(
            ctx.accounts.token_program_2022.to_account_info(),
            token_2022::Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        lp_amount,
    )?;

    token_interface::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program_a.to_account_info(),
            token_2022::Transfer {
                from: ctx.accounts.vault_a.to_account_info(),
                to: ctx.accounts.user_token_a.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[&[
                POOL_SEED,
                pool.token_mint_a.as_ref(),
                pool.token_mint_b.as_ref(),
                &[pool.bump],
            ]],
        ),
        amount_a,
    )?;

    token_interface::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program_b.to_account_info(),
            token_2022::Transfer {
                from: ctx.accounts.vault_b.to_account_info(),
                to: ctx.accounts.user_token_b.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[&[
                POOL_SEED,
                pool.token_mint_a.as_ref(),
                pool.token_mint_b.as_ref(),
                &[pool.bump],
            ]],
        ),
        amount_a,
    )?;

    //更新pool状态
    pool.reserve_a = pool
        .reserve_a
        .checked_sub(amount_a)
        .ok_or(DexError::Overflow)?;
    pool.reserve_b = pool
        .reserve_b
        .checked_sub(amount_b)
        .ok_or(DexError::Overflow)?;
    pool.lp_total_supply = pool
        .lp_total_supply
        .checked_sub(lp_amount)
        .ok_or(DexError::Overflow)?;

    msg!(
        "User {} removed liquidity: burned {} LP tokens, received {} of token {} and {} of token {}",
        ctx.accounts.user.key(),
        lp_amount,
        amount_a,
        pool.token_mint_a,
        amount_b,
        pool.token_mint_b
    );

    Ok(())
}
