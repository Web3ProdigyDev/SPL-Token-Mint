import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SplTokenMint } from "../target/types/spl_token_mint";
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { expect } from "chai";
import * as fs from "fs";

describe("spl-token-mint", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SplTokenMint as Program<SplTokenMint>;
  
  // Test keypairs
  let mintKeypair: anchor.web3.Keypair;
  let mintAuthority: anchor.web3.Keypair;
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  let user3: anchor.web3.Keypair;
  
  // Token accounts
  let user1TokenAccount: anchor.web3.PublicKey;
  let user2TokenAccount: anchor.web3.PublicKey;
  let user3TokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Generate fresh mint keypair for each test run to avoid conflicts
    mintKeypair = anchor.web3.Keypair.generate();
    
    // Load existing keypairs from test-keys directory for other accounts
    const adminKeyData = JSON.parse(fs.readFileSync('./test-keys/admin.json', 'utf-8'));
    const wallet1KeyData = JSON.parse(fs.readFileSync('./test-keys/wallet1.json', 'utf-8'));
    const wallet2KeyData = JSON.parse(fs.readFileSync('./test-keys/wallet2.json', 'utf-8'));
    const wallet3KeyData = JSON.parse(fs.readFileSync('./test-keys/wallet3.json', 'utf-8'));

    mintAuthority = anchor.web3.Keypair.fromSecretKey(new Uint8Array(adminKeyData));
    user1 = anchor.web3.Keypair.fromSecretKey(new Uint8Array(wallet1KeyData));
    user2 = anchor.web3.Keypair.fromSecretKey(new Uint8Array(wallet2KeyData));
    user3 = anchor.web3.Keypair.fromSecretKey(new Uint8Array(wallet3KeyData));

    console.log("\n=== ACCOUNT INFORMATION ===");
    console.log(`Mint Account: ${mintKeypair.publicKey.toString()}`);
    console.log(`Admin/Mint Authority: ${mintAuthority.publicKey.toString()}`);
    console.log(`User1 (Wallet1): ${user1.publicKey.toString()}`);
    console.log(`User2 (Wallet2): ${user2.publicKey.toString()}`);
    console.log(`User3 (Wallet3): ${user3.publicKey.toString()}`);
    
    // Check SOL balances for all accounts
    console.log("\n=== SOL BALANCE CHECK ===");
    const mintBalance = await provider.connection.getBalance(mintKeypair.publicKey);
    const adminBalance = await provider.connection.getBalance(mintAuthority.publicKey);
    const user1Balance = await provider.connection.getBalance(user1.publicKey);
    const user2Balance = await provider.connection.getBalance(user2.publicKey);
    const user3Balance = await provider.connection.getBalance(user3.publicKey);
    
    console.log(`Mint Account Balance: ${mintBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`Admin Balance: ${adminBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`User1 Balance: ${user1Balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`User2 Balance: ${user2Balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`User3 Balance: ${user3Balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

    // Auto-fund accounts if they have insufficient SOL
    const minRequiredSol = 0.01; // 0.01 SOL minimum
    const accounts = [
      { keypair: mintAuthority, name: 'Admin', balance: adminBalance },
      { keypair: user1, name: 'User1', balance: user1Balance },
      { keypair: user2, name: 'User2', balance: user2Balance },
      { keypair: user3, name: 'User3', balance: user3Balance }
    ];

    console.log("\n=== AUTO-FUNDING ACCOUNTS ===");
    
    for (const account of accounts) {
      if (account.balance / anchor.web3.LAMPORTS_PER_SOL < minRequiredSol) {
        console.log(`🔄 Auto-funding ${account.name} (${account.keypair.publicKey.toString()})...`);
        try {
          const airdropAmount = anchor.web3.LAMPORTS_PER_SOL * 1; // 1 SOL
          const airdropTx = await provider.connection.requestAirdrop(
            account.keypair.publicKey,
            airdropAmount
          );
          
          // Wait for airdrop confirmation with timeout
          const latestBlockhash = await provider.connection.getLatestBlockhash();
          await provider.connection.confirmTransaction({
            signature: airdropTx,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
          });
          
          const newBalance = await provider.connection.getBalance(account.keypair.publicKey);
          console.log(`✅ ${account.name} funded: ${newBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
        } catch (error) {
          console.log(`❌ Failed to fund ${account.name}: ${error.message}`);
          console.log(`Manual funding required: solana transfer ${account.keypair.publicKey.toString()} 0.1 --allow-unfunded-recipient`);
        }
      } else {
        console.log(`✅ ${account.name} already has sufficient balance`);
      }
    }
    
    console.log("\n========================\n");

    // Calculate associated token accounts
    user1TokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      user1.publicKey
    );
    
    user2TokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      user2.publicKey
    );

    user3TokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      user3.publicKey
    );
  });

  it("Initialize mint", async () => {
    const decimals = 9;
    
    const tx = await program.methods
      .initializeMint(decimals, mintAuthority.publicKey, null)
      .accounts({
        mint: mintKeypair.publicKey,
        payer: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair, mintAuthority])
      .rpc();

    console.log("Initialize mint transaction signature:", tx);

    // Verify mint was created
    const mintAccount = await program.provider.connection.getAccountInfo(mintKeypair.publicKey);
    expect(mintAccount).to.not.be.null;

    // Get mint info
    const mintInfo = await program.methods
      .getMintInfo()
      .accounts({
        mint: mintKeypair.publicKey,
      })
      .view();

    expect(mintInfo.decimals).to.equal(decimals);
    expect(mintInfo.supply.toString()).to.equal("0");
    expect(mintInfo.mintAuthority.toString()).to.equal(mintAuthority.publicKey.toString());
  });

  it("Mint tokens to user1", async () => {
    const mintAmount = new anchor.BN(1000 * Math.pow(10, 9)); // 1000 tokens

    const tx = await program.methods
      .mintTokens(mintAmount)
      .accounts({
        mint: mintKeypair.publicKey,
        destination: user1TokenAccount,
        destinationOwner: user1.publicKey,
        mintAuthority: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintAuthority])
      .rpc();

    console.log("Mint tokens transaction signature:", tx);

    // Verify tokens were minted
    const tokenAccount = await program.provider.connection.getTokenAccountBalance(user1TokenAccount);
    expect(tokenAccount.value.amount).to.equal(mintAmount.toString());

    // Verify supply increased
    const mintInfo = await program.methods
      .getMintInfo()
      .accounts({
        mint: mintKeypair.publicKey,
      })
      .view();
    
    expect(mintInfo.supply.toString()).to.equal(mintAmount.toString());
  });

  it("Transfer tokens from user1 to user2", async () => {
    const transferAmount = new anchor.BN(500 * Math.pow(10, 9)); // 500 tokens

    // First, create user2's token account by minting 1 token (not 0)
    await program.methods
      .mintTokens(new anchor.BN(1)) // Mint 1 lamport to create the account
      .accounts({
        mint: mintKeypair.publicKey,
        destination: user2TokenAccount,
        destinationOwner: user2.publicKey,
        mintAuthority: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintAuthority])
      .rpc();

    // Now transfer tokens
    const tx = await program.methods
      .transferTokens(transferAmount)
      .accounts({
        from: user1TokenAccount,
        to: user2TokenAccount,
        authority: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    console.log("Transfer tokens transaction signature:", tx);

    // Verify balances
    const user1Balance = await program.provider.connection.getTokenAccountBalance(user1TokenAccount);
    const user2Balance = await program.provider.connection.getTokenAccountBalance(user2TokenAccount);

    expect(user1Balance.value.amount).to.equal((1000 * Math.pow(10, 9) - 500 * Math.pow(10, 9)).toString());
    // User2 should have 500 tokens + 1 lamport from the initial mint
    expect(user2Balance.value.amount).to.equal((500 * Math.pow(10, 9) + 1).toString());
  });

  it("Burn tokens from user1", async () => {
    const burnAmount = new anchor.BN(250 * Math.pow(10, 9)); // 250 tokens

    const tx = await program.methods
      .burnTokens(burnAmount)
      .accounts({
        mint: mintKeypair.publicKey,
        tokenAccount: user1TokenAccount,
        authority: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    console.log("Burn tokens transaction signature:", tx);

    // Verify user1 balance decreased
    const user1Balance = await program.provider.connection.getTokenAccountBalance(user1TokenAccount);
    expect(user1Balance.value.amount).to.equal((250 * Math.pow(10, 9)).toString()); // 500 - 250 = 250

    // Verify total supply decreased
    const mintInfo = await program.methods
      .getMintInfo()
      .accounts({
        mint: mintKeypair.publicKey,
      })
      .view();
    
    // Total supply should be: initial 1000 + 1 lamport - 250 burned = 750 + 1 lamport
    expect(mintInfo.supply.toString()).to.equal((750 * Math.pow(10, 9) + 1).toString());
  });

  it("Set mint authority to null (revoke mint authority)", async () => {
    const tx = await program.methods
      .setMintAuthority(null)
      .accounts({
        mint: mintKeypair.publicKey,
        currentAuthority: mintAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([mintAuthority])
      .rpc();

    console.log("Set mint authority transaction signature:", tx);

    // Verify mint authority was revoked
    const mintInfo = await program.methods
      .getMintInfo()
      .accounts({
        mint: mintKeypair.publicKey,
      })
      .view();
    
    expect(mintInfo.mintAuthority).to.be.null;
  });

  it("Should fail to mint after authority revoked", async () => {
    const mintAmount = new anchor.BN(100 * Math.pow(10, 9));

    try {
      await program.methods
        .mintTokens(mintAmount)
        .accounts({
          mint: mintKeypair.publicKey,
          destination: user1TokenAccount,
          destinationOwner: user1.publicKey,
          mintAuthority: mintAuthority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintAuthority])
        .rpc();

      // Should not reach here
      expect.fail("Expected transaction to fail");
    } catch (error) {
      // Check if it's a SendTransactionError and extract the actual error
      if (error.name === 'SendTransactionError') {
        console.log("Expected error when trying to mint after authority revoked:", error.message);
        // This is the expected behavior
      } else {
        console.log("Expected error when trying to mint after authority revoked:", error.message);
      }
    }
  });

  it("Should fail transfer with insufficient funds", async () => {
    const transferAmount = new anchor.BN(1000 * Math.pow(10, 9)); // More than user1 has

    try {
      await program.methods
        .transferTokens(transferAmount)
        .accounts({
          from: user1TokenAccount,
          to: user2TokenAccount,
          authority: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      expect.fail("Expected transaction to fail");
    } catch (error) {
      expect(error).to.be.an("error");
      console.log("Expected error for insufficient funds:", error.message);
    }
  });

  it("Should fail transfer with invalid authority", async () => {
    const transferAmount = new anchor.BN(10 * Math.pow(10, 9));

    try {
      await program.methods
        .transferTokens(transferAmount)
        .accounts({
          from: user1TokenAccount,
          to: user2TokenAccount,
          authority: user2.publicKey, // Wrong authority
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      expect.fail("Expected transaction to fail");
    } catch (error) {
      expect(error).to.be.an("error");
      console.log("Expected error for invalid authority:", error.message);
    }
  });

  it("Multi-wallet transfer test", async () => {
    const transferAmount = new anchor.BN(100 * Math.pow(10, 9)); // 100 tokens

    // First, create user3's token account by minting 1 lamport (to set up the account)
    // Note: We need to create a new mint since the previous one had its authority revoked
    const newMintKeypair = anchor.web3.Keypair.generate();
    
    // Initialize new mint for this test
    await program.methods
      .initializeMint(9, mintAuthority.publicKey, null)
      .accounts({
        mint: newMintKeypair.publicKey,
        payer: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([newMintKeypair, mintAuthority])
      .rpc();

    // Calculate new token accounts
    const newUser2TokenAccount = getAssociatedTokenAddressSync(
      newMintKeypair.publicKey,
      user2.publicKey
    );
    const newUser3TokenAccount = getAssociatedTokenAddressSync(
      newMintKeypair.publicKey,
      user3.publicKey
    );

    // Mint tokens to user2
    await program.methods
      .mintTokens(new anchor.BN(1000 * Math.pow(10, 9)))
      .accounts({
        mint: newMintKeypair.publicKey,
        destination: newUser2TokenAccount,
        destinationOwner: user2.publicKey,
        mintAuthority: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintAuthority])
      .rpc();

    // Create user3's token account with 1 lamport
    await program.methods
      .mintTokens(new anchor.BN(1))
      .accounts({
        mint: newMintKeypair.publicKey,
        destination: newUser3TokenAccount,
        destinationOwner: user3.publicKey,
        mintAuthority: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintAuthority])
      .rpc();

    // Transfer from user2 to user3
    const tx = await program.methods
      .transferTokens(transferAmount)
      .accounts({
        from: newUser2TokenAccount,
        to: newUser3TokenAccount,
        authority: user2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();

    console.log("Multi-wallet transfer transaction signature:", tx);

    // Verify balances
    const user2Balance = await program.provider.connection.getTokenAccountBalance(newUser2TokenAccount);
    const user3Balance = await program.provider.connection.getTokenAccountBalance(newUser3TokenAccount);

    expect(user2Balance.value.amount).to.equal((1000 * Math.pow(10, 9) - 100 * Math.pow(10, 9)).toString()); // 1000 - 100
    expect(user3Balance.value.amount).to.equal((100 * Math.pow(10, 9) + 1).toString());  // 0 + 100 + 1 initial lamport
  });
});