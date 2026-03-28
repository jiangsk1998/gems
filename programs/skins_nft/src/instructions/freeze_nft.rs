use anchor_lang::prelude::*;
use anchor_spl::token::{self, FreezeAccount, Mint, Token, TokenAccount};

use crate::{error::SkinsNftError, Config};
#[derive(Accounts)]
pub struct FreezeNft<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,


    /// NFT的Mint账户
    #[account(
        constraint = mint.freeze_authority.is_some() && mint.freeze_authority.unwrap() == config.key() @ SkinsNftError::InvalidFreezeAuthority,
    )]
    pub mint: Account<'info, Mint>,

    ///CHECK:: config地址
    #[account(
        seeds = [b"config"], bump,
        constraint = config.authority == manager.key()
    )]
    pub config: Account<'info, Config>,

    /// 要冻结的TokenAccount账户
    #[account(
        mut,
        constraint = token_account.mint == mint.key(),
        constraint =  !token_account.is_frozen()
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// Token Program
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FreezeNft>) -> Result<()> {
    let accounts = FreezeAccount {
        account: ctx.accounts.token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
    };

    let config_bump = [ctx.bumps.config];
    let config_seeds = &[b"config".as_ref(), &config_bump];
    let signer_seeds = &[&config_seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        accounts,
        signer_seeds,
    );

    token::freeze_account(cpi_ctx)?;

    msg!("账户已冻结");
    Ok(())
}
