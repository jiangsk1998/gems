use anchor_lang::prelude::*;

/// 合约初始化事件
#[event]
pub struct InitializedEvent {
    pub authority: Pubkey,
    pub whitelist_enabled: bool,
    pub mint_price: u64,
    pub max_supply: u64,
    pub max_mint_per_address: u64,
}

/// 添加白名单地址事件
#[event]
pub struct WhitelistAddedEvent {
    pub user: Pubkey,
    pub mint_amount: u64,
}

/// NFT 铸造事件（公开铸造 / 白名单铸造）
#[event]
pub struct NftMintedEvent {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    /// "public" 或 "whitelist"
    pub mint_type: String,
}

/// SOL 提现事件
#[event]
pub struct SolWithdrawEvent {
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

/// NFT 冻结事件
#[event]
pub struct NftFrozenEvent {
    pub manager: Pubkey,
    pub mint: Pubkey,
    pub token_account: Pubkey,
}

/// NFT 解冻事件
#[event]
pub struct NftThawedEvent {
    pub manager: Pubkey,
    pub mint: Pubkey,
    pub token_account: Pubkey,
}

/// 转让更新权限事件
#[event]
pub struct TransferUpdateAuthEvent {
    pub current_authority: Pubkey,
    pub new_authority: Pubkey,
    pub metadata_account: Pubkey,
}

/// 撤销冻结权限事件
#[event]
pub struct RevokeFreezeAuthEvent {
    pub manager: Pubkey,
    pub mint: Pubkey,
}

/// NFT 转账事件
#[event]
pub struct NftTransferredEvent {
    pub owner: Pubkey,
    pub recipient: Pubkey,
    pub mint: Pubkey,
}
