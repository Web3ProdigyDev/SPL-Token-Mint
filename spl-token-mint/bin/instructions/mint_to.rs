use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, MintTo as SplMintTo},
};
use crate::errors::*;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = mint_authority,
        associated_token::mint = mint,
        associated_token::authority = destination_owner,
    )]
    pub destination: Account<'info, TokenAccount>,

    /// CHECK: This is the destination token account owner
    pub destination_owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    // Validate amount is not zero
    require!(amount > 0, TokenError::InvalidAmount);

    // Check for potential overflow
    let current_supply = ctx.accounts.mint.supply;
    require!(
        current_supply.checked_add(amount).is_some(),
        TokenError::SupplyOverflow
    );

    // Mint tokens
    let cpi_accounts = SplMintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::mint_to(cpi_ctx, amount)?;

    msg!("Minted {} tokens to {}", amount, ctx.accounts.destination.key());
    
    Ok(())
}

// Re-export handler with the name that lib.rs expects
pub use handler as mint_to_handler;