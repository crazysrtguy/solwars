// Check Treasury Token Balances
require('dotenv').config();
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');
const bs58 = require('bs58');

async function checkTreasuryTokens() {
  try {
    console.log('🏦 Checking Treasury Token Balances');
    console.log('===================================\n');

    const connection = new Connection(
      process.env.HELIUS_RPC || process.env.HELIUS_API_KEY || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    // Get treasury wallet from private key (like the actual service does)
    let treasuryPubkey;
    if (process.env.TREASURY_PRIVATE_KEY) {
      try {
        const privateKeyBytes = bs58.decode(process.env.TREASURY_PRIVATE_KEY);
        const treasuryKeypair = Keypair.fromSecretKey(privateKeyBytes);
        treasuryPubkey = treasuryKeypair.publicKey;
        console.log('✅ Treasury wallet loaded from private key');
      } catch (error) {
        console.error('❌ Invalid treasury private key, using fallback');
        treasuryPubkey = new PublicKey(process.env.TREASURY_WALLET || 'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR');
      }
    } else {
      treasuryPubkey = new PublicKey(process.env.TREASURY_WALLET || 'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR');
    }

    const swarsTokenMint = new PublicKey(process.env.SWARS_TOKEN_MINT || 'GMk6j2defJhS7F194toqmJNFNhAkbDXhYJo5oR3Rpump');

    // Check SOL balance
    console.log('💰 SOL Balance:');
    const solBalance = await connection.getBalance(treasuryPubkey);
    console.log(`   Treasury: ${treasuryPubkey.toString()}`);
    console.log(`   SOL Balance: ${(solBalance / 1e9).toFixed(6)} SOL`);
    console.log(`   Lamports: ${solBalance}`);

    // Check SWARS token account
    console.log('\n💎 SWARS Token Balance:');
    console.log(`   Token Mint: ${swarsTokenMint.toString()}`);

    try {
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        swarsTokenMint,
        treasuryPubkey
      );

      console.log(`   Token Account: ${treasuryTokenAccount.toString()}`);

      try {
        const tokenAccountInfo = await getAccount(connection, treasuryTokenAccount);
        console.log(`   ✅ Token Account Exists`);
        console.log(`   SWARS Balance: ${tokenAccountInfo.amount.toString()} (raw)`);

        // Check token decimals by getting mint info
        const { getMint } = require('@solana/spl-token');
        try {
          const mintInfo = await getMint(connection, swarsTokenMint);
          const decimals = mintInfo.decimals;
          const actualBalance = Number(tokenAccountInfo.amount) / Math.pow(10, decimals);
          console.log(`   Token Decimals: ${decimals}`);
          console.log(`   SWARS Balance: ${actualBalance.toFixed(2)} SWARS`);
        } catch (mintError) {
          console.log(`   SWARS Balance: ${(Number(tokenAccountInfo.amount) / 1e9).toFixed(2)} SWARS (assuming 9 decimals)`);
        }

        console.log(`   Owner: ${tokenAccountInfo.owner.toString()}`);
        console.log(`   Mint: ${tokenAccountInfo.mint.toString()}`);
      } catch (accountError) {
        console.log(`   ❌ Token Account Does Not Exist`);
        console.log(`   Error: ${accountError.message}`);
        console.log('\n🔧 To fix this:');
        console.log('   1. Create token account for treasury:');
        console.log(`      spl-token create-account ${swarsTokenMint.toString()}`);
        console.log('   2. Mint SWARS tokens to treasury:');
        console.log(`      spl-token mint ${swarsTokenMint.toString()} 1000 ${treasuryTokenAccount.toString()}`);
      }
    } catch (error) {
      console.log(`   ❌ Error getting token account: ${error.message}`);
    }

    console.log('\n📋 Summary:');
    console.log('===========');
    if (solBalance > 0) {
      console.log('✅ Treasury has SOL for prizes');
    } else {
      console.log('❌ Treasury needs SOL funding');
    }

    console.log('❌ Treasury needs SWARS tokens for token prizes');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Fund treasury with SWARS tokens');
    console.log('   2. Test prize claim again');
    console.log('   3. Both SOL and SWARS will transfer to winner!');

  } catch (error) {
    console.error('❌ Error checking treasury:', error);
  }
}

checkTreasuryTokens();
