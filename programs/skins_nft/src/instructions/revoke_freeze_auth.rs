use anchor_lang::prelude::*;
use anchor_spl::token::{self, spl_token::instruction::AuthorityType, Mint, SetAuthority, Token};

use crate::Config;

#[derive(Accounts)]
pub struct RevokeFreezeAuth<'info> {
    pub manager: Signer<'info>,

    #[account(
        mut,
        constraint=mint.freeze_authority.is_some() && mint.freeze_authority.unwrap() == config.key()
    )]
    pub mint: Account<'info, Mint>,

    ///CHECK:: config地址
    #[account(
        mut,
        seeds = [b"config"], bump,
        constraint = config.authority == manager.key()
    )]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,
}

pub fn revoke_freeze_auth(ctx: Context<RevokeFreezeAuth>) -> Result<()> {
    let accounts = SetAuthority {
        current_authority: ctx.accounts.config.to_account_info(),
        account_or_mint: ctx.accounts.mint.to_account_info(),
    };

    let config_bump = [ctx.bumps.config];
    let config_seeds = &[b"config".as_ref(), &config_bump];
    let signer_seeds = &[&config_seeds[..]];

    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            accounts,
            signer_seeds,
        ),
        AuthorityType::FreezeAccount,
        None,
    )?;

    msg!("已撤销冻结权限");

    Ok(())
}
