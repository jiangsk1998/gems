use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserMintRecord {
    ///用户地址
    pub user: Pubkey,

    ///已铸造数量
    pub minted_count: u64,

    ///最后一次铸造时间戳
    pub last_mint_at: i64,
}

impl UserMintRecord {
    // pub const LEN: usize = 8 + 32 + 8 + 8;

    pub fn seeds(user: &Pubkey) -> Vec<u8> {
        [b"user_mint_record", user.as_ref()].concat()
    }
}
