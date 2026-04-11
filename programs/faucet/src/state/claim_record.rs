use anchor_lang::prelude::*;

/// PDA 账户，记录每个用户的领取信息 [b"claim_record", user_pubkey]
#[account]
#[derive(Default, InitSpace, Debug)]
pub struct ClaimRecord {
    ///用户公钥
    pub user: Pubkey,

    ///最后一次领取的时间戳（秒）  用于实现冷却时间逻辑，记录用户上次领取的时间戳，单位为秒
    pub last_claim_at: i64,

    ///总共领取的数量（raw amount，含decimals）  记录用户累计领取的数量，单位为原始数量（包含小数位）
    pub total_claimed: u64,

    ///领取次数  记录用户领取的次数，便于统计和分析
    pub claim_count: u64,

    pub bump: u8,
}

impl ClaimRecord {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1;
}
