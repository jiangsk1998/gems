use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{Config, FaucetError, CONFIG_SEED};

pub fn handler(ctx: Context<DepositsTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, FaucetError::InvalidDepositAmount);
    let config = &ctx.accounts.config;
    // 转账逻辑

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.admin_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
            &[&[CONFIG_SEED, &[config.bump]]],
        ),
        amount,
    )?;

    msg!("成功存入 {} 代币到水龙头金库", amount);

    Ok(())
}

/// 管理员向水龙头金库账户存入代币 账户列表结构
#[derive(Accounts)]
pub struct DepositsTokens<'info> {
    ///Config账户
    #[account(seeds = [CONFIG_SEED], bump = config.bump,
        constraint = config.admin == admin.key() @ FaucetError::Unauthorized,
        constraint = config.vault == vault.key() @ FaucetError::InvalidVault,
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut,
        token::mint = config.mint,
        token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    #[account()]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    
    pub system_program: Program<'info, System>,
}
