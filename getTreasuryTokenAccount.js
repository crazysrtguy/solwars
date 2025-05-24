// Get Treasury Token Account Address
require('dotenv').config();
const { PublicKey, Keypair } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const bs58 = require('bs58');

async function getTreasuryTokenAccount() {
  try {
    console.log('🏦 Getting Treasury Token Account Address');
    console.log('========================================\n');

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

    console.log(`🎯 Treasury Wallet: ${treasuryPubkey.toString()}`);
    console.log(`💎 SWARS Token Mint: ${swarsTokenMint.toString()}\n`);

    // Get the Associated Token Account address
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      swarsTokenMint,
      treasuryPubkey
    );

    console.log('📋 Treasury Token Account Details:');
    console.log('==================================');
    console.log(`Associated Token Account: ${treasuryTokenAccount.toString()}\n`);

    console.log('🔧 Transfer Your SWARS Tokens:');
    console.log('==============================');
    console.log('Use this command to transfer your 600 SWARS tokens to the treasury:');
    console.log('');
    console.log(`spl-token transfer ${swarsTokenMint.toString()} 600 ${treasuryTokenAccount.toString()}`);
    console.log('');
    console.log('Or if you need to specify your source account:');
    console.log(`spl-token transfer ${swarsTokenMint.toString()} 600 ${treasuryTokenAccount.toString()} --from <your-token-account>`);
    console.log('');
    console.log('🎯 After transfer, the treasury will have 600 SWARS tokens ready for prize distribution!');

  } catch (error) {
    console.error('❌ Error getting token account:', error);
  }
}

getTreasuryTokenAccount();
