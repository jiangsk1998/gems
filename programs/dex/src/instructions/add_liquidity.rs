use crate::constant::{MINIMUM_LIQUIDITY, POOL_SEED};

use crate::error::DexError;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use anchor_spl::{token_2022, token_interface};

pub fn handler(
    ctx: Context<AddLiquidity>,
    amount_a: u64,
    amount_b: u64,
    min_lp_amount: u64, //滑点保护 如果铸造的LP数量小于这个值 就拒绝交易
) -> Result<()> {
    require!(amount_a > 0 && amount_b > 0, DexError::InvalidTokenAmount);

    let pool = &mut ctx.accounts.pool;

    let is_first_deposit = pool.reserve_a == 0 && pool.reserve_b == 0;

    //1.计算要铸造的LP Token数量 Raw
    let lp_to_mint = if is_first_deposit {
        //首次注入
        let product = (amount_a as u128)
            .checked_mul(amount_b as u128)
            .ok_or(DexError::Overflow)?;
        let lp_raw = integer_sqrt(product);
        //减去锁定的最小流动性
        lp_raw
            .checked_sub(MINIMUM_LIQUIDITY)
            .ok_or(DexError::InsufficientInitLiquidity)?
    } else {
        //后续注入 需要按照比例计算
        // 原理：按照比例最小的那个来决定实际注入量
        // 防止用户不按比例注入，扰乱池子价格
        let lp_supply = pool.lp_total_supply;
        let reserve_a = pool.reserve_a;
        let reserve_b = pool.reserve_b;

        // lp_a = lp_supply × amount_a / reserve_a
        let lp_amount_a = (amount_a as u128)
            .checked_mul(lp_supply as u128)
            .ok_or(DexError::Overflow)?
            .checked_div(reserve_a as u128)
            .ok_or(DexError::DivisionByZero)? as u64;

        // lp_b = lp_supply × amount_b / reserve_b
        let lp_amount_b = (amount_b as u128)
            .checked_mul(lp_supply as u128)
            .ok_or(DexError::Overflow)?
            .checked_div(reserve_b as u128)
            .ok_or(DexError::DivisionByZero)? as u64;
        lp_amount_a.min(lp_amount_b)
    };

    //2.滑点保护
    require!(lp_to_mint >= min_lp_amount, DexError::InvalidTokenAmount);
    require!(lp_to_mint > 0, DexError::ZeroAmount);

    //cpi 用户代币到金库
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program_a.to_account_info(),
            token_2022::TransferChecked {
                from: ctx.accounts.user_token_a.to_account_info(),

                mint: ctx.accounts.mint_a.to_account_info(),
                to: ctx.accounts.vault_a.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_a,
        ctx.accounts.mint_a.decimals,
    )?;

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program_b.to_account_info(),
            token_2022::TransferChecked {
                from: ctx.accounts.user_token_b.to_account_info(),

                mint: ctx.accounts.mint_b.to_account_info(),
                to: ctx.accounts.vault_b.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_a,
        ctx.accounts.mint_a.decimals,
    )?;

    //cpi lp token 到用户
    token_2022::mint_to_checked(
        CpiContext::new(
            ctx.accounts.token_program_2022.to_account_info(),
            token_2022::MintToChecked {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: pool.to_account_info(),
            },
        ),
        lp_to_mint,
        ctx.accounts.lp_mint.decimals,
    )?;

    //更新池子状态
    pool.reserve_a = pool
        .reserve_a
        .checked_add(amount_a)
        .ok_or(DexError::Overflow)?;
    pool.reserve_b = pool
        .reserve_b
        .checked_add(amount_b)
        .ok_or(DexError::Overflow)?;
    pool.lp_total_supply = pool
        .lp_total_supply
        .checked_add(lp_to_mint)
        .ok_or(DexError::Overflow)?;

    msg!(
        "Adding liquidity: user {}, amount_a {}, amount_b {}, lp_to_mint {}",
        ctx.accounts.user.key(),
        amount_a,
        amount_b,
        lp_to_mint
    );
    Ok(())
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED, pool.token_mint_a.as_ref(), pool.token_mint_b.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ DexError::PoolPaused,
        has_one = vault_a,
        has_one = vault_b,
        has_one = lp_mint
    )]
    pub pool: Box<Account<'info, Pool>>,

    ///LP Mint 铸造LP Token给用户
    #[account(mut)]
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        constraint = mint_a.key() == pool.token_mint_a @ DexError::InvalidMint,
    )]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        constraint = mint_b.key() == pool.token_mint_b @ DexError::InvalidMint,
    )]
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    ///代币A的金库地址
    #[account(mut)]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    ///代币B的金库地址
    #[account(mut)]
    pub vault_b: InterfaceAccount<'info, TokenAccount>,

    ///用户的代币A账户
    #[account(
        mut,
        token::mint = pool.token_mint_a,
        token::authority = user,
        token::token_program = token_program_a,
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    ///用户的代币A账户
    #[account(
        mut,
        token::mint = pool.token_mint_b,
        token::authority = user,
        token::token_program = token_program_b,
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    ///用户的LP Token账户，如果没有就创建
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program_2022,
    )]
    pub user_lp_token: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program_a: Interface<'info, TokenInterface>,
    pub token_program_b: Interface<'info, TokenInterface>,

    pub token_program_2022: Program<'info, Token2022>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

pub fn integer_sqrt(n: u128) -> u64 {
    if n < 2 {
        return n as u64;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_sanity() {
        assert_eq!(integer_sqrt(1), 1);
        assert_eq!(integer_sqrt(1), 1);
        assert_eq!(integer_sqrt(4), 2);
        assert_eq!(integer_sqrt(9), 3);
        assert_eq!(integer_sqrt(10000), 100);

        assert_eq!(integer_sqrt(99), 9);
    }
}
