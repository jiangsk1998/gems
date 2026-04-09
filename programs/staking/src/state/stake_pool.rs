use anchor_lang::prelude::*;

pub const SCALE: u128 = 1000000000;
#[account]
pub struct StakePool {
    //管理员
    pub admin: Pubkey,
    //代币Mint地址
    pub mint: Pubkey,
    //金库ATA地址
    pub stake_vault: Pubkey,
    //池子总代币量 质押量+累积奖励
    pub total_staked: u64,
    //总份额数
    pub total_shares: u128,
    //每份额对应的价格，初始为1，乘以SCALE放大，质押和取回时根据这个价格计算份额和奖励
    pub share_price: u128,

    //每次释放多少奖励
    pub reward_rate: u64,
    //上次发放奖励的时间戳，单位为秒
    pub last_reward_time: i64,

    pub bump: u8,
}

impl StakePool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 16 + 16 + 8 + 8 + 1;
    ///计算当前每份额的价格，单位为SCALE倍的代币数量
    pub fn current_share_price(&self) -> u128 {
        if self.total_shares == 0 {
            return SCALE; // 初始价格为1，乘以SCALE放大
        }
        (self.total_staked as u128)
            .saturating_mul(SCALE)
            .saturating_div(self.total_shares as u128)
    }

    //计算用户持有份额对应的当前价值
    pub fn shares_to_amount(&self, shares: u128) -> u64 {
        if self.total_shares == 0 {
            return 0;
        }

        let value = (self.total_staked as u128)
            .saturating_mul(shares)
            .saturating_div(self.total_shares);
        value as u64
    }
}
