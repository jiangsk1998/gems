use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
use instructions::*;

pub mod state;
pub use state::*;

declare_id!("EzP1jXJgQXzxGuosuWnf2vmGGcE8MCW3HfuKLhNxRFuK");

#[program]
pub mod skins_nft {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, args: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, args)
    }

    pub fn add_whitelist(ctx: Context<AddWhitelist>, args: AddWhitelistParams) -> Result<()> {
        instructions::add_whitelist::handler(ctx, args)
    }

    // pub fn mint_nft(
    //     ctx: Context<MintNft>,
    //     name: String,
    //     symbol: String,
    //     uri: String,
    // ) -> Result<()> {
    //     instructions::mint_nft::handler(ctx, name, symbol, uri)
    // }

    pub fn mint_nft_public(
        ctx: Context<MintNftPublic>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        instructions::mint_nft_public::handler_mint_nft_public(ctx, name, symbol, uri)
    }

    pub fn mint_nft_whitelist(
        ctx: Context<MintNftWhitelist>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        instructions::mint_nft_whitelist::handler_mint_nft_whitelist(ctx, name, symbol, uri)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    pub fn freeze_nft(ctx: Context<FreezeNft>) -> Result<()> {
        instructions::freeze_nft::handler(ctx)
    }

    pub fn thaw_nft(ctx: Context<ThawNft>) -> Result<()> {
        instructions::thaw_nft::handler(ctx)
    }

    pub fn trans_update_auth(ctx: Context<TransUpdateAuth>) -> Result<()> {
        instructions::trans_update_auth::trans_update_auth(ctx)
    }

    pub fn revoke_freeze_auth(ctx: Context<RevokeFreezeAuth>) -> Result<()> {
        instructions::revoke_freeze_auth::revoke_freeze_auth(ctx)
    }
}
