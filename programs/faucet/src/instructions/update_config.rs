use anchor_lang::prelude::*;

use crate::{event::ConfigUpdatedEvent, Config, FaucetError, CONFIG_SEED};

/// 初始化水龙头
pub fn handler(
    ctx: Context<UpdateConfig>,
    amount_per_claim: u64,
    cooldown_seconds: u64,
) -> Result<()> {
    require!(amount_per_claim > 0, FaucetError::InvalidAmountPerClaim);
    require!(cooldown_seconds > 0, FaucetError::InvalidCooldownSeconds);

    // 更新Config账户
    let config = &mut ctx.accounts.config;
    if let Some(amount) = Option::Some(amount_per_claim) {
        config.amount_per_claim = amount;
    }
    if let Some(cooldown) = Option::Some(cooldown_seconds) {
        config.cooldown_seconds = cooldown as i64;
    }

    msg!(
        "Faucet config updated: amount_per_claim: {}, cooldown_seconds: {}",
        config.amount_per_claim,
        config.cooldown_seconds
    );
    emit!(ConfigUpdatedEvent {
        admin: ctx.accounts.admin.key(),
        amount_per_claim: config.amount_per_claim,
        cooldown_seconds: config.cooldown_seconds,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump,
        constraint = config.admin == admin.key() @ FaucetError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(mut)]
    pub admin: Signer<'info>,
}
