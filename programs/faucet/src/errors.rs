use anchor_lang::prelude::*;
#[error_code]
pub enum FaucetError {
    /// 领取过于频繁，请稍后再试
    #[msg("Too frequent claims, please try again later.")]
    TooFrequent,
    /// 配置账户未初始化
    #[msg("Config account is not initialized.")]
    UninitializedConfig,
    /// 领取记录账户未初始化
    #[msg("Claim record account is not initialized.")]
    UninitializedClaimRecord,
    /// 领取记录账户已存在，说明用户已经领取过了
    #[msg("Claim record account already exists.")]
    ClaimRecordAlreadyExists,

    #[msg("Faucet vault has insufficient balance.")]
    InsufficientFaucetBalance,

    #[msg("Invalid amount per claim.")]
    InvalidAmountPerClaim,

    #[msg("Invalid cooldown seconds.")]
    InvalidCooldownSeconds,

    #[msg("Invalid vault account.")]
    InvalidVault,

    #[msg("Invalid mint account.")]
    InvalidMint,

    #[msg("Invalid deposit amount.")]
    InvalidDepositAmount,

    #[msg("Unauthorized.")]
    Unauthorized,

    #[msg("Math overflow.")]
    MathOverflow,

    #[msg("Cooldown period has not finished yet.")]
    CooldownNotFinished,
}
