use anchor_lang::prelude::{program_option::COption, *};
use anchor_spl::token::{self, spl_token::instruction::AuthorityType, Mint, SetAuthority, Token};

#[derive(Accounts)]
pub struct RevokeFreezeAuth<'info> {
    pub current_auth: Signer<'info>,

    #[account(
        mut,
        constraint=mint.freeze_authority==COption::Some(current_auth.key())
    )]
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

pub fn revoke_freeze_auth(ctx: Context<RevokeFreezeAuth>) -> Result<()> {
    let accounts = SetAuthority {
        current_authority: ctx.accounts.current_auth.to_account_info(),
        account_or_mint: ctx.accounts.mint.to_account_info(),
    };
    token::set_authority(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts),
        AuthorityType::FreezeAccount,
        None,
    )?;

    msg!("已撤销冻结权限");

    Ok(())
}
