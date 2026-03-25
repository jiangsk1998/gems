use anchor_lang::prelude::*;

use crate::error::SkinsNftError;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    ///合约创建者，必须是签名者
    #[account(mut)]
    pub authority: Signer<'info>,

    ///配置账户，初始化时创建
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump,
        // 首次初始化：config.authority 为零地址（新账户数据全0），允许任意人创建
        // 重新初始化：必须是当前 authority 才能修改
        constraint = config.authority == authority.key() || config.authority == Pubkey::default()
            @ SkinsNftError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub whitelist_enabled: bool,
    pub mint_price: u64,
    pub max_supply: u64,
    pub max_mint_per_address: u64,
}

pub fn handler(ctx: Context<Initialize>, args: InitializeParams) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.whitelist_enabled = args.whitelist_enabled;
    config.mint_price = args.mint_price;
    config.max_supply = args.max_supply;
    config.max_mint_per_address = args.max_mint_per_address;
    config.mint_paused = false;
    config.minted_count = 0;
    config.created_at = Clock::get()?.unix_timestamp;
    msg!(
        "Contract initialized successfully with authority: {}",
        config.authority
    );
    Ok(())
}
