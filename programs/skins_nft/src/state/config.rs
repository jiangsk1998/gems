use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    ///合约管理员
    pub authority: Pubkey,

    ///是否启用白名单
    pub whitelist_enabled: bool,

    ///铸造价格（单位：lamports）
    pub mint_price: u64,

    ///最大供应量
    /// 如果为 0 则表示没有供应上限
    pub max_supply: u64,

    ///单个地址的最大铸造数量
    /// 如果为 0 则表示没有限制
    pub max_mint_per_address: u64,

    ///是否暂停铸造
    pub mint_paused: bool,

    ///当前已铸造的数量
    pub minted_count: u64,

    /// 合约创建时间戳
    pub created_at: i64,

    /// 预留字段(用于未来升级)
    pub _reserved: [u8; 64],
}
