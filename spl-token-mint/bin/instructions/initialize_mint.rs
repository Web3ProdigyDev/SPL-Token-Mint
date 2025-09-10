use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::errors::*;

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = payer,
        space = 82,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeMint>,
    decimals: u8,
    mint_authority: Pubkey,
    freeze_authority: Option<Pubkey>,
) -> Result<()> {
    // Validate decimals
    require!(decimals <= 9, TokenError::InvalidDecimals);

    // Initialize the mint using CPI to the token program
    let cpi_accounts = anchor_spl::token::InitializeMint {
        mint: ctx.accounts.mint.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    anchor_spl::token::initialize_mint(cpi_ctx, decimals, &mint_authority, freeze_authority.as_ref())?;

    msg!("Token mint initialized successfully!");
    msg!("Mint address: {}", ctx.accounts.mint.key());
    msg!("Mint authority: {}", mint_authority);
    if let Some(freeze_auth) = freeze_authority {
        msg!("Freeze authority: {}", freeze_auth);
    } else {
        msg!("Freeze authority: None");
    }
    msg!("Decimals: {}", decimals);
    
    Ok(())
}