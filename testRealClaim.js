// Test Real Prize Claiming with SOL and SWARS Token Transfers
require('dotenv').config();

async function testRealPrizeClaim() {
  try {
    console.log('🧪 Testing Real Prize Claim with Blockchain Transfers');
    console.log('====================================================\n');

    const walletAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3s4M3fRHQY';
    const tournamentId = '5977beb0-40ce-4e1b-b641-ae2b920f6b3b';

    console.log(`🎯 Testing claim for:`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Tournament: ${tournamentId}`);
    console.log(`   Expected: 0.001 SOL + 10 SWARS tokens\n`);

    console.log('📡 Making API call to claim prize...');

    const response = await fetch('http://localhost:3000/api/prizes/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress,
        tournamentId
      })
    });

    console.log(`📊 Response Status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API Error:', error);
      return;
    }

    const result = await response.json();
    console.log('\n🎉 Prize Claim Result:');
    console.log('=====================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`💰 SOL Prize: ${result.solPrize} SOL`);
    console.log(`💎 SWARS Prize: ${result.swarsPrize} SWARS`);
    console.log(`🏆 Rank: ${result.rank}`);
    console.log(`🎮 Tournament: ${result.tournamentName}`);
    
    if (result.transactionHashes && result.transactionHashes.length > 0) {
      console.log('\n🔗 Blockchain Transactions:');
      result.transactionHashes.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.type}: ${tx.signature}`);
        console.log(`      Amount: ${tx.amount} ${tx.type}`);
        console.log(`      Recipient: ${tx.recipient}`);
      });
    }

    console.log(`\n⏰ Claimed At: ${result.claimedAt}`);

    console.log('\n🔍 Verification Steps:');
    console.log('======================');
    console.log('1. Check your wallet for received SOL');
    console.log('2. Check your wallet for received SWARS tokens');
    console.log('3. Verify transactions on Solana Explorer:');
    
    if (result.transactionHashes) {
      result.transactionHashes.forEach(tx => {
        console.log(`   https://explorer.solana.com/tx/${tx.signature}`);
      });
    }

    console.log('\n🎯 Test Complete!');
    console.log('Real SOL and SWARS tokens should now be in your wallet.');

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error('Full error:', error);
  }
}

testRealPrizeClaim();
