use crate::error::StakingError;
use crate::event::UnstakeRequestedEvent;
use crate::state::{StakePool, UserStake};
use anchor_lang::prelude::*;

pub const COOLDOWN_SECONDS: i64 = 3 * 24 * 60 * 60;

#[derive(Accounts)]
pub struct UnStake<'info> {
    #[account(mut,
     seeds = [b"stake_pool",pool.mint.as_ref()],
     bump=pool.bump,
    )]
    pub pool: Account<'info, StakePool>,

    #[account(mut,
        seeds = [b"user_stake", pool.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = user_stake.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<UnStake>, shares: u128) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let user_stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    require!(shares > 0, StakingError::ZeroAmount);

    require!(
        user_stake.shares >= shares,
        StakingError::InsufficientShares
    );

    require!(
        user_stake.unstaked_requested_at == 0,
        StakingError::ExistPendingUnstake
    );

    // 结算奖励
    pool.accrue_reward(clock.unix_timestamp)?;

    let token_amount = pool.shares_to_amount(shares);

    user_stake.shares = user_stake
        .shares
        .checked_sub(shares)
        .ok_or(StakingError::Overflow)?;
    user_stake.unstaked_requested_at = clock.unix_timestamp;
    user_stake.pending_unstake_shares = shares;

    pool.total_shares = pool
        .total_shares
        .checked_sub(shares)
        .ok_or(StakingError::Overflow)?;
    pool.total_staked = pool
        .total_staked
        .checked_sub(token_amount)
        .ok_or(StakingError::Overflow)?;

    if pool.total_shares > 0 {
        pool.share_price = pool.current_share_price();
    }

    //更新用户质押信息，按比例减少 staked_amount（避免负数）
    let shares_before = user_stake
        .shares
        .checked_add(shares)
        .ok_or(StakingError::Overflow)?;

    if shares_before > 0 {
        // 按比例减少 staked_amount（避免负数）
        let reduction = (user_stake.staked_amount as u128)
            .saturating_mul(shares)
            .checked_div(shares_before)
            .ok_or(StakingError::Overflow)? as u64;
        user_stake.staked_amount = user_stake
            .staked_amount
            .checked_sub(reduction)
            .ok_or(StakingError::Overflow)?;
    }

    emit!(UnstakeRequestedEvent {
        user: ctx.accounts.user.key(),
        pool: pool.key(),
        shares,
        token_amount,
        requested_at: clock.unix_timestamp,
    });

    msg!(
        "User {} requested to unstake {} shares ({} tokens) from pool {}, pending for cooldown",
        ctx.accounts.user.key(),
        shares,
        token_amount,
        pool.key()
    );

    Ok(())
}
