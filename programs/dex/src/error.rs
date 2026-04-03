use anchor_lang::error_code;

#[error_code]
pub enum DexError {
    #[msg("流动性不足，无法完成交换")]
    InsufficientLiquidity,

    #[msg("提供的代币数量不匹配")]
    InvalidTokenAmount,

    #[msg("池子已存在")]
    PoolAlreadyExists,

    #[msg("池子不存在")]
    PoolNotFound,

    #[msg("无效的手续费设置")]
    InvalidFee,

    #[msg("无效的价格影响设置")]
    InvalidPriceImpact,

    #[msg("相同的代币铸造")]
    IdenticalMints,

    #[msg("池子已暂停交易")]
    PoolPaused,

    #[msg("计算过程中发生溢出")]
    Overflow,

    #[msg("首次注入的流动性不足，至少需要提供足够的流动性以覆盖锁定的最小流动性")]
    InsufficientInitLiquidity,

    #[msg("计算过程中发生除以零错误")]
    DivisionByZero,

    #[msg("交易金额必须大于零")]
    ZeroAmount,

    #[msg("无效的铸币账户")]
    InvalidMint,
}
