pub mod error;
pub mod event;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

declare_id!("7uDSLVxJbjTNtnHDWFYt4kweCNLbNzVsfMcbdNhk9hiC");

#[program]
pub mod staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
