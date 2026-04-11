pub mod error;
pub mod event;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("7uDSLVxJbjTNtnHDWFYt4kweCNLbNzVsfMcbdNhk9hiC");

#[program]
pub mod staking {
    use super::*;

    pub fn init(ctx: Context<Init>, reward_rate: u64) -> Result<()> {
        init::handler(ctx, reward_rate)
    }

    pub fn deposit(ctx: Context<DepositReward>, amount: u64) -> Result<()> {
        deposit_reward::handler(ctx, amount)
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        stake::handler(ctx, amount)
    }

    pub fn unstake(ctx: Context<UnStake>, amount: u128) -> Result<()> {
        unstake::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw::handler(ctx)
    }
}
