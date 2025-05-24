// SOL and SWARS Token Transfer Service for Prize Distribution
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getMint
} = require('@solana/spl-token');
const bs58 = require('bs58');

class SolTransferService {
  constructor() {
    // Use Helius RPC for better reliability
    this.connection = new Connection(
      process.env.HELIUS_RPC || process.env.HELIUS_API_KEY || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    // Treasury wallet private key (base58 encoded)
    this.treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY;
    this.treasuryKeypair = null;

    // SWARS token configuration
    this.swarsTokenMint = process.env.SWARS_TOKEN_MINT ? new PublicKey(process.env.SWARS_TOKEN_MINT) : null;
    this.swarsDecimals = null; // Will be fetched dynamically from mint

    if (this.treasuryPrivateKey) {
      try {
        const privateKeyBytes = bs58.decode(this.treasuryPrivateKey);
        this.treasuryKeypair = Keypair.fromSecretKey(privateKeyBytes);
        console.log('🏦 Treasury wallet loaded:', this.treasuryKeypair.publicKey.toString());

        if (this.swarsTokenMint) {
          console.log('💎 SWARS token mint configured:', this.swarsTokenMint.toString());
        } else {
          console.log('⚠️ SWARS token mint not configured - token transfers disabled');
        }
      } catch (error) {
        console.error('❌ Invalid treasury private key');
      }
    } else {
      console.log('⚠️ No treasury private key configured - transfers disabled');
    }
  }

  // Send SOL prize to winner
  async sendSolPrize(recipientAddress, solAmount) {
    try {
      if (!this.treasuryKeypair) {
        throw new Error('Treasury wallet not configured');
      }

      console.log(`💰 Sending ${solAmount} SOL to ${recipientAddress}`);

      const toPubkey = new PublicKey(recipientAddress);
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: this.treasuryKeypair.publicKey,
        toPubkey,
        lamports
      });

      // Create and sign transaction
      const transaction = new Transaction().add(transferInstruction);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.treasuryKeypair.publicKey;

      // Sign transaction
      transaction.sign(this.treasuryKeypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize());

      // Wait for confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight
      });

      console.log(`✅ SOL prize sent successfully: ${signature}`);

      return {
        success: true,
        signature,
        amount: solAmount,
        recipient: recipientAddress,
        type: 'SOL',
        lamports
      };

    } catch (error) {
      console.error('❌ Error sending SOL prize:', error);
      throw error;
    }
  }

  // Get SWARS token decimals from mint
  async getSwarsDecimals() {
    try {
      if (this.swarsDecimals !== null) {
        return this.swarsDecimals;
      }

      if (!this.swarsTokenMint) {
        throw new Error('SWARS token mint not configured');
      }

      const mintInfo = await getMint(this.connection, this.swarsTokenMint);
      this.swarsDecimals = mintInfo.decimals;
      console.log(`💎 SWARS token decimals: ${this.swarsDecimals}`);
      return this.swarsDecimals;
    } catch (error) {
      console.error('❌ Error getting SWARS decimals:', error);
      // Fallback to 6 decimals (common for many tokens)
      this.swarsDecimals = 6;
      return this.swarsDecimals;
    }
  }

  // Send SWARS token prize to winner
  async sendSwarsPrize(recipientAddress, swarsAmount) {
    try {
      if (!this.treasuryKeypair) {
        throw new Error('Treasury wallet not configured');
      }

      if (!this.swarsTokenMint) {
        throw new Error('SWARS token mint not configured');
      }

      console.log(`💎 Sending ${swarsAmount} SWARS tokens to ${recipientAddress}`);

      // Get correct decimals
      const decimals = await this.getSwarsDecimals();
      const recipientPubkey = new PublicKey(recipientAddress);
      const tokenAmount = Math.floor(swarsAmount * Math.pow(10, decimals));

      console.log(`💎 Token amount calculation: ${swarsAmount} * 10^${decimals} = ${tokenAmount}`);

      // Get treasury token account
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        this.swarsTokenMint,
        this.treasuryKeypair.publicKey
      );

      // Get recipient token account
      const recipientTokenAccount = await getAssociatedTokenAddress(
        this.swarsTokenMint,
        recipientPubkey
      );

      const transaction = new Transaction();

      // Check if recipient token account exists
      try {
        await getAccount(this.connection, recipientTokenAccount);
        console.log('✅ Recipient token account exists');
      } catch (error) {
        // Create associated token account if it doesn't exist
        console.log('🔧 Creating recipient token account...');
        const createAccountInstruction = createAssociatedTokenAccountInstruction(
          this.treasuryKeypair.publicKey, // payer
          recipientTokenAccount,
          recipientPubkey,
          this.swarsTokenMint
        );
        transaction.add(createAccountInstruction);
      }

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        treasuryTokenAccount,
        recipientTokenAccount,
        this.treasuryKeypair.publicKey,
        tokenAmount
      );

      transaction.add(transferInstruction);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.treasuryKeypair.publicKey;

      // Sign transaction
      transaction.sign(this.treasuryKeypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize());

      // Wait for confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight
      });

      console.log(`✅ SWARS tokens sent successfully: ${signature}`);

      return {
        success: true,
        signature,
        amount: swarsAmount,
        recipient: recipientAddress,
        type: 'SWARS',
        tokenAmount
      };

    } catch (error) {
      console.error('❌ Error sending SWARS tokens:', error);
      throw error;
    }
  }

  // Send combined SOL and SWARS prize
  async sendCombinedPrize(recipientAddress, solAmount, swarsAmount) {
    try {
      const results = [];

      // Send SOL if amount > 0
      if (solAmount > 0) {
        const solResult = await this.sendSolPrize(recipientAddress, solAmount);
        results.push(solResult);
      }

      // Send SWARS if amount > 0
      if (swarsAmount > 0) {
        const swarsResult = await this.sendSwarsPrize(recipientAddress, swarsAmount);
        results.push(swarsResult);
      }

      return {
        success: true,
        transfers: results,
        totalSol: solAmount,
        totalSwars: swarsAmount,
        recipient: recipientAddress
      };

    } catch (error) {
      console.error('❌ Error sending combined prize:', error);
      throw error;
    }
  }

  // Verify a SOL transaction on-chain
  async verifyTransaction(signature) {
    try {
      console.log(`🔍 Verifying transaction: ${signature}`);

      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.meta?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(transaction.meta.err)}`);
      }

      // Extract transfer details
      const preBalances = transaction.meta.preBalances;
      const postBalances = transaction.meta.postBalances;
      const accountKeys = transaction.transaction.message.accountKeys;

      let transferAmount = 0;
      let fromAddress = null;
      let toAddress = null;

      // Find the transfer amount by comparing balances
      for (let i = 0; i < preBalances.length; i++) {
        const balanceChange = postBalances[i] - preBalances[i];
        if (balanceChange > 0) {
          // This account received SOL
          toAddress = accountKeys[i].toString();
          transferAmount = balanceChange / LAMPORTS_PER_SOL;
        } else if (balanceChange < 0) {
          // This account sent SOL (excluding fees)
          fromAddress = accountKeys[i].toString();
        }
      }

      return {
        verified: true,
        signature,
        fromAddress,
        toAddress,
        amount: transferAmount,
        blockTime: transaction.blockTime,
        slot: transaction.slot
      };

    } catch (error) {
      console.error('❌ Error verifying transaction:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }

  // Get treasury wallet balance
  async getTreasuryBalance() {
    try {
      if (!this.treasuryKeypair) {
        return { balance: 0, error: 'Treasury wallet not configured' };
      }

      const balance = await this.connection.getBalance(this.treasuryKeypair.publicKey);

      return {
        balance: balance / LAMPORTS_PER_SOL,
        lamports: balance,
        address: this.treasuryKeypair.publicKey.toString()
      };

    } catch (error) {
      console.error('❌ Error getting treasury balance:', error);
      return {
        balance: 0,
        error: error.message
      };
    }
  }

  // Check if treasury is configured and has sufficient balance
  async canSendPrize(solAmount) {
    try {
      if (!this.treasuryKeypair) {
        return { canSend: false, reason: 'Treasury wallet not configured' };
      }

      const balanceInfo = await this.getTreasuryBalance();
      if (balanceInfo.error) {
        return { canSend: false, reason: balanceInfo.error };
      }

      const requiredAmount = solAmount + 0.001; // Add fee buffer
      if (balanceInfo.balance < requiredAmount) {
        return {
          canSend: false,
          reason: `Insufficient treasury balance. Required: ${requiredAmount} SOL, Available: ${balanceInfo.balance} SOL`
        };
      }

      return { canSend: true, treasuryBalance: balanceInfo.balance };

    } catch (error) {
      return { canSend: false, reason: error.message };
    }
  }
}

module.exports = SolTransferService;
