use anchor_lang::prelude::*;

declare_id!("GV5hMeyznNNy3dvjGfGgaMHqczjCdjTdRAv9K24yJHBC");

#[program]
pub mod spl_token_mint {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
