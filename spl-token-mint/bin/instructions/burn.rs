use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Burn as SplBurn},
};
use crate::errors::*;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    // Validate amount
    require!(amount > 0, TokenError::InvalidAmount);

    // Check sufficient balance
    require!(
        ctx.accounts.token_account.amount >= amount,
        TokenError::InsufficientFunds
    );

    // Verify authority owns the token account
    require!(
        ctx.accounts.token_account.owner == ctx.accounts.authority.key(),
        TokenError::InvalidOwner
    );

    // Verify the token account belongs to the correct mint
    require!(
        ctx.accounts.token_account.mint == ctx.accounts.mint.key(),
        TokenError::MintMismatch
    );

    // Burn tokens
    let cpi_accounts = SplBurn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::burn(cpi_ctx, amount)?;

    msg!("Burned {} tokens from {}", amount, ctx.accounts.token_account.key());

    Ok(())
}