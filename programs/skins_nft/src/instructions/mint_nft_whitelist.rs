use anchor_lang::prelude::*;
use  anchor_lang::system_program::Transfer;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{self, Metadata},
    token::{self, Mint, Token, TokenAccount},
};

use crate::error::SkinsNftError;

pub fn handler_mint_nft_whitelist(ctx: Context<MintNftWhitelist>, name: String, symbol: String, uri: String) -> Result<()> {
        // 1.检查总量限制
        let config = &mut ctx.accounts.config;
        require!(
            config.minted_count < config.max_supply,
            SkinsNftError::MaxSupplyReached
        );

        // 2.检查用户铸造限制
        require!(
            ctx.accounts.user_mint_record.minted_count < config.max_mint_per_address,
            SkinsNftError::MaxMintPerAddressReached
        );

        //3.处理支付逻辑
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            config.mint_price,
        )?;

        config.minted_count.checked_add(1).ok_or(SkinsNftError::MathOverflow)?;
        ctx.accounts.user_mint_record.minted_count.checked_add(1).ok_or(SkinsNftError::MathOverflow)?;
        ctx.accounts.user_mint_record.user = ctx.accounts.user.key();
        ctx.accounts.user_mint_record.last_mint_at = Clock::get()?.unix_timestamp;

        ctx.accounts.whitelist_entry.remaining_mints.checked_sub(1).ok_or(SkinsNftError::MathOverflow)?;
        
        do_mint(ctx, name, symbol, uri);

        
    
        Ok(())
}

/// 这个模块处理铸造 NFT 与交易给制定账户的逻辑
pub fn do_mint(
    ctx: Context<MintNftWhitelist>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    // 1. 创建 NFT 的 Mint 账户（由 Anchor 的 CPI 自动处理）

    token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1, // 铸造 1 个 NFT
    )?;

    // 2. 调用 Metaplex Token Metadata 程序创建 Metadata 和 Master Edition 账户

    let create_metadata_accounts_v3 = metadata::CreateMetadataAccountsV3 {
        metadata: ctx.accounts.metadata_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        mint_authority: ctx.accounts.user.to_account_info(),
        payer: ctx.accounts.user.to_account_info(),
        update_authority: ctx.accounts.user.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let data = mpl_token_metadata::types::DataV2 {
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        seller_fee_basis_points: 500, // 5% 的二级市场销售手续费
        creators: None,               // 可选的创作者列表
        collection: None,             // 可选的系列信息
        uses: None,                   // 可选的使用权信息
    };

    metadata::create_metadata_accounts_v3(
        CpiContext::new(
            ctx.accounts.metadata_program.to_account_info(),
            create_metadata_accounts_v3,
        ),
        data,
        false, // is_mutable
        true,
        None,
    )?;

    // 3. 调用 Metaplex Token Metadata 程序创建 Master Edition 账户
    let create_master_edition_account = metadata::CreateMasterEditionV3 {
        edition: ctx.accounts.master_edition_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        update_authority: ctx.accounts.user.to_account_info(),
        mint_authority: ctx.accounts.user.to_account_info(),
        payer: ctx.accounts.user.to_account_info(),
        metadata: ctx.accounts.metadata_account.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };

    metadata::create_master_edition_v3(
        CpiContext::new(
            ctx.accounts.metadata_program.to_account_info(),
            create_master_edition_account,
        ),
        Some(0), // max_supply: 0 表示无限量版
    )?;

    msg!(
        "NFT minted successfully with name: {}, symbol: {}, uri: {}",
        name,
        symbol,
        uri
    );

    Ok(())
}

#[derive(Accounts)]
pub struct MintNftWhitelist<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump,
    constraint = config.mint_paused == false @ SkinsNftError::MintingPaused,
    constraint = config.whitelist_enabled == true @ SkinsNftError::WhitelistEnabled,
)]
    pub config: Account<'info, crate::state::Config>,


    
    #[account(init,
        payer = user,
        mint::decimals = 0, //NFT 的小数位为0 
        mint::authority = user, //铸造后废除
        mint::freeze_authority = user,
    )]
    pub mint: Account<'info, Mint>,

    #[account(init_if_needed,
        payer = user,
        seeds = [b"user_mint_record", user.key().as_ref()],
        bump,
        space = crate::state::UserMintRecord::INIT_SPACE,
    )]
    pub user_mint_record: Account<'info, crate::state::UserMintRecord>,

        #[account(mut,
        address = config.authority @ SkinsNftError::InvalidTreasuryAddress,
    )]
    pub whitelist_entry: Account<'info, crate::state::WhitelistEntry>,

    ///CHECK:首款地址
    #[account(mut,
        address = config.authority @ SkinsNftError::InvalidTreasuryAddress,
        
    )]
    pub treasury:UncheckedAccount<'info>,

    #[account(init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// Metadata Account (PDA)
    /// CHECK: Metaplex 程序会初始化这个账户
    #[account(mut,
        seeds = [b"metadata", metadata_program.key().as_ref(), mint.key().as_ref()],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub metadata_account: UncheckedAccount<'info>,

    /// Master Edition Account (PDA)
    /// CHECK: Metaplex 程序会初始化这个账户
    #[account(mut,
        seeds = [b"metadata", metadata_program.key().as_ref(), mint.key().as_ref(),b"edition"],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub master_edition_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    //metadata program
    pub metadata_program: Program<'info, Metadata>,
}
