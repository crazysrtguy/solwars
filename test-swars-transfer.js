// Test SWARS Token Transfer
require('dotenv').config();
const SolTransferService = require('./services/solTransferService');

async function testSwarsTransfer() {
  console.log('🧪 Testing SWARS Token Transfer Service');
  console.log('======================================\n');

  const solTransferService = new SolTransferService();

  // Test treasury balance check
  console.log('📊 Checking treasury balance...');
  const balance = await solTransferService.getTreasuryBalance();
  console.log('Treasury Balance:', balance);

  // Test if we can send prizes
  console.log('\n🔍 Checking if we can send prizes...');
  const canSendSol = await solTransferService.canSendPrize(0.001);
  console.log('Can send SOL:', canSendSol);

  // Test configuration
  console.log('\n⚙️ Configuration Status:');
  console.log('Treasury configured:', !!solTransferService.treasuryKeypair);
  console.log('SWARS mint configured:', !!solTransferService.swarsTokenMint);

  if (solTransferService.swarsTokenMint) {
    console.log('SWARS mint address:', solTransferService.swarsTokenMint.toString());
  }

  console.log('\n📋 Next Steps:');
  console.log('==============');

  if (!solTransferService.treasuryKeypair) {
    console.log('❌ Treasury wallet not configured');
    console.log('   Run: node setup-treasury.js');
    console.log('   Then add TREASURY_PRIVATE_KEY to .env');
  } else {
    console.log('✅ Treasury wallet configured');
  }

  if (!solTransferService.swarsTokenMint) {
    console.log('❌ SWARS token mint not configured');
    console.log('   Create SPL token and add SWARS_TOKEN_MINT to .env');
  } else {
    console.log('✅ SWARS token mint configured');
  }

  if (process.env.HELIUS_RPC_URL && process.env.HELIUS_RPC_URL.includes('your-helius-api-key')) {
    console.log('❌ Helius API key not configured');
    console.log('   Get API key from https://helius.xyz/');
    console.log('   Update HELIUS_RPC_URL in .env');
  } else if (process.env.HELIUS_RPC_URL) {
    console.log('✅ Helius RPC configured');
  } else {
    console.log('⚠️ Helius RPC not configured (using default)');
  }

  console.log('\n🚀 When fully configured, the system will:');
  console.log('   - Send real SOL from treasury to winners');
  console.log('   - Send real SWARS tokens from treasury to winners');
  console.log('   - Record all transactions on Solana blockchain');
  console.log('   - Provide transaction hashes for verification');
}

testSwarsTransfer().catch(console.error);
