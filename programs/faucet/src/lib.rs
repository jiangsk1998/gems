use anchor_lang::prelude::*;

pub mod constants;
pub use constants::*;

pub mod state;
pub use state::*;

pub mod instructions;
pub use instructions::*;

pub mod errors;
pub use errors::*;

pub mod event;
pub use event::*;

declare_id!("8pjYoQdRtEbGxddTSPfWAyQYcQhUUhizqxVjtojNxenN");

#[program]
pub mod faucet {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount_per_claim: u64, cooldown_seconds: u64) -> Result<()> {
        instructions::initialize::handler(ctx, amount_per_claim, cooldown_seconds)
    }

    pub fn deposits_tokens(ctx: Context<DepositsTokens>, amount: u64) -> Result<()> {
        instructions::deposits_tokens::handler(ctx, amount)
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        instructions::claim_tokens::handler(ctx)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, amount_per_claim: u64, cooldown_seconds: u64) -> Result<()> {
        instructions::update_config::handler(ctx, amount_per_claim, cooldown_seconds)
    }
    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64) -> Result<()> {
        instructions::withdraw_tokens::handler(ctx, amount)
    }
}


