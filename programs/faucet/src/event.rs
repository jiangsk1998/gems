use anchor_lang::prelude::*;

/// 水龙头初始化事件
#[event]
pub struct FaucetInitializedEvent {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount_per_claim: u64,
    pub cooldown_seconds: u64,
}

/// 代币存入金库事件
#[event]
pub struct TokensDepositedEvent {
    pub admin: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
}

/// 用户领取代币事件
#[event]
pub struct TokensClaimedEvent {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub claim_count: u64,
    pub timestamp: i64,
}

/// 配置更新事件
#[event]
pub struct ConfigUpdatedEvent {
    pub admin: Pubkey,
    pub amount_per_claim: u64,
    pub cooldown_seconds: i64,
}

/// 管理员提取代币事件
#[event]
pub struct TokensWithdrawnEvent {
    pub admin: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
}
