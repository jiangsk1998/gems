use crate::error::StakingError;
use crate::state::StakePool;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::event::DepositRewardEvent;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DepositReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut,
            seeds = [b"stake_pool",mint.key().as_ref()],
            bump = pool.bump,
            constraint = pool.admin == user.key() @ crate::error::StakingError::Unauthorized,
        )]
    pub pool: Account<'info, StakePool>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
     associated_token::mint = mint,
     associated_token::authority = pool,
     associated_token::token_program = token_program,
    )]
    pub stake_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        token::mint = mint,
        token::authority = user,
        token::token_program = token_program,
        constraint = admin_token_account.amount >= amount @ StakingError::InsufficientFunds,
        constraint = admin_token_account.mint == mint.key() @ StakingError::InvalidMint,
        constraint = admin_token_account.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub admin_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<DepositReward>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::InvalidAmount);
    require!(
        ctx.accounts.pool.total_shares > 0,
        StakingError::NoStakersYet // 没人质押时不能注入奖励，会导致代币永久锁死
    );

    let pool = &mut ctx.accounts.pool;
    pool.total_staked = pool
        .total_staked
        .checked_add(amount)
        .ok_or(crate::error::StakingError::Overflow)?;

    pool.share_price = pool.current_share_price();

    // 转移奖励到质押金库
    let cpi_accounts = anchor_spl::token_interface::TransferChecked {
        from: ctx.accounts.admin_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.stake_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    anchor_spl::token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    msg!(
        "Admin {} deposited {} rewards to pool {}",
        ctx.accounts.user.key(),
        amount,
        pool.key()
    );
    emit!(DepositRewardEvent {
        admin: ctx.accounts.user.key(),
        pool: pool.key(),
        amount,
        new_share_price: pool.share_price,
    });
    Ok(())
}
