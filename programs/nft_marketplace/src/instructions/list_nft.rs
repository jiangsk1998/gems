use crate::errors::MarketplaceError;
use crate::event::NftListedEvent;
use crate::state::listing::Listing;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

/// 挂单指令的账户上下文
#[derive(Accounts)]
pub struct ListNft<'info> {
    /// 卖家（签名者，会支付创建账户的 SOL 租金）
    #[account(mut)]
    pub seller: Signer<'info>,

    /// 被挂单的 NFT Mint 地址（唯一标识符）
    pub nft_mint: Account<'info, Mint>,

    /// 卖家持有 NFT 的 Token Account（source，NFT 从这里转出）
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_nft_account: Account<'info, TokenAccount>,

    /// Listing PDA：存储挂单信息
    /// seeds = [b"listing", nft_mint.key()] 保证每个 NFT 全局唯一一个挂单
    #[account(
        init,
        payer = seller,
        space = Listing::LEN,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow Token Account：合约托管 NFT 的地方
    /// owner = listing PDA（这样只有合约可以签名转出）
    #[account(
        init,
        payer = seller,
        token::mint = nft_mint,
        token::authority = listing,
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump,
    )]
    pub escrow_nft_account: Account<'info, TokenAccount>,

    /// SPL Token 程序（执行 transfer）
    pub token_program: Program<'info, Token>,
    /// 系统程序（创建账户）
    pub system_program: Program<'info, System>,
    /// Rent sysvar（初始化账户时需要）
    pub rent: Sysvar<'info, Rent>,
}

/// 挂单指令处理函数
pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
    // 步骤 1：校验价格合法性
    require!(price > 0, MarketplaceError::InvalidPrice);

    // 步骤 2：填充 Listing PDA 数据
    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key(); // 记录卖家
    listing.nft_mint = ctx.accounts.nft_mint.key(); // 记录 NFT Mint
    listing.price = price; // 记录价格
    listing.bump = ctx.bumps.listing; // 记录 PDA bump（签名时用）

    // 步骤 3：将 NFT 从卖家 ATA 转入 Escrow Account
    // 注意：这里用普通 CpiContext（由 seller 签名），不是 PDA 签名
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(), // SPL Token 程序
        Transfer {
            from: ctx.accounts.seller_nft_account.to_account_info(), // 卖家 NFT ATA
            to: ctx.accounts.escrow_nft_account.to_account_info(),   // escrow
            authority: ctx.accounts.seller.to_account_info(),        // 卖家签名授权
        },
    );
    token::transfer(transfer_ctx, 1)?; // NFT 数量固定为 1

    emit!(NftListedEvent {
        seller: ctx.accounts.seller.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        price,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "NFT 挂单成功！Mint: {}, 价格: {} $Tangaga",
        listing.nft_mint,
        listing.price
    );
    Ok(())
}
