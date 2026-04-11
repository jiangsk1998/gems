use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct Config {
    //管理员公钥
    pub admin: Pubkey,

    //代币的MInt地址
    pub mint: Pubkey,

    //金库地址 - 代币将从这个地址发出 ATA owner = config pda
    pub vault: Pubkey,

    //每次领取的数量（raw amount，含decimals）
    pub amount_per_claim: u64,

    //冷却时间（秒）  没两次领取之间必须等待的时间，单位为秒
    pub cooldown_seconds: i64,

    //总共分发的数量（raw amount，含decimals）
    pub total_distributed: u64,

    //领取次数
    pub claim_count: u64,

    //PDA的bump值
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
}
