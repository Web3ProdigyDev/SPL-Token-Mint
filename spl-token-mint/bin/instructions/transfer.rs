use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer as SplTransfer},
};
use crate::errors::*;

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    // Validate amount
    require!(amount > 0, TokenError::InvalidAmount);

    // Check sufficient balance
    require!(
        ctx.accounts.from.amount >= amount,
        TokenError::InsufficientFunds
    );

    // Verify authority owns the source account
    require!(
        ctx.accounts.from.owner == ctx.accounts.authority.key(),
        TokenError::InvalidOwner
    );

    // Verify both accounts have the same mint
    require!(
        ctx.accounts.from.mint == ctx.accounts.to.mint,
        TokenError::MintMismatch
    );

    // Additional security: prevent self-transfer
    require!(
        ctx.accounts.from.key() != ctx.accounts.to.key(),
        TokenError::InvalidTransfer
    );

    // Perform transfer
    let cpi_accounts = SplTransfer {
        from: ctx.accounts.from.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::transfer(cpi_ctx, amount)?;

    msg!(
        "Transferred {} tokens from {} to {}",
        amount,
        ctx.accounts.from.key(),
        ctx.accounts.to.key()
    );

    Ok(())
}

// Re-export handler with the name that lib.rs expects
pub use handler as transfer_handler;