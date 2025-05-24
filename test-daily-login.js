const { PrismaClient } = require('@prisma/client');
const SwarsTokenService = require('./services/swarsTokenService');
const SolTransferService = require('./services/solTransferService');
require('dotenv').config();

const prisma = new PrismaClient();

async function testWalletFlow(swarsService, testWallet, walletType) {
  console.log(`\n🔍 Testing ${walletType} Wallet: ${testWallet}\n`);

  console.log('📊 Getting login streak info for new user...');
  let streakInfo = await swarsService.getLoginStreakInfo(testWallet);
  console.log('📊 Streak info:', streakInfo);
  console.log('✅ Expected: canClaimToday = true, currentStreak = 0\n');

  console.log('🎁 Testing first daily bonus claim...');
  try {
    const claimResult = await swarsService.claimDailyBonus(testWallet);
    console.log('🎁 Claim result:', claimResult);
    console.log('✅ Expected: amount = 5, currentStreak = 1\n');
  } catch (error) {
    console.log('❌ Claim failed:', error.message);
    return; // Exit early if claim fails
  }

  console.log('🚫 Testing duplicate claim prevention...');
  try {
    const duplicateResult = await swarsService.claimDailyBonus(testWallet);
    console.log('❌ Unexpected success:', duplicateResult);
  } catch (error) {
    console.log('✅ Expected error:', error.message);
  }

  console.log('\n📊 Testing login streak info after claim...');
  streakInfo = await swarsService.getLoginStreakInfo(testWallet);
  console.log('📊 Updated streak info:', streakInfo);
  console.log('✅ Expected: canClaimToday = false, currentStreak = 1\n');

  console.log('💰 Checking user balance...');
  const balance = await swarsService.getUserBalance(testWallet);
  console.log('💰 User balance:', balance);
  console.log('✅ Expected: balance = 5\n');

  console.log('🗄️ Checking database records...');

  // Check user record
  const user = await prisma.user.findUnique({
    where: { walletAddress: testWallet }
  });
  console.log('👤 User record:', user ? 'Found' : 'Not found');
  if (user) {
    console.log('   - Balance:', user.swarsTokenBalance);
  }

  // Check login streak record
  const loginStreak = await prisma.loginStreak.findUnique({
    where: { walletAddress: testWallet }
  });
  console.log('🔥 Login streak record:', loginStreak ? 'Found' : 'Not found');
  if (loginStreak) {
    console.log('   - Current streak:', loginStreak.currentStreak);
    console.log('   - Longest streak:', loginStreak.longestStreak);
    console.log('   - Total logins:', loginStreak.totalLogins);
    console.log('   - Last login:', loginStreak.lastLoginDate);
    console.log('   - Last claim:', loginStreak.lastClaimDate);
  }

  // Check transaction record
  const transactions = await prisma.swarsTransaction.findMany({
    where: { walletAddress: testWallet },
    orderBy: { timestamp: 'desc' }
  });
  console.log('💳 Transaction records:', transactions.length);
  transactions.forEach((tx, index) => {
    console.log(`   ${index + 1}. ${tx.type}: ${tx.amount} SWARS - ${tx.description}`);
    console.log(`      Timestamp: ${tx.timestamp}`);
    console.log(`      TX Signature: ${tx.txSignature || 'None'}`);
  });
}

async function testDailyLogin() {
  console.log('🧪 Testing Daily Login System...\n');

  // Test wallet addresses - both invalid and valid
  const testWalletInvalid = 'TestWallet123456789';
  const testWalletValid = 'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR'; // Treasury wallet for testing

  try {
    // Initialize services
    const solTransferService = new SolTransferService();
    const swarsService = new SwarsTokenService(solTransferService);

    // Test with invalid wallet address first
    console.log('1️⃣ Testing with invalid wallet address (database only)...');
    await testWalletFlow(swarsService, testWalletInvalid, 'Invalid');

    console.log('\n' + '='.repeat(60) + '\n');

    // Test with valid wallet address
    console.log('2️⃣ Testing with valid wallet address (blockchain + database)...');
    await testWalletFlow(swarsService, testWalletValid, 'Valid');

    console.log('\n✅ Daily login system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Cleanup function to remove test data
async function cleanup() {
  const testWallets = [
    'TestWallet123456789',
    'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR'
  ];

  console.log('\n🧹 Cleaning up test data...');

  try {
    for (const testWallet of testWallets) {
      console.log(`🧹 Cleaning data for ${testWallet}...`);

      // Delete transactions
      await prisma.swarsTransaction.deleteMany({
        where: { walletAddress: testWallet }
      });

      // Delete login streak
      await prisma.loginStreak.deleteMany({
        where: { walletAddress: testWallet }
      });

      // Delete user
      await prisma.user.deleteMany({
        where: { walletAddress: testWallet }
      });
    }

    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--cleanup')) {
    cleanup();
  } else {
    testDailyLogin();
  }
}

module.exports = { testDailyLogin, cleanup };
