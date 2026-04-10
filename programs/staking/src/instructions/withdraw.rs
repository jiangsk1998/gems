use crate::error::StakingError;
use crate::event::WithdrawEvent;
use crate::instructions::COOLDOWN_SECONDS;
use crate::state::{StakePool, UserStake, SCALE};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::mpl_token_metadata::types::TokenDelegateRole::Staking;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut,
     token::mint = pool.mint,
     token::authority = user,
     token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
      associated_token::mint = mint,
      associated_token::authority = pool,
      associated_token::token_program = token_program,
    )]
    pub stake_vault: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

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

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let user_stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    require!(
        user_stake.unstaked_requested_at > 0,
        StakingError::NoPendingUnstake
    );

    // ===== 校验：冷却期是否已满 =====
    // Java 类比：LocalDateTime.now().isAfter(unlockTime)
    let unlock_time = user_stake.unstaked_requested_at + COOLDOWN_SECONDS;
    require!(
        clock.unix_timestamp >= unlock_time,
        StakingError::CooldownNotFinished
    );

    // ===== 计算可取回的金额 =====
    let shares = user_stake.pending_unstake_shares;
    let token_amount = pool.shares_to_amount(shares);

    require!(token_amount > 0, StakingError::InsufficientShares);

    user_stake.pending_unstake_shares = 0;

    user_stake.unstaked_requested_at = 0;

    let seeds = &[b"stake_pool".as_ref(), pool.mint.as_ref(), &[pool.bump]];

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.stake_vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[seeds],
        ),
        token_amount,
        ctx.accounts.mint.decimals,
    )?;

    emit!(WithdrawEvent {
        user: ctx.accounts.user.key(),
        pool: pool.key(),
        token_amount,
    });

    msg!(
        "User {} withdrew {} tokens from pool {}",
        ctx.accounts.user.key(),
        token_amount,
        pool.key()
    );

    Ok(())
}
