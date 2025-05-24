// Treasury Wallet Setup Script
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');

console.log('🏦 SolWars Treasury Wallet Setup');
console.log('================================\n');

// Generate a new keypair for the treasury
const treasuryKeypair = Keypair.generate();

// Get the public key (wallet address)
const publicKey = treasuryKeypair.publicKey.toString();

// Get the private key in base58 format
const privateKeyBase58 = bs58.encode(treasuryKeypair.secretKey);

console.log('✅ Treasury wallet generated successfully!\n');
console.log('📋 Treasury Wallet Details:');
console.log('============================');
console.log(`Public Key (Address): ${publicKey}`);
console.log(`Private Key (Base58): ${privateKeyBase58}\n`);

console.log('🔧 Setup Instructions:');
console.log('======================');
console.log('1. Add this to your .env file:');
console.log(`   TREASURY_PRIVATE_KEY="${privateKeyBase58}"`);
console.log(`   HELIUS_RPC_URL="https://rpc.helius.xyz/?api-key=your-helius-api-key"`);
console.log(`   SWARS_TOKEN_MINT="your-swars-token-mint-address"\n`);

console.log('2. Fund the treasury wallet:');
console.log(`   - Send SOL to: ${publicKey}`);
console.log('   - Recommended: 1-5 SOL for tournament prizes');
console.log('   - Send SWARS tokens to the treasury for token prizes\n');

console.log('3. Create/Configure SWARS Token:');
console.log('   - Create SPL token with: spl-token create-token');
console.log('   - Create token account: spl-token create-account <mint-address>');
console.log('   - Mint tokens to treasury: spl-token mint <mint-address> <amount> <treasury-token-account>');
console.log('   - Add mint address to SWARS_TOKEN_MINT in .env\n');

console.log('4. Get a Helius API key:');
console.log('   - Visit: https://helius.xyz/');
console.log('   - Create account and get API key');
console.log('   - Replace "your-helius-api-key" in HELIUS_RPC_URL\n');

console.log('⚠️  SECURITY WARNING:');
console.log('====================');
console.log('- Keep the private key SECRET and secure');
console.log('- Never commit the .env file to version control');
console.log('- Consider using a hardware wallet for production');
console.log('- This wallet will hold tournament prize funds\n');

// Save to a file for backup
const backupData = {
  publicKey,
  privateKeyBase58,
  timestamp: new Date().toISOString(),
  note: 'SolWars Tournament Treasury Wallet - Keep this secure!'
};

fs.writeFileSync('treasury-backup.json', JSON.stringify(backupData, null, 2));
console.log('💾 Backup saved to: treasury-backup.json');
console.log('   (Keep this file secure and private!)\n');

console.log('🚀 Ready to process real SOL and SWARS token prize distributions!');
console.log('   Once configured, winners will receive actual SOL and SWARS tokens to their wallets.');
