use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, accessor::authority, CloseAccount, Mint, Token, TokenAccount, Transfer},
};

use crate::accounts;
use crate::event::NftTransferredEvent;

#[derive(Accounts)]
pub struct TransNFT<'info> {
    // 持有者
    #[account(mut)]
    pub owner: Signer<'info>,

    //Mint
    pub mint: Account<'info, Mint>,

    //from_ata
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub from_ata: Account<'info, TokenAccount>, // 发送方的快递柜

    ///CHECK:只接收代币
    pub reviver: UncheckedAccount<'info>,

    #[account(
        init_if_needed, // 如果接收方没柜子，自动建一个
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = reviver,
    )]
    pub to_ata: Account<'info, TokenAccount>, // 接收方的快递柜

    //to_ata
    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<TransNFT>) -> Result<()> {
    let accounts = Transfer {
        from: ctx.accounts.from_ata.to_account_info(),
        to: ctx.accounts.to_ata.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };

    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);

    token::transfer(cpi_context, 1)?;

    let close_accounts = CloseAccount {
        account: ctx.accounts.from_ata.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };

    let close_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), close_accounts);

    token::close_account(close_ctx)?;

    msg!("转账成功,ata已关闭");
    emit!(NftTransferredEvent {
        owner: ctx.accounts.owner.key(),
        recipient: ctx.accounts.reviver.key(),
        mint: ctx.accounts.mint.key(),
    });

    Ok(())
}
