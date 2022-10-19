use anchor_lang::prelude::*;
use num_derive::*;
use anchor_spl::token::{self,Token, TokenAccount};

declare_id!("6dnQvFdv2Wgu3mD977Yur7z9ThrDWnhTVM5RjvwwH9My");

#[program]
pub mod coin_flip {
    use super::*;

    pub fn init(ctx: Context<Init>,player: Pubkey) -> Result<()> {
        let coin_flip = &mut ctx.accounts.coin_flip;
        coin_flip.players = [ctx.accounts.vendor.key(), player];
        coin_flip.bump = *ctx.bumps.get("coin_flip").unwrap();
        Ok(())
    }
    pub fn setup(ctx: Context<Setup>,player: Pubkey,bet_amount: u64, vendor_seed: i64) -> Result<()> {
 
        let coin_flip = &mut ctx.accounts.coin_flip;
        coin_flip.players = [ctx.accounts.vendor.key(), player];
        coin_flip.vendor_seed = vendor_seed;
        coin_flip.bump = *ctx.bumps.get("coin_flip").unwrap();
        coin_flip.bet_amount = bet_amount;
        

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_from.to_account_info(),
                to: ctx.accounts.token_to.to_account_info(),
                authority: ctx.accounts.vendor.to_account_info()
            },

        );

        token::transfer(cpi_ctx, bet_amount)?;

        Ok(())
    }

    
    pub fn play(ctx: Context<Play>, player_choice: u8, player_seed: i64) -> Result<()> {
        let coin_flip = &mut ctx.accounts.coin_flip;
        let player_seed = player_seed;

        // 0: Tails, 1: Heads
        let player_side = if player_choice == 0 {
            Side::Tails
        } else {
            Side::Heads
        };

        let mut cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_from.to_account_info(),
                to: ctx.accounts.token_to.to_account_info(),
                authority: ctx.accounts.player.to_account_info()
            },

        );

        token::transfer(cpi_ctx, coin_flip.bet_amount)?;


        let total_bet = coin_flip.bet_amount * 2;

        let winner = coin_flip.play(player_seed, player_side);

        let seeds = &[
            b"coin-flip",
            ctx.accounts.vendor.key.as_ref(),
            ctx.accounts.player.key.as_ref(),
            &[coin_flip.bump],
        ];

        let pool_signer = &[&seeds[..]];
        
        if winner == *ctx.accounts.vendor.key {
            cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.token_to.to_account_info(),
                    to: ctx.accounts.vendor_token_account.to_account_info(),
                    authority: ctx.accounts.coin_flip.to_account_info()
                },
                pool_signer
                
            );
        } else {
            cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.token_to.to_account_info(),
                    to: ctx.accounts.token_from.to_account_info(),
                    authority: ctx.accounts.coin_flip.to_account_info()
                },
                pool_signer
    
            );
    
        }
 
        token::transfer(cpi_ctx, total_bet)?;
        Ok(())
    }


    pub fn delete(_ctx: Context<Delete>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(player: Pubkey)]
pub struct Init<'info> {
    #[account(
        init, 
        payer = vendor, 
        space = CoinFlip::LEN,
        seeds = [b"coin-flip", vendor.key().as_ref(), player.as_ref()], bump
    )]
    pub coin_flip: Account<'info, CoinFlip>,
    #[account(mut)]
    pub vendor: Signer<'info>,
    /// CHECK
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(player: Pubkey)]
pub struct Setup<'info> {
    #[account(
        mut,
        seeds = [b"coin-flip", vendor.key().as_ref(), player.as_ref()], bump
    )]
    pub coin_flip: Account<'info, CoinFlip>,
    #[account(mut)]
    pub vendor: Signer<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK
    #[account(mut)]
    pub token_from :Box<Account<'info, TokenAccount>>,
    /// CHECK
    #[account(mut)]
    pub token_to :Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
pub struct Play<'info> {
    #[account(
        mut, 
        seeds = [b"coin-flip", vendor.key().as_ref(), player.key().as_ref()], bump
    )]
    pub coin_flip: Account<'info, CoinFlip>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK
    #[account(mut)]
    pub token_from :Box<Account<'info, TokenAccount>>,
    /// CHECK
    #[account(mut)]
    pub token_to :Box<Account<'info, TokenAccount>>,
    /// CHECK
    #[account(mut)]
    pub vendor_token_account :Box<Account<'info, TokenAccount>>,
    
    /// CHECK
    pub vendor : AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(player: Pubkey)]
pub struct Delete<'info> {
    #[account(
        mut, 
        close = vendor,
        seeds = [b"coin-flip", vendor.key().as_ref(), player.as_ref()], bump
    )]
    pub coin_flip: Account<'info, CoinFlip>,
    #[account(mut)]
    pub vendor: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[account]
#[derive(Default)] 
pub struct CoinFlip {
    players: [Pubkey; 2], 
    vendor_seed: i64,
    state: CoinFlipState,
    bet_amount: u64,
    bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CoinFlipState {
    Active,
    Finished { winner: Pubkey },
}

impl Default for CoinFlipState {
    fn default() -> Self {
        Self::Active
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, FromPrimitive, ToPrimitive, Copy, Clone, PartialEq, Eq)]
pub enum Side {
    Heads,
    Tails
}


impl CoinFlip {
    const LEN: usize = 64 + 8 + 33 + 8 + 8 + 8;

    fn flip_side(&self, flip_number: i64) -> Side {
        if flip_number == 0 {
            Side::Tails
        } else {
            Side::Heads
        }
    }

    fn flip(&self, player_seed: i64) -> Side {
        let clock: Clock = Clock::get().unwrap();
        let flip_number: i64 = (self.vendor_seed + player_seed + clock.unix_timestamp) % 2;

        self.flip_side(flip_number)
    }

    pub fn play(&mut self, player_seed: i64, player_side: Side) -> Pubkey {
        let flip_result = self.flip(player_seed);

        if flip_result == player_side {
            self.state = CoinFlipState::Finished {
                winner: self.players[1]
            };
            self.players[1]
        } else {
            self.state = CoinFlipState::Finished {
                winner: self.players[0]
            };
            self.players[0]
        }
    }
}

#[error_code]
pub enum CoinFlipError {
    #[msg("Bet amount is too small")]
    BetTooSmall,

}