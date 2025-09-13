use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Burn as SplBurn, MintTo as SplMintTo, Transfer as SplTransfer, 
            SetAuthority as SplSetAuthority, FreezeAccount as SplFreezeAccount, ThawAccount as SplThawAccount,
            CloseAccount as SplCloseAccount, spl_token::instruction::AuthorityType},
};

declare_id!("72LBxzy5ggcs4PPvet1m8vhPGfuthxPHxtwE4xsSo8qP");

#[error_code]
pub enum TokenError {
    #[msg("Invalid amount: amount must be greater than 0")]
    InvalidAmount,
    #[msg("Insufficient funds: not enough tokens in source account")]
    InsufficientFunds,
    #[msg("Invalid owner: authority does not own the source account")]
    InvalidOwner,
    #[msg("Mint mismatch: source and destination accounts have different mints")]
    MintMismatch,
    #[msg("Supply overflow: minting would exceed maximum supply")]
    SupplyOverflow,
    #[msg("Unauthorized: caller is not the mint authority")]
    Unauthorized,
    #[msg("Account not initialized")]
    AccountNotInitialized,
    #[msg("Invalid transfer: cannot transfer to the same account")]
    InvalidTransfer,
    #[msg("Mint authority cannot be changed")]
    MintAuthorityImmutable,
    #[msg("Invalid decimals: decimals must be between 0 and 9")]
    InvalidDecimals,
    #[msg("Token account is frozen")]
    AccountFrozen,
    #[msg("Invalid authority type")]
    InvalidAuthorityType,
    #[msg("Authority already set")]
    AuthorityAlreadySet,
    #[msg("Cannot burn more tokens than available")]
    BurnAmountExceedsBalance,
    #[msg("Program account mismatch")]
    ProgramAccountMismatch,
    #[msg("Invalid metadata: name cannot be empty")]
    InvalidName,
    #[msg("Invalid metadata: symbol cannot be empty")]
    InvalidSymbol,
    #[msg("Invalid metadata: URI too long (max 200 characters)")]
    UriTooLong,
    #[msg("Cannot close account with remaining balance")]
    AccountNotEmpty,
    #[msg("Batch operation limit exceeded (max 10)")]
    BatchLimitExceeded,
    #[msg("Invalid mint configuration")]
    InvalidMintConfig,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
}

impl TokenMetadata {
    pub fn validate(&self) -> Result<()> {
        require!(!self.name.is_empty(), TokenError::InvalidName);
        require!(!self.symbol.is_empty(), TokenError::InvalidSymbol);
        require!(self.uri.len() <= 200, TokenError::UriTooLong);
        require!(self.seller_fee_basis_points <= 10000, TokenError::InvalidMintConfig);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = payer,
        space = 82,
        owner = token_program.key(),
    )]
    /// CHECK: This will be initialized as a mint account by the token program
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateTokenWithMetadata<'info> {
    #[account(
        init,
        payer = payer,
        space = 82,
        owner = token_program.key(),
    )]
    /// CHECK: This will be initialized as a mint account by the token program
    pub mint: UncheckedAccount<'info>,

    /// CHECK: This is the metadata account that will be created by Metaplex
    #[account(
        mut,
        seeds = [
            "metadata".as_bytes(),
            token_metadata_program.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: This is the update authority for the metadata
    pub update_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    
    /// CHECK: This is the Metaplex Token Metadata program
    pub token_metadata_program: UncheckedAccount<'info>,
    
    pub rent: Sysvar<'info, Rent>,
}

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

#[derive(Accounts)]
pub struct BatchMintTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub mint_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut, constraint = !from.is_frozen() @ TokenError::AccountFrozen)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

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

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut, constraint = !token_account.is_frozen() @ TokenError::AccountFrozen)]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetMintAuthority<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub current_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FreezeAccount<'info> {
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub freeze_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ThawAccount<'info> {
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub freeze_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseAccount<'info> {
    #[account(mut, close = destination)]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: This account will receive the rent
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// Events for better monitoring and indexing
#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensTransferred {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AccountFrozen {
    pub mint: Pubkey,
    pub account: Pubkey,
}

#[event]
pub struct AccountThawed {
    pub mint: Pubkey,
    pub account: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintDestination {
    pub recipient: Pubkey,
    pub amount: u64,
}

#[program]
pub mod spl_token_mint {
    use super::*;

    /// Initialize a new mint with specified parameters (basic version without metadata)
    pub fn initialize_mint(
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

    /// Create a new token with metadata (name, symbol, logo URI)
    /// This function creates the mint and prepares for metadata creation
    pub fn create_token_with_metadata(
        ctx: Context<CreateTokenWithMetadata>,
        decimals: u8,
        metadata: TokenMetadata,
        mint_authority: Pubkey,
        freeze_authority: Option<Pubkey>,
    ) -> Result<()> {
        // Validate inputs
        require!(decimals <= 9, TokenError::InvalidDecimals);
        metadata.validate()?;

        // First, initialize the mint
        let cpi_accounts = anchor_spl::token::InitializeMint {
            mint: ctx.accounts.mint.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        anchor_spl::token::initialize_mint(cpi_ctx, decimals, &mint_authority, freeze_authority.as_ref())?;

        // Create metadata using raw instruction
        let metadata_instruction_data = create_metadata_instruction_data(
            ctx.accounts.metadata.key(),
            ctx.accounts.mint.key(),
            ctx.accounts.payer.key(),
            ctx.accounts.payer.key(),
            ctx.accounts.update_authority.key(),
            metadata.name.clone(),
            metadata.symbol.clone(),
            metadata.uri.clone(),
            metadata.seller_fee_basis_points,
        );

        let accounts = vec![
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.update_authority.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        let create_metadata_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.token_metadata_program.key(),
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.metadata.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.mint.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.payer.key(), true),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.payer.key(), true),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.update_authority.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
            ],
            data: metadata_instruction_data,
        };

        anchor_lang::solana_program::program::invoke(
            &create_metadata_ix,
            &accounts,
        )?;

        // Emit event
        emit!(TokenCreated {
            mint: ctx.accounts.mint.key(),
            authority: mint_authority,
            decimals,
            name: metadata.name.clone(),
            symbol: metadata.symbol.clone(),
        });

        msg!("Token created successfully!");
        msg!("Mint address: {}", ctx.accounts.mint.key());
        msg!("Metadata address: {}", ctx.accounts.metadata.key());
        msg!("Name: {}", metadata.name);
        msg!("Symbol: {}", metadata.symbol);
        msg!("URI: {}", metadata.uri);
        msg!("Decimals: {}", decimals);

        Ok(())
    }

    /// Mint tokens to a destination account
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        // Validate amount is not zero
        require!(amount > 0, TokenError::InvalidAmount);

        // Verify mint authority
        require!(
            ctx.accounts.mint.mint_authority.is_some(),
            TokenError::Unauthorized
        );
        require!(
            ctx.accounts.mint.mint_authority.unwrap() == ctx.accounts.mint_authority.key(),
            TokenError::Unauthorized
        );

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

        // Emit event
        emit!(TokensMinted {
            mint: ctx.accounts.mint.key(),
            recipient: ctx.accounts.destination.key(),
            amount,
        });

        msg!("Minted {} tokens to {}", amount, ctx.accounts.destination.key());
        
        Ok(())
    }

    /// Batch mint tokens to multiple destinations (limited to 10 for safety)
    pub fn batch_mint_tokens(
        ctx: Context<BatchMintTokens>,
        destinations: Vec<MintDestination>,
    ) -> Result<()> {
        // Validate batch size
        require!(destinations.len() <= 10, TokenError::BatchLimitExceeded);
        require!(!destinations.is_empty(), TokenError::InvalidAmount);

        // Verify mint authority
        require!(
            ctx.accounts.mint.mint_authority.is_some(),
            TokenError::Unauthorized
        );
        require!(
            ctx.accounts.mint.mint_authority.unwrap() == ctx.accounts.mint_authority.key(),
            TokenError::Unauthorized
        );

        // Calculate total amount and check for overflow
        let total_amount: u64 = destinations.iter().map(|d| d.amount).sum();
        let current_supply = ctx.accounts.mint.supply;
        require!(
            current_supply.checked_add(total_amount).is_some(),
            TokenError::SupplyOverflow
        );

        // This is a foundation for batch minting - in practice, you'd need to handle
        // the token accounts within the instruction or use remaining_accounts
        msg!("Batch mint prepared for {} destinations, total amount: {}", 
             destinations.len(), total_amount);

        Ok(())
    }

    /// Transfer tokens between accounts
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
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

        // Emit event
        emit!(TokensTransferred {
            mint: ctx.accounts.from.mint,
            from: ctx.accounts.from.key(),
            to: ctx.accounts.to.key(),
            amount,
        });

        msg!(
            "Transferred {} tokens from {} to {}",
            amount,
            ctx.accounts.from.key(),
            ctx.accounts.to.key()
        );

        Ok(())
    }

    /// Get mint information
    pub fn get_mint_info(ctx: Context<GetMintInfo>) -> Result<MintInfo> {
        let mint = &ctx.accounts.mint;
        
        Ok(MintInfo {
            supply: mint.supply,
            decimals: mint.decimals,
            mint_authority: mint.mint_authority.into(),
            freeze_authority: mint.freeze_authority.into(),
        })
    }

    /// Burn tokens from an account
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        // Validate amount
        require!(amount > 0, TokenError::InvalidAmount);

        // Check sufficient balance
        require!(
            ctx.accounts.token_account.amount >= amount,
            TokenError::BurnAmountExceedsBalance
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

        // Emit event
        emit!(TokensBurned {
            mint: ctx.accounts.mint.key(),
            account: ctx.accounts.token_account.key(),
            amount,
        });

        msg!("Burned {} tokens from {}", amount, ctx.accounts.token_account.key());

        Ok(())
    }

    /// Set mint authority (can be used to revoke mint authority by setting to None)
    pub fn set_mint_authority(
        ctx: Context<SetMintAuthority>,
        new_authority: Option<Pubkey>,
    ) -> Result<()> {
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

    /// Freeze a token account to prevent transfers
    pub fn freeze_account(ctx: Context<FreezeAccount>) -> Result<()> {
        // Verify freeze authority
        require!(
            ctx.accounts.mint.freeze_authority.is_some(),
            TokenError::Unauthorized
        );
        require!(
            ctx.accounts.mint.freeze_authority.unwrap() == ctx.accounts.freeze_authority.key(),
            TokenError::Unauthorized
        );

        // Verify token account belongs to this mint
        require!(
            ctx.accounts.token_account.mint == ctx.accounts.mint.key(),
            TokenError::MintMismatch
        );

        // Freeze the account
        let cpi_accounts = SplFreezeAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::freeze_account(cpi_ctx)?;

        // Emit event
        emit!(AccountFrozen {
            mint: ctx.accounts.mint.key(),
            account: ctx.accounts.token_account.key(),
        });

        msg!("Frozen token account: {}", ctx.accounts.token_account.key());

        Ok(())
    }

    /// Thaw a frozen token account to re-enable transfers
    pub fn thaw_account(ctx: Context<ThawAccount>) -> Result<()> {
        // Verify freeze authority
        require!(
            ctx.accounts.mint.freeze_authority.is_some(),
            TokenError::Unauthorized
        );
        require!(
            ctx.accounts.mint.freeze_authority.unwrap() == ctx.accounts.freeze_authority.key(),
            TokenError::Unauthorized
        );

        // Verify token account belongs to this mint
        require!(
            ctx.accounts.token_account.mint == ctx.accounts.mint.key(),
            TokenError::MintMismatch
        );

        // Thaw the account
        let cpi_accounts = SplThawAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::thaw_account(cpi_ctx)?;

        // Emit event
        emit!(AccountThawed {
            mint: ctx.accounts.mint.key(),
            account: ctx.accounts.token_account.key(),
        });

        msg!("Thawed token account: {}", ctx.accounts.token_account.key());

        Ok(())
    }

    /// Set freeze authority
    pub fn set_freeze_authority(
        ctx: Context<SetMintAuthority>,
        new_authority: Option<Pubkey>,
    ) -> Result<()> {
        // Verify current freeze authority
        require!(
            ctx.accounts.mint.freeze_authority.is_some(),
            TokenError::Unauthorized
        );
        require!(
            ctx.accounts.mint.freeze_authority.unwrap() == ctx.accounts.current_authority.key(),
            TokenError::Unauthorized
        );

        // Set new freeze authority
        let cpi_accounts = SplSetAuthority {
            account_or_mint: ctx.accounts.mint.to_account_info(),
            current_authority: ctx.accounts.current_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::set_authority(cpi_ctx, AuthorityType::FreezeAccount, new_authority)?;

        match new_authority {
            Some(authority) => {
                msg!("Freeze authority changed to: {}", authority);
            }
            None => {
                msg!("Freeze authority revoked permanently");
            }
        }

        Ok(())
    }

    /// Close an empty token account to reclaim rent
    pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
        // Verify account is empty
        require!(
            ctx.accounts.token_account.amount == 0,
            TokenError::AccountNotEmpty
        );

        // Verify authority owns the account
        require!(
            ctx.accounts.token_account.owner == ctx.accounts.owner.key(),
            TokenError::InvalidOwner
        );

        // Close the account
        let cpi_accounts = SplCloseAccount {
            account: ctx.accounts.token_account.to_account_info(),
            destination: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::close_account(cpi_ctx)?;

        msg!("Closed token account: {}", ctx.accounts.token_account.key());

        Ok(())
    }
}

// Helper function to create metadata instruction data
fn create_metadata_instruction_data(
    _metadata_key: Pubkey,
    _mint_key: Pubkey,
    _mint_authority_key: Pubkey,
    payer_key: Pubkey,
    _update_authority_key: Pubkey,
    name: String,
    symbol: String,
    uri: String,
    seller_fee_basis_points: u16,
) -> Vec<u8> {
    // This is a simplified version - in production, you'd want to use proper Metaplex instruction encoding
    // For now, this creates the basic structure needed for metadata creation
    let mut data = Vec::new();
    
    // Instruction discriminator for CreateMetadataAccountV3 (33 in decimal)
    data.push(33);
    
    // Add basic metadata fields (this is a simplified encoding)
    // In production, use proper borsh serialization with Metaplex types
    data.extend_from_slice(&name.len().to_le_bytes());
    data.extend_from_slice(name.as_bytes());
    data.extend_from_slice(&symbol.len().to_le_bytes());
    data.extend_from_slice(symbol.as_bytes());
    data.extend_from_slice(&uri.len().to_le_bytes());
    data.extend_from_slice(uri.as_bytes());
    data.extend_from_slice(&seller_fee_basis_points.to_le_bytes());
    
    // Add creator info (simplified)
    data.push(1); // has creators
    data.extend_from_slice(&payer_key.to_bytes());
    data.push(1); // verified
    data.push(100); // share
    
    // Collection and uses (none)
    data.push(0); // no collection
    data.push(0); // no uses
    
    data
}

// Utility functions for common operations
impl MintDestination {
    pub fn new(recipient: Pubkey, amount: u64) -> Self {
        Self { recipient, amount }
    }

    pub fn validate(&self) -> Result<()> {
        require!(self.amount > 0, TokenError::InvalidAmount);
        Ok(())
    }
}

// Helper functions for PDA derivation
pub fn get_associated_token_address(wallet: &Pubkey, mint: &Pubkey) -> Pubkey {
    anchor_spl::associated_token::get_associated_token_address(wallet, mint)
}

pub fn get_metadata_address(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            "metadata".as_bytes(),
            &mpl_token_metadata::ID.to_bytes(),
            mint.as_ref(),
        ],
        &mpl_token_metadata::ID,
    )
}

// Additional validation helpers
pub fn validate_mint_authority(mint: &Account<Mint>, authority: &Pubkey) -> Result<()> {
    require!(
        mint.mint_authority.is_some(),
        TokenError::Unauthorized
    );
    require!(
        mint.mint_authority.unwrap() == *authority,
        TokenError::Unauthorized
    );
    Ok(())
}

pub fn validate_freeze_authority(mint: &Account<Mint>, authority: &Pubkey) -> Result<()> {
    require!(
        mint.freeze_authority.is_some(),
        TokenError::Unauthorized
    );
    require!(
        mint.freeze_authority.unwrap() == *authority,
        TokenError::Unauthorized
    );
    Ok(())
}

// Cost calculation utilities
pub fn calculate_mint_cost(amount: u64, decimals: u8) -> u64 {
    // Simple cost calculation - can be enhanced based on business logic
    let base_cost = 1000; // Base cost in lamports
    let amount_factor = amount / (10_u64.pow(decimals as u32));
    base_cost + amount_factor
}

// Token supply utilities
pub fn calculate_total_supply_after_mint(current_supply: u64, mint_amount: u64) -> Result<u64> {
    current_supply
        .checked_add(mint_amount)
        .ok_or(TokenError::SupplyOverflow.into())
}

// Batch operation utilities
pub fn validate_batch_destinations(destinations: &[MintDestination]) -> Result<()> {
    require!(!destinations.is_empty(), TokenError::InvalidAmount);
    require!(destinations.len() <= 10, TokenError::BatchLimitExceeded);
    
    for dest in destinations {
        dest.validate()?;
    }
    
    Ok(())
}

// Constants for the program
pub const MAX_BATCH_SIZE: usize = 10;
pub const MAX_URI_LENGTH: usize = 200;
pub const MAX_NAME_LENGTH: usize = 32;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MIN_RENT_EXEMPT_BALANCE: u64 = 2039280; // Approximate rent for token account

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_metadata_validation() {
        let valid_metadata = TokenMetadata {
            name: "Test Token".to_string(),
            symbol: "TEST".to_string(),
            uri: "https://example.com/token.json".to_string(),
            seller_fee_basis_points: 500,
        };
        
        assert!(valid_metadata.validate().is_ok());

        let invalid_metadata = TokenMetadata {
            name: "".to_string(), // Empty name should fail
            symbol: "TEST".to_string(),
            uri: "https://example.com/token.json".to_string(),
            seller_fee_basis_points: 500,
        };
        
        assert!(invalid_metadata.validate().is_err());
    }

    #[test]
    fn test_mint_destination_validation() {
        let valid_dest = MintDestination::new(Pubkey::default(), 1000);
        assert!(valid_dest.validate().is_ok());

        let invalid_dest = MintDestination::new(Pubkey::default(), 0);
        assert!(invalid_dest.validate().is_err());
    }

    #[test]
    fn test_supply_overflow_check() {
        let max_supply = u64::MAX - 1000;
        let mint_amount = 2000;
        
        assert!(calculate_total_supply_after_mint(max_supply, mint_amount).is_err());
        
        let safe_mint = 500;
        assert!(calculate_total_supply_after_mint(max_supply, safe_mint).is_ok());
    }

    #[test]
    fn test_batch_validation() {
        let valid_batch = vec![
            MintDestination::new(Pubkey::default(), 100),
            MintDestination::new(Pubkey::default(), 200),
        ];
        assert!(validate_batch_destinations(&valid_batch).is_ok());

        let empty_batch: Vec<MintDestination> = vec![];
        assert!(validate_batch_destinations(&empty_batch).is_err());

        let oversized_batch = vec![MintDestination::new(Pubkey::default(), 100); 11];
        assert!(validate_batch_destinations(&oversized_batch).is_err());
    }

    #[test]
    fn test_cost_calculation() {
        let cost = calculate_mint_cost(1000, 6);
        assert!(cost > 0);
        
        let high_amount_cost = calculate_mint_cost(1_000_000, 6);
        assert!(high_amount_cost > cost);
    }
}