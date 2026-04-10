use crate::error::StakingError;
use anchor_lang::prelude::*;
use std::future::pending;

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

    //每秒释放多少奖励
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

    //自动结算待发奖励
    // 在每个需要"最新份额价格"的指令开头调用
    // Java 类比：类似 AOP 前置通知，每次操作前先结算利息
    pub fn accrue_reward(&mut self, current_time: i64) -> Result<u64> {
        let elapsed = current_time.checked_sub(self.last_reward_time).unwrap_or(0);

        if elapsed <= 0 || self.total_shares == 0 {
            return Ok(0);
        }

        //计算应分发的奖励

        // pending = reward_rate(代币/秒) × elapsed(秒)
        let pending_reward = (elapsed as u128)
            .checked_mul(self.reward_rate as u128)
            .ok_or(StakingError::Overflow)? as u64;

        if pending_reward == 0 {
            return Ok(0);
        }

        //更新池状态
        self.total_staked = self
            .total_staked
            .checked_add(pending_reward)
            .ok_or(StakingError::Overflow)?;
        self.share_price = self.current_share_price();

        self.last_reward_time = current_time;

        msg!(
            "Accrued {} rewards for pool , elapsed time {} seconds, new share price {}",
            pending_reward,
            elapsed,
            self.share_price
        );

        Ok(pending_reward)
    }
}
