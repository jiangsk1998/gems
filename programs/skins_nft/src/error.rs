use anchor_lang::prelude::*;

#[error_code]
pub enum SkinsNftError {
    ///铸造数量超过每地址最大限制
    #[msg("Mint amount exceeds max per address")]
    MintAmountExceedsMaxPerAddress = 6000,

    ///未授权的操作
    #[msg("Unauthorized")]
    Unauthorized = 6001,

    #[msg("Minting is currently paused")]
    MintingPaused = 6002,

    #[msg("Whitelist is not enabled")]
    WhitelistEnabled = 6003,

    #[msg("无效的国库地址")]
    InvalidTreasuryAddress = 6004,

    #[msg("数学运算溢出")]
    MathOverflow,

    #[msg("已达到每地址最大铸造数量")]
    MaxMintPerAddressReached,

    #[msg("已达到最大供应量")]
    MaxSupplyReached,

    #[msg("无效的提取金额")]
    InvalidWithdrawAmount,

    #[msg("余额不足以提取")]
    InsufficientFunds,
}