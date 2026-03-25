use anchor_lang::prelude::*;
use anchor_spl::metadata::Metadata;

#[derive(Accounts)]
pub struct TransUpdateAuth<'info> {
    pub current_authrity: Signer<'info>,

    #[account(mut)]
    /// CHECK: Metaplex CPI 会验证此账户
    pub metadata_account: UncheckedAccount<'info>,

    /// CHECK: 新的更新权限地址
    pub new_auth: UncheckedAccount<'info>,

    pub metadata_program: Program<'info, Metadata>,
}

pub fn trans_update_auth(ctx: Context<TransUpdateAuth>) -> Result<()> {
    mpl_token_metadata::instructions::UpdateMetadataAccountV2CpiBuilder::new(
        &ctx.accounts.metadata_program,
    )
    .metadata(&ctx.accounts.metadata_account)
    .update_authority(&ctx.accounts.current_authrity)
    .new_update_authority(ctx.accounts.new_auth.key())
    .invoke()?;

    msg!("更新权限已转移给: {}", ctx.accounts.new_auth.key());
    Ok(())
}
