use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_2022;
use anchor_spl::token_2022::spl_token_2022::{extension::ExtensionType, state::Mint as MintState};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_2022_extensions::spl_token_metadata_interface::state::TokenMetadata;
use anchor_spl::token_interface::metadata_pointer;
use anchor_spl::token_interface::token_metadata;
use anchor_spl::token_interface::MetadataPointerInitialize;
use anchor_spl::token_interface::TokenMetadataInitialize;

use crate::error::CustomError;

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String, decimals: u8)]
pub struct CreateToken<'info> {
    /// CHECK: 在指令逻辑中手动 create_account + initialize
    #[account(mut)]
    pub mint: Signer<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub manager: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

pub fn create_token(
    ctx: Context<CreateToken>, // 账户上下文，包含指令所需的账户引用
    name: String,              // 代币名称（如 "Solana"）
    symbol: String,            // 代币符号（如 "SOL"）
    uri: String,               // 元数据链接（指向 JSON 文件）
    decimals: u8,              // 代币精度（如 9）
) -> Result<()> {
    // ── 数据长度校验 ────────────────────────────────────────────────
    // 确保输入的字符串长度不超过 Token Metadata 标准的限制
    require!(name.len() <= 32, CustomError::NameTooLong);
    require!(symbol.len() <= 10, CustomError::SymbolTooLong);
    require!(uri.len() <= 200, CustomError::UriTooLong);

    // ── 步骤 1：计算账户空间和租金 (Rent) ────────────────────────────

    // 构建一个临时的元数据结构体，用于计算其在链上存储所需的字节大小
    let token_metadata = TokenMetadata {
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        ..Default::default()
    };

    // 计算基础 Mint 账户加上 MetadataPointer 扩展所需的空间
    // InitializeMint2 指令要求初始创建的账户大小必须完全匹配扩展结构
    let base_mint_size =
        ExtensionType::try_calculate_account_len::<MintState>(&[ExtensionType::MetadataPointer])
            .unwrap();

    // 计算元数据内容本身的 TLV (Tag-Length-Value) 存储大小
    let metadata_size = token_metadata.tlv_size_of().unwrap();

    // 计算总大小：基础 Mint + 扩展指针 + 实际元数据内容
    let full_size = base_mint_size.checked_add(metadata_size).unwrap();

    // 获取当前的租金标准
    let rent = Rent::get()?;
    // 根据总大小计算需要预存的 lamports（租金免除额度）
    let lamports = rent.minimum_balance(full_size);

    // 注意：初始创建账户时，只需指定 base_mint_size
    // 后续通过 token_metadata_initialize 会自动 realloc（重新分配）空间
    let mint_size = base_mint_size;

    // ── 步骤 2：调用系统程序创建账户 ──────────────────────────────────

    system_program::create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(), // 付款人
                to: ctx.accounts.mint.to_account_info(),        // 被创建的 Mint 账户
            },
        ),
        lamports,         // 存入足够支付总空间的租金
        mint_size as u64, // 初始空间大小
        &Token2022::id(), // 该账户的所有者设为 Token-2022 程序
    )?;

    // ── 步骤 3：初始化 MetadataPointer 扩展 ─────────────────────────
    // 这一步告诉 Mint 账户：你的元数据保存在哪里（此处设为 Mint 账户自身）
    metadata_pointer::metadata_pointer_initialize(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MetadataPointerInitialize {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        Some(ctx.accounts.authority.key()), // 该指针的修改权限
        Some(ctx.accounts.mint.key()),      // 元数据存储地址（指向自己）
    )?;

    // ── 步骤 4：初始化基础 Mint 权限 ─────────────────────────────────
    // 设置代币的精度、铸币权（Mint Authority）和冻结权
    token_2022::initialize_mint2(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_2022::InitializeMint2 {
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        decimals,
        &ctx.accounts.manager.key(),               // 铸币权所有人
        Option::Some(&ctx.accounts.manager.key()), // 冻结权所有人（可选）
    )?;

    // ── 步骤 5：初始化元数据内容 ──────────────────────────
    // 将实际的名称、符号、URI 写入 Mint 账户末尾的空间
    token_metadata::token_metadata_initialize(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenMetadataInitialize {
                program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.mint.to_account_info(), // 元数据存储在 Mint 账户内
                mint_authority: ctx.accounts.manager.to_account_info(),
                update_authority: ctx.accounts.manager.to_account_info(), // 更新元数据的权限
            },
        ),
        name,
        symbol,
        uri,
    )?;

    // 记录成功日志
    msg!("Token-2022 Mint 创建成功: {}", ctx.accounts.mint.key());
    Ok(())
}
