use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct GetMintInfo<'info> {
    pub mint: Account<'info, Mint>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MintInfo {
    pub supply: u64,
    pub decimals: u8,
    pub mint_authority: Option<Pubkey>,
    pub freeze_authority: Option<Pubkey>,
}

pub fn handler(ctx: Context<GetMintInfo>) -> Result<MintInfo> {
    let mint = &ctx.accounts.mint;
    
    Ok(MintInfo {
        supply: mint.supply,
        decimals: mint.decimals,
        mint_authority: mint.mint_authority.into(),
        freeze_authority: mint.freeze_authority.into(),
    })
}

// Re-export handler with the name that lib.rs expects
pub use handler as get_mint_info_handler;