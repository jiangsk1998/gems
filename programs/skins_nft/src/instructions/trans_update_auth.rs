use anchor_lang::prelude::* ;
use anchor_spl::metadata::{update_metadata_accounts_v2, Metadata,UpdateMetadataAccountsV2};


#[derive(Accounts)]
pub struct TransUpdateAuth<'info> {
    pub current_authrity: Signer<'info>,

    #[account(
        mut,
        seeds=[b"metadata",metadata_program.key().as_ref()],
        bump,
        seeds::program = metadata_program.key()
    )]
    ///CHECK:metaplex验证
    pub metadata_account: UncheckedAccount<'info>,

    ///CHECK:任意地址
    pub new_auth: UncheckedAccount<'info>,

    pub metadata_program: Program<'info, Metadata>,
}

pub fn trans_update_auth(ctx: Context<TransUpdateAuth>) -> Result<()> {

    let meta_program = &mut ctx.accounts.metadata_program;
    let accounts = UpdateMetadataAccountsV2 {
        metadata: ctx.accounts.metadata_account.to_account_info(),
        update_authority: ctx.accounts.current_authrity.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(meta_program.to_account_info(), accounts);


    update_metadata_accounts_v2(cpi_ctx, Some(ctx.accounts.new_auth.key()), None, None, None)?;

    Ok(())
}
