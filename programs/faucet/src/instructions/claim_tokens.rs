use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_2022::{self, Token2022}, token_interface::{Mint, TokenAccount}};

use crate::{Config, ClaimRecord, FaucetError, CONFIG_SEED, CLAIM_RECORD_SEED};

pub fn handler(ctx: Context<ClaimTokens>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let claim_record = &mut ctx.accounts.claim_record;
    let clock = Clock::get()?;

    // 检查冷却时间
    if clock.unix_timestamp.checked_sub(claim_record.last_claim_at) < Option::from(config.cooldown_seconds) {
        return Err(FaucetError::CooldownNotFinished.into());
    }

    // 转账逻辑
    token_2022::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_2022::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: config.to_account_info(),
            },
            &[&[CONFIG_SEED, &[config.bump]]],
        ),
        config.amount_per_claim,
    )?;

    // 更新领取记录
    claim_record.last_claim_at = clock.unix_timestamp;
    claim_record.total_claimed = claim_record.total_claimed.checked_add(config.amount_per_claim).ok_or(FaucetError::MathOverflow)?;
    claim_record.claim_count = claim_record.claim_count.checked_add(1).ok_or(FaucetError::MathOverflow)?;

    // 更新配置中的统计数据
    config.total_distributed = config.total_distributed.checked_add(config.amount_per_claim).ok_or(FaucetError::MathOverflow)?;
    config.claim_count = config.claim_count.checked_add(1).ok_or(FaucetError::MathOverflow)?;

    msg!("成功领取 {} 代币", config.amount_per_claim);

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        constraint = config.vault == vault.key() @ FaucetError::InvalidVault,
        constraint = config.mint == mint.key() @ FaucetError::InvalidMint,
    )]
    pub config: Box<Account<'info, Config>>,


    pub mint: InterfaceAccount<'info, Mint>,
    
    
    #[account(
        init_if_needed, payer = user, space = ClaimRecord::LEN,
        seeds = [CLAIM_RECORD_SEED, user.key().as_ref()], bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    #[account(mut,
        token::mint = config.mint,
        token::authority = config
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed, 
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    
}        