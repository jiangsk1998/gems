use anchor_lang::error_code;

#[error_code]
pub enum StakingError {
    InvalidInstruction,
    NotRentExempt,
    InvalidAccountData,
    InvalidAccountOwner,
    InsufficientFunds,
    StakePoolNotFound,
    UserStakeNotFound,
    StakePoolFull,
    StakePoolInactive,
    StakePoolAlreadyActive,
    UserAlreadyStaked,
    UserNotStaked,
    #[msg("无效的质押金额，必须大于零")]
    InvalidAmount,
    #[msg("质押池已满，无法接受更多的质押")]
    Overflow,
    #[msg("未经授权的操作")]
    Unauthorized,

    #[msg("无效的Mint")]
    InvalidMint,

    #[msg("没人质押时不能注入奖励")]
    NoStakersYet,

    #[msg("交易金额必须大于零")]
    ZeroAmount,

    #[msg("质押池中没有足够的股份来完成操作")]
    InsufficientShares,

    #[msg("存在未完成的解质押，无法进行新的质押或解质押操作")]
    ExistPendingUnstake,

    #[msg("解质押操作已完成或不存在")]
    NoPendingUnstake,

    #[msg("冷却中")]
    CooldownNotFinished,
}
