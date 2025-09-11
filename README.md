# SPL-Token-Mint
An SPL token minting platform built with Rust and the Anchor framework on the Solana blockchain. This smart contract enables the creation, minting, transfer, burning, and management of SPL tokens, with robust error handling and integration with the Solana Program Library (SPL) token standards.
Table of Contents

Overview
Features
Prerequisites
Installation
Usage
Testing
Project Structure
Error Handling
Contributing
License

Overview
The SPL Token Mint program is a Solana smart contract developed using the Anchor framework (v0.31.1). It provides a secure and efficient way to manage SPL tokens, including initializing mints, minting tokens, transferring tokens, burning tokens, and managing mint authorities. The program is deployed on the Solana blockchain with the program ID: GV5hMeyznNNy3dvjGfGgaMHqczjCdjTdRAv9K24yJHBC.
The contract is organized into modular instruction files for better maintainability and includes a comprehensive test suite using TypeScript, Mocha, and Chai to ensure functionality and reliability. This project is hosted on GitHub at Web3ProdigyDev/SPL-Token-Mint.
Features

Initialize Mint: Create a new SPL token mint with customizable decimals (0-9) and optional freeze authority.
Mint Tokens: Mint tokens to a specified associated token account, with checks for supply overflow.
Transfer Tokens: Transfer tokens between accounts, ensuring sufficient balance, valid ownership, and mint consistency.
Burn Tokens: Burn tokens from an account to reduce the total supply, with validation for sufficient balance.
Set Mint Authority: Update or revoke the mint authority for a token mint.
Get Mint Info: Retrieve mint details, including supply, decimals, mint authority, and freeze authority.
Error Handling: Comprehensive error codes for invalid operations, such as insufficient funds, unauthorized actions, or mint mismatches.

Prerequisites
To develop, deploy, or test this project, ensure you have the following tools installed:

Rust (edition 2021)
Solana CLI (v1.18 or later)
Anchor Framework (v0.31.1)
Node.js (v16 or later) and npm
TypeScript (v5.7.3 or later)
Mocha (v9.0.3 or later) and ts-mocha (v10.0.0 or later)
Chai (v4.3.4 or later) for assertions
A Solana wallet with a keypair (e.g., ~/.config/solana/id.json)

Installation

Clone the Repository
git clone https://github.com/Web3ProdigyDev/SPL-Token-Mint.git
cd SPL-Token-Mint/spl-token-mint


Install Rust Dependencies
Install dependencies specified in Cargo.toml:
cargo build


Install JavaScript/TypeScript Dependencies
Install dependencies specified in package.json:
npm install

The package.json includes:

Dependencies:
@coral-xyz/anchor: v0.31.1
@solana/spl-token: v0.4.14


Dev Dependencies:
@types/bn.js: v5.1.0
@types/chai: v4.3.0
@types/mocha: v9.0.0
chai: v4.3.4
mocha: v9.0.3
prettier: v2.6.2
ts-mocha: v10.0.0
typescript: v5.7.3




Set Up Solana Localnet
Start a local Solana validator:
solana-test-validator


Configure Solana CLI
Set the Solana CLI to use the localnet cluster:
solana config set --url http://127.0.0.1:8899



Usage
Building and Deploying the Program

Build the Program
anchor build

The compiled program and keypair will be generated in the target/deploy/ directory (spl_token_mint.so and spl_token_mint-keypair.json).

Deploy to Localnet
Deploy the program to the localnet cluster using the deployment script in migrations/deploy.ts:
anchor deploy

The program will be deployed with the program ID: GV5hMeyznNNy3dvjGfGgaMHqczjCdjTdRAv9K24yJHBC.

Linting Code
Run code formatting checks using Prettier:
npm run lint

Fix formatting issues automatically:
npm run lint:fix


Interacting with the Program
Use the Anchor CLI or a client-side script (e.g., in TypeScript) to interact with the program. The tests/spl-token-mint.ts file provides examples of how to call the program's instructions.
Example: Initialize a Mint
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SplTokenMint } from "../target/types/spl_token_mint";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.SplTokenMint as Program<SplTokenMint>;

const mintKeypair = anchor.web3.Keypair.generate();
const mintAuthority = provider.wallet;

await program.methods
  .initializeMint(9, mintAuthority.publicKey, null)
  .accounts({
    mint: mintKeypair.publicKey,
    payer: mintAuthority.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
    tokenProgram: anchor.web3.TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  })
  .signers([mintKeypair])
  .rpc();

Additional examples for minting, transferring, burning, and managing authorities are available in tests/spl-token-mint.ts.


Testing
The project includes a comprehensive test suite in tests/spl-token-mint.ts, written in TypeScript and using Mocha and Chai for assertions. The tests cover all major functionalities and error cases.
To run the tests:

Ensure the Solana localnet is running (solana-test-validator).

Execute the test suite:
anchor test

The test command is defined in Anchor.toml as:
test = "npm run ts-mocha -- -p ./tsconfig.json --timeout 1000000 tests/**/*.ts"



Test Setup
The tests use predefined keypairs located in the test-keys/ directory (admin.json, mint.json, wallet1.json, wallet2.json, wallet3.json). If these files are missing, generate new keypairs:
solana-keygen new -o test-keys/<filename>.json

The test suite includes tests for:

Initializing a mint
Minting tokens to a user
Transferring tokens between accounts
Burning tokens
Revoking mint authority
Error cases (e.g., insufficient funds, invalid authority)
Multi-wallet transfers

Test Ledger
The test-ledger/ directory contains files for maintaining a local Solana validator state, including:

genesis.bin and genesis.tar.bz2 for the localnet genesis configuration
faucet-keypair.json, stake-account-keypair.json, and vote-account-keypair.json for validator setup
rocksdb/ for database storage
Snapshot files (snapshot-*.tar.zst) for ledger state

Project Structure
SPL-Token-Mint/
├── README.md                # Project documentation
├── package.json             # JavaScript/TypeScript dependencies
├── package-lock.json        # JavaScript dependency lock file
└── spl-token-mint/
    ├── Anchor.toml          # Anchor configuration
    ├── Cargo.toml           # Rust dependencies and build settings
    ├── Cargo.lock           # Rust dependency lock file
    ├── bin/
    │   ├── errors.rs        # Error definitions
    │   ├── instructions/    # Instruction implementations
    │   │   ├── burn.rs
    │   │   ├── get_mint_info.rs
    │   │   ├── initialize_mint.rs
    │   │   ├── mint_to.rs
    │   │   ├── set_authority.rs
    │   │   └── transfer.rs
    │   └── state.rs         # State definitions (e.g., MintInfo)
    ├── migrations/
    │   └── deploy.ts        # Deployment script
    ├── programs/
    │   └── spl-token-mint/
    │       ├── Cargo.toml   # Program-specific Cargo configuration
    │       ├── Xargo.toml   # Cross-compilation configuration
    │       └── src/        # Source code (merged into programs)
    ├── target/
    │   ├── deploy/         # Compiled program and keypair
    │   │   ├── spl_token_mint-keypair.json
    │   │   └── spl_token_mint.so
    │   ├── idl/            # Interface Definition Language (IDL) file
    │   │   └── spl_token_mint.json
    │   └── types/          # Generated TypeScript types
    │       └── spl_token_mint.ts
    ├── test-keys/          # Test keypairs
    │   ├── admin.json
    │   ├── mint.json
    │   ├── wallet1.json
    │   ├── wallet2.json
    │   └── wallet3.json
    ├── test-ledger/        # Localnet validator state
    │   ├── genesis.bin
    │   ├── rocksdb/
    │   └── snapshot/
    ├── tests/
    │   └── spl-token-mint.ts # Test suite
    └── tsconfig.json        # TypeScript configuration

Error Handling
The program defines a set of error codes in bin/errors.rs to handle various failure cases, including:

InvalidAmount: Amount must be greater than 0.
InsufficientFunds: Source account lacks sufficient tokens.
InvalidOwner: Authority does not own the source account.
MintMismatch: Source and destination accounts have different mints.
SupplyOverflow: Minting would exceed maximum supply.
Unauthorized: Caller is not the mint authority.
InvalidDecimals: Decimals must be between 0 and 9.
And more (see bin/errors.rs for the full list).

These errors ensure robust validation and clear feedback for invalid operations.
Contributing
Contributions are welcome! To contribute:

Fork the repository at Web3ProdigyDev/SPL-Token-Mint.

Create a new branch (git checkout -b feature/your-feature).

Make your changes and commit (git commit -m "Add your feature").

Run linting to ensure code style compliance:
npm run lint:fix


Push to the branch (git push origin feature/your-feature).

Open a pull request on GitHub.


Please ensure your code follows Rust and Anchor best practices, includes tests for new functionality, and adheres to the existing code structure (e.g., modular instructions in bin/instructions/).
License
This project is licensed under the ISC License, as specified in package.json. See the LICENSE file for details.