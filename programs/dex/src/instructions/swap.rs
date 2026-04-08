use crate::constant::POOL_SEED;
use crate::error::DexError;
use crate::instructions::SwapEvent;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

pub fn handler(
    ctx: Context<Swap>,
    amount_in: u64,      //用户输入的代币数量
    min_amount_out: u64, //最少接受的输出量（滑点保护）
    a_to_b: bool,        //交换方向：true表示A换B，false表示B换A
) -> Result<()> {
    require!(amount_in > 0, DexError::ZeroAmount);

    let pool = &mut ctx.accounts.pool;

    //1.确定交换方向
    let ((reserve_in, reserve_out), (input_vault, output_vault)) = if a_to_b {
        (
            (pool.reserve_a, pool.reserve_b),
            (&ctx.accounts.vault_a, &ctx.accounts.vault_b),
        )
    } else {
        (
            (pool.reserve_b, pool.reserve_a),
            (&ctx.accounts.vault_b, &ctx.accounts.vault_a),
        )
    };

    //验证用户输入的代币账户是否正确
    require!(
        (a_to_b && ctx.accounts.user_input.mint == pool.token_mint_a)
            || (!a_to_b && ctx.accounts.user_input.mint == pool.token_mint_b),
        DexError::InvalidMint
    );

    // 防止自转（输入输出是同一个账户）
    require!(
        ctx.accounts.user_input.key() != ctx.accounts.user_put.key(),
        DexError::InvalidMint
    );

    //2.计算输出金额

    let fee_factor = pool
        .fee_denominator
        .checked_sub(pool.fee_numerator)
        .ok_or(DexError::Overflow)?;

    let dx_effected = (amount_in as u128)
        .checked_mul(fee_factor as u128)
        .ok_or(DexError::Overflow)?;

    let numerator = (reserve_out as u128)
        .checked_mul(dx_effected)
        .ok_or(DexError::Overflow)?;

    let denominator = (reserve_in as u128)
        .checked_mul(pool.fee_denominator as u128)
        .ok_or(DexError::Overflow)?
        .checked_add(dx_effected)
        .ok_or(DexError::Overflow)?;

    require!(denominator > 0, DexError::DivisionByZero);

    let amount_out = numerator
        .checked_div(denominator)
        .ok_or(DexError::DivisionByZero)? as u64;

    //3.滑点保护
    require!(
        amount_out >= min_amount_out && amount_out > 0,
        DexError::SlippageExceeded
    );
    require!(reserve_out >= amount_out, DexError::Overflow);

    //4.执行交换
    let (in_decimals, out_decimals) = if a_to_b {
        (ctx.accounts.mint_a.decimals, ctx.accounts.mint_b.decimals)
    } else {
        (ctx.accounts.mint_b.decimals, ctx.accounts.mint_a.decimals)
    };

    token_interface::transfer_checked(
        CpiContext::new(
            if a_to_b {
                ctx.accounts.token_program_a.to_account_info()
            } else {
                ctx.accounts.token_program_b.to_account_info()
            },
            token_interface::TransferChecked {
                from: ctx.accounts.user_input.to_account_info(),
                mint: if a_to_b {
                    ctx.accounts.mint_a.to_account_info()
                } else {
                    ctx.accounts.mint_b.to_account_info()
                },
                to: input_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_in,
        in_decimals,
    )?;

    let pool_seeds: &[&[u8]] = &[
        POOL_SEED,
        pool.token_mint_a.as_ref(),
        pool.token_mint_b.as_ref(),
        &[pool.bump],
    ];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            // 输出方向与输入方向相反：a_to_b 时输出是 token_b，反之是 token_a
            if a_to_b {
                ctx.accounts.token_program_b.to_account_info()
            } else {
                ctx.accounts.token_program_a.to_account_info()
            },
            token_interface::TransferChecked {
                from: output_vault.to_account_info(),
                mint: if a_to_b {
                    ctx.accounts.mint_b.to_account_info()
                } else {
                    ctx.accounts.mint_a.to_account_info()
                },
                to: ctx.accounts.user_put.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[pool_seeds],
        ),
        amount_out,
        out_decimals,
    )?;

    //5.更新池子状态
    if a_to_b {
        pool.reserve_a = pool
            .reserve_a
            .checked_add(amount_in)
            .ok_or(DexError::Overflow)?;
        pool.reserve_b = pool
            .reserve_b
            .checked_sub(amount_out)
            .ok_or(DexError::Overflow)?;
    } else {
        pool.reserve_b = pool
            .reserve_b
            .checked_add(amount_in)
            .ok_or(DexError::Overflow)?;
        pool.reserve_a = pool
            .reserve_a
            .checked_sub(amount_out)
            .ok_or(DexError::Overflow)?;
    }

    msg!(
        "User {} swapped {} of token {} for {} of token {}",
        ctx.accounts.user.key(),
        amount_in,
        if a_to_b {
            pool.token_mint_a
        } else {
            pool.token_mint_b
        },
        amount_out,
        if a_to_b {
            pool.token_mint_b
        } else {
            pool.token_mint_a
        },
    );

    emit!(SwapEvent {
        swap_by: ctx.accounts.user.key(),
        pool: pool.key(),
        amount_in,
        amount_out,
        token_in: if a_to_b {
            pool.token_mint_a
        } else {
            pool.token_mint_b
        },
        token_out: if a_to_b {
            pool.token_mint_b
        } else {
            pool.token_mint_a
        },
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Swap<'info> {
    ///用户钱包
    #[account(mut)]
    pub user: Signer<'info>,

    ///验证池子状态，更新储备量
    #[account(mut,
        seeds = [POOL_SEED, pool.token_mint_a.as_ref(), pool.token_mint_b.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ DexError::PoolPaused,
        has_one = vault_a,
        has_one = vault_b,
    )]
    pub pool: Box<Account<'info, Pool>>,

    ///代币A的Mint
    #[account(constraint = mint_a.key() == pool.token_mint_a @ DexError::InvalidMint)]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,

    ///代币B的Mint
    #[account(constraint = mint_b.key() == pool.token_mint_b @ DexError::InvalidMint)]
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    ///代币A的金库
    #[account(mut)]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    ///代币B的金库
    #[account(mut)]
    pub vault_b: InterfaceAccount<'info, TokenAccount>,

    ///用户输入的代币账户，可能是代币A或代币B
    /// CHECK: 在handle中验证mint是否匹配
    #[account(mut)]
    pub user_input: InterfaceAccount<'info, TokenAccount>,

    ///用户输入的代币账户，可能是代币A或代币B
    /// CHECK: 在handle中验证mint是否匹配
    #[account(mut)]
    pub user_put: InterfaceAccount<'info, TokenAccount>,

    pub token_program_a: Interface<'info, TokenInterface>,
    pub token_program_b: Interface<'info, TokenInterface>,

    pub token_program_2022: Program<'info, Token2022>,
}
