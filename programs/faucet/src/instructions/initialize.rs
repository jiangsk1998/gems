
use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};




use crate::{CONFIG_SEED, Config, FaucetError};

/// 初始化水龙头
pub fn handler(
    ctx: Context<Initialize>,
    amount_per_claim: u64,
    cooldown_seconds: u64,
) -> Result<()> {
    require!(amount_per_claim > 0, FaucetError::InvalidAmountPerClaim);
    require!(cooldown_seconds > 0, FaucetError::InvalidCooldownSeconds);

    // 初始化Config账户
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.mint = ctx.accounts.mint.key();
    config.vault = ctx.accounts.vault.key();
    config.amount_per_claim = amount_per_claim;
    config.cooldown_seconds = cooldown_seconds as i64;
    config.total_distributed = 0;
    config.claim_count = 0;
    config.bump = ctx.bumps.config;

    msg!(
        "Faucet initialized with amount_per_claim: {}, cooldown_seconds: {}",
        amount_per_claim,
        cooldown_seconds
    );
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = Config::LEN, seeds = [CONFIG_SEED], bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(init, payer = admin,
        associated_token::mint = mint,
        associated_token::authority = config
    )]
    pub vault: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
