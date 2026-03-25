use anchor_lang::prelude::{program_option::COption, *};
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{self, Metadata},
    token::{self, FreezeAccount, Mint, Token, TokenAccount},
};

use crate::error::SkinsNftError;
#[derive(Accounts)]
pub struct FreezeNft<'info> {
    
    /// Freeze Authority，冻结权限账户
    pub freeze_authority: Signer<'info>,   //不需要付租金

    /// NFT的Mint账户
    #[account(
        constraint = mint.freeze_authority == COption::Some(freeze_authority.key()) @ SkinsNftError::InvalidFreezeAuthority,
    )]
    pub mint: Account<'info, Mint>,

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


pub fn handler(ctx:Context<FreezeNft>)->Result<()>{
    let accounts = FreezeAccount{
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);
    
    token::freeze_account(cpi_ctx)?;

    msg!("账户已冻结");
    Ok(())
}