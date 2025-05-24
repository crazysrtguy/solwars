// Test Single SWARS Token Transfer
require('dotenv').config();
const SolTransferService = require('./services/solTransferService');

async function testSingleSwarsTransfer() {
  try {
    console.log('🧪 Testing Single SWARS Token Transfer');
    console.log('=====================================\n');

    const solTransferService = new SolTransferService();
    const recipientAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3vMK3s4M3fRHQY';
    const swarsAmount = 10;

    console.log(`🎯 Test Parameters:`);
    console.log(`   Recipient: ${recipientAddress}`);
    console.log(`   Amount: ${swarsAmount} SWARS tokens`);
    console.log(`   Treasury: ${solTransferService.treasuryKeypair?.publicKey.toString()}`);
    console.log(`   SWARS Mint: ${solTransferService.swarsTokenMint?.toString()}\n`);

    console.log('🔍 Checking treasury balance...');
    const balance = await solTransferService.getTreasuryBalance();
    console.log(`Treasury SOL: ${balance.balance} SOL\n`);

    console.log('💎 Attempting SWARS token transfer...');
    
    const result = await solTransferService.sendSwarsPrize(recipientAddress, swarsAmount);
    
    console.log('\n🎉 SWARS Transfer Successful!');
    console.log('============================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`💎 Amount: ${result.amount} SWARS`);
    console.log(`🎯 Recipient: ${result.recipient}`);
    console.log(`🔗 Transaction: ${result.signature}`);
    console.log(`📊 Token Amount (raw): ${result.tokenAmount}`);
    
    console.log('\n🔍 Verification:');
    console.log(`   View on Solana Explorer: https://explorer.solana.com/tx/${result.signature}`);
    console.log('   Check your wallet for received SWARS tokens!');

  } catch (error) {
    console.error('\n❌ SWARS Transfer Failed:');
    console.error('=========================');
    console.error(`Error: ${error.message}`);
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n🔧 Treasury Token Account Issues:');
      console.log('   - Treasury wallet needs SWARS tokens in its token account');
      console.log('   - Make sure tokens are in the Associated Token Account');
      console.log('   - Check if token account exists and has sufficient balance');
    }
    
    if (error.message.includes('Invalid public key')) {
      console.log('\n🔧 Address Issues:');
      console.log('   - Check wallet address format');
      console.log('   - Ensure SWARS token mint address is correct');
    }
    
    console.log('\n📋 Debug Info:');
    console.log(`   Treasury configured: ${!!solTransferService.treasuryKeypair}`);
    console.log(`   SWARS mint configured: ${!!solTransferService.swarsTokenMint}`);
  }
}

testSingleSwarsTransfer();
