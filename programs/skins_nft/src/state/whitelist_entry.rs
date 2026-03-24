use anchor_lang::prelude::*;


#[account]
#[derive(InitSpace)]
pub struct WhitelistEntry {
    ///白名单地址
    pub address: Pubkey,

    ///剩余铸造次数
    pub remaining_mints: u64,

    ///是否已添加
    pub is_added: bool,
}

impl WhitelistEntry {
    pub fn seeds(address: &Pubkey) -> Vec<u8> {
        [b"whitelist_entry", address.as_ref()].concat()
    }
}
