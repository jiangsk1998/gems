use anchor_lang::prelude::*;

#[error_code]
pub enum SkinsNftError {
    ///铸造数量超过每地址最大限制
    #[msg("Mint amount exceeds max per address")]
    MintAmountExceedsMaxPerAddress = 6000,

    ///未授权的操作
    #[msg("Unauthorized")]
    Unauthorized = 6001,
}