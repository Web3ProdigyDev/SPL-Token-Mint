use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, SetAuthority as SplSetAuthority, spl_token::instruction::AuthorityType},
};
use crate::errors::*;

#[derive(Accounts)]
pub struct SetMintAuthority<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub current_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SetMintAuthority>, new_authority: Option<Pubkey>) -> Result<()> {
    // Verify current authority
    require!(
        ctx.accounts.mint.mint_authority.is_some(),
        TokenError::Unauthorized
    );
    
    require!(
        ctx.accounts.mint.mint_authority.unwrap() == ctx.accounts.current_authority.key(),
        TokenError::Unauthorized
    );

    // Set new mint authority (can be None to revoke mint authority permanently)
    let cpi_accounts = SplSetAuthority {
        account_or_mint: ctx.accounts.mint.to_account_info(),
        current_authority: ctx.accounts.current_authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    // Use the proper AuthorityType::MintTokens
    token::set_authority(cpi_ctx, AuthorityType::MintTokens, new_authority)?;

    match new_authority {
        Some(authority) => {
            msg!("Mint authority changed to: {}", authority);
        }
        None => {
            msg!("Mint authority revoked permanently");
        }
    }

    Ok(())
}

// Re-export handler with the name that lib.rs expects
pub use handler as set_authority_handler;