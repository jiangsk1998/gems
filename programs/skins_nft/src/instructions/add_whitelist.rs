use anchor_lang::prelude::*;

use crate::{error::SkinsNftError, state::Config, WhitelistEntry};

#[derive(AnchorDeserialize, AnchorSerialize)]

pub struct AddWhitelistParams {
    ///可铸造数量
    pub mint_amount: u64,
}

#[derive(Accounts)]
pub struct AddWhitelist<'info> {
    ///管理员账户
    #[account(mut)]
    pub authority: Signer<'info>,

    ///配置账户
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    ///CHECK: 白名单账户，只存地址
    pub user: UncheckedAccount<'info>,

    ///白名单条目
    #[account(
        init,
        payer = authority,
        space = WhitelistEntry::INIT_SPACE,
        seeds = [b"whitelist_entry", user.key().as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    ///系统程序
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddWhitelist>, args: AddWhitelistParams) -> Result<()> {
    require!(
        ctx.accounts.config.max_mint_per_address >= args.mint_amount,
        SkinsNftError::MintAmountExceedsMaxPerAddress
    );

    let whitelist_entry = &mut ctx.accounts.whitelist_entry;

    whitelist_entry.remaining_mints = args.mint_amount;
    whitelist_entry.address = ctx.accounts.user.key();
    whitelist_entry.is_added = true;

    Ok(())
}
