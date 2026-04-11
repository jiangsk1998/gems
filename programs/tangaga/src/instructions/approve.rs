use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, Approve, Token2022}, token_interface::TokenAccount,
};

use crate::error::CustomError;
use crate::event::ApprovedEvent;

#[derive(Accounts)]
pub struct ApproveDelegate<'info> {
    //原所有者
    #[account(mut)]
    pub owner: Signer<'info>,

    //要授权的Token Account
    #[account(
        mut,
        constraint=token_account.owner==owner.key() @ CustomError::NotOwnerOfToken
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    //被授权人  只存公钥 不需要验证
    ///CHECK: 被授权人不需要验证
    pub delegate: UncheckedAccount<'info>,

    //token_program
    pub token_program: Program<'info, Token2022>,
}

pub fn handle(ctx: Context<ApproveDelegate>, amount: u64) -> Result<()> {
    let accounts = Approve {
        to: ctx.accounts.token_account.to_account_info(),
        delegate: ctx.accounts.delegate.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };

    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);

    token_2022::approve(cpi_context, amount)?;

    msg!(
        "授权成功: 授予 {} 额度 {}",
        ctx.accounts.delegate.key(),
        amount
    );
    emit!(ApprovedEvent {
        owner: ctx.accounts.owner.key(),
        delegate: ctx.accounts.delegate.key(),
        token_account: ctx.accounts.token_account.key(),
        amount,
    });
    Ok(())
}
