use anchor_lang::prelude::*;

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
}