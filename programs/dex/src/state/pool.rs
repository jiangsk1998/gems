use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Pool {
    ///池子创建者 管理员
    pub authority: Pubkey,

    ///代币A的Mint地址
    pub token_mint_a: Pubkey,

    ///代币B的Mint地址
    pub token_mint_b: Pubkey,

    pub vault_a: Pubkey, // 代币A的托管账户

    pub vault_b: Pubkey, // 代币B的托管账户

    pub lp_mint: Pubkey, // LP 代币的 Mint 地址

    pub fee_numerator: u64, // 交易手续费分子

    pub fee_denominator: u64, // 交易手续费分母

    pub reserve_a: u64, // 代币A的储备量

    pub reserve_b: u64, // 代币B的储备量

    pub lp_total_supply: u64, // LP 代币的总供应量（不含锁定）

    pub paused: bool, // 池子是否暂停交易

    pub bump: u8, // PDA 的 bump 值
}

impl Pool {
    pub const SPACE: usize = Pool::INIT_SPACE
        .checked_add(8)
        .expect("Pool space overflow"); // 8字节的账户 discriminator + Pool 结构体的空间

    pub fn calculate_lp_amount(&self, amount_a: u64, amount_b: u64) -> u64 {
        // 计算用户提供的流动性对应的 LP 代币数量
        let lp_amount_a =
            (amount_a as u128 * self.lp_total_supply as u128) / self.reserve_a as u128;
        let lp_amount_b =
            (amount_b as u128 * self.lp_total_supply as u128) / self.reserve_b as u128;
        std::cmp::min(lp_amount_a, lp_amount_b) as u64
    }
}
