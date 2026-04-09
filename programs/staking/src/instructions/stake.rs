use crate::error::StakingError;
use crate::event::StakeEvent;
use crate::state::{StakePool, UserStake, SCALE};
use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
     init_if_needed,
     payer = user,
     space = UserStake::LEN,
     seeds = [b"user_stake",pool.key().as_ref(), user.key().as_ref()],
     bump,
    )]
    pub user_stake: Account<'info, UserStake>,
    #[account(mut)]
    pub pool: Account<'info, StakePool>,

    #[account(
      mut,
      associated_token::mint = pool.mint,
      associated_token::authority = user,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub stake_vault: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::InvalidAmount);
    let pool = &mut ctx.accounts.pool;

    let user_stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    // 1.计算本次质押获得的份额数
    let shares_to_mint: u128 = if pool.total_shares == 0 {
        amount as u128
    } else {
        (amount as u128)
            .checked_mul(SCALE)
            .ok_or(StakingError::Overflow)?
            .checked_div(pool.share_price as u128)
            .ok_or(StakingError::Overflow)?
    };

    require!(shares_to_mint > 0, StakingError::InsufficientFunds);
    //2.更新池状态
    pool.total_shares = pool
        .total_shares
        .checked_add(shares_to_mint)
        .ok_or(StakingError::Overflow)?;
    pool.total_staked = pool
        .total_staked
        .checked_add(amount)
        .ok_or(StakingError::Overflow)?;
    pool.share_price = (pool.total_staked as u128)
        .checked_mul(SCALE)
        .ok_or(StakingError::Overflow)?
        .checked_div(pool.total_shares as u128)
        .ok_or(StakingError::Overflow)? as u128;

    pool.last_reward_time = clock.unix_timestamp;

    //3.更新用户状态
    user_stake.owner = ctx.accounts.user.key();

    user_stake.pool = pool.key();

    user_stake.shares = user_stake
        .shares
        .checked_add(shares_to_mint)
        .ok_or(StakingError::Overflow)?;

    user_stake.staked_amount = user_stake
        .staked_amount
        .checked_add(amount)
        .ok_or(StakingError::Overflow)?;

    user_stake.bump = ctx.bumps.user_stake;

    //4.转移用户的质押代币到质押金库
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.user_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.stake_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    msg!(
        "User {} staked {} tokens and received {} shares",
        ctx.accounts.user.key(),
        amount,
        shares_to_mint
    );

    emit!(StakeEvent {
        user: ctx.accounts.user.key(),
        share_price: pool.share_price,
        timestamp: clock.unix_timestamp,
        amount,
        shares: shares_to_mint,
    });

    Ok(())
}
