use crate::errors::MarketplaceError;
use crate::state::listing::Listing;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};
use crate::event::NftDelistedEvent;

/// 下架指令的账户上下文
#[derive(Accounts)]
pub struct DelistNft<'info> {
    /// 卖家（必须是原始挂单人，且签名）
    #[account(mut)]
    pub seller: Signer<'info>,

    /// NFT Mint（用于推导 PDA seeds）
    pub nft_mint: Account<'info, Mint>,

    /// 卖家的 NFT Token Account（NFT 要转回这里）
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_nft_account: Account<'info, TokenAccount>,

    /// Listing PDA（读取卖家信息 + 用作 escrow 的 authority 签名）
    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
        // 关闭账户，租金 SOL 归还给卖家
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow Token Account（NFT 从这里转出 + 关闭）
    #[account(
        mut,
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump = listing.escrow_bump,
    )]
    pub escrow_nft_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// 下架指令处理函数
pub fn delist_nft(ctx: Context<DelistNft>) -> Result<()> {
    // 步骤 1：验证调用者是原卖家
    // 这里用 Anchor 约束也可以（has_one = seller），选择显式校验更清晰
    require_keys_eq!(
        ctx.accounts.listing.seller,
        ctx.accounts.seller.key(),
        MarketplaceError::NotSeller
    );

    let nft_mint_key = ctx.accounts.nft_mint.key(); // 提前取 key，避免借用冲突

    // 步骤 2：构造 PDA 签名 seeds（Listing PDA 作为 escrow 的 authority）
    // 格式：&[&[seed1, seed2, &[bump]]]
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"listing",                   // seed 第一段
        nft_mint_key.as_ref(),        // seed 第二段
        &[ctx.accounts.listing.bump], // bump
    ]];

    // 步骤 3：用 PDA 签名，将 NFT 从 Escrow 转回卖家
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_nft_account.to_account_info(), // escrow
            to: ctx.accounts.seller_nft_account.to_account_info(),   // 卖家 ATA
            authority: ctx.accounts.listing.to_account_info(),       // Listing PDA 签名
        },
        signer_seeds, // PDA 签名
    );
    token::transfer(transfer_ctx, 1)?; // 转出 NFT

    // 步骤 4：关闭 Escrow Token Account（清零后才能关闭）
    // close 参数：租金 SOL 归还给 seller
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.escrow_nft_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(), // 租金归还给卖家
            authority: ctx.accounts.listing.to_account_info(),  // PDA 签名
        },
        signer_seeds,
    );
    token::close_account(close_ctx)?;
    // Listing PDA 本身通过 close = seller 约束自动关闭

    emit!(NftDelistedEvent {
        seller: ctx.accounts.seller.key(),
        nft_mint: nft_mint_key,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("NFT 下架成功，已归还卖家！");
    Ok(())
}
