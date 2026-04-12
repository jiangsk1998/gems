use crate::errors::MarketplaceError;
use crate::event::NftBoughtEvent;
use crate::state::listing::Listing;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::spl_token::instruction::TokenInstruction::TransferChecked;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};
use anchor_spl::token_2022;
use anchor_spl::token_2022::Token2022;

/// 购买指令的账户上下文
#[derive(Accounts)]
pub struct BuyNft<'info> {
    /// 买家（支付 $Tangaga，签名者）
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// 卖家账户（接收 $Tangaga，用于关闭账户后返还租金）
    /// CHECK: 仅作为转账目标，通过 listing.seller 约束验证
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MarketplaceError::NotSeller,
    )]
    pub seller: SystemAccount<'info>,

    /// $Tangaga 代币 Mint（用于验证 ATA）
    pub game_mint: Account<'info, Mint>,

    /// NFT Mint（用于推导 Listing/Escrow PDA）
    pub nft_mint: Account<'info, Mint>,

    /// 买家持有 $Tangaga 的 ATA（支付来源）
    #[account(
        mut,
        associated_token::mint = game_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// 卖家持有 $Tangaga 的 ATA（接收付款）
    #[account(
        mut,
        associated_token::mint = game_mint,
        associated_token::authority = seller,
        associated_token::token_program = token_program_2022, // 指定 Token 2022 程序
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// 买家接收 NFT 的 ATA（若不存在需在客户端提前创建或 init_if_needed）
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program_2022, // 指定 Token 2022 程序
    )]
    pub buyer_nft_account: Account<'info, TokenAccount>,

    /// Listing PDA（读取挂单信息 + 用作 escrow authority 签名 + 关闭）
    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow Token Account（NFT 托管在这里，购买后关闭）
    #[account(
        mut,
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump,
    )]
    pub escrow_nft_account: Account<'info, TokenAccount>,

    pub token_program_2022: Program<'info, Token2022>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

/// 购买指令处理函数（原子性：$Tangaga 转账 + NFT 转移 同一笔交易）
pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
    let price = ctx.accounts.listing.price; // 从挂单读取价格

    // 步骤 1：校验买家 $Tangaga 余额充足
    require!(
        ctx.accounts.buyer_token_account.amount >= price,
        MarketplaceError::InsufficientFunds
    );

    // 步骤 2a：买家 $Tangaga → 卖家 $Tangaga（普通 CPI，买家签名）
    let game_transfer_ctx = CpiContext::new(
        ctx.accounts.token_program_2022.to_account_info(),
        token_2022::TransferChecked {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            mint: ctx.accounts.game_mint.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        },
    );
    token_2022::transfer_checked(game_transfer_ctx, price, ctx.accounts.game_mint.decimals)?; // 转账 price 数量的 $Tangaga

    // 步骤 2b：Escrow NFT → 买家 NFT（PDA 签名 CPI）
    let nft_mint_key = ctx.accounts.nft_mint.key(); // 提前取 key 避免借用冲突
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"listing",
        nft_mint_key.as_ref(),
        &[ctx.accounts.listing.bump],
    ]];

    let nft_transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_nft_account.to_account_info(), // escrow
            to: ctx.accounts.buyer_nft_account.to_account_info(),    // 买家 NFT ATA
            authority: ctx.accounts.listing.to_account_info(),       // Listing PDA 签名
        },
        signer_seeds,
    );
    token::transfer(nft_transfer_ctx, 1)?; // 转出 NFT（amount = 1）

    // 步骤 3：关闭 Escrow Token Account（token amount = 0，才能关闭）
    // 租金 SOL 归还给卖家（按市场惯例，卖家创建的账户卖家回收）
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.escrow_nft_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(), // 租金返卖家
            authority: ctx.accounts.listing.to_account_info(),
        },
        signer_seeds,
    );
    token::close_account(close_ctx)?;
    // Listing PDA 由 close = seller 约束自动关闭

    emit!(NftBoughtEvent {
        buyer: ctx.accounts.buyer.key(),
        seller: ctx.accounts.seller.key(),
        nft_mint: nft_mint_key,
        price,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "购买成功！买家: {}, 支付 {} $Tangaga, NFT: {}",
        ctx.accounts.buyer.key(),
        price,
        ctx.accounts.nft_mint.key()
    );
    Ok(())
}
