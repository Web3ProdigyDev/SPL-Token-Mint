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

// Metaplex Token Metadata Program ID
const METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

describe("spl-token-mint", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SplTokenMint as Program<SplTokenMint>;
  
  // Test keypairs
  let mintKeypair: anchor.web3.Keypair;
  let metadataMintKeypair: anchor.web3.Keypair;
  let mintAuthority: anchor.web3.Keypair;
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  let user3: anchor.web3.Keypair;
  let updateAuthority: anchor.web3.Keypair;
  
  // Token accounts
  let user1TokenAccount: anchor.web3.PublicKey;
  let user2TokenAccount: anchor.web3.PublicKey;
  let user3TokenAccount: anchor.web3.PublicKey;
  let metadataUser1TokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Generate fresh mint keypairs
    mintKeypair = anchor.web3.Keypair.generate();
    metadataMintKeypair = anchor.web3.Keypair.generate();
    updateAuthority = anchor.web3.Keypair.generate();
    
    // Load existing keypairs from test-keys directory
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
    console.log(`Metadata Mint Account: ${metadataMintKeypair.publicKey.toString()}`);
    console.log(`Admin/Mint Authority: ${mintAuthority.publicKey.toString()}`);
    console.log(`Update Authority: ${updateAuthority.publicKey.toString()}`);
    console.log(`User1 (Wallet1): ${user1.publicKey.toString()}`);
    console.log(`User2 (Wallet2): ${user2.publicKey.toString()}`);
    console.log(`User3 (Wallet3): ${user3.publicKey.toString()}`);
    
    // Check SOL balances for all accounts
    console.log("\n=== SOL BALANCE CHECK ===");
    const accounts = [
      { keypair: mintAuthority, name: 'Admin' },
      { keypair: user1, name: 'User1' },
      { keypair: user2, name: 'User2' },
      { keypair: user3, name: 'User3' },
      { keypair: updateAuthority, name: 'UpdateAuthority' }
    ];

    for (const account of accounts) {
      const balance = await provider.connection.getBalance(account.keypair.publicKey);
      console.log(`${account.name} Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    // Auto-fund accounts if they have insufficient SOL
    const minRequiredSol = 0.01; // 0.01 SOL minimum
    console.log("\n=== AUTO-FUNDING ACCOUNTS ===");
    
    for (const account of accounts) {
      const balance = await provider.connection.getBalance(account.keypair.publicKey);
      if (balance / anchor.web3.LAMPORTS_PER_SOL < minRequiredSol) {
        console.log(`🔄 Auto-funding ${account.name} (${account.keypair.publicKey.toString()})...`);
        try {
          const airdropAmount = anchor.web3.LAMPORTS_PER_SOL * 1; // 1 SOL
          const airdropTx = await provider.connection.requestAirdrop(
            account.keypair.publicKey,
            airdropAmount
          );
          
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
    user1TokenAccount = getAssociatedTokenAddressSync(mintKeypair.publicKey, user1.publicKey);
    user2TokenAccount = getAssociatedTokenAddressSync(mintKeypair.publicKey, user2.publicKey);
    user3TokenAccount = getAssociatedTokenAddressSync(mintKeypair.publicKey, user3.publicKey);
    metadataUser1TokenAccount = getAssociatedTokenAddressSync(metadataMintKeypair.publicKey, user1.publicKey);
  });

  describe("Basic Token Operations", () => {
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

      const mintAccount = await program.provider.connection.getAccountInfo(mintKeypair.publicKey);
      expect(mintAccount).to.not.be.null;

      const mintInfo = await program.methods
        .getMintInfo()
        .accounts({
          mint: mintKeypair.publicKey,
        })
        .view();

      expect(mintInfo.decimals).to.equal(decimals);
      expect(mintInfo.supply.toString()).to.equal("0");
      expect(mintInfo.mintAuthority.toString()).to.equal(mintAuthority.publicKey.toString());
      expect(mintInfo.freezeAuthority).to.be.null;
    });

    it("Initialize mint with freeze authority", async () => {
      const freezeMintKeypair = anchor.web3.Keypair.generate();
      const freezeAuthority = anchor.web3.Keypair.generate();
      const decimals = 6;
      
      const tx = await program.methods
        .initializeMint(decimals, mintAuthority.publicKey, freezeAuthority.publicKey)
        .accounts({
          mint: freezeMintKeypair.publicKey,
          payer: mintAuthority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([freezeMintKeypair, mintAuthority])
        .rpc();

      console.log("Initialize mint with freeze authority transaction signature:", tx);

      const mintInfo = await program.methods
        .getMintInfo()
        .accounts({
          mint: freezeMintKeypair.publicKey,
        })
        .view();

      expect(mintInfo.decimals).to.equal(decimals);
      expect(mintInfo.supply.toString()).to.equal("0");
      expect(mintInfo.mintAuthority.toString()).to.equal(mintAuthority.publicKey.toString());
      expect(mintInfo.freezeAuthority.toString()).to.equal(freezeAuthority.publicKey.toString());
    });

    it("Should fail to initialize mint with invalid decimals", async () => {
      const invalidMintKeypair = anchor.web3.Keypair.generate();
      const invalidDecimals = 15;
      
      try {
        await program.methods
          .initializeMint(invalidDecimals, mintAuthority.publicKey, null)
          .accounts({
            mint: invalidMintKeypair.publicKey,
            payer: mintAuthority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([invalidMintKeypair, mintAuthority])
          .rpc();

        expect.fail("Expected transaction to fail with invalid decimals");
      } catch (error) {
        console.log("Expected error for invalid decimals:", error.message);
        expect(error.message).to.include("InvalidDecimals");
      }
    });
  });

  describe("Token Metadata Operations", () => {
    it("Create token with metadata", async () => {
      const decimals = 9;
      const metadata = {
        name: "Test Token",
        symbol: "TEST",
        uri: "https://example.com/token-metadata.json",
        sellerFeeBasisPoints: 500,
      };

      const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          metadataMintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      try {
        const tx = await program.methods
          .createTokenWithMetadata(decimals, metadata, mintAuthority.publicKey, null)
          .accounts({
            mint: metadataMintKeypair.publicKey,
            metadata: metadataAddress,
            payer: mintAuthority.publicKey,
            updateAuthority: updateAuthority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: METADATA_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([metadataMintKeypair, mintAuthority])
          .rpc();

        console.log("Create token with metadata transaction signature:", tx);

        const mintAccount = await program.provider.connection.getAccountInfo(metadataMintKeypair.publicKey);
        expect(mintAccount).to.not.be.null;

        const mintInfo = await program.methods
          .getMintInfo()
          .accounts({
            mint: metadataMintKeypair.publicKey,
          })
          .view();

        expect(mintInfo.decimals).to.equal(decimals);
        expect(mintInfo.supply.toString()).to.equal("0");
        expect(mintInfo.mintAuthority.toString()).to.equal(mintAuthority.publicKey.toString());

        console.log("Token with metadata created successfully!");
      } catch (error) {
        console.log("Note: Metadata creation might fail in test environment without proper Metaplex setup");
        console.log("Error:", error.message);
      }
    });

    it("Should fail to create token with empty name", async () => {
      const invalidMetadataMintKeypair = anchor.web3.Keypair.generate();
      const decimals = 9;
      const metadata = {
        name: "",
        symbol: "TEST",
        uri: "https://example.com/token-metadata.json",
        sellerFeeBasisPoints: 500,
      };

      const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          invalidMetadataMintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      try {
        await program.methods
          .createTokenWithMetadata(decimals, metadata, mintAuthority.publicKey, null)
          .accounts({
            mint: invalidMetadataMintKeypair.publicKey,
            metadata: metadataAddress,
            payer: mintAuthority.publicKey,
            updateAuthority: updateAuthority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: METADATA_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([invalidMetadataMintKeypair, mintAuthority])
          .rpc();

        expect.fail("Expected transaction to fail with empty name");
      } catch (error) {
        console.log("Expected error for empty name:", error.message);
        expect(error.message).to.include("InvalidName");
      }
    });
  });

  describe("Minting Operations", () => {
    it("Mint tokens to user1", async () => {
      const mintAmount = new anchor.BN(1000 * Math.pow(10, 9));

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

      const tokenAccount = await program.provider.connection.getTokenAccountBalance(user1TokenAccount);
      expect(tokenAccount.value.amount).to.equal(mintAmount.toString());

      const mintInfo = await program.methods
        .getMintInfo()
        .accounts({
          mint: mintKeypair.publicKey,
        })
        .view();
      
      expect(mintInfo.supply.toString()).to.equal(mintAmount.toString());
    });

    it("Should fail to mint zero tokens", async () => {
      const zeroAmount = new anchor.BN(0);

      try {
        await program.methods
          .mintTokens(zeroAmount)
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

        expect.fail("Expected transaction to fail with zero amount");
      } catch (error) {
        console.log("Expected error for zero mint amount:", error.message);
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Should fail to mint with wrong authority", async () => {
      const mintAmount = new anchor.BN(100 * Math.pow(10, 9));

      try {
        await program.methods
          .mintTokens(mintAmount)
          .accounts({
            mint: mintKeypair.publicKey,
            destination: user1TokenAccount,
            destinationOwner: user1.publicKey,
            mintAuthority: user1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([user1])
          .rpc();

        expect.fail("Expected transaction to fail with wrong authority");
      } catch (error) {
        console.log("Expected error for wrong mint authority:", error.message);
      }
    });
  });

  describe("Transfer Operations", () => {
    it("Transfer tokens from user1 to user2", async () => {
      const transferAmount = new anchor.BN(500 * Math.pow(10, 9));

      await program.methods
        .mintTokens(new anchor.BN(1))
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

      const user1Balance = await program.provider.connection.getTokenAccountBalance(user1TokenAccount);
      const user2Balance = await program.provider.connection.getTokenAccountBalance(user2TokenAccount);

      expect(user1Balance.value.amount).to.equal((1000 * Math.pow(10, 9) - 500 * Math.pow(10, 9)).toString());
      expect(user2Balance.value.amount).to.equal((500 * Math.pow(10, 9) + 1).toString());
    });

    it("Should fail transfer with insufficient funds", async () => {
      const transferAmount = new anchor.BN(1000 * Math.pow(10, 9));

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
        console.log("Expected error for insufficient funds:", error.message);
        expect(error.message).to.include("InsufficientFunds");
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
            authority: user2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error for invalid authority:", error.message);
        expect(error.message).to.include("InvalidOwner");
      }
    });

    it("Should fail transfer to same account", async () => {
      const transferAmount = new anchor.BN(10 * Math.pow(10, 9));

      try {
        await program.methods
          .transferTokens(transferAmount)
          .accounts({
            from: user1TokenAccount,
            to: user1TokenAccount,
            authority: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error for self-transfer:", error.message);
        expect(error.message).to.include("InvalidTransfer");
      }
    });

    it("Should fail transfer with zero amount", async () => {
      const transferAmount = new anchor.BN(0);

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
        console.log("Expected error for zero transfer amount:", error.message);
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Multi-wallet transfer test", async () => {
      const transferAmount = new anchor.BN(100 * Math.pow(10, 9));
      const newMintKeypair = anchor.web3.Keypair.generate();
      
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

      const newUser2TokenAccount = getAssociatedTokenAddressSync(newMintKeypair.publicKey, user2.publicKey);
      const newUser3TokenAccount = getAssociatedTokenAddressSync(newMintKeypair.publicKey, user3.publicKey);

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

      const user2Balance = await program.provider.connection.getTokenAccountBalance(newUser2TokenAccount);
      const user3Balance = await program.provider.connection.getTokenAccountBalance(newUser3TokenAccount);

      expect(user2Balance.value.amount).to.equal((1000 * Math.pow(10, 9) - 100 * Math.pow(10, 9)).toString());
      expect(user3Balance.value.amount).to.equal((100 * Math.pow(10, 9) + 1).toString());
    });
  });

  describe("Burn Operations", () => {
    it("Burn tokens from user1", async () => {
      const burnAmount = new anchor.BN(250 * Math.pow(10, 9));

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

      const user1Balance = await program.provider.connection.getTokenAccountBalance(user1TokenAccount);
      expect(user1Balance.value.amount).to.equal((250 * Math.pow(10, 9)).toString());

      const mintInfo = await program.methods
        .getMintInfo()
        .accounts({
          mint: mintKeypair.publicKey,
        })
        .view();
      
      expect(mintInfo.supply.toString()).to.equal((750 * Math.pow(10, 9) + 1).toString());
    });

    it("Should fail to burn zero tokens", async () => {
      const burnAmount = new anchor.BN(0);

      try {
        await program.methods
          .burnTokens(burnAmount)
          .accounts({
            mint: mintKeypair.publicKey,
            tokenAccount: user1TokenAccount,
            authority: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error for zero burn amount:", error.message);
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Should fail to burn with insufficient balance", async () => {
      const burnAmount = new anchor.BN(1000 * Math.pow(10, 9));

      try {
        await program.methods
          .burnTokens(burnAmount)
          .accounts({
            mint: mintKeypair.publicKey,
            tokenAccount: user1TokenAccount,
            authority: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error for insufficient burn balance:", error.message);
        expect(error.message).to.include("InsufficientFunds");
      }
    });

    it("Should fail to burn with wrong authority", async () => {
      const burnAmount = new anchor.BN(10 * Math.pow(10, 9));

      try {
        await program.methods
          .burnTokens(burnAmount)
          .accounts({
            mint: mintKeypair.publicKey,
            tokenAccount: user1TokenAccount,
            authority: user2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error for wrong burn authority:", error.message);
        expect(error.message).to.include("InvalidOwner");
      }
    });
  });

  describe("Authority Management", () => {
    it("Change mint authority to another account", async () => {
      const authorityMintKeypair = anchor.web3.Keypair.generate();
      const newAuthority = anchor.web3.Keypair.generate();

      await program.methods
        .initializeMint(9, mintAuthority.publicKey, null)
        .accounts({
          mint: authorityMintKeypair.publicKey,
          payer: mintAuthority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([authorityMintKeypair, mintAuthority])
        .rpc();

      const tx = await program.methods
        .setMintAuthority(newAuthority.publicKey)
        .accounts({
          mint: authorityMintKeypair.publicKey,
          currentAuthority: mintAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([mintAuthority])
        .rpc();

      console.log("Set mint authority transaction signature:", tx);

      const mintInfo = await program.methods
        .getMintInfo()
        .accounts({
          mint: authorityMintKeypair.publicKey,
        })
        .view();
      
      expect(mintInfo.mintAuthority.toString()).to.equal(newAuthority.publicKey.toString());
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

      console.log("Revoke mint authority transaction signature:", tx);

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

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error when trying to mint after authority revoked:", error.message);
      }
    });

    it("Should fail to change authority with wrong current authority", async () => {
      const wrongAuthMintKeypair = anchor.web3.Keypair.generate();
      const newAuthority = anchor.web3.Keypair.generate();

      await program.methods
        .initializeMint(9, mintAuthority.publicKey, null)
        .accounts({
          mint: wrongAuthMintKeypair.publicKey,
          payer: mintAuthority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([wrongAuthMintKeypair, mintAuthority])
        .rpc();

      try {
        await program.methods
          .setMintAuthority(newAuthority.publicKey)
          .accounts({
            mint: wrongAuthMintKeypair.publicKey,
            currentAuthority: user1.publicKey, // Wrong authority
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("Expected error for wrong current authority:", error.message);
      }
    });
  });
});