use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    /// 价格必须大于 0
    #[msg("挂单价格必须大于 0")]
    InvalidPrice,

    /// 下架时，调用者不是原卖家
    #[msg("只有卖家才能下架自己的 NFT")]
    NotSeller,

    /// 购买时余额不足
    #[msg("买家 $Tangaga 余额不足")]
    InsufficientFunds,

    /// NFT 已被下架或不存在
    #[msg("该 NFT 当前未在挂售状态")]
    NotListed,

    /// 防止重复挂单
    #[msg("该 NFT 已经挂单，请先下架")]
    AlreadyListed,
}
