// programs/spl-token-mint/src/state.rs
use anchor_lang::prelude::*;

#[account]
pub struct TokenMintState {
    pub mint: Pubkey,
    pub mint_authority: Pubkey,
    pub total_minted: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl TokenMintState {
    pub const LEN: usize = 8 + // discriminator
        32 + // mint
        32 + // mint_authority  
        8 +  // total_minted
        8 +  // created_at
        1;   // bump
}