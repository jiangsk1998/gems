use anchor_lang::prelude::*;

/// Token-2022 代币创建事件
#[event]
pub struct TokenCreatedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

/// 铸造代币到钱包事件
#[event]
pub struct TokenMintedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

/// 代币转账事件
#[event]
pub struct TokenTransferredEvent {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

/// 授权委托事件
#[event]
pub struct ApprovedEvent {
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub token_account: Pubkey,
    pub amount: u64,
}

/// 撤销授权事件
#[event]
pub struct RevokedEvent {
    pub owner: Pubkey,
    pub token_account: Pubkey,
}

/// 委托转账事件
#[event]
pub struct DelegateTransferEvent {
    pub delegate: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

/// 代币销毁事件
#[event]
pub struct BurnedEvent {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub from_ata: Pubkey,
    pub amount: u64,
}

/// Token Account 关闭事件
#[event]
pub struct AccountClosedEvent {
    pub owner: Pubkey,
    pub token_account: Pubkey,
}
